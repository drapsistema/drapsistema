import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listar } from '../../lib/db';
import { PageHeader, Empty, nombreCliente, fmtFecha } from '../../shared/ui.jsx';
import Icon from '../../shared/Icon.jsx';

const COLS = [
  { key: 'nro', label: 'N°' },
  { key: 'tipo', label: 'Tipo' },
  { key: 'cliente', label: 'Cliente' },
  { key: 'equipo', label: 'Equipo' },
  { key: 'ingreso', label: 'Ingreso' },
  { key: 'estado', label: 'Estado' },
];

export default function Service() {
  const [trabajos, setTrabajos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [q, setQ] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [sort, setSort] = useState({ col: 'ingreso', dir: 'desc' });
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([listar('trabajos'), listar('clientes')]).then(([ts, cs]) => {
      setTrabajos(ts); setClientes(cs); setCargando(false);
    });
  }, []);

  const nombrePorId = (id) => { const c = clientes.find((x) => x.id === id); return c ? nombreCliente(c) : `Cliente #${id}`; };
  const equipo = (t) => `${t.marca || ''} ${t.modelo || ''} · ${t.nro_serie || ''}`.trim();
  const badgeEstado = (e) => e === 'Entregada' ? 'g' : e === 'Finalizada' ? 'b' : e === 'Esperando repuestos' ? 'a' : '';

  const valorCol = (t, key) => {
    switch (key) {
      case 'nro': return t.nro || '';
      case 'tipo': return t.tipo || '';
      case 'cliente': return nombrePorId(t.cliente_id).toLowerCase();
      case 'equipo': return equipo(t).toLowerCase();
      case 'ingreso': return t.ingreso || '';
      case 'estado': return t.estado || '';
      default: return '';
    }
  };

  let filas = trabajos;
  const term = q.trim().toLowerCase();
  if (term) {
    filas = filas.filter((t) =>
      (t.nro || '').toLowerCase().includes(term)
      || nombrePorId(t.cliente_id).toLowerCase().includes(term)
      || equipo(t).toLowerCase().includes(term)
      || (t.tipo || '').toLowerCase().includes(term)
      || (t.estado || '').toLowerCase().includes(term)
    );
  }
  if (desde) filas = filas.filter((t) => (t.ingreso || '') >= desde);
  if (hasta) filas = filas.filter((t) => (t.ingreso || '') <= hasta);
  const dir = sort.dir === 'asc' ? 1 : -1;
  filas = [...filas].sort((a, b) => {
    const va = valorCol(a, sort.col), vb = valorCol(b, sort.col);
    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return 0;
  });

  const toggleSort = (col) => setSort((s) => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' });
  const flecha = (col) => sort.col === col ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '';

  return (
    <div>
      <PageHeader titulo="Service y reparación" sub={`${filas.length} de ${trabajos.length} trabajos`}>
        <button className="btn" onClick={() => navigate('/service/nuevo')}><Icon name="plus" size={16} /> Ingresar drone</button>
      </PageHeader>

      {!cargando && trabajos.length > 0 && (
        <div className="card card-pad" style={{ marginBottom: 14, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field" style={{ margin: 0, flex: '1 1 260px' }}>
            <label>Buscar</label>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="N°, cliente, equipo, tipo o estado" />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Ingreso desde</label>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Ingreso hasta</label>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
          {(q || desde || hasta) && (
            <button className="btn ghost sm" onClick={() => { setQ(''); setDesde(''); setHasta(''); }}>Limpiar</button>
          )}
        </div>
      )}

      {cargando ? <Empty>Cargando…</Empty> : trabajos.length === 0 ? (
        <Empty>Todavía no hay trabajos. Ingresá un drone al taller.</Empty>
      ) : filas.length === 0 ? (
        <Empty>Ningún trabajo coincide con la búsqueda o el filtro.</Empty>
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
              {filas.map((t) => (
                <tr key={t.id} className="clickable" onClick={() => navigate(`/service/${t.id}`)}>
                  <td className="strong">{t.nro}</td>
                  <td><span className="badge">{t.tipo}</span></td>
                  <td>{nombrePorId(t.cliente_id)}</td>
                  <td>{t.marca} {t.modelo} · {t.nro_serie}</td>
                  <td>{fmtFecha(t.ingreso)}</td>
                  <td><span className={'badge ' + badgeEstado(t.estado)}>{t.estado}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
