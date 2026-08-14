import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { obtener, listar, crear, actualizar } from '../../lib/db';
import { PageHeader, BackButton, Empty, nombreCliente, fmtFecha, hoyISO } from '../../shared/ui.jsx';
import Comentarios, { comentarSistema } from '../../shared/Comentarios.jsx';
import { useToast } from '../../shared/Toast.jsx';
import { useAuth } from '../../shared/Auth.jsx';
import Icon from '../../shared/Icon.jsx';

// Hitos de postventa y días desde la entrega.
const HITOS = [{ hito: '1 semana', dias: 7 }, { hito: '1 mes', dias: 30 }, { hito: '2 meses', dias: 60 }];

export default function VentaDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [venta, setVenta] = useState(null);
  const [cliente, setCliente] = useState(null);
  const [productos, setProductos] = useState([]);
  const [form, setForm] = useState({ direccion_entrega: '', fecha_entrega: '' });
  const [motivoCancel, setMotivoCancel] = useState('');
  const [confirmaNombre, setConfirmaNombre] = useState('');
  const { esAdmin, usuarioActualId } = useAuth();

  useEffect(() => { cargar(); }, [id]);

  async function cargar() {
    const v = await obtener('ventas', id);
    setVenta(v);
    if (v) {
      setCliente(await obtener('clientes', v.cliente_id));
      setProductos(await listar('productos', { venta_id: Number(id) }));
      setForm({ direccion_entrega: v.direccion_entrega || '', fecha_entrega: v.fecha_entrega || '' });
    }
  }

  if (!venta) return <Empty>Cargando…</Empty>;

  const entregada = Boolean(venta.fecha_entrega);
  const cancelada = venta.estado === 'Cancelada';
  const puedeCancelar = !entregada && !cancelada && esAdmin;

  async function agregarProducto() {
    await crear('productos', { venta_id: Number(id), modelo: 'Nuevo equipo', nro_serie: '', activado: false, alta_dji: false, garantia: '' });
    toast('Equipo agregado · editá sus datos');
    cargar();
  }

  async function guardarEntrega() {
    if (!form.direccion_entrega || !form.fecha_entrega) { toast('Cargá dirección y fecha de entrega', 'err'); return; }
    if (productos.length === 0) { toast('Cargá al menos un equipo antes de la entrega', 'err'); return; }
    const yaTenia = entregada;
    await actualizar('ventas', id, { direccion_entrega: form.direccion_entrega, fecha_entrega: form.fecha_entrega, estado: 'Entregada' });
    // Automatización: al cargar la entrega por primera vez, se generan las 3 tareas de postventa.
    if (!yaTenia) {
      const base = new Date(form.fecha_entrega);
      for (const h of HITOS) {
        const obj = new Date(base); obj.setDate(obj.getDate() + h.dias);
        await crear('tareas_postventa', {
          venta_id: Number(id), hito: h.hito, objetivo: obj.toISOString().slice(0, 10),
          estado: 'Pendiente', fecha_real: '', observaciones: '', hectareas: null,
          visita: false, visita_estado: '', visita_agenda: '', visita_real: '', responsable_id: 5,
        });
      }
      await comentarSistema('venta', id, `Entrega cargada. Se generaron 3 tareas de postventa.`);
      toast('Entrega guardada · postventa generada');
    } else {
      toast('Entrega actualizada');
    }
    cargar();
  }

  async function toggleCobro(campo) {
    await actualizar('ventas', id, { [campo]: !venta[campo] });
    cargar();
  }

  async function cancelar() {
    if (!motivoCancel) { toast('El motivo de cancelación es obligatorio', 'err'); return; }
    // Doble confirmación: reescribir el nombre exacto del cliente (evita cancelaciones por error).
    const nombre = nombreCliente(cliente);
    if (confirmaNombre.trim() !== nombre) {
      toast('El nombre no coincide. Escribilo tal cual figura para confirmar.', 'err'); return;
    }
    await actualizar('ventas', id, { estado: 'Cancelada', motivo_cancel: motivoCancel, fecha_cancel: hoyISO() });
    if (venta.oportunidad_id) {
      await actualizar('oportunidades', venta.oportunidad_id, { resultado: 'Venta cancelada', etapa: 'Cierre' });
    }
    await comentarSistema('venta', id, `Venta cancelada. Motivo: ${motivoCancel}.`);
    toast('Venta cancelada');
    cargar();
  }

  return (
    <div>
      <PageHeader titulo={`Venta VT-${String(venta.id).padStart(4, '0')} · ${nombreCliente(cliente)}`}
        sub={`Ganada el ${fmtFecha(venta.fecha_ganada)} · ${productos.length} equipos`}>
        <BackButton to="/ventas" />
      </PageHeader>

      {cancelada && (
        <div className="aviso bad">Venta <b style={{ margin: '0 4px' }}>cancelada</b> el {fmtFecha(venta.fecha_cancel)} · motivo: {venta.motivo_cancel}</div>
      )}
      {entregada && !cancelada && (
        <div className="aviso ok">
          Entregada el <b style={{ margin: '0 4px' }}>{fmtFecha(venta.fecha_entrega)}</b>. Postventa generada.
          <a onClick={() => navigate('/postventa')} style={{ marginLeft: 8 }}>Ver postventa →</a>
        </div>
      )}

      <div className="two" style={{ marginTop: 16 }}>
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-h">
              <span className="grow">Productos activados ({productos.length})</span>
              {!cancelada && <button className="btn ghost sm" onClick={agregarProducto}>+ Equipo</button>}
            </div>
            <div className="table-wrap">
              {productos.length === 0 ? <Empty>Sin equipos.</Empty> : (
                <table>
                  <thead><tr><th>Modelo</th><th>N° serie</th><th>Activado</th><th>Alta DJI</th></tr></thead>
                  <tbody>
                    {productos.map((p) => (
                      <tr key={p.id}>
                        <td className="strong">{p.modelo}</td>
                        <td>{p.nro_serie || '—'}</td>
                        <td>{p.activado ? <span className="badge g">Sí</span> : <span className="badge a">No</span>}</td>
                        <td>{p.alta_dji ? <span className="badge g">Sí</span> : <span className="badge a">No</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {!cancelada && (
            <div className="card">
              <div className="card-h">Entrega</div>
              <div className="card-pad">
                <div className="field"><label>Dirección de entrega</label>
                  <input value={form.direccion_entrega} onChange={(e) => setForm({ ...form, direccion_entrega: e.target.value })} /></div>
                <div className="field"><label>Fecha de entrega</label>
                  <input type="date" value={form.fecha_entrega} onChange={(e) => setForm({ ...form, fecha_entrega: e.target.value })} /></div>
                {!entregada && <div className="aviso">Cargar la fecha de entrega genera las 3 tareas de postventa. Después la venta ya no se puede cancelar.</div>}
                <button className="btn full" onClick={guardarEntrega}>
                  <Icon name="check" size={16} /> {entregada ? 'Actualizar entrega' : 'Guardar entrega y generar postventa'}
                </button>
              </div>
            </div>
          )}

          <Comentarios entidad="venta" refId={venta.id} />
        </div>

        <div>
          <div className="card">
            <div className="card-h">Datos</div>
            <div className="card-pad">
              <InfoRow k="Oportunidad" v={venta.oportunidad_id
                ? <a onClick={() => navigate(`/comercial/${venta.oportunidad_id}`)}>#{venta.oportunidad_id} →</a>
                : <span className="muted">venta directa</span>} />
              <InfoRow k="Cliente" v={nombreCliente(cliente)} />
              <InfoRow k="Ganada" v={fmtFecha(venta.fecha_ganada)} />
              <InfoRow k="Estado" v={<span className={'badge ' + (cancelada ? 'r' : entregada ? 'b' : '')}>{venta.estado}</span>} />
            </div>
          </div>

          {!cancelada && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-h">Cobro</div>
              <div className="card-pad">
                <label style={{ display: 'flex', gap: 8, marginBottom: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={venta.cobrado} onChange={() => toggleCobro('cobrado')} /> Cobrado
                </label>
                <label style={{ display: 'flex', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={venta.registrado} onChange={() => toggleCobro('registrado')} /> Registrado
                </label>
              </div>
            </div>
          )}

          {puedeCancelar && (
            <div className="card" style={{ marginTop: 16, borderColor: 'var(--red)' }}>
              <div className="card-h">Cancelar venta</div>
              <div className="card-pad">
                <div className="field"><label>Motivo <span className="req">*</span></label>
                  <textarea rows={2} value={motivoCancel} onChange={(e) => setMotivoCancel(e.target.value)} /></div>
                <div className="field">
                  <label>Para confirmar, escribí el nombre del cliente <span className="req">*</span></label>
                  <input value={confirmaNombre} onChange={(e) => setConfirmaNombre(e.target.value)}
                    placeholder={nombreCliente(cliente)} />
                  <div className="hint">Escribí <b>{nombreCliente(cliente)}</b> tal cual para evitar una cancelación por error.</div>
                </div>
                <div className="hint" style={{ marginBottom: 10 }}>Solo el administrador puede cancelar, y solo mientras no se generó la postventa.</div>
                <button className="btn full" style={{ background: 'var(--red)', borderColor: 'var(--red)' }} onClick={cancelar}>Cancelar venta</button>
              </div>
            </div>
          )}
          {entregada && !cancelada && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-pad muted sm">Esta venta ya generó la postventa, por lo que no se puede cancelar.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ k, v }) {
  return <div className="inforow"><span className="k">{k}</span><span className="v">{v}</span></div>;
}
