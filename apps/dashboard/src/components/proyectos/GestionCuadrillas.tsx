import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { Button } from '../ui/Button';


interface GestionCuadrillasProps {
  proyectoId: string;
  triggerCrear?: number;
}

interface Cuadrilla {
  id: string;
  nombre: string;
  capataz_id: string | null;
  supervisor_id: string | null;
  especialidad: string;
  activo: boolean;
  capataz?: { nombre: string } | null;
}

interface Asignacion {
  id: string;
  cuadrilla_id: string;
  trabajador_id: string;
  fecha: string;
  trabajador?: { nombre: string; cargo: string; especialidad: string } | null;
}

interface Personal {
  id: string;
  nombre: string;
  cargo: string;
  especialidad: string;
  activo: boolean;
}

interface MiembroProyecto {
  usuario_id: string;
  usuarios: { nombre: string; email: string } | null;
}

export const GestionCuadrillas: React.FC<GestionCuadrillasProps> = ({ proyectoId, triggerCrear }) => {
  const [cuadrillas, setCuadrillas] = useState<Cuadrilla[]>([]);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [personal, setPersonal] = useState<Personal[]>([]);
  const [miembros, setMiembros] = useState<MiembroProyecto[]>([]);
  const [presentesHoyIds, setPresentesHoyIds] = useState<string[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [mostrarModal, setMostrarModal] = useState(false);
  
  // Formulario de nueva cuadrilla
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoCapatazId, setNuevoCapatazId] = useState('');
  const [nuevoSupervisorId, setNuevoSupervisorId] = useState('');
  const [nuevaEspecialidad, setNuevaEspecialidad] = useState('piping');
  const [creando, setCreando] = useState(false);

  const fechaHoy = new Date().toISOString().split('T')[0];

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Obtener cuadrillas
      const { data: cuads, error: errCuads } = await supabase
        .from('list_cuadrillas')
        .select('*, capataz:capataz_id(nombre)')
        .eq('proyecto_id', proyectoId)
        .eq('activo', true)
        .order('nombre');
      if (errCuads) throw errCuads;
      setCuadrillas(cuads ?? []);

      // 2. Obtener personal activo completo
      const { data: pers, error: errPers } = await supabase
        .from('cat_personal')
        .select('id, nombre, cargo, especialidad, activo')
        .eq('proyecto_id', proyectoId)
        .eq('activo', true)
        .order('nombre');
      if (errPers) throw errPers;
      setPersonal(pers ?? []);

      // 3. Obtener miembros con membresía para el selector de supervisores
      const { data: mems, error: errMems } = await supabase
        .from('membresias')
        .select('usuario_id, usuarios(nombre, email)')
        .eq('proyecto_id', proyectoId)
        .eq('activo', true);
      if (errMems) throw errMems;
      setMiembros((mems as any) ?? []);

      // 4. Obtener asistencia registrada de hoy (para filtrar quién está presente)
      const { data: asistencias, error: errAsist } = await supabase
        .from('log_asistencia')
        .select('trabajador_id')
        .eq('proyecto_id', proyectoId)
        .eq('fecha', fechaHoy)
        .eq('estado', 'presente');
      if (errAsist) throw errAsist;
      setPresentesHoyIds((asistencias ?? []).map(a => a.trabajador_id));

      // 5. Obtener asignaciones diarias
      const { data: asigs, error: errAsigs } = await supabase
        .from('rel_cuadrilla_trabajadores')
        .select('*, trabajador:trabajador_id(nombre, cargo, especialidad)')
        .eq('proyecto_id', proyectoId)
        .eq('fecha', fechaHoy);
      if (errAsigs) throw errAsigs;
      setAsignaciones((asigs as any) ?? []);
    } catch (e) {
      console.error('Error cargando datos de cuadrillas:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (triggerCrear && triggerCrear > 0) {
      setMostrarModal(true);
    }
  }, [triggerCrear]);

  useEffect(() => {
    fetchData();
  }, [proyectoId]);

  const handleCrearCuadrilla = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoNombre.trim() || !nuevaEspecialidad) {
      alert('Completa los campos obligatorios.');
      return;
    }

    setCreando(true);
    try {
      const payload = {
        proyecto_id: proyectoId,
        nombre: nuevoNombre.trim(),
        capataz_id: nuevoCapatazId || null,
        supervisor_id: nuevoSupervisorId || null,
        especialidad: nuevaEspecialidad,
        activo: true
      };

      const { error } = await supabase
        .from('list_cuadrillas')
        .insert(payload);

      if (error) throw error;

      setNuevoNombre('');
      setNuevoCapatazId('');
      setNuevoSupervisorId('');
      setNuevaEspecialidad('piping');
      setMostrarModal(false);
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Error al crear la cuadrilla.');
    } finally {
      setCreando(false);
    }
  };

  const handleDesactivarCuadrilla = async (cuadrillaId: string) => {
    if (!confirm('¿Estás seguro de que deseas desactivar esta cuadrilla? Las asignaciones del día se mantendrán pero la cuadrilla ya no estará activa.')) return;
    
    try {
      const { error } = await supabase
        .from('list_cuadrillas')
        .update({ activo: false })
        .eq('id', cuadrillaId);
      if (error) throw error;
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Error al desactivar la cuadrilla.');
    }
  };

  const handleAsignarTrabajador = async (cuadrillaId: string, trabajadorId: string) => {
    try {
      const { error } = await supabase
        .from('rel_cuadrilla_trabajadores')
        .insert({
          proyecto_id: proyectoId,
          cuadrilla_id: cuadrillaId,
          trabajador_id: trabajadorId,
          fecha: fechaHoy,
          metodo: 'kanban'
        });
      if (error) throw error;
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Error al asignar trabajador.');
    }
  };

  const handleDesasignarTrabajador = async (asignacionId: string) => {
    try {
      const { error } = await supabase
        .from('rel_cuadrilla_trabajadores')
        .delete()
        .eq('id', asignacionId);
      if (error) throw error;
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Error al remover trabajador.');
    }
  };

  // Filtrar operarios que asistieron hoy y que NO están asignados a ninguna cuadrilla hoy
  const operariosAsignadosHoyIds = asignaciones.map(a => a.trabajador_id);
  const operariosDisponiblesHoy = personal.filter(p => 
    presentesHoyIds.includes(p.id) && !operariosAsignadosHoyIds.includes(p.id)
  );



  return (
    <div className="flex-grow p-6 space-y-6 bg-background text-foreground font-sans flex flex-col h-[calc(100vh-4rem)]">
      <div className="border-b border-border pb-4 shrink-0">
        <h2 className="text-xl font-bold text-white tracking-tight">Gestión de Cuadrillas Dinámicas</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Asignación diaria de operarios en terreno. Configura frentes de trabajo y asigna recursos según asistencia diaria y especialidad.
        </p>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-xs">
          Cargando cuadrillas y asignaciones...
        </div>
      ) : (
        <div className="flex-grow flex gap-6 overflow-hidden min-h-0">
          {/* Listado de Cuadrillas (Grid de Cards) */}
          <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cuadrillas.length === 0 ? (
              <div className="col-span-full border border-dashed border-border rounded-xl p-8 text-center text-muted-foreground text-xs flex flex-col items-center justify-center">
                <span>No hay cuadrillas activas creadas en este proyecto.</span>
                <span className="mt-1">Crea una haciendo clic en "+ Crear Cuadrilla" en la barra superior.</span>
              </div>
            ) : (
              cuadrillas.map((cuad) => {
                const asignados = asignaciones.filter(a => a.cuadrilla_id === cuad.id);
                const supervisor = miembros.find(m => m.usuario_id === cuad.supervisor_id);

                return (
                  <div key={cuad.id} className="bg-card border border-border/80 rounded-xl p-4 flex flex-col gap-4 shadow-lg hover:border-border transition-colors h-fit">
                    {/* Cabecera de la Card */}
                    <div className="flex justify-between items-start border-b border-border/40 pb-2.5">
                      <div>
                        <h4 className="font-extrabold text-white text-sm tracking-tight">{cuad.nombre}</h4>
                        <span className="text-[9px] font-extrabold uppercase tracking-widest text-accent mt-0.5 inline-block px-1.5 py-0.5 rounded bg-accent/10 border border-accent/20">
                          {cuad.especialidad}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDesactivarCuadrilla(cuad.id)}
                        className="text-muted-foreground hover:text-red-400 text-xs font-bold transition-colors"
                        title="Desactivar Cuadrilla"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Detalles de Roles */}
                    <div className="text-[11px] space-y-1 text-muted-foreground border-b border-border/40 pb-3">
                      <div>
                        <span className="font-bold text-white">Capataz:</span> {cuad.capataz?.nombre || 'No asignado'}
                      </div>
                      <div>
                        <span className="font-bold text-white">Supervisor:</span> {supervisor?.usuarios?.nombre || supervisor?.usuarios?.email || 'No asignado'}
                      </div>
                    </div>

                    {/* Lista de Operarios Asignados Hoy */}
                    <div className="flex-1 space-y-2">
                      <h5 className="text-[10px] font-extrabold text-white uppercase tracking-wider">
                        Personal asignado hoy ({asignados.length})
                      </h5>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {asignados.length === 0 ? (
                          <div className="text-[10px] text-muted-foreground py-2 text-center border border-dashed border-border/40 rounded-lg">
                            Sin operarios asignados.
                          </div>
                        ) : (
                          asignados.map((a) => (
                            <div key={a.id} className="flex justify-between items-center bg-panel border border-border/30 rounded-lg p-2 hover:border-border/60 transition-colors">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-white truncate">{a.trabajador?.nombre}</p>
                                <span className="text-[9px] text-muted-foreground">
                                  {a.trabajador?.cargo} {a.trabajador?.especialidad ? `(${a.trabajador.especialidad})` : ''}
                                </span>
                              </div>
                              <button
                                onClick={() => handleDesasignarTrabajador(a.id)}
                                className="text-red-400 hover:text-red-300 font-extrabold text-[10px] px-1.5 py-0.5 rounded hover:bg-red-500/10"
                                title="Remover de cuadrilla"
                              >
                                Remover
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Asignar Operario Selector */}
                    <div className="mt-2 border-t border-border/40 pt-3">
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            handleAsignarTrabajador(cuad.id, e.target.value);
                            e.target.value = '';
                          }
                        }}
                        className="w-full bg-panel border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-accent"
                        defaultValue=""
                      >
                        <option value="" disabled className="text-muted-foreground">
                          + Asignar operario disponible hoy...
                        </option>
                        {operariosDisponiblesHoy.map((op) => (
                          <option key={op.id} value={op.id} className="bg-panel text-white">
                            {op.nombre} ({op.cargo})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Sidebar Lateral de Asistencia y Disponibilidad */}
          <div className="w-80 border-l border-border pl-6 flex flex-col shrink-0 overflow-y-auto">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-2.5">
              Estado de Asistencia Hoy ({fechaHoy})
            </h3>
            <p className="text-[11px] text-muted-foreground mb-4">
              Solo el personal que registró asistencia en el reloj control (Buk) o la plataforma califica como disponible hoy.
            </p>

            <div className="flex-1 space-y-4">
              {/* Sin Asignar */}
              <div>
                <h4 className="text-[10px] font-extrabold text-accent uppercase tracking-wider mb-2">
                  Disponibles sin cuadrilla ({operariosDisponiblesHoy.length})
                </h4>
                <div className="space-y-1.5">
                  {operariosDisponiblesHoy.length === 0 ? (
                    <div className="text-[10px] text-muted-foreground py-4 text-center border border-dashed border-border rounded-lg bg-panel/30">
                      Todo el personal de hoy ya está asignado.
                    </div>
                  ) : (
                    operariosDisponiblesHoy.map((p) => (
                      <div key={p.id} className="bg-card border border-border/40 rounded-lg p-2 flex flex-col">
                        <span className="text-xs font-bold text-white truncate">{p.nombre}</span>
                        <span className="text-[9px] text-muted-foreground mt-0.5 uppercase tracking-wide">
                          {p.cargo} {p.especialidad ? `• ${p.especialidad}` : ''}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* No Asistieron */}
              <div>
                <h4 className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider mb-2">
                  No Disponibles / Ausentes ({personal.length - presentesHoyIds.length})
                </h4>
                <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
                  {personal
                    .filter((p) => !presentesHoyIds.includes(p.id))
                    .map((p) => (
                      <div key={p.id} className="text-[11px] text-muted-foreground/60 flex justify-between py-1 border-b border-border/20">
                        <span className="truncate pr-2">{p.nombre}</span>
                        <span className="shrink-0 text-[9px] uppercase">{p.cargo}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Creación de Cuadrilla */}
      {mostrarModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-panel border border-border rounded-xl w-full max-w-md shadow-2xl p-6 relative">
            <h3 className="text-md font-bold text-white tracking-tight mb-4 border-b border-border pb-2">
              Crear Nueva Cuadrilla
            </h3>
            
            <form onSubmit={handleCrearCuadrilla} className="space-y-4 text-xs">
              {/* Nombre */}
              <div className="space-y-1">
                <label className="text-white font-semibold">Nombre de la Cuadrilla *</label>
                <input
                  type="text"
                  required
                  placeholder="ej: Piping Frente Norte 1"
                  value={nuevoNombre}
                  onChange={(e) => setNuevoNombre(e.target.value)}
                  className="w-full bg-card border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-accent"
                />
              </div>

              {/* Especialidad */}
              <div className="space-y-1">
                <label className="text-white font-semibold">Especialidad *</label>
                <select
                  value={nuevaEspecialidad}
                  onChange={(e) => setNuevaEspecialidad(e.target.value)}
                  className="w-full bg-card border border-border rounded-lg px-2.5 py-2 text-foreground focus:outline-none focus:border-accent"
                >
                  <option value="piping">Piping</option>
                  <option value="civiles">Civiles</option>
                  <option value="estructuras">Estructuras</option>
                  <option value="mecanica">Mecánica</option>
                  <option value="general">General / Otro</option>
                </select>
              </div>

              {/* Capataz */}
              <div className="space-y-1">
                <label className="text-white font-semibold">Capataz (de Personal)</label>
                <select
                  value={nuevoCapatazId}
                  onChange={(e) => setNuevoCapatazId(e.target.value)}
                  className="w-full bg-card border border-border rounded-lg px-2.5 py-2 text-foreground focus:outline-none focus:border-accent"
                >
                  <option value="">-- Sin capataz asignado --</option>
                  {personal.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} ({p.cargo})
                    </option>
                  ))}
                </select>
              </div>

              {/* Supervisor */}
              <div className="space-y-1">
                <label className="text-white font-semibold">Supervisor (Usuario de Sistema)</label>
                <select
                  value={nuevoSupervisorId}
                  onChange={(e) => setNuevoSupervisorId(e.target.value)}
                  className="w-full bg-card border border-border rounded-lg px-2.5 py-2 text-foreground focus:outline-none focus:border-accent"
                >
                  <option value="">-- Sin supervisor asignado --</option>
                  {miembros.map((m) => (
                    <option key={m.usuario_id} value={m.usuario_id}>
                      {m.usuarios?.nombre || m.usuarios?.email}
                    </option>
                  ))}
                </select>
              </div>

              {/* Botonera de Acción del Modal */}
              <div className="flex justify-end gap-3 border-t border-border pt-4 mt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMostrarModal(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={creando}
                >
                  {creando ? 'Creando...' : 'Crear Cuadrilla'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GestionCuadrillas;
