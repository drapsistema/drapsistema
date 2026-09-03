import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './layout/Layout.jsx';
import Login from './modules/auth/Login.jsx';
import SinAcceso from './modules/auth/SinAcceso.jsx';
import { useAuth } from './shared/Auth.jsx';
import ProtegerModulo from './shared/ProtegerModulo.jsx';

import Dashboard from './modules/dashboard/Dashboard.jsx';
import ClientesList from './modules/clientes/ClientesList.jsx';
import ClienteFicha from './modules/clientes/ClienteFicha.jsx';
import ClienteForm from './modules/clientes/ClienteForm.jsx';
import Comercial from './modules/comercial/Comercial.jsx';
import OportunidadDetalle from './modules/comercial/OportunidadDetalle.jsx';
import OportunidadForm from './modules/comercial/OportunidadForm.jsx';
import Ventas from './modules/ventas/Ventas.jsx';
import EquiposActivados from './modules/ventas/EquiposActivados.jsx';
import VentaDetalle from './modules/ventas/VentaDetalle.jsx';
import Postventa from './modules/postventa/Postventa.jsx';
import PostventaDetalle from './modules/postventa/PostventaDetalle.jsx';
import Service from './modules/service/Service.jsx';
import TrabajoDetalle from './modules/service/TrabajoDetalle.jsx';
import TrabajoForm from './modules/service/TrabajoForm.jsx';
import Configuracion from './modules/configuracion/Configuracion.jsx';
import UsuarioForm from './modules/configuracion/UsuarioForm.jsx';

export default function App() {
  const { autenticado, cargando } = useAuth();

  // Mientras se resuelve la sesión, no parpadear.
  if (cargando) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-3)' }}>Cargando…</div>;
  }

  // Sin sesión: solo se ve el login. (En modo demo, autenticado es true directo.)
  if (!autenticado) {
    return <Login />;
  }

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<ProtegerModulo modulo="dashboard"><Dashboard /></ProtegerModulo>} />

        <Route path="clientes" element={<ProtegerModulo modulo="clientes"><ClientesList /></ProtegerModulo>} />
        <Route path="clientes/nuevo" element={<ProtegerModulo modulo="clientes"><ClienteForm /></ProtegerModulo>} />
        <Route path="clientes/:id" element={<ProtegerModulo modulo="clientes"><ClienteFicha /></ProtegerModulo>} />
        <Route path="clientes/:id/editar" element={<ProtegerModulo modulo="clientes"><ClienteForm /></ProtegerModulo>} />

        <Route path="comercial" element={<ProtegerModulo modulo="comercial"><Comercial /></ProtegerModulo>} />
        <Route path="comercial/nueva" element={<ProtegerModulo modulo="comercial"><OportunidadForm /></ProtegerModulo>} />
        <Route path="comercial/:id" element={<ProtegerModulo modulo="comercial"><OportunidadDetalle /></ProtegerModulo>} />

        <Route path="ventas" element={<ProtegerModulo modulo="ventas"><Ventas /></ProtegerModulo>} />
        <Route path="ventas/:id" element={<ProtegerModulo modulo="ventas"><VentaDetalle /></ProtegerModulo>} />

        <Route path="postventa" element={<ProtegerModulo modulo="postventa"><Postventa /></ProtegerModulo>} />
        <Route path="postventa/:id" element={<ProtegerModulo modulo="postventa"><PostventaDetalle /></ProtegerModulo>} />

        <Route path="service" element={<ProtegerModulo modulo="service"><Service /></ProtegerModulo>} />
        <Route path="service/nuevo" element={<ProtegerModulo modulo="service"><TrabajoForm /></ProtegerModulo>} />
        <Route path="service/:id" element={<ProtegerModulo modulo="service"><TrabajoDetalle /></ProtegerModulo>} />

        <Route path="equipos" element={<ProtegerModulo modulo="equipos"><EquiposActivados /></ProtegerModulo>} />

        <Route path="configuracion" element={<ProtegerModulo modulo="configuracion"><Configuracion /></ProtegerModulo>} />
        <Route path="configuracion/usuario-nuevo" element={<ProtegerModulo modulo="configuracion"><UsuarioForm /></ProtegerModulo>} />

        <Route path="sin-acceso" element={<SinAcceso />} />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
