import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listar } from '../../lib/db';
import { PageHeader, Empty, nombreCliente, fmtFecha } from '../../shared/ui.jsx';

export default function Ventas() {
  const [ventas, setVentas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([listar('ventas'), listar('clientes')]).then(([vs, cs]) => {
      setVentas(vs); setClientes(cs); setCargando(false);
    });
  }, []);

  const nombrePorId = (id) => { const c = clientes.find((x) => x.id === id); return c ? nombreCliente(c) : `Cliente #${id}`; };
  const badgeEstado = (e) => e === 'Cancelada' ? 'r' : e === 'Entregada' ? 'b' : '';

  return (
    <div>
      <PageHeader titulo="Ventas" sub={`${ventas.length} ventas registradas`} />
      {cargando ? <Empty>Cargando…</Empty> : ventas.length === 0 ? (
        <Empty>Todavía no hay ventas. Se crean al ganar una oportunidad en el CRM.</Empty>
      ) : (
        <div className="card table-wrap">
          <table>
            <thead><tr><th>Venta</th><th>Oportunidad</th><th>Cliente</th><th>Ganada</th><th>Entrega</th><th>Cobrado</th><th>Estado</th></tr></thead>
            <tbody>
              {ventas.map((v) => (
                <tr key={v.id} className="clickable" onClick={() => navigate(`/ventas/${v.id}`)}>
                  <td className="strong">VT-{String(v.id).padStart(4, '0')}</td>
                  <td>{v.oportunidad_id ? <span className="badge b">#{v.oportunidad_id}</span> : <span className="muted">—</span>}</td>
                  <td>{nombrePorId(v.cliente_id)}</td>
                  <td>{fmtFecha(v.fecha_ganada)}</td>
                  <td>{v.fecha_entrega ? fmtFecha(v.fecha_entrega) : <span className="muted">pendiente</span>}</td>
                  <td>{v.cobrado ? <span className="badge g">Sí</span> : <span className="badge a">No</span>}</td>
                  <td><span className={'badge ' + badgeEstado(v.estado)}>{v.estado}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
