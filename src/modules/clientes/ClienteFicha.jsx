import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { obtener, listar, crear, actualizar } from '../../lib/db';
import { PageHeader, BackButton, Empty, nombreCliente, fmtFecha, AvisoClienteIncompleto, nroVenta, nroPostventa } from '../../shared/ui.jsx';
import { useAuth } from '../../shared/Auth.jsx';
import Icon from '../../shared/Icon.jsx';

const TABS = ['Datos y contactos', 'Historial comercial', 'Ventas', 'Equipos', 'Postventa', 'Service'];

// Helpers de formato/validación (mismos criterios que el alta de cliente).
const soloNumeros = (s) => (s || '').replace(/\D/g, '');
const mailValido = (m) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m);

export default function ClienteFicha() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [cliente, setCliente] = useState(null);
  const [contactos, setContactos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [oportunidades, setOportunidades] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [trabajos, setTrabajos] = useState([]);
  const [tareas, setTareas] = useState([]); // postventa (tareas de las ventas del cliente)
  const [equipos, setEquipos] = useState([]);
  const [tab, setTab] = useState('Datos y contactos');
  const { esAdmin } = useAuth();

  useEffect(() => {
    obtener('clientes', id).then(setCliente);
    listar('usuarios').then(setUsuarios).catch(() => setUsuarios([]));
    listar('contactos', { cliente_id: Number(id) }).then(setContactos);
    listar('oportunidades', { cliente_id: Number(id) }).then(setOportunidades);
    listar('trabajos', { cliente_id: Number(id) }).then(setTrabajos).catch(() => setTrabajos([]));
    listar('ventas', { cliente_id: Number(id) }).then(async (vs) => {
      setVentas(vs);
      // Equipos del cliente: los de sus ventas y los cargados sin venta.
      const idsV = new Set(vs.map((v) => v.id));
      listar('productos').then((ps) => setEquipos(ps.filter((p) => idsV.has(p.venta_id) || p.cliente_id === Number(id))))
        .catch(() => setEquipos([]));
      // Tareas de postventa del cliente: las de sus ventas y las cargadas
      // directo al cliente (equipos comprados en otro lado).
      const ids = new Set(vs.map((v) => v.id));
      try {
        const todas = await listar('tareas_postventa');
        setTareas(todas.filter((t) => ids.has(t.venta_id) || t.cliente_id === Number(id)));
      } catch { setTareas([]); }
    }).catch(() => setVentas([]));
  }, [id]);

  if (!cliente) return <Empty>Cargando…</Empty>;

  const ventaPorId = (vid) => ventas.find((v) => v.id === vid);

  return (
    <div>
      <PageHeader titulo={nombreCliente(cliente)} sub={`${cliente.tipo} · ${cliente.cuit ? `CUIT ${cliente.cuit}` : 'Sin CUIT'}`}>
        <BackButton to="/clientes" />
        {!cliente.unificado_en && (
          <button className="btn ghost sm" onClick={() => navigate(`/clientes/${id}/editar`)}>Editar</button>
        )}
        {esAdmin && !cliente.unificado_en && cliente.activo !== false && (
          <button className="btn ghost sm" onClick={() => navigate(`/clientes/unificar?origen=${id}`)}>Unificar con…</button>
        )}
      </PageHeader>

      {cliente.unificado_en ? (
        <div className="aviso bad" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="grow">Este cliente estaba duplicado y se unificó en otro. Todo su historial pasó a ese cliente.</span>
          <button className="btn ghost sm" onClick={() => navigate(`/clientes/${cliente.unificado_en}`)}>Ir al cliente →</button>
        </div>
      ) : (
        <AvisoClienteIncompleto cliente={cliente} />
      )}

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
              <Row k="CUIT" v={cliente.cuit || '—'} />
              <Row k="Domicilio" v={cliente.domicilio || '—'} />
              <Row k="Localidad" v={[cliente.localidad, cliente.provincia].filter(Boolean).join(', ') || '—'} />
              <Row k="Actividad" v={cliente.actividad || '—'} />
              <Row k="Teléfono" v={cliente.telefono || '—'} />
              <Row k="Mail" v={cliente.mail || '—'} />
              <Row k="Observaciones" v={cliente.observaciones || '—'} />
              <Row k="Cargado por" v={usuarios.find((u) => u.id === cliente.creado_por)?.nombre || '—'} />
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
                    <td className="strong">{nroVenta(v)}</td>
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

      {tab === 'Equipos' && (
        <div className="card table-wrap" style={{ marginTop: 16 }}>
          {equipos.length === 0 ? (
            <Empty>Este cliente todavía no tiene equipos activados.</Empty>
          ) : (
            <table>
              <thead><tr><th>Equipo</th><th>N° serie dron</th><th>Activación</th><th>Venta</th></tr></thead>
              <tbody>
                {equipos.map((p) => (
                  <tr key={p.id} className={p.venta_id ? 'clickable' : undefined}
                    onClick={() => p.venta_id && navigate(`/ventas/${p.venta_id}`)}>
                    <td className="strong">{p.equipo || p.modelo || 'Equipo'}</td>
                    <td>{p.ns_dron || <span className="muted">—</span>}</td>
                    <td>{p.fecha_activacion ? fmtFecha(p.fecha_activacion) : <span className="muted">—</span>}</td>
                    <td>{p.venta_id ? nroVenta(ventaPorId(p.venta_id) || { id: p.venta_id }) : <span className="badge">Sin venta</span>}</td>
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
              <thead><tr><th>Postventa</th><th>Venta</th><th>Hito</th><th>Objetivo</th><th>Estado</th></tr></thead>
              <tbody>
                {tareas.map((t) => (
                  <tr key={t.id} className="clickable" onClick={() => t.postventa_id && navigate(`/postventa/${t.postventa_id}`)}>
                    <td className="strong">{t.postventa_id ? nroPostventa({ id: t.postventa_id }) : '—'}</td>
                    <td>{t.venta_id ? nroVenta(ventaPorId(t.venta_id) || { id: t.venta_id }) : <span className="muted">Sin venta</span>}</td>
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

  const [guardando, setGuardando] = useState(false);

  function validar() {
    const e = {};
    if (!form.nombre.trim()) e.nombre = true;
    if (form.mail && !mailValido(form.mail)) e.mail = true;
    setErrores(e);
    return Object.keys(e).length === 0;
  }

  async function guardar() {
    if (!validar()) return;
    setGuardando(true);
    try {
      const datos = {
        nombre: form.nombre, apellido: form.apellido, cargo: form.cargo,
        telefono: form.telefono, mail: form.mail,
      };
      if (form.id) {
        const editado = await actualizar('contactos', form.id, datos);
        setContactos((cs) => cs.map((c) => (c.id === form.id ? { ...c, ...datos, ...editado } : c)));
      } else {
        const nuevo = await crear('contactos', { ...datos, cliente_id: Number(clienteId) });
        setContactos((cs) => [...cs, nuevo]);
      }
      cerrar();
    } catch (err) {
      console.error('Error al guardar contacto:', err);
      alert('No se pudo guardar el contacto. Revisá la consola.');
    } finally {
      setGuardando(false);
    }
  }

  const cerrar = () => { setForm(null); setErrores({}); };
  const abrirNuevo = () => { setErrores({}); setForm({ nombre: '', apellido: '', cargo: '', telefono: '', mail: '' }); };
  const abrirEdicion = (c) => {
    setErrores({});
    setForm({
      id: c.id, nombre: c.nombre || '', apellido: c.apellido || '', cargo: c.cargo || '',
      telefono: c.telefono || '', mail: c.mail || '',
    });
  };

  const formulario = form && (
    <div style={{ margin: '10px 0' }}>
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
          <label>Teléfono</label>
          <input value={form.telefono} inputMode="numeric"
            onChange={(e) => setForm({ ...form, telefono: soloNumeros(e.target.value) })}
            placeholder="Solo números" />
        </div>
        <div className="field full">
          <label>Mail</label>
          <input value={form.mail} type="email" onChange={(e) => setForm({ ...form, mail: e.target.value })}
            style={errores.mail ? { borderColor: 'var(--red)' } : undefined} />
          {errores.mail && <div className="hint" style={{ color: 'var(--red)' }}>Formato de mail inválido.</div>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn sm" onClick={guardar} disabled={guardando}>
          <Icon name="check" size={14} /> {guardando ? 'Guardando…' : 'Guardar'}
        </button>
        <button className="btn ghost sm" onClick={cerrar}>Cancelar</button>
      </div>
    </div>
  );

  return (
    <div className="card">
      <div className="card-h">
        <span className="grow">Contactos ({contactos.length})</span>
        {!form && <button className="btn ghost sm" onClick={abrirNuevo}>
          <Icon name="plus" size={14} /> Agregar</button>}
      </div>
      <div className="card-pad">
        {contactos.length === 0 && !form && <div className="muted sm">Sin contactos cargados.</div>}
        {contactos.map((c) => (form && form.id === c.id ? (
          <div key={c.id}>{formulario}</div>
        ) : (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--line-2)' }}>
            <div className="grow">
              <div className="strong">{c.nombre} {c.apellido} {c.cargo && <span className="muted sm">· {c.cargo}</span>}</div>
              <div className="muted sm">{[c.telefono, c.mail].filter(Boolean).join(' · ') || 'Sin teléfono ni mail'}</div>
            </div>
            {!form && <button className="btn ghost sm" onClick={() => abrirEdicion(c)}>Editar</button>}
          </div>
        )))}
        {form && !form.id && formulario}
      </div>
    </div>
  );
}
