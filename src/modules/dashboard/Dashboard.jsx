import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listar } from '../../lib/db';
import { PageHeader, money } from '../../shared/ui.jsx';
import { useAuth } from '../../shared/Auth.jsx';

function Kpi({ label, value, foot, to }) {
  const navigate = useNavigate();
  return (
    <div className="kpi" onClick={() => navigate(to)}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {foot && <div className="kpi-foot">{foot}</div>}
    </div>
  );
}

export default function Dashboard() {
  const [d, setD] = useState(null);
  const { modulos } = useAuth();

  useEffect(() => {
    Promise.all([
      listar('oportunidades'), listar('clientes'), listar('ventas'),
      listar('tareas_postventa'), listar('trabajos'),
    ]).then(([op, clientes, ventas, tpost, trabajos]) => setD({ op, clientes, ventas, tpost, trabajos }));
  }, []);

  if (!d) return <div><PageHeader titulo="Dashboard" /></div>;

  const abiertas = d.op.filter((o) => !o.resultado);
  const enCotizacion = d.op.filter((o) => o.etapa === 'Cotización' && !o.resultado);
  const vigentes = d.ventas.filter((v) => v.estado !== 'Cancelada');
  const canceladas = d.ventas.filter((v) => v.estado === 'Cancelada');
  const porCobrar = vigentes.filter((v) => !v.cobrado);
  const visitas = d.tpost.filter((t) => t.visita_estado === 'Solicitada' || t.visita_estado === 'Agendada');
  const tareasPend = d.tpost.filter((t) => t.estado === 'Pendiente');
  const trabajosAbiertos = d.trabajos.filter((t) => t.estado !== 'Entregada' && t.estado !== 'Finalizada');
  const esperandoRep = d.trabajos.filter((t) => t.estado === 'Esperando repuestos');

  // Cada área del dashboard se muestra solo si el usuario tiene acceso al módulo.
  const ver = (m) => modulos.has(m);
  const verComercial = ver('comercial') || ver('clientes') || ver('ventas');
  const verOperaciones = ver('postventa') || ver('service');
  const verFinanciero = ver('ventas');

  return (
    <div>
      <PageHeader titulo="Dashboard" sub="Vista general del negocio. Tocá un indicador para ver el detalle." />

      {verComercial && (
        <>
          <div className="sec-title"><span className="badge b">Comercial</span></div>
          <div className="kpi-grid">
            {ver('comercial') && <Kpi label="Oportunidades abiertas" value={abiertas.length} foot="en gestión" to="/comercial" />}
            {ver('comercial') && <Kpi label="En cotización" value={enCotizacion.length} foot="esperando respuesta" to="/comercial?etapa=Cotización" />}
            {ver('clientes') && <Kpi label="Clientes" value={d.clientes.length} foot="total registrados" to="/clientes" />}
            {ver('ventas') && <Kpi label="Ventas vigentes" value={vigentes.length} foot="no canceladas" to="/ventas" />}
          </div>
        </>
      )}

      {verOperaciones && (
        <>
          <div className="sec-title"><span className="badge">Operaciones</span></div>
          <div className="kpi-grid">
            {ver('postventa') && <Kpi label="Postventa: visitas" value={visitas.length} foot="a coordinar" to="/postventa" />}
            {ver('postventa') && <Kpi label="Postventa: tareas" value={tareasPend.length} foot="pendientes" to="/postventa" />}
            {ver('service') && <Kpi label="Service: abiertos" value={trabajosAbiertos.length} foot="en el taller" to="/service" />}
            {ver('service') && <Kpi label="Esperando repuestos" value={esperandoRep.length} foot="trabajos frenados" to="/service" />}
          </div>
        </>
      )}

      {verFinanciero && (
        <>
          <div className="sec-title"><span className="badge g">Financiero</span></div>
          <div className="kpi-grid">
            <Kpi label="Ventas cobradas" value={vigentes.filter((v) => v.cobrado).length} foot={`de ${vigentes.length} vigentes`} to="/ventas" />
            <Kpi label="Por cobrar" value={porCobrar.length} foot="sin marcar cobrado" to="/ventas" />
            <Kpi label="Ventas canceladas" value={canceladas.length} foot="antes de entregar" to="/ventas" />
            <Kpi label="Comisiones" value={money(vigentes.reduce((a, v) => a + (v.comision || 0), 0))} foot="tercerizados" to="/ventas" />
          </div>
        </>
      )}
    </div>
  );
}
