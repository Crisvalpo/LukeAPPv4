import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';

interface Solicitud {
  id: string;
  email: string;
  nombre: string | null;
  telefono: string | null;
  mensaje_solicitud: string | null;
  proyecto_solicitado_id: string | null;
  solicitado_en: string;
}

interface ProyectoOpcion {
  id: string;
  codigo: string;
  nombre: string;
}

interface Usuario {
  id: string;
  email: string;
  nombre: string | null;
  telefono: string | null;
  estado_cuenta: 'pendiente' | 'aprobado' | 'rechazado';
  acceso_global: boolean;
  activo: boolean;
}

interface MembresiaConUsuario {
  id: string;
  rol: string;
  activo: boolean;
  usuario_id: string;
  usuarios: {
    email: string;
    nombre: string | null;
  } | null;
}

const ROLES = ['ADMIN', 'OT', 'QAQC', 'LOGISTICA', 'SUPERVISOR', 'GERENCIA'] as const;

interface GestionUsuariosProps {
  perfilGlobal: {
    acceso_global: boolean;
    puede_administrar_accesos: boolean;
  } | null;
  proyectoActivoId?: string | null;
}

export const GestionUsuarios: React.FC<GestionUsuariosProps> = ({ perfilGlobal, proyectoActivoId }) => {
  const [tab, setTab] = useState<'solicitudes' | 'miembros' | 'globales'>('solicitudes');
  const [proyectos, setProyectos] = useState<ProyectoOpcion[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // Estados para pestaña Miembros
  const [proyectoSel, setProyectoSel] = useState<string>('');
  const [miembros, setMiembros] = useState<MembresiaConUsuario[]>([]);
  const [mostrarAgregarMiembro, setMostrarAgregarMiembro] = useState(false);
  const [nuevoMiembroId, setNuevoMiembroId] = useState('');
  const [nuevoMiembroRol, setNuevoMiembroRol] = useState<typeof ROLES[number]>('OT');

  // Estados para acciones de solicitudes
  const [solicitudAccion, setSolicitudAccion] = useState<{ id: string; tipo: 'aprobar' | 'rechazar' } | null>(null);
  const [solicitudProyecto, setSolicitudProyecto] = useState('');
  const [solicitudRol, setSolicitudRol] = useState<typeof ROLES[number]>('OT');
  const [solicitudMotivo, setSolicitudMotivo] = useState('');

  // Estados para edición global
  const [usuarioEditando, setUsuarioEditando] = useState<Usuario | null>(null);

  const [procesando, setProcesando] = useState(false);
  const resetMensajes = () => { setError(null); setAviso(null); };

  // Inicializar proyecto seleccionado si viene de props
  useEffect(() => {
    if (proyectoActivoId) {
      setProyectoSel(proyectoActivoId);
      setTab('miembros');
    }
  }, [proyectoActivoId]);

  // Carga inicial
  const fetchDatosBase = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ data: proys }, { data: sols }] = await Promise.all([
        supabase.from('v_cartera_kpis').select('id, codigo, nombre').order('codigo'),
        supabase.rpc('solicitudes_pendientes'),
      ]);

      if (proys) setProyectos(proys as ProyectoOpcion[]);
      if (sols) setSolicitudes(sols as Solicitud[]);

      // Si tiene acceso global, cargar la lista de todos los usuarios
      if (perfilGlobal?.acceso_global) {
        const { data: usrs, error: errUsrs } = await supabase
          .from('usuarios')
          .select('id, email, nombre, telefono, estado_cuenta, acceso_global, activo')
          .order('email');
        if (errUsrs) throw errUsrs;
        if (usrs) setUsuarios(usrs as Usuario[]);
      }
    } catch (err: any) {
      setError(err.message || 'Error al cargar los datos base.');
    } finally {
      setLoading(false);
    }
  }, [perfilGlobal]);

  useEffect(() => {
    fetchDatosBase();
  }, [fetchDatosBase]);

  // Cargar miembros del proyecto seleccionado
  const fetchMiembrosProyecto = useCallback(async (proyId: string) => {
    if (!proyId) {
      setMiembros([]);
      return;
    }
    const { data, error: err } = await supabase
      .from('membresias')
      .select('id, rol, activo, usuario_id, usuarios(email, nombre)')
      .eq('proyecto_id', proyId);

    if (err) {
      setError(err.message);
    } else {
      setMiembros((data as any) ?? []);
    }
  }, []);

  useEffect(() => {
    if (proyectoSel && tab === 'miembros') {
      fetchMiembrosProyecto(proyectoSel);
    }
  }, [proyectoSel, tab, fetchMiembrosProyecto]);

  // Aprobación de solicitudes
  const handleAprobarSolicitud = async (solId: string) => {
    if (!solicitudProyecto) {
      setError('Por favor, selecciona un proyecto.');
      return;
    }
    setProcesando(true);
    setError(null);
    const { error: err } = await supabase.rpc('aprobar_usuario', {
      p_usuario_id: solId,
      p_proyecto_id: solicitudProyecto,
      p_rol: solicitudRol,
    });

    if (err) {
      setError(err.message);
    } else {
      setAviso('Usuario aprobado con éxito.');
      setSolicitudAccion(null);
      await fetchDatosBase();
    }
    setProcesando(false);
  };

  // Rechazo de solicitudes
  const handleRechazarSolicitud = async (solId: string) => {
    if (!solicitudMotivo.trim()) {
      setError('Por favor, ingresa el motivo del rechazo.');
      return;
    }
    setProcesando(true);
    setError(null);
    const { error: err } = await supabase.rpc('rechazar_usuario', {
      p_usuario_id: solId,
      p_motivo: solicitudMotivo.trim(),
    });

    if (err) {
      setError(err.message);
    } else {
      setAviso('Solicitud rechazada con éxito.');
      setSolicitudAccion(null);
      await fetchDatosBase();
    }
    setProcesando(false);
  };

  // Gestión de miembros: Agregar
  const handleAgregarMiembro = async () => {
    if (!nuevoMiembroId) {
      setError('Por favor, selecciona un usuario.');
      return;
    }
    setProcesando(true);
    setError(null);
    const { error: err } = await supabase.rpc('agregar_miembro', {
      p_usuario_id: nuevoMiembroId,
      p_proyecto_id: proyectoSel,
      p_rol: nuevoMiembroRol,
    });

    if (err) {
      setError(err.message);
    } else {
      setAviso('Miembro agregado al proyecto con éxito.');
      setMostrarAgregarMiembro(false);
      setNuevoMiembroId('');
      await fetchMiembrosProyecto(proyectoSel);
    }
    setProcesando(false);
  };

  // Gestión de miembros: Cambiar rol o de/activar
  const handleModificarMembresia = async (memId: string, rol: typeof ROLES[number], activo: boolean) => {
    setProcesando(true);
    setError(null);
    const { error: err } = await supabase.rpc('actualizar_miembro', {
      p_membresia_id: memId,
      p_rol: rol,
      p_activo: activo,
    });

    if (err) {
      setError(err.message);
    } else {
      setAviso('Membresía actualizada con éxito.');
      await fetchMiembrosProyecto(proyectoSel);
    }
    setProcesando(false);
  };

  // Gestión de miembros: Eliminar físicamente
  const handleQuitarMembresia = async (memId: string) => {
    if (!window.confirm('¿Estás seguro de que deseas quitar este miembro de este proyecto?')) return;
    setProcesando(true);
    setError(null);
    const { error: err } = await supabase.rpc('quitar_miembro', {
      p_membresia_id: memId,
    });

    if (err) {
      setError(err.message);
    } else {
      setAviso('Miembro removido con éxito.');
      await fetchMiembrosProyecto(proyectoSel);
    }
    setProcesando(false);
  };

  // Edición global (GERENCIA)
  const handleGuardarCambiosGlobales = async () => {
    if (!usuarioEditando) return;
    setProcesando(true);
    setError(null);
    const { error: err } = await supabase.rpc('actualizar_usuario_global', {
      p_usuario_id: usuarioEditando.id,
      p_estado_cuenta: usuarioEditando.estado_cuenta,
      p_acceso_global: usuarioEditando.acceso_global,
      p_activo: usuarioEditando.activo,
    });

    if (err) {
      setError(err.message);
    } else {
      setAviso('Usuario global actualizado correctamente.');
      setUsuarioEditando(null);
      await fetchDatosBase();
    }
    setProcesando(false);
  };

  const activeSolicitudesCount = solicitudes.length;

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 font-sans">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-extrabold text-white tracking-tight">Accesos y Usuarios</h1>
        <p className="text-muted text-xs mt-1">Panel administrativo de control de accesos y roles del sistema.</p>
      </div>

      {/* Tabs */}
      <div className="bg-panel/40 border border-border p-1 rounded-lg flex gap-1 mb-6 max-w-md">
        <button
          onClick={() => { setTab('solicitudes'); resetMensajes(); }}
          className={`flex-1 text-center py-1.5 px-3 rounded-md text-xs font-semibold tracking-wide transition-all ${
            tab === 'solicitudes'
              ? 'bg-accent text-white shadow'
              : 'text-muted hover:text-white'
          }`}
        >
          Solicitudes {activeSolicitudesCount > 0 && (
            <span className="ml-1 bg-red-500 text-white rounded-full px-1.5 py-0.5 text-[10px] font-bold">
              {activeSolicitudesCount}
            </span>
          )}
        </button>
        <button
          onClick={() => { setTab('miembros'); resetMensajes(); }}
          className={`flex-1 text-center py-1.5 px-3 rounded-md text-xs font-semibold tracking-wide transition-all ${
            tab === 'miembros'
              ? 'bg-accent text-white shadow'
              : 'text-muted hover:text-white'
          }`}
        >
          Miembros de Proyectos
        </button>
        {perfilGlobal?.acceso_global && (
          <button
            onClick={() => { setTab('globales'); resetMensajes(); }}
            className={`flex-1 text-center py-1.5 px-3 rounded-md text-xs font-semibold tracking-wide transition-all ${
              tab === 'globales'
                ? 'bg-accent text-white shadow'
                : 'text-muted hover:text-white'
            }`}
          >
            Usuarios Globales
          </button>
        )}
      </div>

      {/* Alertas */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/25 rounded-lg px-4 py-3 text-red-400 text-xs mb-6">
          ⚠️ {error}
        </div>
      )}
      {aviso && (
        <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-lg px-4 py-3 text-emerald-400 text-xs mb-6">
          ✓ {aviso}
        </div>
      )}

      {loading ? (
        <div className="text-center py-20 text-muted text-sm">Cargando datos del panel…</div>
      ) : (
        <>
          {/* TAB SOLICITUDES */}
          {tab === 'solicitudes' && (
            <div className="flex flex-col gap-4">
              {solicitudes.length === 0 ? (
                <div className="text-center py-12 bg-panel/20 border border-border border-dashed rounded-xl text-muted text-xs">
                  No hay solicitudes de acceso pendientes en este momento.
                </div>
              ) : (
                solicitudes.map((s) => (
                  <Card key={s.id} className="bg-panel/40 border-border">
                    <CardHeader className="flex flex-row justify-between items-start flex-wrap gap-4 pb-3">
                      <div>
                        <CardTitle className="text-sm text-white font-bold">{s.nombre || 'Usuario sin nombre'}</CardTitle>
                        <p className="text-xs text-muted mt-1">
                          {s.email} {s.telefono ? `· ${s.telefono}` : ''}
                        </p>
                        <p className="text-[10px] text-muted/60 mt-0.5">
                          Solicitado: {new Date(s.solicitado_en).toLocaleString('es-CL')}
                        </p>
                        <p className="text-[11px] font-semibold text-accent mt-1.5">
                          Proyecto solicitado: {
                            s.proyecto_solicitado_id
                              ? (proyectos.find(p => p.id === s.proyecto_solicitado_id)
                                  ? `${proyectos.find(p => p.id === s.proyecto_solicitado_id)!.codigo} — ${proyectos.find(p => p.id === s.proyecto_solicitado_id)!.nombre}`
                                  : 'Proyecto fuera de tu alcance')
                              : 'Sin proyecto especificado'
                          }
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            setSolicitudAccion({ id: s.id, tipo: 'aprobar' });
                            setSolicitudProyecto(s.proyecto_solicitado_id || '');
                            setSolicitudRol('OT');
                            resetMensajes();
                          }}
                        >
                          ✓ Aprobar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30"
                          onClick={() => {
                            setSolicitudAccion({ id: s.id, tipo: 'rechazar' });
                            setSolicitudMotivo('');
                            resetMensajes();
                          }}
                        >
                          ✕ Rechazar
                        </Button>
                      </div>
                    </CardHeader>
                    {s.mensaje_solicitud && (
                      <CardContent className="pb-3 text-xs text-foreground/90">
                        <div className="bg-background/50 border border-border/40 rounded-lg p-3 leading-relaxed">
                          <span className="font-semibold text-muted text-[10px] block mb-1">MENSAJE DE SOLICITUD:</span>
                          "{s.mensaje_solicitud}"
                        </div>
                      </CardContent>
                    )}

                    {/* Sub-formulario Aprobación */}
                    {solicitudAccion?.id === s.id && solicitudAccion.tipo === 'aprobar' && (
                      <CardContent className="border-t border-border/40 pt-4 flex gap-4 flex-wrap items-end bg-background/20 rounded-b-xl">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-bold text-muted uppercase">Proyecto a asignar</label>
                          <select
                            value={solicitudProyecto}
                            onChange={(e) => setSolicitudProyecto(e.target.value)}
                            className="bg-card border border-border text-foreground text-xs rounded-lg p-2 min-w-[200px]"
                          >
                            <option value="">— Selecciona —</option>
                            {proyectos.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.codigo} — {p.nombre}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-bold text-muted uppercase">Rol asignado</label>
                          <select
                            value={solicitudRol}
                            onChange={(e) => setSolicitudRol(e.target.value as typeof ROLES[number])}
                            className="bg-card border border-border text-foreground text-xs rounded-lg p-2 min-w-[120px]"
                          >
                            {ROLES.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        </div>
                        <Button
                          size="sm"
                          disabled={procesando}
                          onClick={() => handleAprobarSolicitud(s.id)}
                        >
                          {procesando ? 'Aprobando…' : 'Confirmar Aprobación'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSolicitudAccion(null)}
                        >
                          Cancelar
                        </Button>
                      </CardContent>
                    )}

                    {/* Sub-formulario Rechazo */}
                    {solicitudAccion?.id === s.id && solicitudAccion.tipo === 'rechazar' && (
                      <CardContent className="border-t border-border/40 pt-4 flex gap-4 flex-wrap items-end bg-background/20 rounded-b-xl">
                        <div className="flex flex-col gap-1.5 flex-1 min-w-[240px]">
                          <label className="text-[10px] font-bold text-muted uppercase">Motivo del rechazo</label>
                          <Input
                            type="text"
                            value={solicitudMotivo}
                            onChange={(e) => setSolicitudMotivo(e.target.value)}
                            placeholder="Ej: No corresponde a personal o contratistas de LukeAPP."
                            required
                          />
                        </div>
                        <Button
                          variant="outline"
                          className="bg-red-500 hover:bg-red-600 text-white border-none"
                          size="sm"
                          disabled={procesando}
                          onClick={() => handleRechazarSolicitud(s.id)}
                        >
                          {procesando ? 'Rechazando…' : 'Confirmar Rechazo'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSolicitudAccion(null)}
                        >
                          Cancelar
                        </Button>
                      </CardContent>
                    )}
                  </Card>
                ))
              )}
            </div>
          )}

          {/* TAB MIEMBROS */}
          {tab === 'miembros' && (
            <div className="flex flex-col gap-6">
              {/* Selección del proyecto */}
              <div className="flex gap-4 items-end flex-wrap bg-panel/20 p-4 border border-border rounded-xl">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-muted uppercase">Selecciona el Proyecto</label>
                  <select
                    value={proyectoSel}
                    onChange={(e) => {
                      setProyectoSel(e.target.value);
                      setMostrarAgregarMiembro(false);
                      resetMensajes();
                    }}
                    className="bg-card border border-border text-foreground text-xs rounded-lg p-2 min-w-[260px]"
                  >
                    <option value="">— Elige un proyecto —</option>
                    {proyectos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.codigo} — {p.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                {proyectoSel && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setMostrarAgregarMiembro(true);
                      setNuevoMiembroId('');
                      setNuevoMiembroRol('OT');
                    }}
                  >
                    + Agregar Miembro
                  </Button>
                )}
              </div>

              {proyectoSel && mostrarAgregarMiembro && (
                <div className="bg-panel/40 border border-border/80 rounded-xl p-5 flex flex-col gap-4">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wide">Agregar Miembro al Proyecto</h3>
                  <div className="flex gap-4 flex-wrap items-end">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-muted uppercase">Usuario aprobado</label>
                      <select
                        value={nuevoMiembroId}
                        onChange={(e) => setNuevoMiembroId(e.target.value)}
                        className="bg-card border border-border text-foreground text-xs rounded-lg p-2 min-w-[260px]"
                      >
                        <option value="">— Selecciona un usuario —</option>
                        {usuarios
                          .filter(u => u.estado_cuenta === 'aprobado' && !miembros.some(m => m.usuario_id === u.id))
                          .map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.nombre ? `${u.nombre} (${u.email})` : u.email}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-muted uppercase">Rol</label>
                      <select
                        value={nuevoMiembroRol}
                        onChange={(e) => setNuevoMiembroRol(e.target.value as typeof ROLES[number])}
                        className="bg-card border border-border text-foreground text-xs rounded-lg p-2 min-w-[120px]"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Button
                      size="sm"
                      disabled={procesando}
                      onClick={handleAgregarMiembro}
                    >
                      {procesando ? 'Agregando…' : 'Agregar'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setMostrarAgregarMiembro(false)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}

              {proyectoSel && (
                <div className="overflow-x-auto border border-border rounded-xl bg-card">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-panel/40 border-b border-border/80 text-muted uppercase tracking-wider text-[10px] font-bold">
                        <th className="p-4">Miembro</th>
                        <th className="p-4">Email</th>
                        <th className="p-4 w-40">Rol</th>
                        <th className="p-4 w-32">Estado</th>
                        <th className="p-4 w-28 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {miembros.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-muted text-xs">
                            Este proyecto no tiene miembros asignados de momento.
                          </td>
                        </tr>
                      ) : (
                        miembros.map((m) => (
                          <tr key={m.id} className="hover:bg-panel/10">
                            <td className="p-4 text-white font-semibold">
                              {m.usuarios?.nombre || '—'}
                            </td>
                            <td className="p-4 text-muted">
                              {m.usuarios?.email || '—'}
                            </td>
                            <td className="p-4">
                              <select
                                value={m.rol}
                                disabled={procesando}
                                onChange={(e) =>
                                  handleModificarMembresia(m.id, e.target.value as typeof ROLES[number], m.activo)
                                }
                                className="bg-background border border-border text-foreground text-xs rounded-lg p-1 w-full"
                              >
                                {ROLES.map((r) => (
                                  <option key={r} value={r}>
                                    {r}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="p-4">
                              <select
                                value={m.activo ? 'true' : 'false'}
                                disabled={procesando}
                                onChange={(e) =>
                                  handleModificarMembresia(m.id, m.rol as typeof ROLES[number], e.target.value === 'true')
                                }
                                className={`border text-xs rounded-lg p-1 w-full font-bold ${
                                  m.activo
                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                    : 'bg-red-500/10 border-red-500/30 text-red-400'
                                }`}
                              >
                                <option value="true">Activo</option>
                                <option value="false">Inactivo</option>
                              </select>
                            </td>
                            <td className="p-4 text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                className="hover:bg-red-500/15 hover:text-red-400 hover:border-red-500/40 text-muted border-border/80"
                                onClick={() => handleQuitarMembresia(m.id)}
                              >
                                Quitar
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB GLOBALES */}
          {tab === 'globales' && (
            <div className="flex flex-col gap-6">
              {usuarioEditando && (
                <div className="bg-panel/40 border border-border rounded-xl p-5 flex flex-col gap-4">
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wide">Editar Cuenta de Usuario Global</h3>
                    <p className="text-xs text-muted mt-0.5">{usuarioEditando.email}</p>
                  </div>
                  <div className="flex gap-4 flex-wrap items-end">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-muted uppercase">Estado Cuenta</label>
                      <select
                        value={usuarioEditando.estado_cuenta}
                        onChange={(e) =>
                          setUsuarioEditando({
                            ...usuarioEditando,
                            estado_cuenta: e.target.value as any,
                          })
                        }
                        className="bg-card border border-border text-foreground text-xs rounded-lg p-2 min-w-[140px]"
                      >
                        <option value="pendiente">Pendiente</option>
                        <option value="aprobado">Aprobado</option>
                        <option value="rechazado">Rechazado</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-muted uppercase">Acceso Global (GERENCIA)</label>
                      <select
                        value={usuarioEditando.acceso_global ? 'true' : 'false'}
                        onChange={(e) =>
                          setUsuarioEditando({
                            ...usuarioEditando,
                            acceso_global: e.target.value === 'true',
                          })
                        }
                        className="bg-card border border-border text-foreground text-xs rounded-lg p-2 min-w-[140px]"
                      >
                        <option value="true">Sí (Acceso completo)</option>
                        <option value="false">No (Por membresías)</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-muted uppercase">Activación de Cuenta</label>
                      <select
                        value={usuarioEditando.activo ? 'true' : 'false'}
                        onChange={(e) =>
                          setUsuarioEditando({
                            ...usuarioEditando,
                            activo: e.target.value === 'true',
                          })
                        }
                        className="bg-card border border-border text-foreground text-xs rounded-lg p-2 min-w-[120px]"
                      >
                        <option value="true">Activa</option>
                        <option value="false">Desactivada (Bloquear)</option>
                      </select>
                    </div>
                    <Button
                      size="sm"
                      disabled={procesando}
                      onClick={handleGuardarCambiosGlobales}
                    >
                      {procesando ? 'Guardando…' : 'Guardar Cambios'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setUsuarioEditando(null)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto border border-border rounded-xl bg-card">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-panel/40 border-b border-border/80 text-muted uppercase tracking-wider text-[10px] font-bold">
                      <th className="p-4">Nombre / Teléfono</th>
                      <th className="p-4">Email</th>
                      <th className="p-4">Estado Cuenta</th>
                      <th className="p-4">Acceso Global</th>
                      <th className="p-4">Cuenta Activa</th>
                      <th className="p-4 w-24 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {usuarios.map((u) => (
                      <tr key={u.id} className="hover:bg-panel/10">
                        <td className="p-4">
                          <span className="text-white font-semibold block">{u.nombre || '—'}</span>
                          {u.telefono && <span className="text-muted text-[10px] block mt-0.5">{u.telefono}</span>}
                        </td>
                        <td className="p-4 text-muted">{u.email}</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            u.estado_cuenta === 'aprobado' ? 'bg-emerald-500/10 text-emerald-400' :
                            u.estado_cuenta === 'pendiente' ? 'bg-amber-500/10 text-amber-400' :
                            'bg-red-500/10 text-red-400'
                          }`}>
                            {u.estado_cuenta}
                          </span>
                        </td>
                        <td className="p-4 font-semibold">
                          {u.acceso_global ? (
                            <span className="text-accent">GERENCIA (Sí)</span>
                          ) : (
                            <span className="text-muted">No</span>
                          )}
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            u.activo ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                          }`}>
                            {u.activo ? 'Activa' : 'Inactiva'}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={procesando}
                            onClick={() => {
                              setUsuarioEditando(u);
                              resetMensajes();
                            }}
                          >
                            Editar
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

