import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listar } from '../../lib/db';
import { PageHeader } from '../../shared/ui.jsx';

// KPI clickeable (feature 3): al hacer clic navega a la vista con el detalle.
// `to` puede llevar querystring para que el módulo destino filtre.
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
  const [op, setOp] = useState([]);
  const [clientes, setClientes] = useState([]);

  useEffect(() => {
    listar('oportunidades').then(setOp);
    listar('clientes').then(setClientes);
  }, []);

  const abiertas = op.filter((o) => !o.resultado);
  const enCotizacion = op.filter((o) => o.etapa === 'Cotización');
  const enSeguimiento = op.filter((o) => o.etapa === 'Seguimiento');

  return (
    <div>
      <PageHeader titulo="Dashboard" sub="Vista general del negocio. Tocá un indicador para ver el detalle." />

      <div className="sec-title"><span className="badge b">Comercial</span></div>
      <div className="kpi-grid">
        <Kpi label="Oportunidades abiertas" value={abiertas.length} foot="en gestión" to="/comercial" />
        <Kpi label="En cotización" value={enCotizacion.length} foot="esperando respuesta" to="/comercial?etapa=Cotización" />
        <Kpi label="En seguimiento" value={enSeguimiento.length} foot="por cerrar" to="/comercial?etapa=Seguimiento" />
        <Kpi label="Clientes" value={clientes.length} foot="total registrados" to="/clientes" />
      </div>

      <div className="sec-title" style={{ marginTop: 28 }}>
        <span className="badge">Cómo seguir</span>
      </div>
      <div className="card card-pad">
        <p className="muted sm" style={{ lineHeight: 1.7 }}>
          Este dashboard es de ejemplo con los datos del módulo Clientes/Comercial.
          Cada módulo que se desarrolle agrega sus propios KPIs acá, siguiendo el mismo patrón
          del componente <code>Kpi</code>: se le pasa un <code>to</code> con la ruta (y filtros
          por querystring) para que al hacer clic lleve directo a esa información.
        </p>
      </div>
    </div>
  );
}
