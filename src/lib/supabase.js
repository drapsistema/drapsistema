import { createClient } from '@supabase/supabase-js';

// Lee las credenciales desde las variables de entorno (.env).
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// MODO DEMO: si no hay credenciales, la app funciona con datos
// de ejemplo en memoria. Esto permite levantar el proyecto sin
// tener la base creada todavía. Ver src/lib/db.js.
export const modoDemo = !url || !anonKey;

// Cliente de Supabase. En modo demo queda null y db.js usa los
// datos locales en su lugar.
export const supabase = modoDemo ? null : createClient(url, anonKey);

if (modoDemo) {
  // Aviso visible en la consola del navegador para el desarrollador.
  console.warn(
    '%c[DRAP] Modo demo activo',
    'color:#C2410C;font-weight:bold',
    '- sin credenciales de Supabase. Los datos son de ejemplo y no se guardan. ' +
    'Cargá VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env para usar la base real.'
  );
}
