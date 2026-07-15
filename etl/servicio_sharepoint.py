# -*- coding: utf-8 -*-
"""
LukeAPP v4 — Servicio de Integración SharePoint / Microsoft Graph API
Estrategia "Cables Listos" con Fallback de Carga Manual
"""
import os
import logging
import httpx
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)

class SharePointService:
    def __init__(self, tenant_id: Optional[str] = None, client_id: Optional[str] = None, 
                 client_secret: Optional[str] = None, drive_id: Optional[str] = None):
        """
        Inicializa el servicio de SharePoint/OneDrive.
        Si no se proveen las credenciales, intentará leerlas de las variables de entorno o la base de datos.
        """
        self.tenant_id = tenant_id or os.getenv("MICROSOFT_TENANT_ID")
        self.client_id = client_id or os.getenv("MICROSOFT_CLIENT_ID")
        self.client_secret = client_secret or os.getenv("MICROSOFT_CLIENT_SECRET")
        self.drive_id = drive_id or os.getenv("SHAREPOINT_DRIVE_ID")
        self.access_token = None
        self.client = httpx.Client(timeout=30.0)

    def esta_configurado(self) -> bool:
        """Verifica si el conector cuenta con las credenciales mínimas configuradas."""
        return all([self.tenant_id, self.client_id, self.client_secret])

    def conectar(self) -> bool:
        """
        Obtiene el Access Token de Azure AD (Microsoft Graph API) usando client credentials flow.
        Retorna True si la conexión fue exitosa, False en caso contrario.
        """
        if not self.esta_configurado():
            logger.warning("Conector SharePoint: Cables listos pero faltan credenciales (Tenant/Client ID/Secret).")
            return False
            
        url = f"https://login.microsoftonline.com/{self.tenant_id}/oauth2/v2.0/token"
        headers = {"Content-Type": "application/x-www-form-urlencoded"}
        data = {
            "client_id": self.client_id,
            "scope": "https://graph.microsoft.com/.default",
            "client_secret": self.client_secret,
            "grant_type": "client_credentials"
        }
        
        try:
            response = self.client.post(url, headers=headers, data=data)
            if response.status_code == 200:
                self.access_token = response.json().get("access_token")
                logger.info("Conexión exitosa a Microsoft Graph API.")
                return True
            else:
                logger.error(f"Error de autenticación Azure AD: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            logger.exception(f"Error al conectar con Microsoft Graph API: {str(e)}")
            return False

    def descargar_archivo_excel(self, ruta_archivo_sharepoint: str, ruta_destino_local: str) -> bool:
        """
        Descarga un archivo Excel específico de SharePoint/OneDrive y lo guarda localmente.
        Si la conexión no está activa o falla, este método retorna False
        permitiendo que el importador use la carga manual como fallback.
        """
        if not self.access_token and not self.conectar():
            logger.warning("Sincronización automática deshabilitada o sin credenciales Graph. Usar fallback de carga manual.")
            return False

        # Endpoint de Microsoft Graph para descargar archivos por su ruta relativa en la biblioteca
        # URL formateada: /drives/{drive-id}/root:/{path}:/content o /me/drive/root:/{path}:/content
        drive_prefix = f"/drives/{self.drive_id}" if self.drive_id else "/me/drive"
        url = f"https://graph.microsoft.com/v1.0{drive_prefix}/root:/{ruta_archivo_sharepoint.lstrip('/')}:/content"
        headers = {"Authorization": f"Bearer {self.access_token}"}

        try:
            logger.info(f"Descargando archivo de SharePoint: {ruta_archivo_sharepoint}")
            response = self.client.get(url, headers=headers, follow_redirects=True)
            if response.status_code == 200:
                os.makedirs(os.path.dirname(ruta_destino_local), exist_ok=True)
                with open(ruta_destino_local, "wb") as f:
                    f.write(response.content)
                logger.info(f"Archivo guardado exitosamente en: {ruta_destino_local}")
                return True
            else:
                logger.error(f"Error al descargar de Graph API: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            logger.exception(f"Error descargando archivo desde SharePoint: {str(e)}")
            return False

    def escanear_planos_vigentes(self, ruta_carpeta_sharepoint: str) -> List[Dict[str, Any]]:
        """
        Escanea un directorio en SharePoint en busca de nuevos planos o P&IDs en PDF.
        Retorna un listado de diccionarios con metadatos del archivo para su posterior importación.
        Ejemplo de retorno: [{'nombre': '413-PID-101_RevB.pdf', 'ruta': '/pid/413-PID-101_RevB.pdf', 'size_bytes': 104822, 'hash': '...'}]
        """
        if not self.access_token and not self.conectar():
            logger.warning("Escaneo de planos en SharePoint inactivo por falta de credenciales Graph.")
            return []

        drive_prefix = f"/drives/{self.drive_id}" if self.drive_id else "/me/drive"
        url = f"https://graph.microsoft.com/v1.0{drive_prefix}/root:/{ruta_carpeta_sharepoint.strip('/')}:/children"
        headers = {"Authorization": f"Bearer {self.access_token}"}

        planos_detectados = []
        try:
            logger.info(f"Escaneando carpeta de SharePoint: {ruta_carpeta_sharepoint}")
            response = self.client.get(url, headers=headers)
            if response.status_code == 200:
                items = response.json().get("value", [])
                for item in items:
                    # Filtrar solo archivos PDF
                    if item.get("file") and item.get("name", "").lower().endswith(".pdf"):
                        planos_detectados.append({
                            "nombre": item.get("name"),
                            "ruta_descarga": item.get("@microsoft.graph.downloadUrl"),
                            "ruta_relativa": f"{ruta_carpeta_sharepoint.strip('/')}/{item.get('name')}",
                            "size_bytes": item.get("size"),
                            "id_graph": item.get("id"),
                            "sha1_hash": item.get("file", {}).get("hashes", {}).get("sha1Hash")
                        })
                logger.info(f"Se encontraron {len(planos_detectados)} archivos PDF en SharePoint.")
            else:
                logger.error(f"Error al escanear directorio en Graph API: {response.status_code} - {response.text}")
        except Exception as e:
            logger.exception(f"Error escaneando carpeta en SharePoint: {str(e)}")
            
        return planos_detectados

    def descargar_plano_binario(self, url_descarga_graph: str) -> Optional[bytes]:
        """
        Descarga el binario del PDF usando el downloadUrl temporal provisto por Microsoft Graph.
        """
        try:
            response = self.client.get(url_descarga_graph, follow_redirects=True)
            if response.status_code == 200:
                return response.content
            else:
                logger.error(f"Error descargando binario de plano: {response.status_code}")
                return None
        except Exception as e:
            logger.exception(f"Error al descargar binario desde Graph downloadUrl: {str(e)}")
            return None
            
    def __del__(self):
        try:
            self.client.close()
        except:
            pass
