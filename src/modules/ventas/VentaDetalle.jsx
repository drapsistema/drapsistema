import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { obtener, listar, crear, actualizar, generarPostventa } from '../../lib/db';
import { PageHeader, BackButton, Empty, nombreCliente, fmtFecha, hoyISO, AvisoClienteIncompleto, nroVenta, nroPostventa } from '../../shared/ui.jsx';
import Comentarios, { comentarSistema } from '../../shared/Comentarios.jsx';
import ModalCampos from '../../shared/ModalCampos.jsx';
import { useToast } from '../../shared/Toast.jsx';
import { useAuth } from '../../shared/Auth.jsx';
import { rolesDe, parseArray } from '../../shared/permisos';
import Icon from '../../shared/Icon.jsx';

import { CAMPOS_EQUIPO } from './equipo.js';
import { estadoCobro } from './cobro.js';

const ESTADOS_COBRO = ['No', 'Parcial', 'Total'];
const FORMAS_PAGO = ['Contado', 'Cheques', 'Transferencia', 'Tarjeta', 'Otros'];

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
  const [cobro, setCobro] = useState(null);
  const [erroresCobro, setErroresCobro] = useState({});
  const [guardandoCobro, setGuardandoCobro] = useState(false);
  const [numeroInput, setNumeroInput] = useState(null); // null = no se está editando
  const [postventa, setPostventa] = useState(null);
  const { esAdmin, usuarioActualId, roles } = useAuth();

  useEffect(() => { cargar(); }, [id]);

  async function cargar() {
    const v = await obtener('ventas', id);
    setVenta(v);
    if (v) {
      setCliente(await obtener('clientes', v.cliente_id));
      setProductos(await listar('productos', { venta_id: Number(id) }));
      // Solo admin y Postventa pueden ver postventas; para el resto queda vacío.
      listar('postventas', { venta_id: Number(id) }).then((ps) => setPostventa(ps[0] || null)).catch(() => setPostventa(null));
      setForm({ direccion_entrega: v.direccion_entrega || '', fecha_entrega: v.fecha_entrega || '' });
      setComisionInput(v.comision ? String(v.comision) : '');
      setCobro(cobroDe(v));
      setErroresCobro({});
      listar('usuarios').then(setUsuarios).catch(() => setUsuarios([]));
    }
  }

  if (!venta) return <Empty>Cargando…</Empty>;

  const entregada = Boolean(venta.fecha_entrega);
  const cancelada = venta.estado === 'Cancelada';
  const puedeCancelar = !entregada && !cancelada && esAdmin;
  // La venta se bloquea cuando está cobrada Y registrada: a partir de ahí
  // solo un admin edita sus datos (integridad de lo ya cerrado). Antes de
  // eso, el vendedor (o tercerizado) puede operarla normalmente.
  const bloqueada = estadoCobro(venta) === 'Total' && Boolean(venta.registrado);
  const puedeEditar = esAdmin || !bloqueada;

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
        // La postventa la genera una función de la base (por fuera de RLS),
        // así funciona la guarde quien la guarde y sin el bug de fecha vacía.
        const n = await generarPostventa(id);
        await comentarSistema('venta', id, `Entrega cargada.${n ? ` Se generaron ${n} tareas de postventa.` : ''}`, usuarioActualId);
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

  async function guardarCobro() {
    const e = {};
    if (!cobro.estado_cobro) e.estado_cobro = true;
    if (cobro.con_iva === null) e.con_iva = true;
    if (cobro.formas_pago.length === 0) e.formas_pago = true;
    if (cobro.formas_pago.includes('Otros') && !cobro.forma_pago_otro.trim()) e.forma_pago_otro = true;
    setErroresCobro(e);
    if (Object.keys(e).length) { toast('Completá los datos obligatorios del cobro', 'err'); return; }

    setGuardandoCobro(true);
    try {
      const otro = cobro.formas_pago.includes('Otros') ? cobro.forma_pago_otro.trim() : '';
      await actualizar('ventas', id, {
        estado_cobro: cobro.estado_cobro,
        cobrado: cobro.estado_cobro === 'Total',
        con_iva: cobro.con_iva,
        formas_pago: cobro.formas_pago,
        forma_pago_otro: otro,
        registrado: cobro.registrado,
      });
      const formas = cobro.formas_pago.map((f) => (f === 'Otros' ? `Otros (${otro})` : f)).join(', ');
      const iva = cobro.con_iva === true ? ' · con IVA' : cobro.con_iva === false ? ' · sin IVA' : '';
      await comentarSistema('venta', id,
        `Cobro actualizado: ${cobro.estado_cobro === 'No' ? 'no cobrado' : `cobro ${cobro.estado_cobro.toLowerCase()}`}${iva} · forma de pago: ${formas} · registrado: ${cobro.registrado ? 'Sí' : 'No'}.`,
        usuarioActualId);
      toast('Cobro guardado');
      await cargar();
    } catch (err) {
      console.error(err);
      toast('No se pudo guardar el cobro', 'err');
    } finally {
      setGuardandoCobro(false);
    }
  }

  async function guardarNumero() {
    // Vacío = volver al número automático de esta venta.
    const nuevo = numeroInput.trim().replace(/\s+/g, ' ') || `VT-${String(venta.id).padStart(4, '0')}`;
    const clave = (s) => s.trim().toUpperCase();
    if (clave(nuevo) === clave(nroVenta(venta))) { setNumeroInput(null); return; }
    try {
      // Chequeo contra las ventas visibles (incluye los números automáticos);
      // la base igual lo impide para todas con su índice único.
      const todas = await listar('ventas');
      const otra = todas.find((v) => v.id !== venta.id && clave(nroVenta(v)) === clave(nuevo));
      if (otra) { toast(`Ya existe otra venta con el número ${nroVenta(otra)}`, 'err'); return; }

      await actualizar('ventas', id, { numero: nuevo });
      await comentarSistema('venta', id,
        `Número de venta cambiado de ${nroVenta(venta)} a ${nuevo}.`, usuarioActualId);
      setNumeroInput(null);
      toast('Número de venta actualizado');
      await cargar();
    } catch (err) {
      console.error(err);
      toast(err?.code === '23505' ? 'Ya existe otra venta con ese número' : 'No se pudo cambiar el número', 'err');
    }
  }

  const setC = (k, v) => setCobro((c) => ({ ...c, [k]: v }));
  const toggleForma = (f) => setCobro((c) => ({
    ...c, formas_pago: c.formas_pago.includes(f) ? c.formas_pago.filter((x) => x !== f) : [...c.formas_pago, f],
  }));

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
      await actualizar('oportunidades', venta.oportunidad_id, { resultado: 'Venta cancelada', etapa: 'Cierre', fecha_cierre: hoyISO() });
    }
    await comentarSistema('venta', id, `Venta cancelada. Motivo: ${motivoCancel}.`, usuarioActualId);
    toast('Venta cancelada');
    cargar();
  }

  return (
    <div>
      <PageHeader titulo={`Venta ${nroVenta(venta)} · ${nombreCliente(cliente)}`}
        sub={`Ganada el ${fmtFecha(venta.fecha_ganada)} · ${productos.length} equipos`}>
        <BackButton to="/ventas" />
      </PageHeader>

      {!cancelada && <AvisoClienteIncompleto cliente={cliente} />}

      {cancelada && (
        <div className="aviso bad">Venta <b style={{ margin: '0 4px' }}>cancelada</b> el {fmtFecha(venta.fecha_cancel)} · motivo: {venta.motivo_cancel}</div>
      )}
      {entregada && !cancelada && (
        <div className="aviso ok">
          Entregada el <b style={{ margin: '0 4px' }}>{fmtFecha(venta.fecha_entrega)}</b>. Postventa generada.
          <a onClick={() => navigate(postventa ? `/postventa/${postventa.id}` : '/postventa')} style={{ marginLeft: 8 }}>
            Ver postventa{postventa ? ` ${nroPostventa(postventa)}` : ''} →
          </a>
        </div>
      )}
      {bloqueada && !esAdmin && (
        <div className="aviso">Esta venta ya está cobrada y registrada: sus datos quedaron bloqueados para mantener la integridad. Solo un administrador puede modificarlos.</div>
      )}

      <div className="two" style={{ marginTop: 16 }}>
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-h">
              <span className="grow">Productos activados ({productos.length})</span>
              {puedeEditar && !cancelada && <button className="btn ghost sm" onClick={() => setEquipoModal({})}>+ Equipo</button>}
            </div>
            <div className="card-pad">
              {productos.length === 0 ? <Empty>Sin equipos cargados.</Empty> : (
                productos.map((p) => (
                  <div key={p.id} style={{ border: '1px solid var(--line-2)', borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="strong grow">{p.equipo || p.modelo || 'Equipo sin nombre'}</span>
                      {p.activado && <span className="badge g">Activado</span>}
                      {puedeEditar && !cancelada && <button className="btn ghost sm" onClick={() => setEquipoModal(p)}>Editar</button>}
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

          {/* Entrega: editable mientras la venta no esté bloqueada; lectura si sí */}
          {puedeEditar && !cancelada ? (
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
              {numeroInput === null ? (
                <InfoRow k="N° de venta" v={
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <b>{nroVenta(venta)}</b>
                    {puedeEditar && !cancelada && (
                      <button className="btn ghost sm" onClick={() => setNumeroInput(venta.numero || nroVenta(venta))}>Editar</button>
                    )}
                  </span>} />
              ) : (
                <div className="field">
                  <label>N° de venta</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input value={numeroInput} onChange={(e) => setNumeroInput(e.target.value)} autoFocus
                      placeholder={`VT-${String(venta.id).padStart(4, '0')}`} />
                    <button className="btn sm" onClick={guardarNumero}><Icon name="check" size={14} /></button>
                    <button className="btn ghost sm" onClick={() => setNumeroInput(null)}>✕</button>
                  </div>
                  <div className="hint">Dejalo vacío para volver al número automático.</div>
                </div>
              )}
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

          {/* Cobro / Facturación: editable mientras no esté bloqueada; lectura si sí */}
          {!cancelada && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-h">Cobro</div>
              <div className="card-pad">
                {puedeEditar && cobro ? (
                  <>
                    <div className="field">
                      <label>Cobrado <span className="req">*</span></label>
                      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', ...(erroresCobro.estado_cobro ? rojo : {}) }}>
                        {ESTADOS_COBRO.map((e) => (
                          <label key={e} style={opcion}>
                            <input type="checkbox" checked={cobro.estado_cobro === e}
                              onChange={() => setC('estado_cobro', cobro.estado_cobro === e ? '' : e)} /> {e}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="field">
                      <label>IVA <span className="req">*</span></label>
                      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', ...(erroresCobro.con_iva ? rojo : {}) }}>
                        {[['Con IVA', true], ['Sin IVA', false]].map(([txt, val]) => (
                          <label key={txt} style={opcion}>
                            <input type="checkbox" checked={cobro.con_iva === val}
                              onChange={() => setC('con_iva', cobro.con_iva === val ? null : val)} /> {txt}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="field">
                      <label>Forma de pago <span className="req">*</span></label>
                      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', ...(erroresCobro.formas_pago ? rojo : {}) }}>
                        {FORMAS_PAGO.map((f) => (
                          <label key={f} style={opcion}>
                            <input type="checkbox" checked={cobro.formas_pago.includes(f)} onChange={() => toggleForma(f)} /> {f}
                          </label>
                        ))}
                      </div>
                      <div className="hint">Podés marcar más de una.</div>
                    </div>
                    {cobro.formas_pago.includes('Otros') && (
                      <div className="field">
                        <label>¿Qué otra forma de pago? <span className="req">*</span></label>
                        <input value={cobro.forma_pago_otro} onChange={(e) => setC('forma_pago_otro', e.target.value)}
                          placeholder="Ej: canje, pagaré…"
                          style={erroresCobro.forma_pago_otro ? { borderColor: 'var(--red)' } : undefined} />
                      </div>
                    )}

                    <label style={{ ...opcion, marginBottom: 12 }}>
                      <input type="checkbox" checked={cobro.registrado} onChange={(e) => setC('registrado', e.target.checked)} /> Registrado
                    </label>

                    <button className="btn full" onClick={guardarCobro} disabled={guardandoCobro}>
                      <Icon name="check" size={16} /> {guardandoCobro ? 'Guardando…' : 'Guardar cobro'}
                    </button>
                  </>
                ) : (
                  <>
                    <InfoRow k="Cobrado" v={estadoCobro(venta)} />
                    <InfoRow k="IVA" v={venta.con_iva === true ? 'Con IVA' : venta.con_iva === false ? 'Sin IVA' : '—'} />
                    <InfoRow k="Forma de pago" v={textoFormasPago(venta) || '—'} />
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

const opcion = { display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer', fontWeight: 400 };
const rojo = { outline: '1px solid var(--red)', borderRadius: 6, padding: 4 };

function textoFormasPago(v) {
  return parseArray(v.formas_pago)
    .map((f) => (f === 'Otros' && v.forma_pago_otro ? `Otros (${v.forma_pago_otro})` : f)).join(', ');
}

function cobroDe(v) {
  return {
    // Una venta sin datos de cobro arranca sin selección, para obligar a elegir.
    estado_cobro: v.estado_cobro || (v.cobrado ? 'Total' : ''),
    con_iva: v.con_iva ?? null,
    formas_pago: parseArray(v.formas_pago),
    forma_pago_otro: v.forma_pago_otro || '',
    registrado: Boolean(v.registrado),
  };
}

function InfoRow({ k, v }) {
  return <div className="inforow"><span className="k">{k}</span><span className="v">{v}</span></div>;
}
