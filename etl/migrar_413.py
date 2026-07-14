#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LukeAPP v4 — Script de Migración ETL del Piloto Andina (EIMI00413)
Carga de datos históricos v1 (Excel) a la base de datos Supabase en lukeserver.
Garantiza idempotencia, reporte detallado de conciliación, y subida de evidencias.
"""

import os
import sys
import argparse
import hashlib
import mimetypes
import uuid
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv
import requests
from collections import defaultdict

# Cargar variables de entorno
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
ETL_SOURCE_PATH = os.getenv("ETL_SOURCE_PATH")
SUPABASE_URL = os.getenv("SUPABASE_URL") or "https://api.lukeapp.cl"
# Clave del backend obtenida de la config de lukeserver
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiaWF0IjoxNzM5NzI5MjcyLCJleHAiOjIwNTUwODkyNzJ9.OEpjObm93DhWMupkDmBQt-9YqrbD18Go_tsPnLCxtUc"

# Libros de Excel mapeados por clave
EXCEL_BOOKS = {
    "CAT": "1_Tablas_MS/CAT/CAT_Piping_MS.xlsx",
    "DOC": "1_Tablas_MS/DOC/DOC_Piping_MS.xlsx",
    "LIST_MEC": "1_Tablas_MS/LIST/LIST_Mecanica_MS.xlsx",
    "LIST_PIP": "1_Tablas_MS/LIST/LIST_Piping_MS.xlsx",
    "LOG": "1_Tablas_MS/LOG/LOG_Piping_MS.xlsx",
    "REG": "1_Tablas_MS/REG/REG_Piping_MS.xlsx",
    "REL": "1_Tablas_MS/REL/REL_Piping_MS.xlsx",
    "UX": "0_UX/LIST_uxApp_MS.xlsx"
}

# Estructura global para conciliación
conciliacion_stats = {}

def get_db_connection():
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL no configurada en las variables de entorno.")
    return psycopg2.connect(DATABASE_URL)

def clean_dataframe(df):
    """
    Sanea el dataframe eliminando columnas residuales e inconsistentes.
    """
    # Renombrar columnas removiendo espacios en blanco
    df.columns = [str(c).strip() for c in df.columns]
    
    # Descartar columnas vacías o residuales
    cols_to_keep = [c for c in df.columns if not c.startswith("Unnamed") and not c.startswith("Column") and c != '']
    df = df[cols_to_keep]
    
    # Trim en valores de texto
    for col in df.select_dtypes(include=['object']):
        df[col] = df[col].astype(str).str.strip()
        
    # Reemplazar representaciones de nulos
    df = df.replace({"nan": None, "NaN": None, "None": None, "": None})
    
    # Descartar filas vacías
    if len(df) > 0:
        first_col = df.columns[0]
        df = df[df[first_col].notna()]
        
    return df

def parse_date(date_val):
    if pd.isna(date_val) or date_val is None:
        return None
    if isinstance(date_val, pd.Timestamp):
        return date_val.to_pydatetime()
    date_str = str(date_val).strip()
    if date_str == '' or date_str.lower() in ['nan', 'none']:
        return None
        
    for fmt in ('%Y-%m-%d %H:%M:%S', '%d/%m/%Y %H:%M', '%d/%m/%Y', '%Y-%m-%d'):
        try:
            return pd.to_datetime(date_str, format=fmt, errors='raise')
        except (ValueError, TypeError):
            continue
            
    # Intentar parseo automático de pandas
    try:
        return pd.to_datetime(date_str, errors='ignore')
    except Exception:
        return None

def clean_numeric(val):
    if pd.isna(val) or val is None:
        return None
    val_str = str(val).strip().replace(" ", "")
    if val_str == '' or val_str.lower() in ['nan', 'none']:
        return None
    # Reemplazar coma por punto decimal
    val_str = val_str.replace(",", ".")
    try:
        return float(val_str)
    except ValueError:
        return None

def upload_to_supabase_storage(local_path, storage_path):
    """
    Sube archivos locales al bucket evidencias vía API REST de Supabase Storage.
    """
    if not os.path.exists(local_path):
        return False
        
    mime_type, _ = mimetypes.guess_type(local_path)
    if not mime_type:
        mime_type = "application/octet-stream"
        
    url = f"{SUPABASE_URL}/storage/v1/object/evidencias/{storage_path}"
    
    headers = {
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "apiKey": SUPABASE_SERVICE_ROLE_KEY,
        "Content-Type": mime_type
    }
    
    try:
        with open(local_path, "rb") as f:
            data = f.read()
        res = requests.post(url, headers=headers, data=data)
        if res.status_code in [200, 201]:
            return True
        elif res.status_code == 400 and "AlreadyExists" in res.text:
            return True
        else:
            print(f"[STORAGE] Error al subir {local_path} (Status {res.status_code}): {res.text}")
            return False
    except Exception as e:
        print(f"[STORAGE] Excepción al subir {local_path}: {e}")
        return False

def register_conciliacion(table_name, total_fuente, cargado=0, rechazados=None):
    if rechazados is None:
        rechazados = []
    conciliacion_stats[table_name] = {
        "fuente": total_fuente,
        "cargado": cargado,
        "rechazado": len(rechazados),
        "motivos": rechazados
    }

def print_conciliacion_report():
    print("\n" + "="*80)
    print("REPORTE DE CONCILIACIÓN DE MIGRACIÓN - PILOTO Andina EIMI00413")
    print("="*80)
    print(f"{'Tabla':<30} | {'Fuente':<10} | {'Cargado':<10} | {'Rechazado':<10} | {'Concilia?':<10}")
    print("-"*80)
    for t, stats in conciliacion_stats.items():
        concilia = "✓ OK" if stats["fuente"] == (stats["cargado"] + stats["rechazado"]) else "✗ ERROR"
        print(f"{t:<30} | {stats['fuente']:<10} | {stats['cargado']:<10} | {stats['rechazado']:<10} | {concilia:<10}")
    print("="*80)

def scan_evidencias_files(source_path):
    """
    Escanea recursivamente los subdirectorios Archivos/ para catalogar los archivos de evidencias.
    Retorna un diccionario: { hash_corto (primeros 8 caracteres): (full_local_path, nombre_archivo) }
    """
    evidencias_map = {}
    if not os.path.exists(source_path):
        return evidencias_map
        
    for root, dirs, files in os.walk(source_path):
        if "Archivos" in root or "1_Tablas_MS" in root:
            for file in files:
                name_parts = file.split('.')
                if len(name_parts) >= 2:
                    h_candidate = name_parts[0]
                    # Si tiene un hash de 8 caracteres
                    if len(h_candidate) == 8:
                        full_path = os.path.join(root, file)
                        evidencias_map[h_candidate] = (full_path, file)
    return evidencias_map

def run_migration(conn, dry_run=True):
    cur = conn.cursor()
    print(f"\n[START] Iniciando migración {'(DRY-RUN)' if dry_run else '(REAL)'}...")
    
    # 1. Asegurar entidades nucleo
    cur.execute("SELECT id FROM lukeapp.empresas WHERE rut = '76111222-3'")
    res = cur.fetchone()
    if not res:
        cur.execute(
            "INSERT INTO lukeapp.empresas (nombre, rut, tipo) VALUES ('Empresa Contratista', '76111222-3', 'contratista') RETURNING id"
        )
        emp_id = cur.fetchone()[0]
    else:
        emp_id = res[0]
        
    cur.execute("SELECT id FROM lukeapp.empresas WHERE rut = '88888888-8'")
    res = cur.fetchone()
    if not res:
        cur.execute(
            "INSERT INTO lukeapp.empresas (nombre, rut, tipo) VALUES ('CODELCO', '88888888-8', 'mandante') RETURNING id"
        )
        mandante_id = cur.fetchone()[0]
    else:
        mandante_id = res[0]
        
    # Asegurar Proyecto
    cur.execute("SELECT id FROM lukeapp.proyectos WHERE codigo = 'EIMI00413'")
    res = cur.fetchone()
    if not res:
        cur.execute(
            """
            INSERT INTO lukeapp.proyectos (codigo, nombre, mandante_id, industria, estado)
            VALUES ('EIMI00413', 'Espesador de Concentrado Colectivo PMFC - CODELCO - 2025', %s, 'mineria', 'activo')
            RETURNING id
            """,
            (mandante_id,)
        )
        proyecto_id = cur.fetchone()[0]
    else:
        proyecto_id = res[0]
        
    # Asegurar usuarios admin
    cur.execute("SELECT id FROM auth.users WHERE email = 'cristian@lukeapp.me'")
    u_admin = cur.fetchone()
    if not u_admin:
        u_admin_id = str(uuid.uuid4())
        cur.execute(
            "INSERT INTO auth.users (id, email) VALUES (%s, 'cristian@lukeapp.me')",
            (u_admin_id,)
        )
    else:
        u_admin_id = u_admin[0]
        
    # Actualizar nombre en lukeapp.usuarios (el perfil ya habrá sido creado por el trigger)
    cur.execute(
        "UPDATE lukeapp.usuarios SET nombre = 'Cristian Luke' WHERE id = %s",
        (u_admin_id,)
    )
        
    cur.execute(
        """
        INSERT INTO lukeapp.membresias (usuario_id, proyecto_id, rol, activo)
        VALUES (%s, %s, 'ADMIN', true)
        ON CONFLICT DO NOTHING
        """,
        (u_admin_id, proyecto_id)
    )

    # 2. Limpiar datos anteriores del proyecto para la transacción actual
    print(f"\n[CLEAN] Limpiando datos anteriores del proyecto ID {proyecto_id}...")
    tables_to_clean = [
        'evidencias', 'doc_revision_events', 'rel_sdi_iso', 'rel_pid_lineas',
        'reg_esp_elem', 'reg_inspeccion_visual', 'reg_dimensional_spool', 'reg_pintura_spool',
        'reg_montaje_valvulas', 'reg_montaje_soportes', 'reg_junta_adicional', 'reg_ejecucion_juntas',
        'log_sdi', 'log_iso', 'log_pid', 'log_materiales', 'log_spool',
        'list_bim', 'list_esp_elem', 'list_mec', 'list_mto', 'list_valvulas', 'list_soportes',
        'list_juntas', 'list_spools', 'list_isos', 'list_lineas', 'list_pid',
        'cat_personal', 'cat_tipo_union', 'cat_tipo_soporte', 'cat_tipo_prueba', 'cat_porcentaje_nde',
        'cat_esquema_pintura', 'cat_revestimiento_int', 'cat_aislacion_ext', 'cat_diametros_nps',
        'cat_clase_piping', 'cat_fluido_servicio', 'cat_iwp', 'cat_cwp', 'cat_cwa'
    ]
    for t in tables_to_clean:
        cur.execute(f"DELETE FROM lukeapp.{t} WHERE proyecto_id = %s", (proyecto_id,))
    if not dry_run:
        conn.commit()

    # Escanear archivos de evidencias locales
    print("[EVIDENCIAS] Escaneando subdirectorios de evidencias locales...")
    evidencias_map = scan_evidencias_files(ETL_SOURCE_PATH)
    print(f"[EVIDENCIAS] Se encontraron {len(evidencias_map)} archivos de evidencias locales en disco.")

    # Diccionario de búsqueda en memoria para FKs
    cache = defaultdict(dict)

    # Helper local para cargar Excel
    def load_sheet(book_key, sheet_name):
        rel_path = EXCEL_BOOKS.get(book_key)
        full_path = os.path.join(ETL_SOURCE_PATH, rel_path)
        if not os.path.exists(full_path):
            print(f"[X] No existe el libro: {full_path}")
            return pd.DataFrame()
        try:
            df = pd.read_excel(full_path, sheet_name=sheet_name, engine='openpyxl')
            return clean_dataframe(df)
        except Exception as e:
            print(f"[X] Error al cargar la hoja {sheet_name} de {book_key}: {e}")
            return pd.DataFrame()

    # Helper local para procesar y subir evidencias ligadas a un registro
    def handle_evidencia_rel(celda_val, dominio, tabla_nombre, registro_uuid):
        if not celda_val:
            return
        # La celda contiene la ruta o nombre de archivo
        filename = os.path.basename(str(celda_val).strip())
        parts = filename.split('.')
        if len(parts) < 2:
            return
        h_corto = parts[0]
        if len(h_corto) != 8:
            return
            
        file_info = evidencias_map.get(h_corto)
        if not file_info:
            return # No está físicamente
            
        full_local_path, original_name = file_info
        storage_path = f"{proyecto_id}/{dominio}/{tabla_nombre}/{original_name}"
        
        # Subir a storage si no es dry-run
        if not dry_run:
            success = upload_to_supabase_storage(full_local_path, storage_path)
            if not success:
                return
                
        # Calcular MD5 del archivo local
        try:
            with open(full_local_path, "rb") as f:
                md5_hash = hashlib.md5(f.read()).hexdigest()
        except Exception:
            md5_hash = h_corto # Fallback al hash corto del nombre
            
        # Determinar tipo
        tipo_ev = "FOTO"
        if "PDF" in original_name or original_name.endswith('.pdf'):
            if "ISO" in original_name:
                tipo_ev = "PDF_ISO"
            elif "PID" in original_name:
                tipo_ev = "PDF_PID"
            else:
                tipo_ev = "PDF"
                
        # Insertar registro de evidencia
        cur.execute(
            """
            INSERT INTO lukeapp.evidencias 
            (proyecto_id, entidad, registro_id, tipo, storage_path, hash, nombre_original, tamanio_bytes, mime_type, subida_pendiente)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, false)
            ON CONFLICT DO NOTHING
            """,
            (
                proyecto_id,
                tabla_nombre,
                registro_uuid,
                tipo_ev,
                storage_path,
                md5_hash,
                original_name,
                os.path.getsize(full_local_path) if os.path.exists(full_local_path) else 0,
                mimetypes.guess_type(full_local_path)[0] or "application/octet-stream"
            )
        )

    # =========================================================================
    # A. MIGRACIÓN DE CATÁLOGOS LOCALES (CAT)
    # =========================================================================
    print("\n--- Cargando Catálogos locales (CAT) ---")
    
    # 1. cat_fluido_servicio
    df = load_sheet("CAT", "CAT_FluidoServicio_MS")
    rechazados = []
    cargados = 0
    for _, row in df.iterrows():
        cod = row.get("CODIGO")
        if not cod:
            rechazados.append("Código nulo en fuente")
            continue
        cur.execute(
            """
            INSERT INTO lukeapp.cat_fluido_servicio (proyecto_id, codigo, descripcion)
            VALUES (%s, %s, %s) RETURNING id
            """,
            (proyecto_id, cod, row.get("DESCRIPCION"))
        )
        cache["cat_fluido_servicio"][cod] = cur.fetchone()[0]
        cargados += 1
    register_conciliacion("cat_fluido_servicio", len(df), cargados, rechazados)

    # 2. cat_clase_piping
    df = load_sheet("CAT", "CAT_ClasePiping_MS")
    rechazados = []
    cargados = 0
    for _, row in df.iterrows():
        cod = row.get("CODIGO")
        if not cod:
            rechazados.append("Código nulo")
            continue
        # Resolver fluido_id si viene
        fluido_cod = row.get("FLUIDO_SERVICIO")
        fluido_id = cache["cat_fluido_servicio"].get(fluido_cod)
        
        cur.execute(
            """
            INSERT INTO lukeapp.cat_clase_piping (proyecto_id, codigo, descripcion, fluido_id, temp_max, presion_max)
            VALUES (%s, %s, %s, %s, %s, %s) RETURNING id
            """,
            (proyecto_id, cod, row.get("DESCRIPCION"), fluido_id, clean_numeric(row.get("TEMP_MAX")), clean_numeric(row.get("PRESION_MAX")))
        )
        cache["cat_clase_piping"][cod] = cur.fetchone()[0]
        cargados += 1
    register_conciliacion("cat_clase_piping", len(df), cargados, rechazados)

    # 3. cat_diametros_nps
    df = load_sheet("CAT", "CAT_DiametrosNPS_MS")
    rechazados = []
    cargados = 0
    for _, row in df.iterrows():
        cod = row.get("CODIGO") or row.get("DIAMETRO_NPS")
        if not cod:
            rechazados.append("Código o NPS nulo")
            continue
        nps_val = str(cod).strip()
        cur.execute(
            """
            INSERT INTO lukeapp.cat_diametros_nps (proyecto_id, nps, diametro_mm, wdi_factor)
            VALUES (%s, %s, %s, %s) RETURNING id
            """,
            (proyecto_id, nps_val, clean_numeric(row.get("DIAMETRO_MM")), clean_numeric(row.get("WDI_FACTOR")))
        )
        cache["cat_diametros_nps"][nps_val] = cur.fetchone()[0]
        cargados += 1
    register_conciliacion("cat_diametros_nps", len(df), cargados, rechazados)

    # 4. cat_aislacion_ext
    df = load_sheet("CAT", "CAT_AislacionExt_MS")
    rechazados = []
    cargados = 0
    for _, row in df.iterrows():
        cod = row.get("CODIGO")
        if not cod:
            rechazados.append("Código nulo")
            continue
        cur.execute(
            "INSERT INTO lukeapp.cat_aislacion_ext (proyecto_id, codigo, descripcion) VALUES (%s, %s, %s) RETURNING id",
            (proyecto_id, cod, row.get("DESCRIPCION"))
        )
        cache["cat_aislacion_ext"][cod] = cur.fetchone()[0]
        cargados += 1
    register_conciliacion("cat_aislacion_ext", len(df), cargados, rechazados)

    # 5. cat_cwa
    df = load_sheet("CAT", "CAT_CWA_MS")
    rechazados = []
    cargados = 0
    for _, row in df.iterrows():
        cod = row.get("CODIGO")
        if not cod:
            rechazados.append("Código nulo")
            continue
        cur.execute(
            "INSERT INTO lukeapp.cat_cwa (proyecto_id, codigo, descripcion) VALUES (%s, %s, %s) RETURNING id",
            (proyecto_id, cod, row.get("DESCRIPCION"))
        )
        cache["cat_cwa"][cod] = cur.fetchone()[0]
        cargados += 1
    register_conciliacion("cat_cwa", len(df), cargados, rechazados)

    # 6. cat_cwp
    df = load_sheet("CAT", "CAT_CWP_MS")
    rechazados = []
    cargados = 0
    for _, row in df.iterrows():
        cod = row.get("CODIGO")
        if not cod:
            rechazados.append("Código nulo")
            continue
        # Resolver cwa_id
        cwa_cod = row.get("CWA_PADRE")
        cwa_id = cache["cat_cwa"].get(cwa_cod)
        cur.execute(
            "INSERT INTO lukeapp.cat_cwp (proyecto_id, codigo, descripcion, cwa_id) VALUES (%s, %s, %s, %s) RETURNING id",
            (proyecto_id, cod, row.get("DESCRIPCION"), cwa_id)
        )
        cache["cat_cwp"][cod] = cur.fetchone()[0]
        cargados += 1
    register_conciliacion("cat_cwp", len(df), cargados, rechazados)

    # 7. cat_iwp
    df = load_sheet("CAT", "CAT_IWP_MS")
    rechazados = []
    cargados = 0
    for _, row in df.iterrows():
        cod = row.get("CODIGO")
        if not cod:
            rechazados.append("Código nulo")
            continue
        cwp_cod = row.get("CWP_PADRE")
        cwp_id = cache["cat_cwp"].get(cwp_cod)
        cur.execute(
            "INSERT INTO lukeapp.cat_iwp (proyecto_id, codigo, descripcion, cwp_id) VALUES (%s, %s, %s, %s) RETURNING id",
            (proyecto_id, cod, row.get("DESCRIPCION"), cwp_id)
        )
        cache["cat_iwp"][cod] = cur.fetchone()[0]
        cargados += 1
    register_conciliacion("cat_iwp", len(df), cargados, rechazados)

    # 8. cat_esquema_pintura
    df = load_sheet("CAT", "CAT_EsquemaPintura_MS")
    rechazados = []
    cargados = 0
    for _, row in df.iterrows():
        cod = row.get("CODIGO")
        if not cod:
            rechazados.append("Código nulo")
            continue
        cur.execute(
            "INSERT INTO lukeapp.cat_esquema_pintura (proyecto_id, codigo, descripcion) VALUES (%s, %s, %s) RETURNING id",
            (proyecto_id, cod, row.get("DESCRIPCION"))
        )
        cache["cat_esquema_pintura"][cod] = cur.fetchone()[0]
        cargados += 1
    register_conciliacion("cat_esquema_pintura", len(df), cargados, rechazados)

    # 9. cat_porcentaje_nde
    df = load_sheet("CAT", "CAT_PorcentajeNDE_MS")
    rechazados = []
    cargados = 0
    for _, row in df.iterrows():
        cod = row.get("ID_NDE")
        pct = clean_numeric(row.get("PORCENTAJE_NDE"))
        if not cod or pct is None:
            rechazados.append("ID_NDE o PORCENTAJE_NDE nulo en fuente")
            continue
        n_val = str(cod).strip()
        cur.execute(
            """
            INSERT INTO lukeapp.cat_porcentaje_nde (proyecto_id, codigo, porcentaje, descripcion)
            VALUES (%s, %s, %s, %s) RETURNING id
            """,
            (proyecto_id, n_val, pct, row.get("METODO"))
        )
        cache["cat_porcentaje_nde"][n_val] = cur.fetchone()[0]
        cargados += 1
    register_conciliacion("cat_porcentaje_nde", len(df), cargados, rechazados)

    # 10. cat_tipo_prueba
    df = load_sheet("CAT", "CAT_TipoPrueba_MS")
    rechazados = []
    cargados = 0
    for _, row in df.iterrows():
        cod = row.get("CODIGO")
        if not cod:
            rechazados.append("Código nulo")
            continue
        cur.execute(
            "INSERT INTO lukeapp.cat_tipo_prueba (proyecto_id, codigo, descripcion) VALUES (%s, %s, %s) RETURNING id",
            (proyecto_id, cod, row.get("DESCRIPCION"))
        )
        cache["cat_tipo_prueba"][cod] = cur.fetchone()[0]
        cargados += 1
    register_conciliacion("cat_tipo_prueba", len(df), cargados, rechazados)

    # 11. cat_tipo_soporte
    df = load_sheet("CAT", "CAT_TipoSoporte_MS")
    rechazados = []
    cargados = 0
    for _, row in df.iterrows():
        cod = row.get("CODIGO")
        if not cod:
            rechazados.append("Código nulo")
            continue
        cur.execute(
            "INSERT INTO lukeapp.cat_tipo_soporte (proyecto_id, codigo, descripcion) VALUES (%s, %s, %s) RETURNING id",
            (proyecto_id, cod, row.get("DESCRIPCION"))
        )
        cache["cat_tipo_soporte"][cod] = cur.fetchone()[0]
        cargados += 1
    register_conciliacion("cat_tipo_soporte", len(df), cargados, rechazados)

    # 12. cat_tipo_union
    df = load_sheet("CAT", "CAT_TipoUnion_MS")
    rechazados = []
    cargados = 0
    for _, row in df.iterrows():
        cod = row.get("CODIGO")
        if not cod:
            rechazados.append("Código nulo")
            continue
        cur.execute(
            "INSERT INTO lukeapp.cat_tipo_union (proyecto_id, codigo, descripcion) VALUES (%s, %s, %s) RETURNING id",
            (proyecto_id, cod, row.get("DESCRIPCION"))
        )
        cache["cat_tipo_union"][cod] = cur.fetchone()[0]
        cargados += 1
    register_conciliacion("cat_tipo_union", len(df), cargados, rechazados)

    # 13. cat_revestimiento_int
    df = load_sheet("CAT", "CAT_RevestimientoInt_MS")
    rechazados = []
    cargados = 0
    for _, row in df.iterrows():
        cod = row.get("CODIGO")
        if not cod:
            rechazados.append("Código nulo")
            continue
        cur.execute(
            "INSERT INTO lukeapp.cat_revestimiento_int (proyecto_id, codigo, descripcion) VALUES (%s, %s, %s) RETURNING id",
            (proyecto_id, cod, row.get("DESCRIPCION"))
        )
        cache["cat_revestimiento_int"][cod] = cur.fetchone()[0]
        cargados += 1
    register_conciliacion("cat_revestimiento_int", len(df), cargados, rechazados)

    # 14. cat_personal
    df = load_sheet("CAT", "CAT_Personal_MS")
    rechazados = []
    cargados = 0
    for _, row in df.iterrows():
        cod = row.get("ID_PERSONAL") or row.get("CODIGO")
        estampa = row.get("ESTAMPA") or cod
        if not estampa or pd.isna(estampa):
            rechazados.append("Código/Estampa nulo")
            continue
            
        nombre = row.get("NOMBRE")
        if pd.isna(nombre) or nombre is None:
            nombre = str(estampa)
            
        cur.execute(
            """
            INSERT INTO lukeapp.cat_personal (proyecto_id, estampa, nombre, especialidad, activo)
            VALUES (%s, %s, %s, %s, true) RETURNING id
            """,
            (proyecto_id, str(estampa), str(nombre), row.get("ESPECIALIDAD") or 'SOLDADOR')
        )
        cache["cat_personal"][str(estampa)] = cur.fetchone()[0]
        cargados += 1
    register_conciliacion("cat_personal", len(df), cargados, rechazados)


    # =========================================================================
    # B. MIGRACIÓN DE MAESTROS PIPING (LIST)
    # =========================================================================
    print("\n--- Cargando Maestros Piping (LIST) ---")
    
    # 1. list_pid
    df = load_sheet("LIST_PIP", "LIST_PID_MS")
    rechazados = []
    cargados = 0
    for _, row in df.iterrows():
        id_p = row.get("ID_PID")
        if not id_p:
            rechazados.append("ID_PID nulo")
            continue
        cur.execute(
            """
            INSERT INTO lukeapp.list_pid (proyecto_id, id_pid, descripcion, pdf_path, revision, estado)
            VALUES (%s, %s, %s, %s, %s, %s) RETURNING id
            """,
            (proyecto_id, id_p, row.get("DESCRIPCION"), row.get("ARCHIVO_PDF_ISO"), str(row.get("REV")), row.get("ESTADO_DOCUMENTO"))
        )
        cache["list_pid"][id_p] = cur.fetchone()[0]
        cargados += 1
    register_conciliacion("list_pid", len(df), cargados, rechazados)

    # 2. list_lineas
    df = load_sheet("LIST_PIP", "LIST_Lineas_MS_")
    rechazados = []
    cargados = 0
    for _, row in df.iterrows():
        id_l = row.get("ID_LINEA")
        if not id_l:
            rechazados.append("ID_LINEA nulo")
            continue
        
        # Resolver catálogos
        fluido_id = cache["cat_fluido_servicio"].get(row.get("FLUIDO_SERVICIO"))
        clase_id = cache["cat_clase_piping"].get(row.get("CLASE_PIP_V2") or row.get("CLASE_PIP_V1"))
        nps_id = cache["cat_diametros_nps"].get(str(row.get("NPS")).strip())
        aislacion_id = cache["cat_aislacion_ext"].get(row.get("AISLACION_EXT"))
        revestimiento_id = cache["cat_revestimiento_int"].get(row.get("REVESTIMIENTO_INT"))
        pintura_id = cache["cat_esquema_pintura"].get(row.get("ESQUEMA_PINTURA"))
        prueba_id = cache["cat_tipo_prueba"].get(row.get("TIPO_PRUEBA"))
        nde_id = cache["cat_porcentaje_nde"].get(str(row.get("PORCENTAJE_NDE")).strip())
        
        cur.execute(
            """
            INSERT INTO lukeapp.list_lineas 
            (proyecto_id, id_linea, descripcion, fluido_id, clase_id, nps_id, aislacion_id, revestimiento_id, pintura_id, prueba_id, nde_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
            """,
            (proyecto_id, id_l, row.get("DESCRIPCION"), fluido_id, clase_id, nps_id, aislacion_id, revestimiento_id, pintura_id, prueba_id, nde_id)
        )
        cache["list_lineas"][id_l] = cur.fetchone()[0]
        cargados += 1
    register_conciliacion("list_lineas", len(df), cargados, rechazados)

    # 3. list_isos
    df = load_sheet("LIST_PIP", "LIST_Isos_MS_")
    rechazados = []
    cargados = 0
    seen_isos = set()
    for _, row in df.iterrows():
        id_l = row.get("ID_LINEA")
        hoja_raw = row.get("HOJA_NUMERO") or "1"
        sheet = str(hoja_raw).replace("HOJA-", "").strip()
        
        if not id_l:
            rechazados.append("ID_LINEA nulo")
            continue
            
        key = (id_l, sheet)
        if key in seen_isos:
            rechazados.append(f"ISO duplicado en Excel: {id_l} hoja {sheet}")
            continue
        seen_isos.add(key)
        
        linea_id = cache["list_lineas"].get(id_l)
        if not linea_id:
            rechazados.append(f"Línea padre {id_l} no existe en list_lineas")
            continue
            
        cur.execute(
            """
            INSERT INTO lukeapp.list_isos (proyecto_id, linea_id, id_linea, sheet, descripcion, revision, pdf_path)
            VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id
            """,
            (proyecto_id, linea_id, id_l, sheet, row.get("OBSERVACIONES_NOTAS"), str(row.get("REV_INGENIERIA")), row.get("ARCHIVO_PDF_ISO"))
        )
        cache["list_isos"][key] = cur.fetchone()[0]
        cargados += 1
    register_conciliacion("list_isos", len(df), cargados, rechazados)

    # 4. list_spools
    df = load_sheet("LIST_PIP", "LIST_Spools_MS_")
    rechazados = []
    cargados = 0
    seen_spools = set()
    for _, row in df.iterrows():
        s_id = row.get("ID_SPOOL")
        if not s_id:
            rechazados.append("ID_SPOOL nulo")
            continue
            
        if s_id in seen_spools:
            rechazados.append(f"Spool duplicado en Excel: {s_id}")
            continue
        seen_spools.add(s_id)
        
        id_iso = row.get("ID_ISO")
        
        # Resolver iso_id y linea_id
        iso_id, linea_id = None, None
        if id_iso:
            parts = id_iso.split("_HOJA-")
            if len(parts) > 1:
                l_id = parts[0]
                sh = parts[1].strip()
                iso_id = cache["list_isos"].get((l_id, sh))
                linea_id = cache["list_lineas"].get(l_id)
                
        if not iso_id:
            rechazados.append(f"Isométrico padre {id_iso} no existe en list_isos")
            continue
            
        cur.execute(
            """
            INSERT INTO lukeapp.list_spools (proyecto_id, iso_id, linea_id, id_spool, tag_gestion, peso, longitud, nro_juntas, estado_montaje, sector)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
            """,
            (
                proyecto_id, iso_id, linea_id, s_id, row.get("TAG_GESTION"),
                clean_numeric(row.get("PESO_EST_KG")), clean_numeric(row.get("LONGITUD_M")),
                clean_numeric(row.get("CANTIDAD_JUNTAS")), row.get("STATUS_SPOOL") or 'Pendiente', row.get("SECTOR_LEVANTAMIENTO")
            )
        )
        cache["list_spools"][s_id] = cur.fetchone()[0]
        cargados += 1
    register_conciliacion("list_spools", len(df), cargados, rechazados)

    # 5. list_juntas
    df = load_sheet("LIST_PIP", "LIST_Juntas_MS_")
    rechazados = []
    cargados = 0
    seen_juntas = set()
    for _, row in df.iterrows():
        s_id = row.get("ID_SPOOL")
        n_junta = str(row.get("NUMERO_JUNTA")).strip()
        
        if not s_id or not n_junta or n_junta == 'None' or n_junta == '':
            rechazados.append("ID_SPOOL o NUMERO_JUNTA nulo")
            continue
            
        key = (s_id, n_junta)
        if key in seen_juntas:
            rechazados.append(f"Junta duplicada en Excel: {s_id}_{n_junta}")
            continue
        seen_juntas.add(key)
        
        spool_id = None
        linea_id = None
        if s_id:
            # Buscar spool y obtener su linea_id
            cur.execute("SELECT id, linea_id FROM lukeapp.list_spools WHERE proyecto_id = %s AND id_spool = %s", (proyecto_id, s_id))
            res = cur.fetchone()
            if res:
                spool_id, linea_id = res
                
        if not spool_id:
            rechazados.append(f"Spool padre {s_id} no existe en list_spools")
            continue
            
        tipo_union_id = cache["cat_tipo_union"].get(row.get("TIPO_UNION"))
        nps_id = cache["cat_diametros_nps"].get(str(row.get("DIAMETRO_NPS")).strip())
        
        cur.execute(
            """
            INSERT INTO lukeapp.list_juntas 
            (proyecto_id, spool_id, linea_id, id_spool, numero_junta, tipo_union_id, nps_id, nps_texto, proceso_soldadura, material_base, requiere_pwht, requiere_pmi, porcentaje_nde, estado)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
            """,
            (
                proyecto_id, spool_id, linea_id, s_id, n_junta, tipo_union_id, nps_id, str(row.get("DIAMETRO_NPS")),
                row.get("PROCESO_SOLDADURA"), row.get("MATERIAL_BASE"), row.get("REQUIERE_PWHT") == 'SI',
                row.get("REQUIERE_PMI") == 'SI', clean_numeric(row.get("PORCENTAJE_NDE")), row.get("ESTADO_JUNTA") or 'Pendiente'
            )
        )
        cache["list_juntas"][key] = cur.fetchone()[0]
        cargados += 1
    register_conciliacion("list_juntas", len(df), cargados, rechazados)

    # 6. list_mto
    df = load_sheet("LIST_PIP", "LIST_MTO_MS")
    rechazados = []
    cargados = 0
    seen_mto = set()
    for _, row in df.iterrows():
        id_mto = row.get("ID_MTO")
        if not id_mto:
            rechazados.append("ID_MTO nulo")
            continue
            
        if id_mto in seen_mto:
            rechazados.append(f"MTO duplicado en Excel: {id_mto}")
            continue
        seen_mto.add(id_mto)
        
        id_l = row.get("ID_LINEA")
        
        linea_id = cache["list_lineas"].get(id_l)
        if not linea_id:
            rechazados.append(f"Línea padre {id_l} no existe")
            continue
            
        nps_id = cache["cat_diametros_nps"].get(str(row.get("NPS_1")).strip())
        
        cur.execute(
            """
            INSERT INTO lukeapp.list_mto (proyecto_id, linea_id, item, descripcion, cantidad, nps_id, nps_texto)
            VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id
            """,
            (proyecto_id, linea_id, id_mto, row.get("DESCRIPCION"), clean_numeric(row.get("CANTIDAD_PROYECTO")), nps_id, str(row.get("NPS_1")))
        )
        cache["list_mto"][id_mto] = cur.fetchone()[0]
        cargados += 1
    register_conciliacion("list_mto", len(df), cargados, rechazados)

    # 7. list_soportes
    df = load_sheet("LIST_PIP", "LIST_Soportes_MS")
    rechazados = []
    cargados = 0
    seen_soportes = set()
    for _, row in df.iterrows():
        id_sop = row.get("ID_Soporte")
        if not id_sop:
            rechazados.append("ID_Soporte nulo")
            continue
            
        if id_sop in seen_soportes:
            rechazados.append(f"Soporte duplicado en Excel: {id_sop}")
            continue
        seen_soportes.add(id_sop)
        
        id_l = row.get("ID_LINEA")
        
        linea_id = cache["list_lineas"].get(id_l)
        if not linea_id:
            rechazados.append(f"Línea padre {id_l} no existe")
            continue
            
        tipo_sop_id = cache["cat_tipo_soporte"].get(row.get("TIPO_SOPORTE"))
        
        cur.execute(
            """
            INSERT INTO lukeapp.list_soportes (proyecto_id, linea_id, id_soporte, tipo_soporte_id, descripcion, estado)
            VALUES (%s, %s, %s, %s, %s, 'Pendiente') RETURNING id
            """,
            (proyecto_id, linea_id, id_sop, tipo_sop_id, row.get("PLANO_DETALLE") or row.get("TIPO_SOPORTE"))
        )
        cache["list_soportes"][id_sop] = cur.fetchone()[0]
        cargados += 1
    register_conciliacion("list_soportes", len(df), cargados, rechazados)

    # 8. list_valvulas
    df = load_sheet("LIST_PIP", "LIST_Valvulas_MS")
    rechazados = []
    cargados = 0
    for _, row in df.iterrows():
        id_val = row.get("ID_VALVULA")
        id_l = row.get("ID_LINEA")
        
        linea_id = cache["list_lineas"].get(id_l)
        if not linea_id:
            rechazados.append(f"Línea padre {id_l} no existe")
            continue
            
        nps_id = cache["cat_diametros_nps"].get(str(row.get("NPS")).strip())
        clase_id = cache["cat_clase_piping"].get(row.get("CLASE"))
        
        cur.execute(
            """
            INSERT INTO lukeapp.list_valvulas (proyecto_id, linea_id, id_valvula, tag, tipo, actuador, nps_id, nps_texto, clase_id, estado)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
            """,
            (proyecto_id, linea_id, id_val, row.get("TAG"), row.get("TIPO"), row.get("ACTUADOR"), nps_id, str(row.get("NPS")), clase_id, row.get("STATUS") or 'Pendiente')
        )
        cache["list_valvulas"][id_val] = cur.fetchone()[0]
        cargados += 1
    register_conciliacion("list_valvulas", len(df), cargados, rechazados)

    # 9. list_equipos
    df = load_sheet("LIST_PIP", "LIST_Equipos_MS")
    rechazados = []
    cargados = 0
    for _, row in df.iterrows():
        id_eq = row.get("ID_EQUIPO")
        if not id_eq:
            rechazados.append("ID_EQUIPO nulo")
            continue
        cur.execute(
            """
            INSERT INTO lukeapp.list_equipos (proyecto_id, id_equipo, tag, descripcion, tipo, area)
            VALUES (%s, %s, %s, %s, %s, %s) RETURNING id
            """,
            (proyecto_id, id_eq, row.get("TAG"), row.get("DESCRIPCION"), row.get("TIPO"), str(row.get("AREA")))
        )
        cache["list_equipos"][id_eq] = cur.fetchone()[0]
        cargados += 1
    register_conciliacion("list_equipos", len(df), cargados, rechazados)

    # 10. list_tie_ins
    df = load_sheet("LIST_PIP", "LIST_TieIns_MS")
    rechazados = []
    cargados = 0
    for _, row in df.iterrows():
        id_ti = row.get("ID_TIE_IN")
        if not id_ti:
            rechazados.append("ID_TIE_IN nulo")
            continue
        id_l = row.get("ID_LINEA")
        linea_id = cache["list_lineas"].get(id_l)
        nps_id = cache["cat_diametros_nps"].get(str(row.get("NPS")).strip())
        
        cur.execute(
            """
            INSERT INTO lukeapp.list_tie_ins (proyecto_id, id_tie_in, tipo, descripcion, estado, linea_id, nps_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (proyecto_id, id_ti, row.get("TIPO"), row.get("DESCRIPCION"), row.get("ESTADO") or 'Pendiente', linea_id, nps_id)
        )
        cargados += 1
    register_conciliacion("list_tie_ins", len(df), cargados, rechazados)

    # 11. list_bim
    df = load_sheet("LIST_PIP", "LIST_Bim_MS")
    rechazados = []
    cargados = 0
    for _, row in df.iterrows():
        guid = row.get("Elemento GUID")
        if not guid:
            rechazados.append("GUID nulo")
            continue
            
        # Resolver relaciones opcionales
        # El campo SPOOL LUKEAPP contiene el tag_gestion del spool
        spool_tag = row.get("SPOOL LUKEAPP")
        spool_id = None
        if spool_tag and not pd.isna(spool_tag) and str(spool_tag).strip().lower() not in ['nan', 'none', '']:
            tag_str = str(spool_tag).strip()
            cur.execute("SELECT id FROM lukeapp.list_spools WHERE proyecto_id = %s AND tag_gestion = %s", (proyecto_id, tag_str))
            res = cur.fetchone()
            spool_id = res[0] if res else None
            
        cur.execute(
            """
            INSERT INTO lukeapp.list_bim (proyecto_id, elemento_guid, tag, descripcion, linea_numero, cwp_codigo, autocad_size, spool_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (proyecto_id, guid, row.get("TAG"), row.get("DESCRIPCION"), row.get("Line Number"), row.get("CWP"), row.get("AutoCad Size"), spool_id)
        )
        cargados += 1
    register_conciliacion("list_bim", len(df), cargados, rechazados)


    # =========================================================================
    # C. MIGRACIÓN DE LOGS Y HISTORIAL (LOG)
    # =========================================================================
    print("\n--- Cargando Logs de Historial (LOG) ---")
    
    # 1. log_spool
    df = load_sheet("LOG", "LOG_Spool_MS")
    rechazados = []
    cargados = 0
    for _, row in df.iterrows():
        id_log = row.get("ID_LOG_SPOOL")
        s_id = row.get("ID_SPOOL")
        
        spool_id = cache["list_spools"].get(s_id)
        if not spool_id:
            rechazados.append(f"Spool padre {s_id} no existe")
            continue
            
        f_reg = parse_date(row.get("FECHA_LEVANTAMIENTO")) or parse_date(row.get("FECHA_CREACION")) or "2023-01-01"
        
        cur.execute(
            """
            INSERT INTO lukeapp.log_spool (id, proyecto_id, spool_id, id_spool, estado, fecha_registro, mts_montados, estampa, sector, observacion, foto_path)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                id_log, proyecto_id, spool_id, s_id, row.get("STATUS") or 'Pendiente', f_reg,
                clean_numeric(row.get("MTS MONTADOS")), row.get("ESTAMPA"), row.get("UBICACION/SECTOR LEVANTAMIENTO"),
                row.get("OBSERVACION TERRENO"), row.get("FOTO")
            )
        )
        # Manejo de evidencia foto si viene
        if row.get("FOTO"):
            handle_evidencia_rel(row.get("FOTO"), "log", "log_spool", id_log)
            
        cargados += 1
    register_conciliacion("log_spool", len(df), cargados, rechazados)

    # 2. log_materiales
    df = load_sheet("LOG", "LOG_Materiales_MS")
    rechazados = []
    cargados = 0
    for _, row in df.iterrows():
        id_log = row.get("ID_LOG_MATERIALES") or str(uuid.uuid4())
        id_mto = row.get("ID_MTO")
        
        mto_id = cache["list_mto"].get(id_mto)
        if not mto_id:
            rechazados.append(f"Material MTO padre {id_mto} no existe")
            continue
            
        f_reg = parse_date(row.get("FECHA_MOVIMIENTO")) or "2023-01-01"
        
        cur.execute(
            """
            INSERT INTO lukeapp.log_materiales (id, proyecto_id, mto_id, cantidad, tipo_movimiento, guia_numero, fecha_registro, observacion)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (id_log, proyecto_id, mto_id, clean_numeric(row.get("CANTIDAD")) or 1.0, row.get("TIPO_MOVIMIENTO") or 'Recepcion', row.get("GUIA_NUMERO"), f_reg, row.get("OBSERVACIONES"))
        )
        cargados += 1
    register_conciliacion("log_materiales", len(df), cargados, rechazados)

    # 3. log_iso
    df = load_sheet("LOG", "LOG_Iso_MS")
    rechazados = []
    cargados = 0
    for _, row in df.iterrows():
        id_log = row.get("ID_LOG_ISO")
        id_iso = row.get("ID_ISO")
        
        iso_id = None
        if id_iso:
            parts = id_iso.split("_HOJA-")
            if len(parts) > 1:
                iso_id = cache["list_isos"].get((parts[0], parts[1].strip()))
                
        if not iso_id:
            rechazados.append(f"Isométrico padre {id_iso} no existe")
            continue
            
        f_reg = parse_date(row.get("FECHA_SUBIDA")) or "2023-01-01"
        
        cur.execute(
            """
            INSERT INTO lukeapp.log_iso (id, proyecto_id, iso_id, revision, evento, fecha_evento, pdf_path, comentario)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (id_log, proyecto_id, iso_id, str(row.get("REVISION_NRO")), row.get("TIPO_MODIFICACION") or 'Emision', f_reg, row.get("ARCHIVO_PDF_REVISION"), row.get("MOTIVO_CAMBIO"))
        )
        
        if row.get("ARCHIVO_PDF_REVISION"):
            handle_evidencia_rel(row.get("ARCHIVO_PDF_REVISION"), "log", "log_iso", id_log)
            
        cargados += 1
    register_conciliacion("log_iso", len(df), cargados, rechazados)

    # 4. log_pid
    df = load_sheet("LOG", "LOG_PID_MS")
    rechazados = []
    cargados = 0
    for _, row in df.iterrows():
        id_log = row.get("ID_LOG_PID")
        # El Excel contiene un tabulador o espacio al final en los encabezados, por eso limpiamos con clean_dataframe.
        id_pid_padre = row.get("ID_PID_PADRE")
        
        pid_id = cache["list_pid"].get(id_pid_padre)
        if not pid_id:
            # Intentar sin espacios o buscar
            cur.execute("SELECT id FROM lukeapp.list_pid WHERE proyecto_id = %s AND id_pid = %s", (proyecto_id, id_pid_padre))
            res = cur.fetchone()
            pid_id = res[0] if res else None
            
        if not pid_id:
            rechazados.append(f"P&ID padre '{id_pid_padre}' no existe")
            continue
            
        f_reg = parse_date(row.get("FECHA_SUBIDA")) or "2023-01-01"
        
        cur.execute(
            """
            INSERT INTO lukeapp.log_pid (id, proyecto_id, pid_id, revision, evento, fecha_evento, comentario)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (id_log, proyecto_id, pid_id, str(row.get("REVISION_NRO")), row.get("TIPO_MODIFICACION") or 'Emision', f_reg, row.get("ESTADO_DOCUMENTO"))
        )
        
        if row.get("ARCHIVO_PDF_REVISION"):
            handle_evidencia_rel(row.get("ARCHIVO_PDF_REVISION"), "log", "log_pid", id_log)
            
        cargados += 1
    register_conciliacion("log_pid", len(df), cargados, rechazados)

    # 5. log_sdi
    df = load_sheet("LOG", "LOG_SDI_MS")
    rechazados = []
    cargados = 0
    for _, row in df.iterrows():
        num_sdi = row.get("CODIGO DAND") or row.get("NOMBRE Sdis")
        if not num_sdi:
            rechazados.append("Código DAND/Nombre SDI nulo")
            continue
            
        id_sdi = str(uuid.uuid4())
        f_emision = parse_date(row.get("FECHA ENVÍO"))
        f_resp = parse_date(row.get("FECHA DAND"))
        
        cur.execute(
            """
            INSERT INTO lukeapp.log_sdi (id, proyecto_id, numero_sdi, descripcion, estado, fecha_emision, fecha_respuesta, respuesta, prioridad)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                id_sdi, proyecto_id, num_sdi, row.get("Descricpión"), row.get("ESTADO") or 'RESPONDIDA',
                f_emision, f_resp, row.get("Descripcion de Respuesta"), str(row.get("REV"))
            )
        )
        cache["log_sdi"][num_sdi] = id_sdi
        cargados += 1
    register_conciliacion("log_sdi", len(df), cargados, rechazados)


    # =========================================================================
    # D. MIGRACIÓN DE REGISTROS DE TERRENO (REG)
    # =========================================================================
    print("\n--- Cargando Registros de Terreno (REG) ---")
    
    # 1. reg_ejecucion_juntas
    # Consolidar las hojas REG_EjecucionJuntas_MS y REG_EjecucionJuntas_MS (2)
    df1 = load_sheet("REG", "REG_EjecucionJuntas_MS")
    df2 = load_sheet("REG", "REG_EjecucionJuntas_MS (2)")
    df_juntas = pd.concat([df1, df2], ignore_index=True)
    total_fuente_juntas = len(df_juntas)
    
    # Deduplicar por ID_juntaEjecutada
    df_juntas = df_juntas.drop_duplicates(subset=["ID_juntaEjecutada"], keep="first")
    print(f"[REG] Hojas de juntas unificadas: {total_fuente_juntas} filas -> {len(df_juntas)} deduplicadas.")
    
    rechazados = []
    cargados = 0
    for _, row in df_juntas.iterrows():
        id_reg = row.get("ID_juntaEjecutada")
        s_id = row.get("ID_SPOOL")
        n_junta = str(row.get("NUMERO_JUNTA")).strip()
        
        # Buscar junta_id
        junta_id = cache["list_juntas"].get((s_id, n_junta))
        if not junta_id:
            # Buscar por ID_JUNTA directo
            id_j = row.get("ID_JUNTA")
            if id_j:
                cur.execute("SELECT id FROM lukeapp.list_juntas WHERE proyecto_id = %s AND (id_spool || '_' || numero_junta) = %s", (proyecto_id, id_j))
                res = cur.fetchone()
                junta_id = res[0] if res else None
                
        if not junta_id:
            rechazados.append(f"Junta {s_id}_{n_junta} no existe en list_juntas")
            continue
            
        f_reg = parse_date(row.get("FECHA_EJECUCION")) or parse_date(row.get("FECHA_CREACION")) or "2023-01-01"
        soldador_estampa = row.get("ESTAMPA_EJECUTOR")
        soldador_id = cache["cat_personal"].get(soldador_estampa)
        
        cur.execute(
            """
            INSERT INTO lukeapp.reg_ejecucion_juntas (id, proyecto_id, junta_id, fecha_ejecucion, soldador_id, estampa_soldador, proceso, estado)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (id_reg, proyecto_id, junta_id, f_reg, soldador_id, soldador_estampa, row.get("PROCESO_SOLDADURA") or 'SMAW', row.get("ESTADO_EJECUCION") or 'EJECUTADA')
        )
        
        if row.get("FOTO_EVIDENCIA"):
            handle_evidencia_rel(row.get("FOTO_EVIDENCIA"), "reg", "reg_ejecucion_juntas", id_reg)
            
        cargados += 1
    register_conciliacion("reg_ejecucion_juntas", total_fuente_juntas, cargados, rechazados)

    # 2. reg_junta_adicional
    df = load_sheet("REG", " REG_JuntaAdicional_MS")
    rechazados = []
    cargados = 0
    for _, row in df.iterrows():
        id_reg = row.get("ID_JuntaAdicional")
        s_id = row.get("ID_SPOOL")
        
        spool_id = cache["list_spools"].get(s_id)
        if not spool_id:
            rechazados.append(f"Spool {s_id} no existe")
            continue
            
        f_reg = parse_date(row.get("FECHA_EJECUCION")) or "2023-01-01"
        tipo_union_id = cache["cat_tipo_union"].get(row.get("ID_TIPO_UNION"))
        nps_id = cache["cat_diametros_nps"].get(str(row.get("NPS")).strip())
        soldador_id = cache["cat_personal"].get(row.get("ESTAMPA_EJECUTOR"))
        
        cur.execute(
            """
            INSERT INTO lukeapp.reg_junta_adicional (id, proyecto_id, spool_id, numero_junta, tipo_union_id, nps_id, soldador_id, proceso, estado, fecha_ejecucion, observacion)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                id_reg, proyecto_id, spool_id, str(row.get("NUMERO_JUNTA")), tipo_union_id, nps_id,
                soldador_id, row.get("PROCESO") or 'SMAW', row.get("ESTADO_EJECUCION") or 'EJECUTADA',
                f_reg, row.get("OBSERVACIONES")
            )
        )
        cargados += 1
    register_conciliacion("reg_junta_adicional", len(df), cargados, rechazados)

    # 3. reg_inspeccion_visual
    df = load_sheet("REG", "REG_InspeccionVisual_MS")
    rechazados = []
    cargados = 0
    for _, row in df.iterrows():
        id_reg = row.get("ID_inspeccionVisual")
        id_j = row.get("ID_JUNTA")
        
        # Resolver junta_id
        cur.execute("SELECT id FROM lukeapp.list_juntas WHERE proyecto_id = %s AND (id_spool || '_' || numero_junta) = %s", (proyecto_id, id_j))
        res = cur.fetchone()
        junta_id = res[0] if res else None
        
        if not junta_id:
            rechazados.append(f"Junta {id_j} no existe")
            continue
            
        f_reg = parse_date(row.get("FECHA_INSPECCION")) or "2023-01-01"
        inspector_id = cache["cat_personal"].get(row.get("INSPECTOR"))
        
        cur.execute(
            """
            INSERT INTO lukeapp.reg_inspeccion_visual (id, proyecto_id, junta_id, fecha_inspeccion, inspector_id, resultado, observacion, proxima_etapa, tipo_nde, tipo_defecto)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                id_reg, proyecto_id, junta_id, f_reg, inspector_id, row.get("ESTADO") or 'APROBADO',
                row.get("OBSERVACIONES_QC"), row.get("PROXIMA_ETAPA"), row.get("TIPO_ENSAYO_NDE"), row.get("DEFECTO_DETECTADO")
            )
        )
        
        if row.get("FOTO"):
            handle_evidencia_rel(row.get("FOTO"), "reg", "reg_inspeccion_visual", id_reg)
            
        cargados += 1
    register_conciliacion("reg_inspeccion_visual", len(df), cargados, rechazados)

    # 4. reg_dimensional_spool
    df = load_sheet("REG", "REG_DimensionalSpool_MS")
    rechazados = []
    cargados = 0
    for _, row in df.iterrows():
        id_reg = row.get("ID_REG_DIM") or str(uuid.uuid4())
        s_id = row.get("ID_SPOOL")
        
        spool_id = cache["list_spools"].get(s_id)
        if not spool_id:
            rechazados.append(f"Spool {s_id} no existe")
            continue
            
        f_reg = parse_date(row.get("FECHA")) or "2023-01-01"
        
        cur.execute(
            """
            INSERT INTO lukeapp.reg_dimensional_spool (id, proyecto_id, spool_id, resultado, fecha_inspeccion, observacion)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (id_reg, proyecto_id, spool_id, row.get("RESULTADO") or 'Aprobado', f_reg, row.get("NUM_INFORME"))
        )
        
        if row.get("FOTO"):
            handle_evidencia_rel(row.get("FOTO"), "reg", "reg_dimensional_spool", id_reg)
            
        cargados += 1
    register_conciliacion("reg_dimensional_spool", len(df), cargados, rechazados)

    # 5. reg_pintura_spool
    df = load_sheet("REG", "REG_PinturaSpool_MS")
    rechazados = []
    cargados = 0
    for _, row in df.iterrows():
        id_reg = row.get("ID_REG_PINT") or str(uuid.uuid4())
        s_id = row.get("ID_SPOOL")
        
        spool_id = cache["list_spools"].get(s_id)
        if not spool_id:
            rechazados.append(f"Spool {s_id} no existe")
            continue
            
        f_reg = parse_date(row.get("FECHA")) or "2023-01-01"
        
        cur.execute(
            """
            INSERT INTO lukeapp.reg_pintura_spool (id, proyecto_id, spool_id, resultado, fecha_aplicacion, etapa, observacion)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (id_reg, proyecto_id, spool_id, row.get("RESULTADO") or 'Aprobado', f_reg, 'Aplicado', row.get("NUM_INFORME"))
        )
        
        if row.get("FOTO_PINTURA"):
            handle_evidencia_rel(row.get("FOTO_PINTURA"), "reg", "reg_pintura_spool", id_reg)
            
        cargados += 1
    register_conciliacion("reg_pintura_spool", len(df), cargados, rechazados)

    # 6. reg_montaje_valvulas
    df = load_sheet("REG", "REG_MontajeValvulas_MS")
    rechazados = []
    cargados = 0
    for _, row in df.iterrows():
        id_reg = row.get("ID_MontajeValvula")
        id_val = row.get("ID_VALVULA")
        
        valvula_id = cache["list_valvulas"].get(id_val)
        if not valvula_id:
            rechazados.append(f"Válvula {id_val} no existe en list_valvulas")
            continue
            
        f_reg = parse_date(row.get("fecha")) or "2023-01-01"
        
        cur.execute(
            """
            INSERT INTO lukeapp.reg_montaje_valvulas (id, proyecto_id, valvula_id, estado, fecha_montaje, observacion)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (id_reg, proyecto_id, valvula_id, row.get("Status") or 'Montado', f_reg, row.get("Hoja"))
        )
        
        if row.get("FotoTerreno"):
            handle_evidencia_rel(row.get("FotoTerreno"), "reg", "reg_montaje_valvulas", id_reg)
            
        cargados += 1
    register_conciliacion("reg_montaje_valvulas", len(df), cargados, rechazados)

    # 7. reg_montaje_soportes
    df = load_sheet("REG", "REG_MontajeSoportes_MS")
    rechazados = []
    cargados = 0
    for _, row in df.iterrows():
        id_reg = row.get("ID_MontajeSoporte")
        id_sop = row.get("ID_Soporte")
        
        soporte_id = cache["list_soportes"].get(id_sop)
        if not soporte_id:
            rechazados.append(f"Soporte '{id_sop}' no existe en list_soportes")
            continue
            
        f_reg = parse_date(row.get("Fecha")) or "2023-01-01"
        
        cur.execute(
            """
            INSERT INTO lukeapp.reg_montaje_soportes (id, proyecto_id, soporte_id, estado, fecha_montaje, observacion)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (id_reg, proyecto_id, soporte_id, 'Montado', f_reg, row.get("ObservacionMontaje"))
        )
        
        if row.get("FotoTerreno"):
            handle_evidencia_rel(row.get("FotoTerreno"), "reg", "reg_montaje_soportes", id_reg)
            
        cargados += 1
    register_conciliacion("reg_montaje_soportes", len(df), cargados, rechazados)


    # =========================================================================
    # E. MIGRACIÓN DE RELACIONES (REL)
    # =========================================================================
    print("\n--- Cargando Relaciones (REL) ---")
    
    # 1. rel_pid_lineas
    df = load_sheet("REL", "REL_PIDLineas_MS")
    rechazados = []
    cargados = 0
    for _, row in df.iterrows():
        id_p = row.get("ID_PID")
        id_l = row.get("ID_LINEA")
        
        pid_id = cache["list_pid"].get(id_p)
        linea_id = cache["list_lineas"].get(id_l)
        
        if not pid_id or not linea_id:
            rechazados.append(f"P&ID {id_p} o Línea {id_l} no existen")
            continue
            
        cur.execute(
            """
            INSERT INTO lukeapp.rel_pid_lineas (proyecto_id, pid_id, linea_id)
            VALUES (%s, %s, %s)
            """,
            (proyecto_id, pid_id, linea_id)
        )
        cargados += 1
    register_conciliacion("rel_pid_lineas", len(df), cargados, rechazados)

    # 2. rel_sdi_iso
    df = load_sheet("REL", "REL_SDIIso_MS")
    rechazados = []
    cargados = 0
    for _, row in df.iterrows():
        num_sdi = row.get("CODIGO_DAND")
        id_iso = row.get("ID_ISO")
        
        sdi_id = cache["log_sdi"].get(num_sdi)
        iso_id = None
        if id_iso:
            parts = id_iso.split("_HOJA-")
            if len(parts) > 1:
                iso_id = cache["list_isos"].get((parts[0], parts[1].strip()))
                
        if not sdi_id or not iso_id:
            rechazados.append(f"SDI '{num_sdi}' o ISO '{id_iso}' no existen")
            continue
            
        cur.execute(
            """
            INSERT INTO lukeapp.rel_sdi_iso (proyecto_id, sdi_id, iso_id)
            VALUES (%s, %s, %s)
            """,
            (proyecto_id, sdi_id, iso_id)
        )
        cargados += 1
    register_conciliacion("rel_sdi_iso", len(df), cargados, rechazados)


    # =========================================================================
    # F. MIGRACIÓN DE DOCUMENTOS (DOC)
    # =========================================================================
    print("\n--- Cargando Eventos Documentales (DOC) ---")
    
    # 1. doc_revision_events
    df = load_sheet("DOC", "DOC_RevisionEvents_MS")
    rechazados = []
    cargados = 0
    for _, row in df.iterrows():
        id_reg = row.get("ID_REV_EVENT") or str(uuid.uuid4())
        entidad = row.get("ENTIDAD")
        id_padre = row.get("ID_REGISTRO_PADRE")
        
        # Intentar resolver UUID de registro_id
        registro_id = None
        if entidad == 'list_isos':
            # id_padre es ID_ISO (ej. 03351-PW-4"-C1-0016-N_HOJA-1)
            if id_padre:
                parts = id_padre.split("_HOJA-")
                if len(parts) > 1:
                    registro_id = cache["list_isos"].get((parts[0], parts[1].strip()))
        elif entidad == 'list_lineas':
            registro_id = cache["list_lineas"].get(id_padre)
        elif entidad == 'list_pid':
            registro_id = cache["list_pid"].get(id_padre)
            
        if not registro_id:
            rechazados.append(f"Registro padre '{id_padre}' en '{entidad}' no existe")
            continue
            
        f_reg = parse_date(row.get("FECHA_REGISTRO")) or "2023-01-01"
        
        cur.execute(
            """
            INSERT INTO lukeapp.doc_revision_events (id, proyecto_id, entidad, registro_id, evento, fecha_evento, revision, comentario)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (id_reg, proyecto_id, entidad, registro_id, row.get("EVENTO") or 'Revision', f_reg, str(row.get("REVISION_NRO")), row.get("OBSERVACIONES"))
        )
        cargados += 1
    register_conciliacion("doc_revision_events", len(df), cargados, rechazados)


    # =========================================================================
    # G. MIGRACIÓN DE MECÁNICA (LIST_MEC)
    # =========================================================================
    print("\n--- Cargando Datos de Mecánica (MEC) ---")
    
    # 1. list_mec
    df = load_sheet("LIST_MEC", "LIST_Mec_MS")
    rechazados = []
    cargados = 0
    for _, row in df.iterrows():
        id_mec = row.get("ID_MEC")
        if not id_mec:
            rechazados.append("ID_MEC nulo")
            continue
        cur.execute(
            """
            INSERT INTO lukeapp.list_mec (proyecto_id, id_mec, tag, descripcion, tipo, estado)
            VALUES (%s, %s, %s, %s, %s, %s) RETURNING id
            """,
            (proyecto_id, id_mec, row.get("TAG"), row.get("DESCRIPCION"), row.get("TIPO"), row.get("ESTADO") or 'Pendiente')
        )
        cache["list_mec"][id_mec] = cur.fetchone()[0]
        cargados += 1
    register_conciliacion("list_mec", len(df), cargados, rechazados)

    # 2. list_esp_elem
    df = load_sheet("LIST_MEC", "LIST_ESP_ELEM")
    rechazados = []
    cargados = 0
    for _, row in df.iterrows():
        id_esp = row.get("ID_ESP_ELEM")
        id_m = row.get("ID_MEC")
        
        mec_id = cache["list_mec"].get(id_m)
        if not mec_id:
            rechazados.append(f"Equipo Mecánica padre {id_m} no existe")
            continue
            
        cur.execute(
            """
            INSERT INTO lukeapp.list_esp_elem (proyecto_id, id_esp_elem, tag, descripcion, tipo, estado, mec_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id
            """,
            (proyecto_id, id_esp, row.get("TAG"), row.get("DESCRIPCION"), row.get("TIPO"), row.get("ESTADO") or 'Pendiente', mec_id)
        )
        cache["list_esp_elem"][id_esp] = cur.fetchone()[0]
        cargados += 1
    register_conciliacion("list_esp_elem", len(df), cargados, rechazados)

    # 3. reg_esp_elem
    df = load_sheet("LIST_MEC", "REG_ESP_ELEM")
    rechazados = []
    cargados = 0
    for _, row in df.iterrows():
        id_reg = row.get("ID_REG_ESP_ELEM") or str(uuid.uuid4())
        id_esp = row.get("ID_ESP_ELEM")
        
        esp_elem_id = cache["list_esp_elem"].get(id_esp)
        if not esp_elem_id:
            rechazados.append(f"Elemento mecánico {id_esp} no existe")
            continue
            
        f_reg = parse_date(row.get("FECHA")) or "2023-01-01"
        
        cur.execute(
            """
            INSERT INTO lukeapp.reg_esp_elem (id, proyecto_id, esp_elem_id, estado, fecha_registro, observacion)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (id_reg, proyecto_id, esp_elem_id, row.get("ESTADO") or 'Montado', f_reg, row.get("OBSERVACIONES"))
        )
        cargados += 1
    register_conciliacion("reg_esp_elem", len(df), cargados, rechazados)

    # 4. Imprimir Reporte Final
    print_conciliacion_report()

    if dry_run:
        print("\n[DRY-RUN] Rollback exitoso. Ningún cambio fue escrito en la base de datos.")
        conn.rollback()
        return False
    else:
        print("\n[MIGRACIÓN] Confirmando cambios en la base de datos...")
        conn.commit()
        print("[SUCCESS] ¡ETL de migración completado exitosamente de forma real!")
        return True

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ETL de Migración del Piloto Andina a LukeAPP v4")
    parser.add_argument("--dry-run", action="store_true", help="Validar consistencia e integridad relacional sin guardar")
    args = parser.parse_args()
    
    try:
        print("[START] Inicializando script ETL...")
        conn = get_db_connection()
        
        # Ejecutar migración
        success = run_migration(conn, dry_run=args.dry_run)
        conn.close()
        sys.exit(0)
        
    except Exception as e:
        print(f"\n[CRITICAL ERROR] Error crítico durante la ejecución del ETL: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
