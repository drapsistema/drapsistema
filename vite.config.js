import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Configuración de Vite. El alias '@' apunta a /src para importar
// cómodo desde cualquier módulo: import { supabase } from '@/lib/supabase'
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(new URL('.', import.meta.url).pathname, 'src'),
    },
  },
  server: {
    port: 5173,
    host: true, // permite abrir la app desde el celular en la misma red (mobile testing)
  },
});
