import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listar, obtener } from '../../lib/db';
import { PageHeader, Empty, nombreCliente, fmtFecha, diasDesde, nroVenta, nroPostventa } from '../../shared/ui.jsx';
import Icon from '../../shared/Icon.jsx';

// Semáforo por cliente: días desde el último contacto (umbrales del admin).
// `desde` es la fecha de referencia si todavía no hubo contactos.
function semaforo(desde, tareas, verde = 30, amarillo = 60) {
  const realizadas = tareas.filter((t) => t.estado === 'Realizada' && t.fecha_real);
  const ultima = realizadas.map((t) => t.fecha_real).sort().pop() || desde;
  // Nunca negativo: una postventa recién cargada tiene su primera tarea en el futuro.
  const dias = Math.max(0, diasDesde(ultima));
  const cl = dias <= verde ? 'g' : dias <= amarillo ? 'a' : 'r';
  return { dias, cl };
}

// Columnas ordenables de la tabla principal.
const COLS = [
  { key: 'numero', label: 'N°' },
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
  const [postventas, setPostventas] = useState([]);
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
    Promise.all([listar('postventas'), listar('ventas'), listar('clientes'), listar('tareas_postventa'), listar('usuarios')])
      .then(([pvs, vs, cs, ts, us]) => {
        setPostventas(pvs); setVentas(vs); setClientes(cs); setTareas(ts); setUsuarios(us); setCargando(false);
      })
      .catch((e) => { console.error('Error al cargar postventa:', e); setCargando(false); });
    obtener('configuracion', 1).then(setCfg).catch(() => {});
  }, []);

  const sVerde = cfg?.sem_post_verde ?? 30;
  const sAmarillo = cfg?.sem_post_amarillo ?? 60;

  const nombrePorId = (id) => { const c = clientes.find((x) => x.id === id); return c ? nombreCliente(c) : `Cliente #${id}`; };
  const nombreVen = (id) => usuarios.find((u) => u.id === id)?.nombre || '— sin asignar —';
  const ventaDe = (vid) => ventas.find((x) => x.id === vid);
  const postventaDe = (pid) => postventas.find((x) => x.id === pid);

  const hermanasDe = (t) => tareas.filter((x) => x.postventa_id === t.postventa_id);
  const clienteDeTarea = (t) => postventaDe(t.postventa_id)?.cliente_id ?? t.cliente_id ?? null;
  const rutaDeTarea = (t) => `/postventa/${t.postventa_id}`;

  // Visitas ya realizadas (para calcular "desde la última visita").
  const visitasRealizadas = tareas.filter((t) => t.visita_estado === 'Realizada' && t.visita_real);
  const ultimaVisitaDeCliente = (cid) => {
    const f = visitasRealizadas.filter((t) => clienteDeTarea(t) === cid).map((t) => t.visita_real).sort();
    return f.length ? f[f.length - 1] : null;
  };
  // Número de tarea de contacto (1, 2, 3) de la que se desprende una visita.
  const ordinalTarea = (t) => {
    const hermanas = hermanasDe(t).slice().sort((a, b) => (a.objetivo || '').localeCompare(b.objetivo || '') || a.id - b.id);
    const i = hermanas.findIndex((x) => x.id === t.id);
    return i >= 0 ? i + 1 : '—';
  };

  // Panel de visitas a coordinar (solicitadas o agendadas).
  const visitas = tareas.filter((t) => t.visita_estado === 'Solicitada' || t.visita_estado === 'Agendada');

  const resumen = (ts, desdeRef) => ({
    s: semaforo(desdeRef, ts, sVerde, sAmarillo),
    hechas: ts.filter((t) => t.estado === 'Realizada').length,
    total: ts.length,
    // Rojo si hay una visita AGENDADA sin atender; verde si no hay agendadas o ya se atendieron.
    visitaPendiente: ts.some((t) => t.visita_estado === 'Agendada'),
  });

  // Una fila por postventa (con o sin venta). Las de ventas canceladas no van.
  const filasBase = postventas
    .map((pv) => ({ pv, v: pv.venta_id ? ventaDe(pv.venta_id) : null }))
    .filter(({ pv, v }) => !pv.venta_id || (v && v.estado !== 'Cancelada'))
    .map(({ pv, v }) => {
      const ts = tareas.filter((t) => t.postventa_id === pv.id);
      const inicio = v?.fecha_entrega || ts.map((t) => t.objetivo).filter(Boolean).sort()[0] || (pv.creado_en || '').slice(0, 10) || null;
      return {
        key: pv.id, to: `/postventa/${pv.id}`, sinVenta: !pv.venta_id,
        numero: nroPostventa(pv),
        cliente: nombrePorId(pv.cliente_id),
        venta: v ? nroVenta(v) : 'Sin venta',
        vendedor: v ? nombreVen(v.vendedor_id) : '—',
        entrega: v?.fecha_entrega || null,
        ...resumen(ts, inicio),
      };
    });

  const sev = (cl) => (cl === 'r' ? 2 : cl === 'a' ? 1 : 0);
  const valorCol = (f, key) => {
    switch (key) {
      case 'numero': return f.key;
      case 'cliente': return f.cliente.toLowerCase();
      case 'venta': return f.venta.toLowerCase();
      case 'vendedor': return f.vendedor.toLowerCase();
      case 'entrega': return f.entrega || '';
      case 'dias': return f.s.dias;
      case 'tareas': return f.total ? f.hechas / f.total : 0;
      case 'visitas': return f.visitaPendiente ? 1 : 0;
      case 'semaforo': return sev(f.s.cl);
      default: return '';
    }
  };

  let filas = filasBase;
  const term = q.trim().toLowerCase();
  if (term) filas = filas.filter((f) => f.numero.toLowerCase().includes(term) || f.cliente.toLowerCase().includes(term) || f.venta.toLowerCase().includes(term) || f.vendedor.toLowerCase().includes(term));
  // El filtro por fecha de entrega deja afuera las postventas sin venta (no tienen entrega).
  if (desde) filas = filas.filter((f) => (f.entrega || '') >= desde);
  if (hasta) filas = filas.filter((f) => f.entrega && f.entrega <= hasta);
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
      <PageHeader titulo="Postventa" sub="Semáforo por días desde el último contacto · 3 tareas por cliente entregado">
        <button className="btn" onClick={() => navigate('/postventa/nueva')}>
          <Icon name="plus" size={16} /> Nueva postventa
        </button>
      </PageHeader>

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
                  const cid = clienteDeTarea(t);
                  const ult = ultimaVisitaDeCliente(cid);
                  return (
                    <tr key={t.id} className="clickable" onClick={() => navigate(rutaDeTarea(t))}>
                      <td className="strong">{cid ? nombrePorId(cid) : '—'}</td>
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

      {filasBase.length > 0 && (
        <div className="card card-pad" style={{ marginBottom: 14, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field" style={{ margin: 0, flex: '1 1 260px' }}>
            <label>Buscar</label>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="N° de postventa, cliente o N° de venta" />
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

      {filasBase.length === 0 ? (
        <Empty>Todavía no hay postventas. Nacen al cargar la entrega de una venta, o con “Nueva postventa” para equipos comprados en otro lado.</Empty>
      ) : filas.length === 0 ? (
        <Empty>Ninguna postventa coincide con la búsqueda o el filtro.</Empty>
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
                <tr key={f.key} className="clickable" onClick={() => navigate(f.to)}>
                  <td className="strong">{f.numero}</td>
                  <td className="strong">{f.cliente}</td>
                  <td>{f.sinVenta ? <span className="badge">Sin venta</span> : f.venta}</td>
                  <td>{f.vendedor}</td>
                  <td>{f.entrega ? fmtFecha(f.entrega) : <span className="muted">—</span>}</td>
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
