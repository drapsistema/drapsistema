import { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import Icon from '../shared/Icon.jsx';
import { modoDemo } from '../lib/supabase';
import './layout.css';

// Menú lateral. Agregar un módulo nuevo = agregar una entrada acá.
const NAV = [
  { grupo: 'Comercial', items: [
    { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { to: '/clientes', label: 'Clientes', icon: 'clientes' },
    { to: '/comercial', label: 'CRM comercial', icon: 'comercial' },
    { to: '/ventas', label: 'Ventas', icon: 'ventas' },
  ]},
  { grupo: 'Operaciones', items: [
    { to: '/postventa', label: 'Postventa', icon: 'postventa' },
    { to: '/service', label: 'Service y reparación', icon: 'service' },
  ]},
  { grupo: 'Sistema', items: [
    { to: '/configuracion', label: 'Configuración', icon: 'config' },
  ]},
];

const TITULOS = {
  '/dashboard': 'Dashboard', '/clientes': 'Clientes', '/comercial': 'CRM comercial',
  '/ventas': 'Ventas', '/postventa': 'Postventa', '/service': 'Service y reparación',
  '/configuracion': 'Configuración',
};

export default function Layout() {
  const [menuAbierto, setMenuAbierto] = useState(false);
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
          {NAV.map((g) => (
            <div key={g.grupo}>
              <div className="nav-group">{g.grupo}</div>
              {g.items.map((it) => (
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
          ))}
        </nav>
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
