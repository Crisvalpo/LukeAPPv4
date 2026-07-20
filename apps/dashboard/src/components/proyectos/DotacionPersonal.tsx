import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { Button } from '../ui/Button';
import { useHeaderActions } from '../../hooks/useHeaderActions';

interface DotacionPersonalProps {
  proyectoId: string;
}

interface CampoPersonal {
  key: string;
  label: string;
  placeholder?: string;
  requerido?: boolean;
  esClave?: boolean;
  esSelect?: boolean;
  opciones?: { value: string; label: string }[];
}

interface FilaTabla {
  key: string;
  id: string | null;
  valores: Record<string, string>;
  esNueva: boolean;
  dirty: boolean;
}

const CAMPOS: CampoPersonal[] = [
  { key: 'rut', label: 'RUT', esClave: true, requerido: true, placeholder: 'ej: 12345678K' },
  { key: 'nombre', label: 'Nombre', requerido: true, placeholder: 'ej: Juan Pérez' },
  { key: 'cargo', label: 'Cargo', requerido: true, placeholder: 'ej: Soldador, Capataz, Ayudante' },
  { key: 'especialidad', label: 'Especialidad', placeholder: 'ej: piping, civiles, mecanica' },
  { key: 'telefono', label: 'Teléfono', placeholder: 'ej: +56912345678' },
  { key: 'centro_costo', label: 'Centro Costo', placeholder: 'ej: EIMI00413' },
  { key: 'estampa', label: 'Estampa', placeholder: 'ej: SOL-014' },
  {
    key: 'activo',
    label: 'Estado',
    esSelect: true,
    opciones: [
      { value: 'true', label: 'Activo' },
      { value: 'false', label: 'Inactivo' },
    ],
  },
];

const filaVacia = (): Record<string, string> => {
  const valores = Object.fromEntries(CAMPOS.map((c) => [c.key, '']));
  valores.activo = 'true'; // Activo por defecto
  return valores;
};

const valoresDesdeObjeto = (obj: Record<string, any>): Record<string, string> =>
  Object.fromEntries(
    CAMPOS.map((c) => [
      c.key,
      obj[c.key] != null ? String(obj[c.key]) : c.key === 'activo' ? 'true' : '',
    ])
  );

export const DotacionPersonal: React.FC<DotacionPersonalProps> = ({ proyectoId }) => {
  const [datos, setDatos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filas, setFilas] = useState<FilaTabla[]>([]);
  const [guardandoKey, setGuardandoKey] = useState<string | null>(null);

  const fetchPersonal = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('cat_personal')
        .select('*')
        .eq('proyecto_id', proyectoId)
        .order('nombre');
      if (error) throw error;
      setDatos(data ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPersonal();
  }, [proyectoId]);

  useEffect(() => {
    setFilas((prev) => {
      const prevByKey = new Map(prev.map((f) => [f.key, f]));
      const registrados: FilaTabla[] = datos.map((item) => {
        const key = item.id as string;
        const prevFila = prevByKey.get(key);
        if (prevFila?.dirty) return prevFila;
        return { key, id: key, valores: valoresDesdeObjeto(item), esNueva: false, dirty: false };
      });
      const nuevasManuales = prev.filter((f) => f.esNueva);
      return [...registrados, ...nuevasManuales];
    });
  }, [datos]);

  const handleCambiarValor = (key: string, campoKey: string, valor: string) => {
    setFilas((prev) =>
      prev.map((f) => (f.key === key ? { ...f, valores: { ...f.valores, [campoKey]: valor }, dirty: true } : f))
    );
  };

  const handleAgregarFilaManual = () => {
    const key = `nueva-${Date.now()}`;
    setFilas((prev) => [...prev, { key, id: null, valores: filaVacia(), esNueva: true, dirty: true }]);
  };

  const handleGuardarFila = async (fila: FilaTabla) => {
    const camposRequeridos = CAMPOS.filter((c) => c.requerido);
    if (camposRequeridos.some((c) => !fila.valores[c.key]?.trim())) {
      alert('Completa los campos obligatorios antes de guardar.');
      return;
    }
    setGuardandoKey(fila.key);
    try {
      const payload: Record<string, any> = { proyecto_id: proyectoId };
      CAMPOS.forEach((campo) => {
        const valorCrudo = fila.valores[campo.key]?.trim() ?? '';
        if (campo.key === 'activo') {
          payload[campo.key] = valorCrudo === 'true';
        } else if (campo.esClave) {
          // El RUT o campos clave en mayúsculas y normalizados
          payload[campo.key] = campo.key === 'rut'
            ? valorCrudo.toUpperCase().replace(/[^0-9K]/g, '')
            : valorCrudo.toUpperCase();
        } else {
          payload[campo.key] = valorCrudo || null;
        }
      });

      if (fila.id) {
        const { error } = await supabase.from('cat_personal').update(payload).eq('id', fila.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('cat_personal').insert(payload);
        if (error) throw error;
      }

      setFilas((prev) => prev.filter((f) => f.key !== fila.key));
      await fetchPersonal();
    } catch (err: any) {
      alert(err.message || 'Error al guardar la fila.');
    } finally {
      setGuardandoKey(null);
    }
  };

  const handleEliminarFila = async (fila: FilaTabla) => {
    if (!fila.id) {
      setFilas((prev) => prev.filter((f) => f.key !== fila.key));
      return;
    }
    if (!confirm('¿Estás seguro de que deseas eliminar esta persona del personal del proyecto?')) return;

    try {
      const { error } = await supabase.from('cat_personal').delete().eq('id', fila.id);
      if (error) throw error;
      await fetchPersonal();
    } catch (err: any) {
      alert(err.message || 'Error al eliminar el registro.');
    }
  };

  // Registrar la acción primaria en el header superior usando el hook useHeaderActions
  useHeaderActions(
    <Button variant="primary" size="sm" onClick={handleAgregarFilaManual}>
      + Agregar Personal
    </Button>
  );

  return (
    <div className="flex-grow p-6 space-y-4 bg-background text-foreground font-sans flex flex-col h-[calc(100vh-4rem)]">
      <div className="border-b border-border pb-4 shrink-0">
        <h2 className="text-xl font-bold text-white tracking-tight">Personal & Dotación</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Identidad unificada (Buk) y personal certificado del proyecto. Administra operarios, soldadores, supervisores y capataces.
        </p>
      </div>

      <div className="flex items-center justify-between shrink-0">
        <h4 className="text-xs font-bold text-white uppercase tracking-wider">Personal registrado ({datos.length})</h4>
      </div>

      <div className="flex-1 min-h-0 overflow-auto border border-border rounded-lg">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 bg-card z-10">
            <tr>
              <th className="p-2 w-8 border-b border-border" />
              {CAMPOS.map((campo) => (
                <th key={campo.key} className="p-2 text-left font-bold text-white uppercase text-[10px] border-b border-border">
                  {campo.label}
                </th>
              ))}
              <th className="p-2 w-28 border-b border-border" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={CAMPOS.length + 2} className="p-4 text-center text-muted-foreground">
                  Cargando nómina de personal...
                </td>
              </tr>
            ) : filas.length === 0 ? (
              <tr>
                <td colSpan={CAMPOS.length + 2} className="p-4 text-center text-muted-foreground">
                  Sin personal registrado. Agrega una persona haciendo clic en el botón de la barra superior.
                </td>
              </tr>
            ) : (
              filas.map((fila) => (
                <tr key={fila.key} className={`border-b border-border/40 ${fila.esNueva ? 'bg-emerald-500/5' : ''}`}>
                  <td className="p-1 text-center align-middle">
                    {fila.esNueva && (
                      <span title="Fila nueva sin guardar" className="text-[9px] font-extrabold text-emerald-400">
                        +
                      </span>
                    )}
                    {!fila.esNueva && fila.dirty && (
                      <span title="Cambios sin guardar" className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                    )}
                  </td>
                  {CAMPOS.map((campo) => (
                    <td key={campo.key} className="p-1 align-middle">
                      {campo.esSelect ? (
                        <select
                          value={fila.valores[campo.key] ?? 'true'}
                          onChange={(e) => handleCambiarValor(fila.key, campo.key, e.target.value)}
                          className="w-full bg-transparent border border-transparent px-1.5 py-1 rounded text-xs focus:outline-none focus:bg-panel focus:border-accent text-foreground font-medium"
                        >
                          {campo.opciones?.map((o) => (
                            <option key={o.value} value={o.value} className="bg-panel text-white">
                              {o.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          placeholder={campo.placeholder}
                          value={fila.valores[campo.key] ?? ''}
                          onChange={(e) => handleCambiarValor(fila.key, campo.key, e.target.value)}
                          className={`w-full bg-transparent border border-transparent px-1.5 py-1 rounded text-xs focus:outline-none focus:bg-panel focus:border-accent ${
                            campo.esClave ? 'uppercase font-extrabold text-white' : 'font-medium text-foreground'
                          }`}
                        />
                      )}
                    </td>
                  ))}
                  <td className="p-1 text-right whitespace-nowrap align-middle">
                    {(fila.dirty || fila.esNueva) && (
                      <button
                        onClick={() => handleGuardarFila(fila)}
                        disabled={guardandoKey === fila.key}
                        className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 px-1.5 py-0.5 rounded hover:bg-emerald-500/10 mr-1 disabled:opacity-40"
                      >
                        {guardandoKey === fila.key ? '...' : 'Guardar'}
                      </button>
                    )}
                    <button
                      onClick={() => handleEliminarFila(fila)}
                      title={fila.id ? 'Eliminar' : 'Descartar'}
                      className="text-red-400/60 hover:text-red-400 transition-colors p-0.5 rounded hover:bg-red-500/10 focus:outline-none"
                    >
                      <svg className="w-3.5 h-3.5 inline" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DotacionPersonal;
