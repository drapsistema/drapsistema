import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './layout/Layout.jsx';

// Cada módulo expone su propia página. Al agregar un módulo nuevo,
// se importa acá y se agrega su <Route>. Como cada uno vive en su
// carpeta, distintos devs trabajan sin pisarse.
import Dashboard from './modules/dashboard/Dashboard.jsx';
import ClientesList from './modules/clientes/ClientesList.jsx';
import ClienteFicha from './modules/clientes/ClienteFicha.jsx';
import ClienteForm from './modules/clientes/ClienteForm.jsx';
import Comercial from './modules/comercial/Comercial.jsx';
import Ventas from './modules/ventas/Ventas.jsx';
import Postventa from './modules/postventa/Postventa.jsx';
import Service from './modules/service/Service.jsx';
import Configuracion from './modules/configuracion/Configuracion.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />

        {/* Clientes: módulo completo de ejemplo */}
        <Route path="clientes" element={<ClientesList />} />
        <Route path="clientes/nuevo" element={<ClienteForm />} />
        <Route path="clientes/:id" element={<ClienteFicha />} />
        <Route path="clientes/:id/editar" element={<ClienteForm />} />

        {/* Módulos con andamiaje listo para desarrollar */}
        <Route path="comercial" element={<Comercial />} />
        <Route path="ventas" element={<Ventas />} />
        <Route path="postventa" element={<Postventa />} />
        <Route path="service" element={<Service />} />
        <Route path="configuracion" element={<Configuracion />} />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
