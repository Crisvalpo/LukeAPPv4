import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en el .env de la raíz del monorepo.'
  );
}

// El esquema v4 vive en `lukeapp` (PGRST_DB_SCHEMAS lo expone vía Kong);
// sin esta opción todas las consultas irían al esquema `public`.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: { schema: 'lukeapp' },
});
