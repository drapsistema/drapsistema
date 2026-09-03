import { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import Icon from '../shared/Icon.jsx';
import { modoDemo } from '../lib/supabase';
import { useAuth } from '../shared/Auth.jsx';
import './layout.css';

// Menú lateral. Agregar un módulo nuevo = agregar una entrada acá.
const NAV = [
  { grupo: 'Comercial', items: [
    { to: '/dashboard', label: 'Dashboard', icon: 'dashboard', mod: 'dashboard' },
    { to: '/clientes', label: 'Clientes', icon: 'clientes', mod: 'clientes' },
    { to: '/comercial', label: 'CRM comercial', icon: 'comercial', mod: 'comercial' },
    { to: '/ventas', label: 'Ventas', icon: 'ventas', mod: 'ventas' },
  ]},
  { grupo: 'Operaciones', items: [
    { to: '/postventa', label: 'Postventa', icon: 'postventa', mod: 'postventa' },
    { to: '/service', label: 'Service y reparación', icon: 'service', mod: 'service' },
    { to: '/equipos', label: 'Equipos activados', icon: 'ventas', mod: 'equipos' },
  ]},
  { grupo: 'Sistema', items: [
    { to: '/configuracion', label: 'Configuración', icon: 'config', mod: 'configuracion' },
  ]},
];

const TITULOS = {
  '/dashboard': 'Dashboard', '/clientes': 'Clientes', '/comercial': 'CRM comercial',
  '/ventas': 'Ventas', '/postventa': 'Postventa', '/service': 'Service y reparación',
  '/equipos': 'Equipos activados',
  '/configuracion': 'Configuración',
};

// Saludo según la hora del sistema.
function saludo() {
  const h = new Date().getHours();
  if (h < 12) return 'Buen día';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}
const iniciales = (nombre) => (nombre || '').split(' ').map((w) => w[0]).slice(0, 2).join('');

export default function Layout() {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [tema, setTema] = useState(() => {
    try { return localStorage.getItem('drap-tema') || 'light'; } catch { return 'light'; }
  });
  const { perfil, logout, modulos } = useAuth();
  const location = useLocation();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tema);
    try { localStorage.setItem('drap-tema', tema); } catch { /* ignore */ }
  }, [tema]);
  const titulo = TITULOS[location.pathname] ||
    Object.entries(TITULOS).find(([ruta]) => location.pathname.startsWith(ruta))?.[1] || '';

  return (
    <div className="layout">
      <aside className={'sidebar' + (menuAbierto ? ' open' : '')}>
        <NavLink to="/sin-acceso" className="sidebar-brand" style={{ textDecoration: 'none', color: 'inherit' }}
          onClick={() => setMenuAbierto(false)}>
          <img className="sidebar-logo" src="/drap-mark.png" alt="DRAP" />
          <div>
            <b>DRAP</b>
            <div className="sub">Gestión integral</div>
          </div>
        </NavLink>
        <nav className="sidebar-nav">
          {NAV.map((g) => {
            const items = g.items.filter((it) => modulos.has(it.mod));
            if (items.length === 0) return null; // no mostrar el grupo si quedó vacío
            return (
              <div key={g.grupo}>
                <div className="nav-group">{g.grupo}</div>
                {items.map((it) => (
                  <NavLink
                    key={it.to} to={it.to}
                    className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
                    onClick={() => setMenuAbierto(false)}
                  >
                    <Icon name={it.icon} />
                    <span>{it.label}</span>
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
        {perfil && (
          <div className="sidebar-user">
            <div className="su-avatar">{perfil.nombre?.split(' ').map((w) => w[0]).slice(0, 2).join('')}</div>
            <div className="su-info">
              <div className="su-nombre">{perfil.nombre}</div>
              <div className="su-rol">{perfil.rol}</div>
            </div>
            {!modoDemo && (
              <button className="su-logout" onClick={logout} title="Cerrar sesión">
                <Icon name="back" size={16} />
              </button>
            )}
          </div>
        )}
      </aside>

      <div className={'backdrop' + (menuAbierto ? ' show' : '')} onClick={() => setMenuAbierto(false)} />

      <div className="main">
        <header className="topbar">
          <button className="hamburger" onClick={() => setMenuAbierto(true)} aria-label="Abrir menú">
            <Icon name="menu" size={22} />
          </button>
          <div className="crumb"><b>{titulo}</b></div>
          <div style={{ flex: 1 }} />
          {modoDemo && <span className="badge a">Modo demo</span>}
          <button className="tema-toggle" onClick={() => setTema((t) => (t === 'dark' ? 'light' : 'dark'))}
            title={tema === 'dark' ? 'Modo claro' : 'Modo oscuro'} aria-label="Cambiar tema">
            {tema === 'dark' ? (
              <svg width="18" height="18" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
            )}
          </button>
          {perfil && (
            <div className="topbar-user">
              <span className="saludo">{saludo()}, <b>{perfil.nombre}</b></span>
              <div className="tb-avatar">{iniciales(perfil.nombre)}</div>
            </div>
          )}
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
