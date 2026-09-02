import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listar, obtener } from '../../lib/db';
import { PageHeader, Empty, nombreCliente, fmtFecha, diasDesde } from '../../shared/ui.jsx';
import Icon from '../../shared/Icon.jsx';

// Semáforo por cliente: días desde el último contacto (umbrales del admin).
function semaforo(venta, tareas, verde = 30, amarillo = 60) {
  const realizadas = tareas.filter((t) => t.estado === 'Realizada' && t.fecha_real);
  const ultima = realizadas.map((t) => t.fecha_real).sort().pop() || venta.fecha_entrega;
  const dias = diasDesde(ultima);
  const cl = dias <= verde ? 'g' : dias <= amarillo ? 'a' : 'r';
  return { dias, cl };
}

// Columnas ordenables de la tabla principal.
const COLS = [
  { key: 'cliente', label: 'Cliente' },
  { key: 'venta', label: 'Venta' },
  { key: 'vendedor', label: 'Vendedor' },
  { key: 'entrega', label: 'Entrega' },
  { key: 'dias', label: 'Días s/contacto' },
  { key: 'semaforo', label: 'Semáforo' },
  { key: 'tareas', label: 'Tareas' },
  { key: 'visitas', label: 'Visitas' },
];

export default function Postventa() {
  const [ventas, setVentas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [tareas, setTareas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [cfg, setCfg] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [q, setQ] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [sort, setSort] = useState({ col: 'semaforo', dir: 'desc' });
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([listar('ventas'), listar('clientes'), listar('tareas_postventa'), listar('usuarios')])
      .then(([vs, cs, ts, us]) => { setVentas(vs); setClientes(cs); setTareas(ts); setUsuarios(us); setCargando(false); });
    obtener('configuracion', 1).then(setCfg).catch(() => {});
  }, []);

  const sVerde = cfg?.sem_post_verde ?? 30;
  const sAmarillo = cfg?.sem_post_amarillo ?? 60;

  const entregadas = ventas.filter((v) => v.fecha_entrega && v.estado !== 'Cancelada');
  const nombrePorId = (id) => { const c = clientes.find((x) => x.id === id); return c ? nombreCliente(c) : `Cliente #${id}`; };
  const nombreVen = (id) => usuarios.find((u) => u.id === id)?.nombre || '— sin asignar —';
  const tareasDe = (vid) => tareas.filter((t) => t.venta_id === vid);
  const ventaDe = (vid) => ventas.find((x) => x.id === vid);
  const clienteDeTarea = (t) => { const v = ventaDe(t.venta_id); return v ? v.cliente_id : null; };
  const vt = (idv) => `VT-${String(idv).padStart(4, '0')}`;

  // Visitas ya realizadas (para calcular "desde la última visita").
  const visitasRealizadas = tareas.filter((t) => t.visita_estado === 'Realizada' && t.visita_real);
  const ultimaVisitaDeCliente = (cid) => {
    const f = visitasRealizadas.filter((t) => clienteDeTarea(t) === cid).map((t) => t.visita_real).sort();
    return f.length ? f[f.length - 1] : null;
  };
  // Número de tarea de contacto (1, 2, 3) de la que se desprende una visita.
  const ordinalTarea = (t) => {
    const hermanas = tareasDe(t.venta_id).slice().sort((a, b) => (a.objetivo || '').localeCompare(b.objetivo || '') || a.id - b.id);
    const i = hermanas.findIndex((x) => x.id === t.id);
    return i >= 0 ? i + 1 : '—';
  };

  // Panel de visitas a coordinar (solicitadas o agendadas).
  const visitas = tareas.filter((t) => t.visita_estado === 'Solicitada' || t.visita_estado === 'Agendada');

  // Filas de la tabla principal, con lo necesario para ordenar y filtrar.
  const filasBase = entregadas.map((v) => {
    const ts = tareasDe(v.id);
    const s = semaforo(v, ts, sVerde, sAmarillo);
    const hechas = ts.filter((t) => t.estado === 'Realizada').length;
    // Rojo si hay una visita AGENDADA sin atender; verde si no hay agendadas o ya se atendieron.
    const visitaPendiente = ts.some((t) => t.visita_estado === 'Agendada');
    return { v, s, hechas, total: ts.length, visitaPendiente, cliente: nombrePorId(v.cliente_id), vendedor: nombreVen(v.vendedor_id) };
  });

  const sev = (cl) => (cl === 'r' ? 2 : cl === 'a' ? 1 : 0);
  const valorCol = (f, key) => {
    switch (key) {
      case 'cliente': return f.cliente.toLowerCase();
      case 'venta': return f.v.id;
      case 'vendedor': return f.vendedor.toLowerCase();
      case 'entrega': return f.v.fecha_entrega || '';
      case 'dias': return f.s.dias;
      case 'tareas': return f.total ? f.hechas / f.total : 0;
      case 'visitas': return f.visitaPendiente ? 1 : 0;
      case 'semaforo': return sev(f.s.cl);
      default: return '';
    }
  };

  let filas = filasBase;
  const term = q.trim().toLowerCase();
  if (term) filas = filas.filter((f) => f.cliente.toLowerCase().includes(term) || vt(f.v.id).toLowerCase().includes(term) || f.vendedor.toLowerCase().includes(term));
  if (desde) filas = filas.filter((f) => (f.v.fecha_entrega || '') >= desde);
  if (hasta) filas = filas.filter((f) => (f.v.fecha_entrega || '') <= hasta);
  const dir = sort.dir === 'asc' ? 1 : -1;
  filas = [...filas].sort((a, b) => {
    const va = valorCol(a, sort.col), vb = valorCol(b, sort.col);
    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return 0;
  });

  const toggleSort = (col) => setSort((s) => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' });
  const flecha = (col) => sort.col === col ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '';

  if (cargando) return <div><PageHeader titulo="Postventa" /><Empty>Cargando…</Empty></div>;

  return (
    <div>
      <PageHeader titulo="Postventa" sub="Semáforo por días desde el último contacto · 3 tareas por cliente entregado" />

      {visitas.length > 0 && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'var(--amber)' }}>
          <div className="card-h" style={{ color: 'var(--amber)' }}>
            <Icon name="postventa" size={16} /> Visitas técnicas a coordinar ({visitas.length})
          </div>
          <div className="table-wrap" style={{ maxHeight: 236, overflowY: 'auto' }}>
            <table>
              <thead><tr><th>Cliente</th><th>Tarea de contacto</th><th>Estado</th><th>Agendada</th><th>Última visita técnica</th></tr></thead>
              <tbody>
                {visitas.map((t) => {
                  const v = ventaDe(t.venta_id);
                  const ult = ultimaVisitaDeCliente(clienteDeTarea(t));
                  return (
                    <tr key={t.id} className="clickable" onClick={() => navigate(`/postventa/${t.venta_id}`)}>
                      <td className="strong">{v ? nombrePorId(v.cliente_id) : '—'}</td>
                      <td>Tarea {ordinalTarea(t)} · {t.hito}</td>
                      <td><span className={'badge ' + (t.visita_estado === 'Agendada' ? 'b' : 'a')}>{t.visita_estado}</span></td>
                      <td>{t.visita_agenda ? fmtFecha(t.visita_agenda) : <span className="muted">sin fecha</span>}</td>
                      <td>{ult ? `Hace ${diasDesde(ult)} días` : <span className="badge b">Primera visita</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {entregadas.length > 0 && (
        <div className="card card-pad" style={{ marginBottom: 14, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field" style={{ margin: 0, flex: '1 1 260px' }}>
            <label>Buscar</label>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cliente o N° de venta" />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Entrega desde</label>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Entrega hasta</label>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
          {(q || desde || hasta) && (
            <button className="btn ghost sm" onClick={() => { setQ(''); setDesde(''); setHasta(''); }}>Limpiar</button>
          )}
        </div>
      )}

      {entregadas.length === 0 ? (
        <Empty>Todavía no hay ventas entregadas. La postventa nace al cargar la entrega de una venta.</Empty>
      ) : filas.length === 0 ? (
        <Empty>Ninguna venta coincide con la búsqueda o el filtro.</Empty>
      ) : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                {COLS.map((c) => (
                  <th key={c.key} onClick={() => toggleSort(c.key)} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                    {c.label}{flecha(c.key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.v.id} className="clickable" onClick={() => navigate(`/postventa/${f.v.id}`)}>
                  <td className="strong">{f.cliente}</td>
                  <td>{vt(f.v.id)}</td>
                  <td>{f.vendedor}</td>
                  <td>{fmtFecha(f.v.fecha_entrega)}</td>
                  <td>{f.s.dias}</td>
                  <td><span className={'dot ' + f.s.cl} />{f.s.cl === 'g' ? 'Verde' : f.s.cl === 'a' ? 'Amarillo' : 'Rojo'}</td>
                  <td>{f.hechas}/{f.total}</td>
                  <td>
                    {f.visitaPendiente
                      ? <><span className="dot r" />Visita pendiente</>
                      : <><span className="dot g" />Al día</>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
