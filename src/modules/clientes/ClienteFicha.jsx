import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { obtener, listar, crear } from '../../lib/db';
import { PageHeader, BackButton, Empty, nombreCliente } from '../../shared/ui.jsx';
import Icon from '../../shared/Icon.jsx';

const TABS = ['Datos y contactos', 'Historial comercial', 'Ventas', 'Postventa', 'Service'];

export default function ClienteFicha() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [cliente, setCliente] = useState(null);
  const [contactos, setContactos] = useState([]);
  const [oportunidades, setOportunidades] = useState([]);
  const [tab, setTab] = useState('Datos y contactos');

  useEffect(() => {
    obtener('clientes', id).then(setCliente);
    listar('contactos', { cliente_id: Number(id) }).then(setContactos);
    listar('oportunidades', { cliente_id: Number(id) }).then(setOportunidades);
  }, [id]);

  if (!cliente) return <Empty>Cargando…</Empty>;

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
                  <tr key={o.id}>
                    <td className="strong">#{o.id}</td>
                    <td>{o.etapa}</td>
                    <td>{o.fecha_contacto}</td>
                    <td>{o.resultado || <span className="badge a">Abierta</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {['Ventas', 'Postventa', 'Service'].includes(tab) && (
        <div className="card" style={{ marginTop: 16 }}>
          <Empty>
            La pestaña <b>{tab}</b> se completa cuando se desarrolle ese módulo.<br />
            Los datos se leen igual que en las otras pestañas, con <code>listar()</code> filtrando por cliente.
          </Empty>
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
  async function guardar() {
    if (!form.nombre || !form.telefono) return;
    const nuevo = await crear('contactos', { ...form, cliente_id: Number(clienteId) });
    setContactos((cs) => [...cs, nuevo]);
    setForm(null);
  }
  return (
    <div className="card">
      <div className="card-h">
        <span className="grow">Contactos ({contactos.length})</span>
        {!form && <button className="btn ghost sm" onClick={() => setForm({ nombre: '', apellido: '', cargo: '', telefono: '', mail: '' })}>
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
              <div className="field"><label>Nombre *</label><input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></div>
              <div className="field"><label>Apellido</label><input value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value })} /></div>
              <div className="field"><label>Cargo</label><input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} /></div>
              <div className="field"><label>Teléfono *</label><input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} /></div>
              <div className="field full"><label>Mail</label><input value={form.mail} onChange={(e) => setForm({ ...form, mail: e.target.value })} /></div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn sm" onClick={guardar}><Icon name="check" size={14} /> Guardar</button>
              <button className="btn ghost sm" onClick={() => setForm(null)}>Cancelar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
