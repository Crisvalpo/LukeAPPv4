import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';

interface ConfiguracionBotPersonalProps {
  proyectoId: string;
}

interface BotStatus {
  success: boolean;
  status: 'connected' | 'connecting' | 'disconnected';
  botNumber: string | null;
  botName: string | null;
  lastConnectedAt: string | null;
  hasQr: boolean;
}

export const ConfiguracionBotPersonal: React.FC<ConfiguracionBotPersonalProps> = ({ proyectoId }) => {
  const STAFF_WORKER_URL = import.meta.env.VITE_STAFF_WORKER_URL || 'http://localhost:3030';
  
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorConexion, setErrorConexion] = useState<string | null>(null);
  const [ejecutandoAccion, setEjecutandoAccion] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${STAFF_WORKER_URL}/api/bot/status`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStatus(data);
      setErrorConexion(null);
      
      // Si no está conectado, obtenemos el código QR
      if (data.status !== 'connected') {
        fetchQr();
      } else {
        setQrDataUrl(null);
      }
    } catch (err: any) {
      console.error('Error conectando con staff-worker:', err);
      setErrorConexion(`No se pudo conectar con el servicio staff-worker en ${STAFF_WORKER_URL}. Asegúrate de que el microservicio esté corriendo.`);
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchQr = async () => {
    try {
      const res = await fetch(`${STAFF_WORKER_URL}/api/bot/qr`);
      if (res.ok) {
        const data = await res.json();
        if (data.qrDataUrl) {
          setQrDataUrl(data.qrDataUrl);
        } else {
          setQrDataUrl(null);
        }
      }
    } catch (err) {
      console.error('Error obteniendo QR:', err);
    }
  };

  useEffect(() => {
    fetchStatus();
    
    // Polling de estado cada 8 segundos para actualizar en tiempo real la vinculación
    const interval = setInterval(() => {
      fetchStatus();
    }, 8000);

    return () => clearInterval(interval);
  }, [proyectoId]);

  const handleRestart = async (logout: boolean) => {
    if (logout && !confirm('¿Estás seguro de que deseas desvincular el número de WhatsApp de personal actual? Esto cerrará la sesión y requerirá escanear un nuevo código QR.')) {
      return;
    }
    
    setEjecutandoAccion(true);
    try {
      const res = await fetch(`${STAFF_WORKER_URL}/api/bot/restart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logout })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      alert(logout ? 'Sesión desvinculada. Generando nuevo código QR...' : 'Reconectando puente...');
      await fetchStatus();
    } catch (err: any) {
      alert(`Error al ejecutar acción: ${err.message}`);
    } finally {
      setEjecutandoAccion(false);
    }
  };

  return (
    <div className="flex-grow p-6 space-y-6 bg-background text-foreground font-sans flex flex-col h-[calc(100vh-4rem)] overflow-y-auto">
      <div className="border-b border-border pb-4 shrink-0">
        <h2 className="text-xl font-bold text-white tracking-tight">Configuración del Bot de WhatsApp</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Vinculación de cuenta de WhatsApp y monitoreo del estado de conexión para el Bot de Asistencia y Cuadrillas de Terreno.
        </p>
      </div>

      {errorConexion && (
        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg text-xs text-red-400 font-semibold max-w-xl">
          ⚠️ {errorConexion}
        </div>
      )}

      {loading && !status ? (
        <div className="text-xs text-muted-foreground">Cargando estado del bot...</div>
      ) : status ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl">
          {/* Card de Estado del Bot */}
          <div className="bg-card border border-border/80 rounded-xl p-6 flex flex-col gap-4 shadow-lg h-fit">
            <h3 className="font-extrabold text-white text-sm tracking-tight border-b border-border/40 pb-2">
              Estado de la Sesión
            </h3>

            <div className="flex items-center gap-3">
              <span className={`w-3.5 h-3.5 rounded-full shrink-0 border ${
                status.status === 'connected' ? 'bg-emerald-500 border-emerald-600 animate-pulse' :
                status.status === 'connecting' ? 'bg-amber-500 border-amber-600 animate-pulse' :
                'bg-red-500 border-red-600'
              }`} />
              <div className="text-xs font-bold uppercase tracking-wider text-white">
                {status.status === 'connected' ? 'Bot Conectado y Activo' :
                 status.status === 'connecting' ? 'Conectando...' :
                 'Bot Desconectado'}
              </div>
            </div>

            <div className="text-xs space-y-2 text-muted-foreground bg-panel border border-border/30 rounded-lg p-4">
              {status.status === 'connected' && (
                <>
                  <div>
                    <span className="font-bold text-white">Número de Teléfono:</span> +{status.botNumber}
                  </div>
                  {status.botName && (
                    <div>
                      <span className="font-bold text-white">Nombre de Cuenta:</span> {status.botName}
                    </div>
                  )}
                  {status.lastConnectedAt && (
                    <div>
                      <span className="font-bold text-white">Última Conexión:</span> {new Date(status.lastConnectedAt).toLocaleString()}
                    </div>
                  )}
                </>
              )}
              {status.status !== 'connected' && (
                <div>
                  El bot no se encuentra conectado. Por favor, escanea el código QR que se muestra a la derecha para vincular el número de WhatsApp corporativo de personal.
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleRestart(false)}
                disabled={ejecutandoAccion}
              >
                Reconectar
              </Button>
              {status.status === 'connected' && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleRestart(true)}
                  disabled={ejecutandoAccion}
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10 border-red-500/20"
                >
                  Desvincular Bot
                </Button>
              )}
            </div>
          </div>

          {/* Card de Código QR */}
          <div className="bg-card border border-border/80 rounded-xl p-6 flex flex-col items-center justify-center gap-4 shadow-lg min-h-[350px]">
            <h3 className="font-extrabold text-white text-sm tracking-tight border-b border-border/40 pb-2 w-full text-left">
              Código QR de Vinculación
            </h3>

            {status.status === 'connected' ? (
              <div className="flex-grow flex flex-col items-center justify-center text-center p-4">
                <svg className="w-16 h-16 text-emerald-400 mb-2" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
                </svg>
                <p className="text-xs font-bold text-white">Bot correctamente vinculado</p>
                <p className="text-[10px] text-muted-foreground mt-1 max-w-xs">
                  Tu número de WhatsApp ya se encuentra enlazado al servicio. El bot está listo para recibir marcas y autoasignaciones.
                </p>
              </div>
            ) : qrDataUrl ? (
              <div className="flex-grow flex flex-col items-center justify-center p-2 bg-white rounded-lg">
                <img 
                  src={qrDataUrl} 
                  alt="WhatsApp QR Code" 
                  className="w-56 h-56 object-contain"
                />
                <span className="text-[9px] text-slate-800 font-bold uppercase tracking-wider mt-1">
                  Escanea desde WhatsApp Web
                </span>
              </div>
            ) : (
              <div className="flex-grow flex flex-col items-center justify-center text-center p-4 border border-dashed border-border/40 rounded-lg w-full bg-panel/30">
                <span className="text-[10px] text-muted-foreground">
                  {status.status === 'connecting' ? 'Generando código QR...' : 'Esperando estado del puente...'}
                </span>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ConfiguracionBotPersonal;
