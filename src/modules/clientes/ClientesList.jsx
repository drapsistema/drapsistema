import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listar } from '../../lib/db';
import { PageHeader, Empty, nombreCliente } from '../../shared/ui.jsx';
import Icon from '../../shared/Icon.jsx';

const COLS = [
  { key: 'nombre', label: 'Nombre / Razón social' },
  { key: 'tipo', label: 'Tipo' },
  { key: 'cuit', label: 'CUIT' },
  { key: 'telefono', label: 'Teléfono' },
  { key: 'mail', label: 'Mail' },
  { key: 'cargado', label: 'Cargado por' },
];

export default function ClientesList() {
  const [clientes, setClientes] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState({ col: 'nombre', dir: 'asc' });
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([listar('clientes'), listar('usuarios')])
      .then(([data, us]) => { setUsuarios(us); setClientes(data.filter((c) => c.activo !== false)); })
      .catch((e) => console.error('Error al listar clientes:', e))
      .finally(() => setCargando(false));
  }, []);

  const cargadoPor = (uid) => usuarios.find((u) => u.id === uid)?.nombre || '—';

  const valorCol = (c, key) => {
    switch (key) {
      case 'nombre': return nombreCliente(c).toLowerCase();
      case 'tipo': return c.tipo || '';
      case 'cuit': return c.cuit || '';
      case 'telefono': return c.telefono || '';
      case 'mail': return (c.mail || '').toLowerCase();
      case 'cargado': return cargadoPor(c.creado_por).toLowerCase();
      default: return '';
    }
  };

  let filas = clientes;
  const term = q.trim().toLowerCase();
  if (term) {
    filas = filas.filter((c) =>
      nombreCliente(c).toLowerCase().includes(term)
      || (c.cuit || '').includes(term)
      || (c.tipo || '').toLowerCase().includes(term)
      || (c.mail || '').toLowerCase().includes(term)
      || cargadoPor(c.creado_por).toLowerCase().includes(term));
  }
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
      <PageHeader titulo="Clientes" sub={`${filas.length} de ${clientes.length} clientes`}>
        <button className="btn" onClick={() => navigate('/clientes/nuevo')}>
          <Icon name="plus" size={16} /> Nuevo cliente
        </button>
      </PageHeader>

      {!cargando && clientes.length > 0 && (
        <div className="card card-pad" style={{ marginBottom: 14 }}>
          <div className="field" style={{ margin: 0 }}>
            <label>Buscar</label>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre, CUIT, mail o quién lo cargó" />
          </div>
        </div>
      )}

      {cargando ? (
        <Empty>Cargando…</Empty>
      ) : clientes.length === 0 ? (
        <Empty>Todavía no hay clientes. Creá el primero con “Nuevo cliente”.</Empty>
      ) : filas.length === 0 ? (
        <Empty>Ningún cliente coincide con la búsqueda.</Empty>
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
              {filas.map((c) => (
                <tr key={c.id} className="clickable" onClick={() => navigate(`/clientes/${c.id}`)}>
                  <td className="strong">{nombreCliente(c)}</td>
                  <td><span className="badge">{c.tipo}</span></td>
                  <td>{c.cuit}</td>
                  <td>{c.telefono}</td>
                  <td>{c.mail || <span className="muted">—</span>}</td>
                  <td className="muted sm">{cargadoPor(c.creado_por)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
