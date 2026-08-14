import { useState } from 'react';
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
  ]},
  { grupo: 'Sistema', items: [
    { to: '/configuracion', label: 'Configuración', icon: 'config', mod: 'configuracion' },
  ]},
];

const TITULOS = {
  '/dashboard': 'Dashboard', '/clientes': 'Clientes', '/comercial': 'CRM comercial',
  '/ventas': 'Ventas', '/postventa': 'Postventa', '/service': 'Service y reparación',
  '/configuracion': 'Configuración',
};

export default function Layout() {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const { perfil, logout, modulos } = useAuth();
  const location = useLocation();
  const titulo = TITULOS[location.pathname] ||
    Object.entries(TITULOS).find(([ruta]) => location.pathname.startsWith(ruta))?.[1] || '';

  return (
    <div className="layout">
      <aside className={'sidebar' + (menuAbierto ? ' open' : '')}>
        <div className="sidebar-brand">
          <div className="sidebar-logo">D</div>
          <div>
            <b>DRAP</b>
            <div className="sub">Gestión integral</div>
          </div>
        </div>
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
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
