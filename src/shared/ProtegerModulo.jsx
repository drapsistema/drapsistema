import { Navigate } from 'react-router-dom';
import { useAuth } from './Auth.jsx';

// Envuelve una ruta y solo la deja pasar si el usuario tiene acceso al módulo.
// Si no, lo manda al dashboard (o al primer módulo que sí pueda ver).
// Nota: esto es comodidad/UX del frontend. La seguridad REAL la darán las
// políticas RLS de Supabase (Tanda B2): aunque alguien fuerce la URL o la API,
// la base no le devuelve datos que su rol no permite.
export default function ProtegerModulo({ modulo, children }) {
  const { modulos, cargando } = useAuth();
  if (cargando) return null;
  if (!modulos.has(modulo)) {
    // Buscar el primer módulo que sí puede ver, para no dejarlo en una pantalla vacía.
    const destino = modulos.has('dashboard') ? '/dashboard'
      : modulos.size > 0 ? '/' + [...modulos][0]
      : '/sin-acceso';
    return <Navigate to={destino} replace />;
  }
  return children;
}
