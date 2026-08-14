import { useAuth } from '../../shared/Auth.jsx';

// Se muestra si un usuario logueado no tiene ningún módulo habilitado.
// Normalmente no debería pasar (todos los roles tienen al menos Dashboard),
// pero cubre el caso para no dejar una pantalla en blanco.
export default function SinAcceso() {
  const { perfil, logout } = useAuth();
  return (
    <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24 }}>
      <div style={{ maxWidth: 420 }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>🔒</div>
        <h2 style={{ marginBottom: 10 }}>Sin módulos habilitados</h2>
        <p style={{ color: 'var(--ink-2)', lineHeight: 1.6, marginBottom: 20 }}>
          {perfil?.nombre ? `Hola ${perfil.nombre}. ` : ''}
          Tu usuario todavía no tiene módulos asignados. Pedile a un administrador
          que te habilite el acceso desde Configuración → Permisos.
        </p>
        <button className="btn ghost" onClick={logout}>Cerrar sesión</button>
      </div>
    </div>
  );
}
