import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listar } from '../../lib/db';
import { PageHeader, Empty, nombreCliente, fmtFecha, diasDesde } from '../../shared/ui.jsx';
import Icon from '../../shared/Icon.jsx';

// Semáforo por cliente: días desde el último contacto realizado (o desde la entrega).
function semaforo(venta, tareas) {
  const realizadas = tareas.filter((t) => t.estado === 'Realizada' && t.fecha_real);
  const ultima = realizadas.map((t) => t.fecha_real).sort().pop() || venta.fecha_entrega;
  const dias = diasDesde(ultima);
  const cl = dias <= 30 ? 'g' : dias <= 60 ? 'a' : 'r';
  return { dias, cl };
}

export default function Postventa() {
  const [ventas, setVentas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [tareas, setTareas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([listar('ventas'), listar('clientes'), listar('tareas_postventa')])
      .then(([vs, cs, ts]) => { setVentas(vs); setClientes(cs); setTareas(ts); setCargando(false); });
  }, []);

  const entregadas = ventas.filter((v) => v.fecha_entrega && v.estado !== 'Cancelada');
  const nombrePorId = (id) => { const c = clientes.find((x) => x.id === id); return c ? nombreCliente(c) : `Cliente #${id}`; };
  const tareasDe = (vid) => tareas.filter((t) => t.venta_id === vid);

  // Panel de visitas a coordinar (solicitadas o agendadas).
  const visitas = tareas.filter((t) => t.visita_estado === 'Solicitada' || t.visita_estado === 'Agendada');

  if (cargando) return <div><PageHeader titulo="Postventa" /><Empty>Cargando…</Empty></div>;

  return (
    <div>
      <PageHeader titulo="Postventa" sub="Semáforo por días desde el último contacto · 3 tareas por cliente entregado" />

      {visitas.length > 0 && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'var(--amber)' }}>
          <div className="card-h" style={{ color: 'var(--amber)' }}>
            <Icon name="postventa" size={16} /> Visitas técnicas a coordinar ({visitas.length})
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Cliente</th><th>Tarea</th><th>Estado</th><th>Agendada</th></tr></thead>
              <tbody>
                {visitas.map((t) => {
                  const v = ventas.find((x) => x.id === t.venta_id);
                  return (
                    <tr key={t.id} className="clickable" onClick={() => navigate(`/postventa/${t.venta_id}`)}>
                      <td className="strong">{v ? nombrePorId(v.cliente_id) : '—'}</td>
                      <td>{t.hito}</td>
                      <td><span className={'badge ' + (t.visita_estado === 'Agendada' ? 'b' : 'a')}>{t.visita_estado}</span></td>
                      <td>{t.visita_agenda ? fmtFecha(t.visita_agenda) : <span className="muted">sin fecha</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {entregadas.length === 0 ? (
        <Empty>Todavía no hay ventas entregadas. La postventa nace al cargar la entrega de una venta.</Empty>
      ) : (
        <div className="card table-wrap">
          <table>
            <thead><tr><th>Cliente</th><th>Venta</th><th>Entrega</th><th>Días s/contacto</th><th>Tareas</th><th>Semáforo</th></tr></thead>
            <tbody>
              {entregadas.map((v) => {
                const ts = tareasDe(v.id);
                const s = semaforo(v, ts);
                const hechas = ts.filter((t) => t.estado === 'Realizada').length;
                return (
                  <tr key={v.id} className="clickable" onClick={() => navigate(`/postventa/${v.id}`)}>
                    <td className="strong">{nombrePorId(v.cliente_id)}</td>
                    <td>VT-{String(v.id).padStart(4, '0')}</td>
                    <td>{fmtFecha(v.fecha_entrega)}</td>
                    <td>{s.dias}</td>
                    <td>{hechas}/{ts.length}</td>
                    <td><span className={'dot ' + s.cl} />{s.cl === 'g' ? 'Verde' : s.cl === 'a' ? 'Amarillo' : 'Rojo'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
