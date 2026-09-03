import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../shared/Auth.jsx';
import Icon from '../../shared/Icon.jsx';

// Tarjetas de módulos. Se muestran solo las que el usuario tiene habilitadas.
const TARJETAS = [
  { id: 'dashboard', label: 'Dashboard', desc: 'Resumen e indicadores del negocio.', icon: 'dashboard', to: '/dashboard' },
  { id: 'clientes', label: 'Clientes', desc: 'Fichas, contactos e historial.', icon: 'clientes', to: '/clientes' },
  { id: 'comercial', label: 'CRM comercial', desc: 'Oportunidades y pipeline de venta.', icon: 'comercial', to: '/comercial' },
  { id: 'ventas', label: 'Ventas', desc: 'Ventas, entregas y cobranza.', icon: 'ventas', to: '/ventas' },
  { id: 'postventa', label: 'Postventa', desc: 'Seguimiento y visitas técnicas.', icon: 'postventa', to: '/postventa' },
  { id: 'service', label: 'Service y reparación', desc: 'Órdenes de trabajo y remitos.', icon: 'service', to: '/service' },
  { id: 'equipos', label: 'Equipos activados', desc: 'Equipos cargados en las ventas.', icon: 'ventas', to: '/equipos' },
  { id: 'configuracion', label: 'Configuración', desc: 'Usuarios, roles, permisos y parámetros.', icon: 'config', to: '/configuracion' },
];

export default function SinAcceso() {
  const { perfil, modulos, logout } = useAuth();
  const navigate = useNavigate();
  const disponibles = TARJETAS.filter((t) => modulos && modulos.has(t.id));

  // Caso real "sin acceso": el usuario no tiene ningún módulo habilitado.
  if (disponibles.length === 0) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24 }}>
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

  return (
    <div>
      <h1 style={{ fontSize: 26, margin: '4px 0 2px' }}>
        Hola{perfil?.nombre ? ', ' : ''}<span style={{ color: 'var(--brand)' }}>{perfil?.nombre || ''}</span>
      </h1>
      <p className="muted" style={{ marginBottom: 22 }}>Elegí una herramienta para empezar.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
        {disponibles.map((t) => (
          <div key={t.id} className="card card-pad clickable-card" onClick={() => navigate(t.to)}
            style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--brand-bg)', color: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={t.icon} size={22} />
            </div>
            <div>
              <div className="strong" style={{ fontSize: 16 }}>{t.label}</div>
              <div className="muted sm" style={{ marginTop: 2 }}>{t.desc}</div>
            </div>
            <div style={{ color: 'var(--brand)', fontWeight: 600, fontSize: 13, marginTop: 'auto' }}>Abrir →</div>
          </div>
        ))}
      </div>
    </div>
  );
}
