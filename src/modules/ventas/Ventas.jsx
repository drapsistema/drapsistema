import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { listar } from '../../lib/db';
import { PageHeader, Empty, nombreCliente, fmtFecha } from '../../shared/ui.jsx';

// Columnas ordenables de la tabla.
const COLS = [
  { key: 'vt', label: 'Venta' },
  { key: 'vendedor', label: 'Vendedor' },
  { key: 'cliente', label: 'Cliente' },
  { key: 'ganada', label: 'Ganada' },
  { key: 'entrega', label: 'Entrega' },
  { key: 'cobrado', label: 'Cobrado' },
  { key: 'estado', label: 'Estado' },
];

export default function Ventas() {
  const [ventas, setVentas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [q, setQ] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [sort, setSort] = useState({ col: 'ganada', dir: 'desc' });
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([listar('ventas'), listar('clientes'), listar('usuarios')]).then(([vs, cs, us]) => {
      setVentas(vs); setClientes(cs); setUsuarios(us); setCargando(false);
    });
  }, []);

  const nombreCli = (id) => { const c = clientes.find((x) => x.id === id); return c ? nombreCliente(c) : `Cliente #${id}`; };
  const nombreVen = (id) => usuarios.find((u) => u.id === id)?.nombre || '— sin asignar —';
  const vt = (id) => `VT-${String(id).padStart(4, '0')}`;
  const badgeEstado = (e) => e === 'Cancelada' ? 'r' : e === 'Entregada' ? 'b' : '';

  // Valor por el que se ordena/busca cada columna.
  const valorCol = (v, key) => {
    switch (key) {
      case 'vt': return v.id;
      case 'vendedor': return nombreVen(v.vendedor_id).toLowerCase();
      case 'cliente': return nombreCli(v.cliente_id).toLowerCase();
      case 'ganada': return v.fecha_ganada || '';
      case 'entrega': return v.fecha_entrega || '';
      case 'cobrado': return v.cobrado ? 1 : 0;
      case 'estado': return v.estado || '';
      default: return '';
    }
  };

  const filtradas = useMemo(() => {
    let arr = ventas;
    const term = q.trim().toLowerCase();
    if (term) {
      arr = arr.filter((v) =>
        vt(v.id).toLowerCase().includes(term)
        || nombreVen(v.vendedor_id).toLowerCase().includes(term)
        || nombreCli(v.cliente_id).toLowerCase().includes(term)
        || (v.estado || '').toLowerCase().includes(term)
      );
    }
    if (desde) arr = arr.filter((v) => (v.fecha_ganada || '') >= desde);
    if (hasta) arr = arr.filter((v) => (v.fecha_ganada || '') <= hasta);

    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...arr].sort((a, b) => {
      const va = valorCol(a, sort.col), vb = valorCol(b, sort.col);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ventas, clientes, usuarios, q, desde, hasta, sort]);

  const toggleSort = (col) => setSort((s) => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' });
  const flecha = (col) => sort.col === col ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '';

  return (
    <div>
      <PageHeader titulo="Ventas" sub={`${filtradas.length} de ${ventas.length} ventas`} />

      {!cargando && ventas.length > 0 && (
        <div className="card card-pad" style={{ marginBottom: 14, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field" style={{ margin: 0, flex: '1 1 260px' }}>
            <label>Buscar</label>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Vendedor, cliente, N° de venta o estado" />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Ganada desde</label>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Ganada hasta</label>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
          {(q || desde || hasta) && (
            <button className="btn ghost sm" onClick={() => { setQ(''); setDesde(''); setHasta(''); }}>Limpiar</button>
          )}
        </div>
      )}

      {cargando ? <Empty>Cargando…</Empty> : ventas.length === 0 ? (
        <Empty>Todavía no hay ventas. Se crean al ganar una oportunidad en el CRM.</Empty>
      ) : filtradas.length === 0 ? (
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
              {filtradas.map((v) => (
                <tr key={v.id} className="clickable" onClick={() => navigate(`/ventas/${v.id}`)}>
                  <td className="strong">{vt(v.id)}</td>
                  <td>{nombreVen(v.vendedor_id)}</td>
                  <td>{nombreCli(v.cliente_id)}</td>
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
