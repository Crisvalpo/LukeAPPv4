import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { Button } from '../ui/Button';

interface ProyectoIntegraciones {
  id?: string;
  proyecto_id: string;
  proveedor: 'sharepoint_onedrive';
  config: {
    tenant_id?: string;
    client_id?: string;
    client_secret?: string;
    folder_path_excel?: string;
    folder_path_pdfs?: string;
  };
  activo: boolean;
}

interface ConfiguracionIntegracionProps {
  proyectoId: string;
  onClose?: () => void;
}

export const ConfiguracionIntegracion: React.FC<ConfiguracionIntegracionProps> = ({ proyectoId, onClose }) => {
  const [integracion, setIntegracion] = useState<ProyectoIntegraciones>({
    proyecto_id: proyectoId,
    proveedor: 'sharepoint_onedrive',
    config: {
      tenant_id: '',
      client_id: '',
      client_secret: '',
      folder_path_excel: '',
      folder_path_pdfs: '',
    },
    activo: true,
  });

  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      setLoading(true);
      setMensaje(null);
      try {
        const { data, error } = await supabase
          .from('proyecto_integraciones')
          .select('*')
          .eq('proyecto_id', proyectoId)
          .eq('proveedor', 'sharepoint_onedrive')
          .maybeSingle();

        if (error) throw error;
        if (data) {
          setIntegracion(data as ProyectoIntegraciones);
        }
      } catch (err) {
        console.error('Error al cargar configuración de integraciones:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, [proyectoId]);

  const handleChangeConfig = (campo: string, valor: string) => {
    setIntegracion((prev) => ({
      ...prev,
      config: {
        ...prev.config,
        [campo]: valor,
      },
    }));
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    setMensaje(null);

    try {
      let res;
      if (integracion.id) {
        res = await supabase
          .from('proyecto_integraciones')
          .update({
            config: integracion.config,
            activo: integracion.activo,
          })
          .eq('id', integracion.id);
      } else {
        res = await supabase
          .from('proyecto_integraciones')
          .insert({
            proyecto_id: proyectoId,
            proveedor: 'sharepoint_onedrive',
            config: integracion.config,
            activo: integracion.activo,
          });
      }

      if (res.error) throw res.error;
      setMensaje({ tipo: 'exito', texto: 'Configuración de integración guardada exitosamente.' });
      
      // Recargar la config para obtener el ID en caso de insert
      const { data } = await supabase
        .from('proyecto_integraciones')
        .select('*')
        .eq('proyecto_id', proyectoId)
        .eq('proveedor', 'sharepoint_onedrive')
        .maybeSingle();
      if (data) setIntegracion(data as ProyectoIntegraciones);

    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: err.message || 'Error al guardar la configuración.' });
    } finally {
      setGuardando(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-10 text-muted-foreground text-sm font-medium">
        Cargando configuración de integraciones...
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto bg-panel border border-border p-6 rounded-lg shadow-xl mt-6">
      <div className="flex justify-between items-center mb-6 border-b border-border pb-4">
        <div>
          <h3 className="text-lg font-bold text-white leading-tight">Configuración de Integración</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Parámetros de conexión a SharePoint y OneDrive corporativos a través de Microsoft Graph API.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase font-bold tracking-wider text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
            Cables Listos
          </span>
          {onClose && (
            <button onClick={onClose} className="text-muted-foreground hover:text-white transition-colors text-sm">
              ✕
            </button>
          )}
        </div>
      </div>

      <form onSubmit={handleGuardar} className="space-y-5">
        {mensaje && (
          <div className={`p-3 text-xs font-semibold rounded border ${
            mensaje.tipo === 'exito' 
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
              : 'bg-red-500/10 text-red-400 border-red-500/20'
          }`}>
            {mensaje.texto}
          </div>
        )}

        <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded text-xs text-yellow-400 font-medium">
          ⚠️ <strong>Nota:</strong> Actualmente el acceso a la Graph API no está conectado en el servidor de producción. La configuración quedará guardada y lista ("cables listos"), pero el sistema continuará operando bajo la modalidad de subida manual (Drag & Drop) de planillas y PDFs en el importador como fallback plenamente funcional.
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5 col-span-2">
            <label className="text-xs font-semibold text-white">Azure Tenant ID</label>
            <input 
              type="text" 
              placeholder="00000000-0000-0000-0000-000000000000"
              value={integracion.config.tenant_id || ''}
              onChange={(e) => handleChangeConfig('tenant_id', e.target.value)}
              className="bg-card border border-border text-foreground px-3 py-2 rounded text-xs font-medium focus:outline-none focus:border-accent w-full"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-white">Azure Client ID (App ID)</label>
            <input 
              type="text" 
              placeholder="00000000-0000-0000-0000-000000000000"
              value={integracion.config.client_id || ''}
              onChange={(e) => handleChangeConfig('client_id', e.target.value)}
              className="bg-card border border-border text-foreground px-3 py-2 rounded text-xs font-medium focus:outline-none focus:border-accent w-full"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-white">Client Secret (Valor Secreto)</label>
            <input 
              type="password" 
              placeholder="••••••••••••••••"
              value={integracion.config.client_secret || ''}
              onChange={(e) => handleChangeConfig('client_secret', e.target.value)}
              className="bg-card border border-border text-foreground px-3 py-2 rounded text-xs font-medium focus:outline-none focus:border-accent w-full"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-white">Ruta de Carpeta de Planillas Excel</label>
            <input 
              type="text" 
              placeholder="ej: 1 - APP/1_Tablas_MS/LIST"
              value={integracion.config.folder_path_excel || ''}
              onChange={(e) => handleChangeConfig('folder_path_excel', e.target.value)}
              className="bg-card border border-border text-foreground px-3 py-2 rounded text-xs font-medium focus:outline-none focus:border-accent w-full"
            />
            <span className="text-[10px] text-muted-foreground">Carpeta donde residen las tablas LIST del cubicador</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-white">Ruta de Carpeta de Planos PDF</label>
            <input 
              type="text" 
              placeholder="ej: 1 - APP/2_Documentos_PDF"
              value={integracion.config.folder_path_pdfs || ''}
              onChange={(e) => handleChangeConfig('folder_path_pdfs', e.target.value)}
              className="bg-card border border-border text-foreground px-3 py-2 rounded text-xs font-medium focus:outline-none focus:border-accent w-full"
            />
            <span className="text-[10px] text-muted-foreground">Carpeta donde se depositan los PDFs vigentes desde Aconex</span>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-border mt-4">
          <input 
            type="checkbox" 
            id="integracion_activo"
            checked={integracion.activo}
            onChange={(e) => setIntegracion(prev => ({ ...prev, activo: e.target.checked }))}
            className="w-4 h-4 accent-accent"
          />
          <label htmlFor="integracion_activo" className="text-xs font-semibold text-white cursor-pointer select-none">
            Activar integración para este proyecto
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          {onClose && (
            <Button variant="outline" size="sm" type="button" onClick={onClose} disabled={guardando}>
              Cancelar
            </Button>
          )}
          <Button variant="primary" size="sm" type="submit" disabled={guardando}>
            {guardando ? 'Guardando...' : 'Guardar Configuración'}
          </Button>
        </div>
      </form>
    </div>
  );
};
