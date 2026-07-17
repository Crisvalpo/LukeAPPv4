import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { Button } from '../ui/Button';

interface AWPCatalogosProps {
  proyectoId: string;
}

interface CampoCatalogo {
  key: string;
  label: string;
  tipo: 'text' | 'select';
  placeholder?: string;
  requerido?: boolean;
  esClave?: boolean;
  refCatalogoId?: string; // solo tipo 'select': id de otro catálogo de CATALOGOS_AWP
  columnaFk?: string;     // solo tipo 'select': columna UUID real a resolver antes de guardar
}

interface CatalogoAWPConfig {
  id: string;
  tabla: string;
  claveNatural: string;
  label: string;
  labelSingular: string;
  selectQuery: string;
  campos: CampoCatalogo[];
}

interface FilaTabla {
  key: string;
  id: string | null;
  valores: Record<string, string>;
  esNueva: boolean;
  dirty: boolean;
}

const CATALOGOS_AWP: CatalogoAWPConfig[] = [
  {
    id: 'cwa', tabla: 'cat_cwa', claveNatural: 'codigo',
    label: 'Áreas de Trabajo (CWA)', labelSingular: 'Área',
    selectQuery: '*',
    campos: [
      { key: 'codigo', label: 'Código', tipo: 'text', esClave: true, requerido: true, placeholder: 'ej: CWA-01' },
      { key: 'descripcion', label: 'Descripción', tipo: 'text', placeholder: 'ej: Planta Concentradora' },
    ],
  },
  {
    id: 'cwp', tabla: 'cat_cwp', claveNatural: 'codigo',
    label: 'Paquetes de Trabajo (CWP)', labelSingular: 'Paquete',
    selectQuery: '*, cat_cwa(codigo)',
    campos: [
      { key: 'codigo', label: 'Código', tipo: 'text', esClave: true, requerido: true, placeholder: 'ej: CWP-100' },
      { key: 'descripcion', label: 'Descripción', tipo: 'text', placeholder: 'ej: Piping Área Chancado' },
      { key: 'cwa_codigo', label: 'Área (CWA)', tipo: 'select', refCatalogoId: 'cwa', columnaFk: 'cwa_id' },
    ],
  },
  {
    id: 'iwp', tabla: 'cat_iwp', claveNatural: 'codigo',
    label: 'Paquetes de Instalación (IWP)', labelSingular: 'Instalación',
    selectQuery: '*, cat_cwp(codigo)',
    campos: [
      { key: 'codigo', label: 'Código', tipo: 'text', esClave: true, requerido: true, placeholder: 'ej: IWP-100-01' },
      { key: 'descripcion', label: 'Descripción', tipo: 'text', placeholder: 'ej: Montaje spools línea 12' },
      { key: 'cwp_codigo', label: 'Paquete (CWP)', tipo: 'select', refCatalogoId: 'cwp', columnaFk: 'cwp_id' },
    ],
  },
];

const catalogoPorId = (id: string): CatalogoAWPConfig => CATALOGOS_AWP.find((c) => c.id === id) ?? CATALOGOS_AWP[0];

const filaVaciaDesde = (campos: CampoCatalogo[]): Record<string, string> =>
  Object.fromEntries(campos.map((c) => [c.key, '']));

const valoresDesdeObjeto = (campos: CampoCatalogo[], obj: Record<string, any>): Record<string, string> =>
  Object.fromEntries(
    campos.map((c) => {
      if (c.tipo === 'select' && c.refCatalogoId) {
        const refCat = catalogoPorId(c.refCatalogoId);
        const joined = obj[refCat.tabla];
        const codigo = Array.isArray(joined) ? joined[0]?.codigo : joined?.codigo;
        return [c.key, codigo ?? ''];
      }
      return [c.key, obj[c.key] != null ? String(obj[c.key]) : ''];
    })
  );

export const AWPCatalogos: React.FC<AWPCatalogosProps> = ({ proyectoId }) => {
  const [pestana, setPestana] = useState<string>('cwa');
  const [datos, setDatos] = useState<Record<string, any[]>>({});
  const [loadingCatalogos, setLoadingCatalogos] = useState(true);
  const [filas, setFilas] = useState<FilaTabla[]>([]);
  const [guardandoKey, setGuardandoKey] = useState<string | null>(null);
  const pestanaAnteriorRef = useRef(pestana);

  const catalogoActivo = catalogoPorId(pestana);

  const fetchCatalogos = async () => {
    setLoadingCatalogos(true);
    try {
      const resultados = await Promise.all(
        CATALOGOS_AWP.map((cat) =>
          supabase.from(cat.tabla).select(cat.selectQuery).eq('proyecto_id', proyectoId).order(cat.claveNatural)
        )
      );
      const nuevo: Record<string, any[]> = {};
      resultados.forEach((res, idx) => {
        nuevo[CATALOGOS_AWP[idx].id] = res.data ?? [];
      });
      setDatos(nuevo);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingCatalogos(false);
    }
  };

  useEffect(() => {
    fetchCatalogos();
  }, [proyectoId]);

  useEffect(() => {
    const cambioDePestana = pestanaAnteriorRef.current !== pestana;
    pestanaAnteriorRef.current = pestana;

    setFilas((prev) => {
      const prevByKey = cambioDePestana ? new Map<string, FilaTabla>() : new Map(prev.map((f) => [f.key, f]));

      const registrados: FilaTabla[] = (datos[pestana] ?? []).map((item) => {
        const key = item.id as string;
        const prevFila = prevByKey.get(key);
        if (prevFila?.dirty) return prevFila;
        return {
          key,
          id: key,
          valores: valoresDesdeObjeto(catalogoActivo.campos, item),
          esNueva: false,
          dirty: false,
        };
      });

      const nuevasManuales = cambioDePestana ? [] : prev.filter((f) => f.esNueva);

      return [...registrados, ...nuevasManuales];
    });
  }, [pestana, datos, catalogoActivo]);

  const handleCambiarValor = (key: string, campoKey: string, valor: string) => {
    setFilas((prev) =>
      prev.map((f) => (f.key === key ? { ...f, valores: { ...f.valores, [campoKey]: valor }, dirty: true } : f))
    );
  };

  const handleAgregarFilaManual = () => {
    const key = `nueva-${Date.now()}`;
    setFilas((prev) => [...prev, { key, id: null, valores: filaVaciaDesde(catalogoActivo.campos), esNueva: true, dirty: true }]);
  };

  const handleGuardarFila = async (fila: FilaTabla) => {
    const camposRequeridos = catalogoActivo.campos.filter((c) => c.requerido);
    if (camposRequeridos.some((c) => !fila.valores[c.key]?.trim())) {
      alert('Completa los campos obligatorios antes de guardar.');
      return;
    }
    setGuardandoKey(fila.key);
    try {
      const payload: Record<string, any> = { proyecto_id: proyectoId };
      for (const campo of catalogoActivo.campos) {
        const valorCrudo = fila.valores[campo.key]?.trim() ?? '';
        if (campo.tipo === 'select' && campo.columnaFk) {
          if (!valorCrudo) {
            payload[campo.columnaFk] = null;
          } else {
            const refCat = catalogoPorId(campo.refCatalogoId!);
            const match = (datos[campo.refCatalogoId!] ?? []).find(
              (item: any) => String(item.codigo).toUpperCase() === valorCrudo.toUpperCase()
            );
            if (!match) throw new Error(`"${valorCrudo}" no existe en ${refCat.label}. Regístralo primero.`);
            payload[campo.columnaFk] = match.id;
          }
        } else {
          payload[campo.key] = campo.esClave ? valorCrudo.toUpperCase() : (valorCrudo || null);
        }
      }

      if (fila.id) {
        const { error } = await supabase.from(catalogoActivo.tabla).update(payload).eq('id', fila.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(catalogoActivo.tabla).insert(payload);
        if (error) throw error;
      }

      setFilas((prev) => prev.filter((f) => f.key !== fila.key));
      await fetchCatalogos();
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
    if (!confirm(`¿Estás seguro de que deseas eliminar este elemento de "${catalogoActivo.label}" del proyecto?`)) return;

    try {
      const { error } = await supabase.from(catalogoActivo.tabla).delete().eq('id', fila.id);
      if (error) throw error;
      await fetchCatalogos();
    } catch (err: any) {
      alert(err.message || 'Error al eliminar el elemento del catálogo.');
    }
  };

  return (
    <div className="flex-grow p-6 space-y-4 bg-background text-foreground font-sans flex flex-col h-[calc(100vh-4rem)]">
      <div className="border-b border-border pb-4 shrink-0">
        <h2 className="text-xl font-bold text-white tracking-tight">Catálogos AWP</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Áreas de trabajo (CWA), paquetes de trabajo (CWP) y paquetes de instalación (IWP) de la metodología Advanced Work Packaging.
        </p>
      </div>

      <div className="flex border-b border-border overflow-x-auto shrink-0">
        {CATALOGOS_AWP.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setPestana(cat.id)}
            className={`shrink-0 px-4 text-center py-2.5 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
              pestana === cat.id ? 'text-accent border-accent' : 'text-muted-foreground border-transparent hover:text-white'
            }`}
          >
            {cat.label} ({datos[cat.id]?.length ?? 0})
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between shrink-0">
        <h4 className="text-xs font-bold text-white uppercase tracking-wider">{catalogoActivo.label}</h4>
        <Button variant="outline" size="sm" onClick={handleAgregarFilaManual}>
          + Agregar Fila
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto border border-border rounded-lg">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 bg-card z-10">
            <tr>
              <th className="p-2 w-8 border-b border-border" />
              {catalogoActivo.campos.map((campo) => (
                <th key={campo.key} className="p-2 text-left font-bold text-white uppercase text-[10px] border-b border-border">
                  {campo.label}
                </th>
              ))}
              <th className="p-2 w-28 border-b border-border" />
            </tr>
          </thead>
          <tbody>
            {loadingCatalogos ? (
              <tr>
                <td colSpan={catalogoActivo.campos.length + 2} className="p-4 text-center text-muted-foreground">
                  Cargando catálogo...
                </td>
              </tr>
            ) : filas.length === 0 ? (
              <tr>
                <td colSpan={catalogoActivo.campos.length + 2} className="p-4 text-center text-muted-foreground">
                  Sin elementos. Agrega una fila manualmente.
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
                  {catalogoActivo.campos.map((campo) => (
                    <td key={campo.key} className="p-1 align-middle">
                      {campo.tipo === 'select' ? (
                        <select
                          value={fila.valores[campo.key] ?? ''}
                          onChange={(e) => handleCambiarValor(fila.key, campo.key, e.target.value)}
                          className="w-full bg-transparent border border-transparent px-1.5 py-1 rounded text-xs font-medium text-foreground focus:outline-none focus:bg-panel focus:border-accent"
                        >
                          <option value="">— Sin asignar —</option>
                          {(datos[campo.refCatalogoId!] ?? []).map((item: any) => (
                            <option key={item.id} value={item.codigo}>
                              {item.codigo}
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

export default AWPCatalogos;
