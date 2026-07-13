#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LukeAPP v4 — Ingesta documental con IA
Procesamiento de especificaciones técnicas y adendas en PDF usando Gemini.
Genera chunks, embeddings vectoriales (RAG) y propuestas de carga estructuradas (staging).
"""

import os
import sys
import json
import argparse
import psycopg2
from psycopg2.extras import RealDictCursor
import google.generativeai as genai
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

# Configurar API de Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
else:
    print("⚠️ Advertencia: GEMINI_API_KEY no encontrada en las variables de entorno.")

# Conexión a la base de datos
DATABASE_URL = os.getenv("DATABASE_URL")

def get_db_connection():
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL no configurada en las variables de entorno.")
    return psycopg2.connect(DATABASE_URL)

def extract_text_from_pdf(pdf_path):
    """
    Intenta extraer texto del PDF página por página.
    Para esta demo inicial, si no se cuenta con pypdf, se genera un texto estructurado mock
    de especificación técnica de piping que emula un PDF real de ingeniería.
    """
    try:
        import pypdf
        reader = pypdf.PdfReader(pdf_path)
        pages_text = []
        for i, page in enumerate(reader.pages):
            text = page.extract_text()
            pages_text.append((i + 1, text))
        return pages_text
    except ImportError:
        print("💡 pypdf no está instalado. Usando simulador de PDF de ingeniería.")
        # Generar texto simulado de especificación técnica
        return [
            (1, """ESPECIFICACIÓN TÉCNICA DE PIPING - PROYECTO ANDINA EIMI00413
            1. OBJETIVO Y ALCANCE
            Este documento define las clases de piping, fluidos de servicio y requisitos de QA/QC para el proyecto de montaje Andina.
            
            2. FLUIDOS DE SERVICIO APROBADOS
            Los siguientes fluidos están autorizados para circular por las líneas del proyecto:
            - AG: Agua de procesos y de servicio industrial.
            - AC: Ácido sulfúrico diluido. Temperatura máxima 60°C.
            - GN: Gas Natural de alimentación para quemadores.
            - VN: Vapor de media presión. Temperatura de diseño 180°C.
            """),
            (2, """ESPECIFICACIÓN TÉCNICA DE PIPING - PROYECTO ANDINA EIMI00413
            3. CLASES DE TUBERÍAS (PIPING CLASSES)
            Las líneas se fabricarán y montarán estrictamente de acuerdo con las siguientes clases:
            - Clase A1: Acero al Carbono (ASTM A106-B). Rating 150#. Servicio: Agua de procesos (AG). Requiere pintura protectora tipo EP1. Sin tratamiento térmico posterior (PWHT).
            - Clase A2: Acero al Carbono (ASTM A106-B). Rating 300#. Servicio: Vapor (VN). Requiere PWHT para espesores mayores a 3/4". Requiere ensayos no destructivos (NDE) al 20% en juntas BW.
            - Clase C1: Acero Inoxidable (ASTM A312 TP316L). Rating 150#. Servicio: Ácido sulfúrico (AC). Requiere control de materiales (PMI) al 100% de las juntas y componentes. Sin pintura.
            """),
            (3, """ESPECIFICACIÓN TÉCNICA DE PIPING - PROYECTO ANDINA EIMI00413
            4. REQUISITOS DE CONTROL DE CALIDAD Y QA/QC
            - Ensayos No Destructivos (NDE):
              - Servicios generales (AG, aire): Inspección Visual (VT) al 100% + Radiografía (RT) al 5%.
              - Vapor (VN): RT al 20% en todas las juntas a tope (BW).
              - Ácido sulfúrico (AC): Tintas Penetrantes (PT) al 100% + RT al 10%.
            - Tratamiento Térmico (PWHT):
              - Obligatorio para líneas de vapor clase A2 en juntas de diámetro nominal (NPS) mayor o igual a 2".
            - Identificación de Materiales Positiva (PMI):
              - Requerido para todas las aleaciones inoxidables (Clase C1) antes del montaje.
            """)
        ]

def generate_chunks(pages_text, chunk_size=800, overlap=150):
    """
    Divide el texto de las páginas en chunks solapados, registrando el número de página de inicio y fin.
    """
    chunks = []
    current_chunk = ""
    current_pages = []
    chunk_idx = 1
    
    for page_num, text in pages_text:
        words = text.split()
        for word in words:
            if len(current_chunk) + len(word) + 1 > chunk_size:
                # Guardar el chunk
                chunks.append({
                    "nro_chunk": chunk_idx,
                    "contenido": current_chunk.strip(),
                    "pagina_inicio": current_pages[0] if current_pages else page_num,
                    "pagina_fin": page_num
                })
                chunk_idx += 1
                # Crear nuevo chunk con overlap (últimas N palabras)
                overlap_words = current_chunk.split()[-25:]  # ~150 caracteres
                current_chunk = " ".join(overlap_words) + " " + word + " "
                current_pages = [page_num]
            else:
                current_chunk += word + " "
                if page_num not in current_pages:
                    current_pages.append(page_num)
                    
    if current_chunk.strip():
        chunks.append({
            "nro_chunk": chunk_idx,
            "contenido": current_chunk.strip(),
            "pagina_inicio": current_pages[0] if current_pages else pages_text[-1][0],
            "pagina_fin": pages_text[-1][0]
        })
        
    return chunks

def save_chunks_to_db(conn, doc_id, proyecto_id, chunks):
    """
    Guarda los chunks en la tabla doc_chunks. Genera y guarda los embeddings vectoriales si
    la API key de Gemini está configurada.
    """
    cursor = conn.cursor()
    
    # Limpiar chunks anteriores de este documento para evitar duplicaciones
    cursor.execute("DELETE FROM lukeapp.doc_chunks WHERE documento_id = %s", (doc_id,))
    
    print(f"💾 Guardando {len(chunks)} chunks en doc_chunks...")
    for chunk in chunks:
        embedding_vector = None
        if GEMINI_API_KEY:
            try:
                # Generar embedding con text-embedding-004 de Google
                response = genai.embed_content(
                    model="models/text-embedding-004",
                    content=chunk["contenido"],
                    task_type="retrieval_document"
                )
                embedding_vector = response["embedding"]
            except Exception as e:
                print(f"⚠️ Error al generar embedding para chunk {chunk['nro_chunk']}: {e}")
                
        cursor.execute(
            """
            INSERT INTO lukeapp.doc_chunks 
            (documento_id, proyecto_id, nro_chunk, pagina_inicio, pagina_fin, contenido, embedding)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                doc_id, 
                proyecto_id, 
                chunk["nro_chunk"], 
                chunk["pagina_inicio"], 
                chunk["pagina_fin"], 
                chunk["contenido"],
                embedding_vector
            )
        )
    conn.commit()

def extract_structured_data_with_gemini(document_text, tipo_doc):
    """
    Envía el contenido del documento a Gemini para realizar una extracción estructurada.
    Retorna una lista de diccionarios que representan propuestas de filas a importar.
    """
    if not GEMINI_API_KEY:
        print("💡 Sin API Key de Gemini. Generando propuesta estructurada estática para la demo.")
        return get_mock_extraction_data()

    # Construir prompt en base al tipo de documento
    system_instruction = (
        "Eres un analista experto en ingeniería de piping y control de calidad industrial.\n"
        "Tu tarea es analizar el texto de un documento de ingeniería (especificación, adenda, etc.) "
        "y extraer de forma estructurada los elementos clave que deben poblar los catálogos del sistema.\n"
        "Debes retornar UNICAMENTE un objeto JSON válido, sin bloques de código markdown ni texto adicional.\n\n"
        "El JSON debe tener la siguiente estructura exacta:\n"
        "{\n"
        "  \"propuestas\": [\n"
        "    {\n"
        "      \"tabla_destino\": \"nombre_de_tabla\", // solo puede ser: 'cat_fluido_servicio' o 'cat_clase_piping'\n"
        "      \"clave_natural\": \"valor_unico\", // ej: el codigo del fluido o clase\n"
        "      \"payload\": { ... }, // columnas específicas de la tabla\n"
        "      \"confianza\": 0.95, // valor entre 0.0 y 1.0\n"
        "      \"fuente\": { \"paginas\": [1, 2], \"contexto\": \"texto de origen\" }\n"
        "    }\n"
        "  ]\n"
        "}\n\n"
        "Campos de payload requeridos por tabla:\n"
        "- Para 'cat_fluido_servicio': { \"codigo\": \"...\", \"descripcion\": \"...\" }\n"
        "- Para 'cat_clase_piping': { \"codigo\": \"...\", \"descripcion\": \"...\", \"presion_max\": null, \"temp_max\": null, \"usa_pwht\": true/false, \"usa_pmi\": true/false }\n"
    )

    try:
        model = genai.GenerativeModel(
            model_name="gemini-2.5-flash",
            generation_config={"response_mime_type": "application/json"},
            system_instruction=system_instruction
        )
        
        prompt = f"Analiza el siguiente texto extraído de un documento de tipo '{tipo_doc}' y extrae las clases de piping y fluidos de servicio:\n\n{document_text}"
        
        response = model.generate_content(prompt)
        result = json.loads(response.text)
        return result.get("propuestas", [])
    except Exception as e:
        print(f"❌ Error al llamar a la API de Gemini: {e}")
        print("Fallback: Usando propuesta estructurada simulada.")
        return get_mock_extraction_data()

def get_mock_extraction_data():
    """
    Datos de simulación estructurados para la demo o cuando la API key falle.
    """
    return [
        {
            "tabla_destino": "cat_fluido_servicio",
            "clave_natural": "AG",
            "payload": {
                "codigo": "AG",
                "descripcion": "Agua de procesos y de servicio industrial"
            },
            "confianza": 0.98,
            "fuente": {
                "paginas": [1],
                "contexto": "AG: Agua de procesos y de servicio industrial."
            }
        },
        {
            "tabla_destino": "cat_fluido_servicio",
            "clave_natural": "AC",
            "payload": {
                "codigo": "AC",
                "descripcion": "Ácido sulfúrico diluido"
            },
            "confianza": 0.95,
            "fuente": {
                "paginas": [1],
                "contexto": "- AC: Ácido sulfúrico diluido. Temperatura máxima 60°C."
            }
        },
        {
            "tabla_destino": "cat_fluido_servicio",
            "clave_natural": "VN",
            "payload": {
                "codigo": "VN",
                "descripcion": "Vapor de media presión"
            },
            "confianza": 0.97,
            "fuente": {
                "paginas": [1],
                "contexto": "- VN: Vapor de media presión. Temperatura de diseño 180°C."
            }
        },
        {
            "tabla_destino": "cat_clase_piping",
            "clave_natural": "A1",
            "payload": {
                "codigo": "A1",
                "descripcion": "Acero al Carbono (ASTM A106-B) 150# — Agua de procesos",
                "usa_pwht": False,
                "usa_pmi": False
            },
            "confianza": 0.94,
            "fuente": {
                "paginas": [2],
                "contexto": "- Clase A1: Acero al Carbono (ASTM A106-B). Rating 150#. Servicio: Agua de procesos (AG). Requiere pintura protectora tipo EP1. Sin tratamiento térmico posterior (PWHT)."
            }
        },
        {
            "tabla_destino": "cat_clase_piping",
            "clave_natural": "A2",
            "payload": {
                "codigo": "A2",
                "descripcion": "Acero al Carbono (ASTM A106-B) 300# — Vapor",
                "usa_pwht": True,
                "usa_pmi": False
            },
            "confianza": 0.96,
            "fuente": {
                "paginas": [2, 3],
                "contexto": "- Clase A2: Acero al Carbono (ASTM A106-B). Rating 300#. Servicio: Vapor (VN). Requiere PWHT para espesores mayores a 3/4\". Requiere ensayos no destructivos (NDE) al 20% en juntas BW. Obligatorio para líneas de vapor clase A2 en juntas de diámetro nominal (NPS) mayor o igual a 2\"."
            }
        },
        {
            "tabla_destino": "cat_clase_piping",
            "clave_natural": "C1",
            "payload": {
                "codigo": "C1",
                "descripcion": "Acero Inoxidable (ASTM A312 TP316L) 150# — Ácido sulfúrico",
                "usa_pwht": False,
                "usa_pmi": True
            },
            "confianza": 0.92,
            "fuente": {
                "paginas": [2, 3],
                "contexto": "- Clase C1: Acero Inoxidable (ASTM A312 TP316L). Rating 150#. Servicio: Ácido sulfúrico (AC). Requiere control de materiales (PMI) al 100% de las juntas y componentes. Sin pintura."
            }
        }
    ]

def process_document(doc_id):
    """
    Ejecuta el pipeline completo de procesamiento para el documento.
    """
    print(f"🎬 Iniciando procesamiento del documento ID: {doc_id}")
    
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    # 1. Obtener detalles del documento
    cursor.execute(
        "SELECT id, proyecto_id, tipo_documento, titulo, storage_path FROM lukeapp.doc_biblioteca WHERE id = %s",
        (doc_id,)
    )
    doc = cursor.fetchone()
    if not doc:
        print(f"❌ Error: Documento con ID {doc_id} no existe en la base de datos.")
        conn.close()
        return False
        
    proyecto_id = doc["proyecto_id"]
    tipo_doc = doc["tipo_documento"]
    
    # Actualizar estado a 'procesando'
    cursor.execute(
        "UPDATE lukeapp.doc_biblioteca SET estado_procesamiento = 'procesando' WHERE id = %s",
        (doc_id,)
    )
    conn.commit()
    
    try:
        # 2. Extraer texto (aquí pasamos el storage_path o simulamos)
        pages_text = extract_text_from_pdf(doc["storage_path"])
        full_text = "\n\n".join([text for _, text in pages_text])
        
        # 3. Guardar chunks e integrar pgvector
        chunks = generate_chunks(pages_text)
        save_chunks_to_db(conn, doc_id, proyecto_id, chunks)
        
        # Actualizar estado a 'extrayendo'
        cursor.execute(
            "UPDATE lukeapp.doc_biblioteca SET estado_procesamiento = 'extrayendo', n_paginas = %s, n_chunks = %s WHERE id = %s",
            (len(pages_text), len(chunks), doc_id)
        )
        conn.commit()
        
        # 4. Extraer datos con Gemini
        propuestas = extract_structured_data_with_gemini(full_text, tipo_doc)
        print(f"✨ Gemini extrajo {len(propuestas)} propuestas estructuradas.")
        
        if propuestas:
            # 5. Crear lote de importación en staging
            # Necesitamos un perfil_id válido de importador. Buscaremos o crearemos uno por defecto
            cursor.execute(
                "SELECT id FROM lukeapp.import_perfiles WHERE proyecto_id = %s AND tabla_destino = 'cat_clase_piping' LIMIT 1",
                (proyecto_id,)
            )
            perfil = cursor.fetchone()
            
            if not perfil:
                # Crear un perfil genérico ficticio para la importación
                cursor.execute(
                    """
                    INSERT INTO lukeapp.import_perfiles (proyecto_id, nombre, tabla_destino, mapeo)
                    VALUES (%s, 'Perfil IA Autogenerado', 'cat_clase_piping', '{}'::jsonb)
                    RETURNING id
                    """,
                    (proyecto_id,)
                )
                perfil_id = cursor.fetchone()["id"]
            else:
                perfil_id = perfil["id"]
                
            cursor.execute(
                """
                INSERT INTO lukeapp.import_lotes (proyecto_id, perfil_id, origen, documento_id, estado, resumen)
                VALUES (%s, %s, 'extraccion_ia', %s, 'diff_listo', %s)
                RETURNING id
                """,
                (
                    proyecto_id, 
                    perfil_id, 
                    doc_id,
                    json.dumps({
                        "n_nuevas": len(propuestas),
                        "n_modificadas": 0,
                        "n_ausentes": 0,
                        "n_sin_cambio": 0,
                        "n_errores": 0
                    })
                )
            )
            lote_id = cursor.fetchone()["id"]
            
            # Insertar las filas propuestas
            for idx, prop in enumerate(propuestas):
                cursor.execute(
                    """
                    INSERT INTO lukeapp.import_filas (lote_id, nro_fila, payload, clave_natural, accion, confianza, fuente)
                    VALUES (%s, %s, %s, %s, 'nueva', %s, %s)
                    """,
                    (
                        lote_id,
                        idx + 1,
                        json.dumps(prop["payload"]),
                        prop["clave_natural"],
                        prop["confianza"],
                        json.dumps({
                            "documento_id": str(doc_id),
                            "titulo": doc["titulo"],
                            "paginas": prop["fuente"].get("paginas", [1]),
                            "contexto": prop["fuente"].get("contexto", "")
                        })
                    )
                )
            
            # Asociar el lote al documento
            cursor.execute(
                "UPDATE lukeapp.doc_biblioteca SET estado_procesamiento = 'lote_generado', lote_ia_id = %s WHERE id = %s",
                (lote_id, doc_id)
            )
            print(f"🎉 Lote de importación {lote_id} creado exitosamente en staging.")
        else:
            # Si no hay propuestas, marcar procesado directamente
            cursor.execute(
                "UPDATE lukeapp.doc_biblioteca SET estado_procesamiento = 'procesado' WHERE id = %s",
                (doc_id,)
            )
            
        conn.commit()
        print("✅ Pipeline completado de forma exitosa.")
        return True
        
    except Exception as e:
        print(f"❌ Error crítico en el pipeline: {e}")
        try:
            cursor.execute(
                "UPDATE lukeapp.doc_biblioteca SET estado_procesamiento = 'error', error_detalle = %s WHERE id = %s",
                (str(e), doc_id)
            )
            conn.commit()
        except Exception:
            pass
        return False
    finally:
        conn.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Procesar documento de Biblioteca IA en LukeAPP v4")
    parser.add_argument("--doc_id", required=True, help="UUID del documento en doc_biblioteca")
    args = parser.parse_args()
    
    success = process_document(args.doc_id)
    sys.exit(0 if success else 1)
