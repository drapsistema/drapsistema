import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listar, actualizar } from '../../lib/db';
import { PageHeader, Empty, nombreCliente, fmtFecha } from '../../shared/ui.jsx';
import ModalCampos from '../../shared/ModalCampos.jsx';
import { useToast } from '../../shared/Toast.jsx';

// Mismos campos del equipo que en el detalle de la venta. Solo "Equipo" obligatorio.
const CAMPOS_EQUIPO = [
  { name: 'equipo', label: 'Equipo', type: 'text', required: true, full: true, placeholder: 'Ej: DJI Agras T50' },
  { name: 'ns_dron', label: 'N° de serie de dron', type: 'text' },
  { name: 'fecha_activacion', label: 'Fecha de activación', type: 'date' },
  { name: 'ns_caja_dron', label: 'NS caja de dron', type: 'text' },
  { name: 'ns_caja_tanque', label: 'NS caja tanque de líquidos', type: 'text' },
  { name: 'ns_baterias', label: 'N° serie baterías', type: 'text' },
  { name: 'ns_hub', label: 'N° serie HUB', type: 'text' },
  { name: 'ns_wb37', label: 'N° serie WB37', type: 'text' },
  { name: 'ns_100w', label: 'N° serie 100W', type: 'text' },
  { name: 'ns_core_board', label: 'N° serie core board control', type: 'text' },
  { name: 'ns_generador', label: 'N° serie generador', type: 'text' },
  { name: 'localidad', label: 'Localidad', type: 'text' },
  { name: 'mail', label: 'Mail', type: 'text' },
];

const COLS = [
  { key: 'equipo', label: 'Equipo' },
  { key: 'ns_dron', label: 'N° serie dron' },
  { key: 'cliente', label: 'Cliente' },
  { key: 'venta', label: 'Venta' },
  { key: 'localidad', label: 'Localidad' },
  { key: 'activado', label: 'Activado' },
];

export default function EquiposActivados() {
  const [productos, setProductos] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState({ col: 'equipo', dir: 'asc' });
  const [modal, setModal] = useState(null); // producto en edición
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => { cargar(); }, []);
  async function cargar() {
    const [ps, vs, cs] = await Promise.all([listar('productos'), listar('ventas'), listar('clientes')]);
    setProductos(ps); setVentas(vs); setClientes(cs); setCargando(false);
  }

  const ventaDe = (vid) => ventas.find((v) => v.id === vid);
  const nombreCli = (clid) => { const c = clientes.find((x) => x.id === clid); return c ? nombreCliente(c) : '—'; };
  const clienteDe = (p) => { const v = ventaDe(p.venta_id); return v ? nombreCli(v.cliente_id) : '—'; };
  const vt = (vid) => `VT-${String(vid).padStart(4, '0')}`;
  const nombreEquipo = (p) => p.equipo || p.modelo || 'Equipo sin nombre';

  const valorCol = (p, key) => {
    switch (key) {
      case 'equipo': return nombreEquipo(p).toLowerCase();
      case 'ns_dron': return (p.ns_dron || '').toLowerCase();
      case 'cliente': return clienteDe(p).toLowerCase();
      case 'venta': return p.venta_id || 0;
      case 'localidad': return (p.localidad || '').toLowerCase();
      case 'activado': return p.activado ? 1 : 0;
      default: return '';
    }
  };

  let filas = productos;
  const term = q.trim().toLowerCase();
  if (term) {
    filas = filas.filter((p) =>
      nombreEquipo(p).toLowerCase().includes(term)
      || (p.ns_dron || '').toLowerCase().includes(term)
      || clienteDe(p).toLowerCase().includes(term)
      || (p.localidad || '').toLowerCase().includes(term)
      || vt(p.venta_id).toLowerCase().includes(term));
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

  async function guardar(valores) {
    const datos = { ...valores };
    if (!datos.fecha_activacion) datos.fecha_activacion = null; // no mandar '' a columna date
    datos.activado = Boolean(datos.fecha_activacion);
    try {
      await actualizar('productos', modal.id, datos);
      setModal(null); toast('Equipo actualizado'); cargar();
    } catch (e) {
      console.error(e); toast('No se pudo guardar el equipo', 'err');
    }
  }

  return (
    <div>
      <PageHeader titulo="Equipos activados" sub={`${filas.length} de ${productos.length} equipos cargados en ventas`} />

      {!cargando && productos.length > 0 && (
        <div className="card card-pad" style={{ marginBottom: 14 }}>
          <div className="field" style={{ margin: 0 }}>
            <label>Buscar</label>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Equipo, N° de serie, cliente, localidad o venta" />
          </div>
        </div>
      )}

      {cargando ? <Empty>Cargando…</Empty> : productos.length === 0 ? (
        <Empty>Todavía no hay equipos cargados. Se cargan desde el detalle de cada venta.</Empty>
      ) : filas.length === 0 ? (
        <Empty>Ningún equipo coincide con la búsqueda.</Empty>
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
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filas.map((p) => (
                <tr key={p.id}>
                  <td className="strong">{nombreEquipo(p)}</td>
                  <td>{p.ns_dron || <span className="muted">—</span>}</td>
                  <td>{clienteDe(p)}</td>
                  <td><a onClick={() => navigate(`/ventas/${p.venta_id}`)}>{vt(p.venta_id)}</a></td>
                  <td>{p.localidad || <span className="muted">—</span>}</td>
                  <td>{p.activado ? <span className="badge g">Sí</span> : <span className="badge">No</span>}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn ghost sm" onClick={() => setModal(p)}>Editar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <ModalCampos
          titulo="Editar equipo"
          subtitulo={`Venta ${vt(modal.venta_id)} · ${clienteDe(modal)}`}
          campos={CAMPOS_EQUIPO}
          valoresIniciales={modal}
          grid
          ancho={680}
          textoConfirmar="Guardar cambios"
          onConfirm={guardar}
          onCancel={() => setModal(null)}
        />
      )}
    </div>
  );
}
