import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { obtener, listar, crear } from '../../lib/db';
import { PageHeader, BackButton, Empty, nombreCliente, fmtFecha } from '../../shared/ui.jsx';
import Icon from '../../shared/Icon.jsx';

const TABS = ['Datos y contactos', 'Historial comercial', 'Ventas', 'Postventa', 'Service'];

// Helpers de formato/validación (mismos criterios que el alta de cliente).
const soloNumeros = (s) => (s || '').replace(/\D/g, '');
const mailValido = (m) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m);
const vt = (id) => `VT-${String(id).padStart(4, '0')}`;

export default function ClienteFicha() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [cliente, setCliente] = useState(null);
  const [contactos, setContactos] = useState([]);
  const [oportunidades, setOportunidades] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [trabajos, setTrabajos] = useState([]);
  const [tareas, setTareas] = useState([]); // postventa (tareas de las ventas del cliente)
  const [tab, setTab] = useState('Datos y contactos');

  useEffect(() => {
    obtener('clientes', id).then(setCliente);
    listar('contactos', { cliente_id: Number(id) }).then(setContactos);
    listar('oportunidades', { cliente_id: Number(id) }).then(setOportunidades);
    listar('trabajos', { cliente_id: Number(id) }).then(setTrabajos).catch(() => setTrabajos([]));
    listar('ventas', { cliente_id: Number(id) }).then(async (vs) => {
      setVentas(vs);
      // La postventa cuelga de la venta, no del cliente: filtramos las
      // tareas cuyas ventas son de este cliente.
      const ids = new Set(vs.map((v) => v.id));
      try {
        const todas = await listar('tareas_postventa');
        setTareas(todas.filter((t) => ids.has(t.venta_id)));
      } catch { setTareas([]); }
    }).catch(() => setVentas([]));
  }, [id]);

  if (!cliente) return <Empty>Cargando…</Empty>;

  const vtDe = (ventaId) => vt(ventaId);

  return (
    <div>
      <PageHeader titulo={nombreCliente(cliente)} sub={`${cliente.tipo} · CUIT ${cliente.cuit}`}>
        <BackButton to="/clientes" />
        <button className="btn ghost sm" onClick={() => navigate(`/clientes/${id}/editar`)}>Editar</button>
      </PageHeader>

      <div className="tabs-row">
        {TABS.map((t) => (
          <button key={t} className={'tab' + (tab === t ? ' on' : '')} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === 'Datos y contactos' && (
        <div className="two" style={{ marginTop: 16 }}>
          <div className="card">
            <div className="card-h">Datos del cliente</div>
            <div className="card-pad">
              <Row k="Tipo" v={cliente.tipo} />
              <Row k="CUIT" v={cliente.cuit} />
              <Row k="Domicilio" v={cliente.domicilio} />
              <Row k="Teléfono" v={cliente.telefono} />
              <Row k="Mail" v={cliente.mail || '—'} />
              <Row k="Observaciones" v={cliente.observaciones || '—'} />
            </div>
          </div>
          <ContactosCard clienteId={id} contactos={contactos} setContactos={setContactos} />
        </div>
      )}

      {tab === 'Historial comercial' && (
        <div className="card table-wrap" style={{ marginTop: 16 }}>
          {oportunidades.length === 0 ? (
            <Empty>Este cliente todavía no tiene oportunidades comerciales.</Empty>
          ) : (
            <table>
              <thead><tr><th>Oportunidad</th><th>Etapa</th><th>Primer contacto</th><th>Resultado</th></tr></thead>
              <tbody>
                {oportunidades.map((o) => (
                  <tr key={o.id} className="clickable" onClick={() => navigate(`/comercial/${o.id}`)}>
                    <td className="strong">#{o.id}</td>
                    <td>{o.etapa}</td>
                    <td>{fmtFecha(o.fecha_contacto)}</td>
                    <td>{o.resultado || <span className="badge a">Abierta</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'Ventas' && (
        <div className="card table-wrap" style={{ marginTop: 16 }}>
          {ventas.length === 0 ? (
            <Empty>Este cliente todavía no tiene ventas.</Empty>
          ) : (
            <table>
              <thead><tr><th>Venta</th><th>Ganada</th><th>Entrega</th><th>Estado</th></tr></thead>
              <tbody>
                {ventas.map((v) => (
                  <tr key={v.id} className="clickable" onClick={() => navigate(`/ventas/${v.id}`)}>
                    <td className="strong">{vt(v.id)}</td>
                    <td>{fmtFecha(v.fecha_ganada)}</td>
                    <td>{v.fecha_entrega ? fmtFecha(v.fecha_entrega) : '—'}</td>
                    <td>{v.estado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'Postventa' && (
        <div className="card table-wrap" style={{ marginTop: 16 }}>
          {tareas.length === 0 ? (
            <Empty>Este cliente todavía no tiene tareas de postventa.</Empty>
          ) : (
            <table>
              <thead><tr><th>Venta</th><th>Hito</th><th>Objetivo</th><th>Estado</th></tr></thead>
              <tbody>
                {tareas.map((t) => (
                  <tr key={t.id} className="clickable" onClick={() => navigate(`/postventa/${t.id}`)}>
                    <td className="strong">{vtDe(t.venta_id)}</td>
                    <td>{t.hito}</td>
                    <td>{fmtFecha(t.objetivo)}</td>
                    <td>{t.estado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'Service' && (
        <div className="card table-wrap" style={{ marginTop: 16 }}>
          {trabajos.length === 0 ? (
            <Empty>Este cliente todavía no tiene órdenes de service.</Empty>
          ) : (
            <table>
              <thead><tr><th>N°</th><th>Tipo</th><th>Ingreso</th><th>Estado</th></tr></thead>
              <tbody>
                {trabajos.map((t) => (
                  <tr key={t.id} className="clickable" onClick={() => navigate(`/service/${t.id}`)}>
                    <td className="strong">{t.nro}</td>
                    <td>{t.tipo}</td>
                    <td>{fmtFecha(t.ingreso)}</td>
                    <td>{t.estado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--line-2)', gap: 16 }}>
      <span className="muted sm">{k}</span>
      <span style={{ textAlign: 'right' }}>{v}</span>
    </div>
  );
}

function ContactosCard({ clienteId, contactos, setContactos }) {
  const [form, setForm] = useState(null);
  const [errores, setErrores] = useState({});

  function validar() {
    const e = {};
    if (!form.nombre) e.nombre = true;
    if (!form.telefono) e.telefono = true;
    if (form.mail && !mailValido(form.mail)) e.mail = true;
    setErrores(e);
    return Object.keys(e).length === 0;
  }

  async function guardar() {
    if (!validar()) return;
    const nuevo = await crear('contactos', { ...form, cliente_id: Number(clienteId) });
    setContactos((cs) => [...cs, nuevo]);
    setForm(null);
    setErrores({});
  }

  const abrir = () => { setErrores({}); setForm({ nombre: '', apellido: '', cargo: '', telefono: '', mail: '' }); };

  return (
    <div className="card">
      <div className="card-h">
        <span className="grow">Contactos ({contactos.length})</span>
        {!form && <button className="btn ghost sm" onClick={abrir}>
          <Icon name="plus" size={14} /> Agregar</button>}
      </div>
      <div className="card-pad">
        {contactos.length === 0 && !form && <div className="muted sm">Sin contactos cargados.</div>}
        {contactos.map((c) => (
          <div key={c.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--line-2)' }}>
            <div className="strong">{c.nombre} {c.apellido} {c.cargo && <span className="muted sm">· {c.cargo}</span>}</div>
            <div className="muted sm">{c.telefono}{c.mail ? ` · ${c.mail}` : ''}</div>
          </div>
        ))}
        {form && (
          <div style={{ marginTop: 10 }}>
            <div className="form-grid">
              <div className="field">
                <label>Nombre *</label>
                <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  style={errores.nombre ? { borderColor: 'var(--red)' } : undefined} />
              </div>
              <div className="field">
                <label>Apellido</label>
                <input value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value })} />
              </div>
              <div className="field">
                <label>Cargo</label>
                <input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} />
              </div>
              <div className="field">
                <label>Teléfono *</label>
                <input value={form.telefono} inputMode="numeric"
                  onChange={(e) => setForm({ ...form, telefono: soloNumeros(e.target.value) })}
                  placeholder="Solo números"
                  style={errores.telefono ? { borderColor: 'var(--red)' } : undefined} />
              </div>
              <div className="field full">
                <label>Mail</label>
                <input value={form.mail} type="email" onChange={(e) => setForm({ ...form, mail: e.target.value })}
                  style={errores.mail ? { borderColor: 'var(--red)' } : undefined} />
                {errores.mail && <div className="hint" style={{ color: 'var(--red)' }}>Formato de mail inválido.</div>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn sm" onClick={guardar}><Icon name="check" size={14} /> Guardar</button>
              <button className="btn ghost sm" onClick={() => { setForm(null); setErrores({}); }}>Cancelar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
