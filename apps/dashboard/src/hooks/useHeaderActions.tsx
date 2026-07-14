import { createContext, useContext, useEffect, type ReactNode } from 'react';

/**
 * Barra superior única para acciones de página: cualquier vista registra sus
 * botones de navegación/acción primaria (volver, crear, importar, eliminar…)
 * acá en vez de renderizarlos dentro de su propio contenido. Ver AGENTS.md
 * ("Un solo lugar para acciones de página").
 */
export const HeaderActionsContext = createContext<(node: ReactNode) => void>(() => {});

export function useHeaderActions(node: ReactNode) {
  const setHeaderActions = useContext(HeaderActionsContext);

  // Sin array de deps: siempre registra el nodo más reciente (con los
  // closures/handlers al día) sin obligar a cada vista a declarar deps a mano.
  useEffect(() => {
    setHeaderActions(node);
  });

  // Solo se limpia al desmontar la vista.
  useEffect(() => {
    return () => setHeaderActions(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
