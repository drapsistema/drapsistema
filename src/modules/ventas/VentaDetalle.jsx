import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { obtener, listar, crear, actualizar } from '../../lib/db';
import { PageHeader, BackButton, Empty, nombreCliente, fmtFecha, hoyISO } from '../../shared/ui.jsx';
import Comentarios, { comentarSistema } from '../../shared/Comentarios.jsx';
import ModalCampos from '../../shared/ModalCampos.jsx';
import { useToast } from '../../shared/Toast.jsx';
import { useAuth } from '../../shared/Auth.jsx';
import { rolesDe } from '../../shared/permisos';
import Icon from '../../shared/Icon.jsx';

// Hitos de postventa y días desde la entrega.
const HITOS = [{ hito: '1 semana', dias: 7 }, { hito: '1 mes', dias: 30 }, { hito: '2 meses', dias: 60 }];

// Campos de cada equipo cargado en la venta. Solo "Equipo" es obligatorio.
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

export default function VentaDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [venta, setVenta] = useState(null);
  const [cliente, setCliente] = useState(null);
  const [productos, setProductos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [form, setForm] = useState({ direccion_entrega: '', fecha_entrega: '' });
  const [motivoCancel, setMotivoCancel] = useState('');
  const [confirmaNombre, setConfirmaNombre] = useState('');
  const [equipoModal, setEquipoModal] = useState(null);
  const [comisionInput, setComisionInput] = useState('');
  const [guardandoEntrega, setGuardandoEntrega] = useState(false);
  const { esAdmin, usuarioActualId, roles } = useAuth();

  useEffect(() => { cargar(); }, [id]);

  async function cargar() {
    const v = await obtener('ventas', id);
    setVenta(v);
    if (v) {
      setCliente(await obtener('clientes', v.cliente_id));
      setProductos(await listar('productos', { venta_id: Number(id) }));
      setForm({ direccion_entrega: v.direccion_entrega || '', fecha_entrega: v.fecha_entrega || '' });
      setComisionInput(v.comision ? String(v.comision) : '');
      listar('usuarios').then(setUsuarios).catch(() => setUsuarios([]));
    }
  }

  if (!venta) return <Empty>Cargando…</Empty>;

  const entregada = Boolean(venta.fecha_entrega);
  const cancelada = venta.estado === 'Cancelada';
  const puedeCancelar = !entregada && !cancelada && esAdmin;

  // Vendedor de la venta y si es tercerizado (para la comisión).
  const vendedorVenta = usuarios.find((u) => u.id === venta.vendedor_id) || null;
  const vendedorNombre = vendedorVenta?.nombre || '— sin asignar —';
  const ventaEsTercerizada = vendedorVenta ? rolesDe(vendedorVenta).includes('Vendedor tercerizado') : false;
  const soyElTercerizado = (roles || []).includes('Vendedor tercerizado') && venta.vendedor_id === usuarioActualId;
  const mostrarComision = ventaEsTercerizada && (esAdmin || soyElTercerizado);
  const comisionDefinida = venta.comision != null && Number(venta.comision) > 0;

  async function guardarEquipo(valores) {
    const datos = { ...valores };
    if (!datos.fecha_activacion) datos.fecha_activacion = null; // no mandar '' a columna date
    datos.activado = Boolean(datos.fecha_activacion);
    try {
      if (equipoModal && equipoModal.id) {
        await actualizar('productos', equipoModal.id, datos);
      } else {
        await crear('productos', { venta_id: Number(id), ...datos });
      }
      setEquipoModal(null);
      toast('Equipo guardado');
      cargar();
    } catch (e) {
      console.error(e);
      toast('No se pudo guardar el equipo', 'err');
    }
  }

  async function guardarEntrega() {
    if (!form.direccion_entrega || !form.fecha_entrega) { toast('Cargá dirección y fecha de entrega', 'err'); return; }
    if (productos.length === 0) { toast('Cargá al menos un equipo antes de la entrega', 'err'); return; }
    setGuardandoEntrega(true);
    try {
      const yaTenia = entregada;
      await actualizar('ventas', id, { direccion_entrega: form.direccion_entrega, fecha_entrega: form.fecha_entrega, estado: 'Entregada' });
      if (!yaTenia) {
        // Las 3 tareas de postventa se crean EN PARALELO (antes era una por
        // una y por eso demoraba). Con Promise.all es un solo ida y vuelta.
        const base = new Date(form.fecha_entrega);
        await Promise.all(HITOS.map((h) => {
          const obj = new Date(base); obj.setDate(obj.getDate() + h.dias);
          return crear('tareas_postventa', {
            venta_id: Number(id), hito: h.hito, objetivo: obj.toISOString().slice(0, 10),
            estado: 'Pendiente', fecha_real: '', observaciones: '', hectareas: null,
            visita: false, visita_estado: '', visita_agenda: '', visita_real: '', responsable_id: 5,
          });
        }));
        await comentarSistema('venta', id, 'Entrega cargada. Se generaron 3 tareas de postventa.', usuarioActualId);
        toast('Entrega guardada · postventa generada');
      } else {
        await comentarSistema('venta', id, 'Entrega actualizada.', usuarioActualId);
        toast('Entrega actualizada');
      }
      await cargar();
    } catch (e) {
      console.error(e);
      toast('No se pudo guardar la entrega', 'err');
    } finally {
      setGuardandoEntrega(false);
    }
  }

  async function toggleCobro(campo) {
    const nuevo = !venta[campo];
    await actualizar('ventas', id, { [campo]: nuevo });
    await comentarSistema('venta', id, `${campo === 'cobrado' ? 'Cobrado' : 'Registrado'} marcado como ${nuevo ? 'Sí' : 'No'}.`, usuarioActualId);
    cargar();
  }

  async function guardarComision() {
    const t = comisionInput.trim();
    const val = t ? Number(t) : null;
    if (t && (Number.isNaN(val) || val < 0)) { toast('La comisión debe ser un número válido', 'err'); return; }
    try {
      await actualizar('ventas', id, { comision: val });
      await comentarSistema('venta', id,
        val != null ? `Comisión del vendedor tercerizado definida en $${val}.` : 'Comisión del vendedor tercerizado borrada.',
        usuarioActualId);
      toast('Comisión guardada');
      cargar();
    } catch (e) {
      console.error(e);
      toast('No se pudo guardar la comisión', 'err');
    }
  }

  async function cancelar() {
    if (!motivoCancel) { toast('El motivo de cancelación es obligatorio', 'err'); return; }
    const nombre = nombreCliente(cliente);
    if (confirmaNombre.trim() !== nombre) {
      toast('El nombre no coincide. Escribilo tal cual figura para confirmar.', 'err'); return;
    }
    await actualizar('ventas', id, { estado: 'Cancelada', motivo_cancel: motivoCancel, fecha_cancel: hoyISO() });
    if (venta.oportunidad_id) {
      await actualizar('oportunidades', venta.oportunidad_id, { resultado: 'Venta cancelada', etapa: 'Cierre' });
    }
    await comentarSistema('venta', id, `Venta cancelada. Motivo: ${motivoCancel}.`, usuarioActualId);
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
      {!esAdmin && (
        <div className="aviso">Estás viendo la venta en modo lectura. Los datos de la venta los edita un administrador.</div>
      )}

      <div className="two" style={{ marginTop: 16 }}>
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-h">
              <span className="grow">Productos activados ({productos.length})</span>
              {esAdmin && !cancelada && <button className="btn ghost sm" onClick={() => setEquipoModal({})}>+ Equipo</button>}
            </div>
            <div className="card-pad">
              {productos.length === 0 ? <Empty>Sin equipos cargados.</Empty> : (
                productos.map((p) => (
                  <div key={p.id} style={{ border: '1px solid var(--line-2)', borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="strong grow">{p.equipo || p.modelo || 'Equipo sin nombre'}</span>
                      {p.activado && <span className="badge g">Activado</span>}
                      {esAdmin && !cancelada && <button className="btn ghost sm" onClick={() => setEquipoModal(p)}>Editar</button>}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 16px', marginTop: 6 }}>
                      {CAMPOS_EQUIPO
                        .filter((c) => c.name !== 'equipo' && p[c.name] && String(p[c.name]).trim() !== '')
                        .map((c) => (
                          <div key={c.name} className="sm">
                            <span className="muted">{c.label}:</span> {c.name === 'fecha_activacion' ? fmtFecha(p[c.name]) : p[c.name]}
                          </div>
                        ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Entrega: editable solo para admin; lectura para el resto */}
          {esAdmin && !cancelada ? (
            <div className="card">
              <div className="card-h">Entrega</div>
              <div className="card-pad">
                <div className="field"><label>Dirección de entrega</label>
                  <input value={form.direccion_entrega} onChange={(e) => setForm({ ...form, direccion_entrega: e.target.value })} /></div>
                <div className="field"><label>Fecha de entrega</label>
                  <input type="date" value={form.fecha_entrega} onChange={(e) => setForm({ ...form, fecha_entrega: e.target.value })} /></div>
                {!entregada && <div className="aviso">Cargar la fecha de entrega genera las 3 tareas de postventa. Después la venta ya no se puede cancelar.</div>}
                <button className="btn full" onClick={guardarEntrega} disabled={guardandoEntrega}>
                  <Icon name="check" size={16} /> {guardandoEntrega ? 'Guardando…' : (entregada ? 'Actualizar entrega' : 'Guardar entrega y generar postventa')}
                </button>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-h">Entrega</div>
              <div className="card-pad">
                <InfoRow k="Dirección" v={venta.direccion_entrega || '—'} />
                <InfoRow k="Fecha" v={venta.fecha_entrega ? fmtFecha(venta.fecha_entrega) : 'pendiente'} />
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
              <InfoRow k="Vendedor" v={vendedorNombre} />
              <InfoRow k="Ganada" v={fmtFecha(venta.fecha_ganada)} />
              <InfoRow k="Estado" v={<span className={'badge ' + (cancelada ? 'r' : entregada ? 'b' : '')}>{venta.estado}</span>} />
            </div>
          </div>

          {/* Comisión: solo si el vendedor de la venta es tercerizado */}
          {mostrarComision && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-h">Comisión (vendedor tercerizado)</div>
              <div className="card-pad">
                {esAdmin ? (
                  <>
                    <div className="field">
                      <label>Monto de comisión</label>
                      <input inputMode="decimal" value={comisionInput}
                        onChange={(e) => setComisionInput(e.target.value)} placeholder="Ej: 15000 (opcional)" />
                      <div className="hint">Aplica solo a vendedores tercerizados. Dejalo vacío si todavía no está definida.</div>
                    </div>
                    <button className="btn sm" onClick={guardarComision}><Icon name="check" size={14} /> Guardar comisión</button>
                  </>
                ) : (
                  comisionDefinida
                    ? <div>Comisión de venta: <span className="strong">${Number(venta.comision).toLocaleString('es-AR')}</span></div>
                    : <div>Comisión de venta: <span className="badge a">No definida</span></div>
                )}
              </div>
            </div>
          )}

          {/* Cobro: editable solo admin; lectura para el resto */}
          {!cancelada && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-h">Cobro</div>
              <div className="card-pad">
                {esAdmin ? (
                  <>
                    <label style={{ display: 'flex', gap: 8, marginBottom: 10, cursor: 'pointer' }}>
                      <input type="checkbox" checked={venta.cobrado} onChange={() => toggleCobro('cobrado')} /> Cobrado
                    </label>
                    <label style={{ display: 'flex', gap: 8, cursor: 'pointer' }}>
                      <input type="checkbox" checked={venta.registrado} onChange={() => toggleCobro('registrado')} /> Registrado
                    </label>
                  </>
                ) : (
                  <>
                    <InfoRow k="Cobrado" v={venta.cobrado ? 'Sí' : 'No'} />
                    <InfoRow k="Registrado" v={venta.registrado ? 'Sí' : 'No'} />
                  </>
                )}
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
          {entregada && !cancelada && esAdmin && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-pad muted sm">Esta venta ya generó la postventa, por lo que no se puede cancelar.</div>
            </div>
          )}
        </div>
      </div>

      {equipoModal && (
        <ModalCampos
          titulo={equipoModal.id ? 'Editar equipo' : 'Agregar equipo'}
          subtitulo="Solo el equipo es obligatorio; el resto se completa a medida que tengas los datos."
          campos={CAMPOS_EQUIPO}
          valoresIniciales={equipoModal}
          grid
          ancho={680}
          textoConfirmar={equipoModal.id ? 'Guardar cambios' : 'Agregar equipo'}
          onConfirm={guardarEquipo}
          onCancel={() => setEquipoModal(null)}
        />
      )}
    </div>
  );
}

function InfoRow({ k, v }) {
  return <div className="inforow"><span className="k">{k}</span><span className="v">{v}</span></div>;
}
