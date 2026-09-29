import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { obtener, listar, crear, buscarCatalogo, siguienteNroPresupuesto } from '../../lib/db';
import { PageHeader, BackButton, Empty, nombreCliente, hoyISO } from '../../shared/ui.jsx';
import { comentarSistema } from '../../shared/Comentarios.jsx';
import { useToast } from '../../shared/Toast.jsx';
import { useAuth } from '../../shared/Auth.jsx';
import { rolesDe, parseArray } from '../../shared/permisos';
import Icon from '../../shared/Icon.jsx';
import { registrarPresupuesto } from '../comercial/etapas.js';
import { conMoneda, formatoNumero, precioEnMoneda, totales, nombreVersion, MONEDAS } from './calculo.js';
import { descargarPdfPresupuesto } from './pdf.js';

// ============================================================
// PRESUPUESTADOR
//   /presupuestos/nuevo?oportunidad=ID  (vendedores, desde el CRM)
//   /presupuestos/nuevo?trabajo=ID      (técnicos, reparaciones)
//   /presupuestos/nuevo?base=ID         (nueva versión de un presupuesto)
// Los precios del catálogo son fijos salvo para el admin; los ítems
// manuales (mano de obra, flete…) llevan el precio que se cargue.
// ============================================================

let claveItem = 0;
const nuevaClave = () => ++claveItem;

const datosCliente = (c) => ({
  nombre: nombreCliente(c), cuit: c.cuit || '', domicilio: c.domicilio || '', telefono: c.telefono || '', mail: c.mail || '',
});
const datosVendedor = (u) => ({
  nombre: u?.nombre || '', cargo: u?.cargo || 'Asesor Comercial', telefono: u?.telefono || '', whatsapp: u?.whatsapp || '',
});

export default function PresupuestoForm() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { esAdmin, usuarioActualId } = useAuth();

  const [ctx, setCtx] = useState(null);  // { op?, trabajo?, cliente, base?, cotizaciones }
  const [cfg, setCfg] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [form, setForm] = useState(null);
  const [items, setItems] = useState([]);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [monedaDescuento, setMonedaDescuento] = useState(null); // moneda en la que se cargó el descuento

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    const [cRaw, us] = await Promise.all([
      obtener('configuracion', 1).catch(() => null),
      listar('usuarios').catch(() => []),
    ]);
    const c = cRaw && {
      ...cRaw,
      pres_tipos: parseArray(cRaw.pres_tipos), pres_condiciones: parseArray(cRaw.pres_condiciones), pres_validez: parseArray(cRaw.pres_validez),
    };
    setCfg(c); setUsuarios(us);

    let base = null, op = null, trabajo = null;
    if (params.get('base')) {
      base = await obtener('presupuestos', params.get('base'));
      if (base.oportunidad_id) op = await obtener('oportunidades', base.oportunidad_id);
      if (base.trabajo_id) trabajo = await obtener('trabajos', base.trabajo_id);
    } else if (params.get('oportunidad')) {
      op = await obtener('oportunidades', params.get('oportunidad'));
    } else if (params.get('trabajo')) {
      trabajo = await obtener('trabajos', params.get('trabajo'));
    }
    const cliente = await obtener('clientes', (op || trabajo || base).cliente_id);
    const cotizaciones = op ? await listar('cotizaciones', { oportunidad_id: op.id }) : [];
    setCtx({ op, trabajo, cliente, base, cotizaciones });

    const tipos = c?.pres_tipos || [];
    const tipoReparacion = tipos.find((t) => /servicio|reparaci/i.test(t)) || tipos[0] || '';
    if (base) {
      setForm({
        vendedor_id: base.vendedor_id || usuarioActualId, tipo: base.tipo || '', condicion_pago: base.condicion_pago || '',
        validez: base.validez || '', notas: base.notas || '', moneda: base.moneda || 'USD',
        cotizacion: base.cotizacion ? String(base.cotizacion) : '', descuento: base.descuento ? String(base.descuento) : '',
      });
      setMonedaDescuento(base.moneda || 'USD');
      const its = (await listar('presupuesto_items', { presupuesto_id: base.id })).sort((a, b) => a.orden - b.orden);
      setItems(its.map((it) => ({
        key: nuevaClave(), producto_id: it.producto_id, sku: it.sku || '', codigo: it.codigo || '',
        descripcion: it.descripcion, cantidad: Number(it.cantidad), precio_unit: Number(it.precio_unit), precio_lista: it.precio_lista,
      })));
    } else {
      setForm({
        // El admin puede elegir qué vendedor figura; por defecto el de la oportunidad.
        vendedor_id: esAdmin && op?.vendedor_id ? op.vendedor_id : usuarioActualId,
        tipo: trabajo ? tipoReparacion : (tipos[0] || ''),
        condicion_pago: (c?.pres_condiciones || [])[0] || '',
        validez: (c?.pres_validez || [])[0] || '',
        notas: '', moneda: 'USD', cotizacion: '', descuento: '',
      });
    }
  }

  if (!ctx || !form) return <Empty>Cargando…</Empty>;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const vendedor = usuarios.find((u) => u.id === Number(form.vendedor_id));
  const faltaContacto = vendedor && (!vendedor.telefono || !vendedor.whatsapp);
  const elegibles = usuarios
    .filter((u) => (u.acceso || 'Activo') === 'Activo' && rolesDe(u).some((r) => r.startsWith('Vendedor') || r === 'Técnico' || r === 'Administrador'))
    .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));

  const pres = { moneda: form.moneda, cotizacion: Number(form.cotizacion) || 0, descuento: Number(form.descuento) || 0 };
  const t = totales(pres, items);

  const agregarProducto = (p) => setItems((its) => [...its, {
    key: nuevaClave(), producto_id: p.id, sku: p.sku, codigo: p.codigo || '', descripcion: p.descripcion,
    cantidad: 1, precio_unit: Number(p.precio), precio_lista: Number(p.precio),
  }]);
  const agregarManual = () => setItems((its) => [...its, {
    key: nuevaClave(), producto_id: null, sku: '', codigo: '', descripcion: '', cantidad: 1, precio_unit: 0, precio_lista: null,
  }]);
  const setItem = (key, k, v) => setItems((its) => its.map((it) => (it.key === key ? { ...it, [k]: v } : it)));
  const quitarItem = (key) => setItems((its) => its.filter((it) => it.key !== key));
  const mover = (key, d) => setItems((its) => {
    const i = its.findIndex((it) => it.key === key), j = i + d;
    if (j < 0 || j >= its.length) return its;
    const copia = [...its]; [copia[i], copia[j]] = [copia[j], copia[i]]; return copia;
  });

  function validar() {
    const e = {};
    if (items.length === 0) e.items = 'Agregá al menos un ítem.';
    items.forEach((it) => {
      if (!it.descripcion.trim()) e[`d${it.key}`] = true;
      if (!(Number(it.cantidad) > 0)) e[`c${it.key}`] = true;
      if (!(Number(it.precio_unit) >= 0) || (it.producto_id == null && !(Number(it.precio_unit) > 0))) e[`p${it.key}`] = true;
    });
    if (form.moneda === 'ARS' && !(Number(form.cotizacion) > 0)) e.cotizacion = true;
    if (Number(form.descuento) < 0 || Number(form.descuento) > t.subtotal) e.descuento = true;
    if (!form.vendedor_id) e.vendedor_id = true;
    setErrores(e);
    return e;
  }

  async function guardar(conPdf) {
    const e = validar();
    if (Object.keys(e).length) { toast(e.items || 'Revisá los datos marcados en rojo', 'err'); return; }
    setGuardando(true);
    try {
      const { op, trabajo, cliente, base } = ctx;
      let numero, version = 1;
      if (base) {
        numero = base.numero;
        const versiones = await listar('presupuestos', { numero });
        version = Math.max(...versiones.map((v) => v.version), base.version) + 1;
      } else {
        numero = await siguienteNroPresupuesto();
      }
      const datos = {
        numero, version,
        oportunidad_id: op?.id || null, trabajo_id: trabajo?.id || null, cliente_id: cliente.id,
        vendedor_id: Number(form.vendedor_id), fecha: hoyISO(),
        tipo: form.tipo, condicion_pago: form.condicion_pago, validez: form.validez, notas: form.notas.trim(),
        moneda: form.moneda, cotizacion: form.moneda === 'ARS' ? Number(form.cotizacion) : null,
        descuento: t.descuento, subtotal: t.subtotal, total: t.total,
        cliente_datos: datosCliente(cliente), vendedor_datos: datosVendedor(vendedor),
      };
      const nuevo = await crear('presupuestos', datos);
      const guardados = [];
      for (const [i, it] of items.entries()) {
        guardados.push(await crear('presupuesto_items', {
          presupuesto_id: nuevo.id, orden: i, producto_id: it.producto_id,
          sku: it.sku || null, codigo: it.codigo || null, descripcion: it.descripcion.trim(),
          cantidad: Number(it.cantidad), precio_unit: Number(it.precio_unit), precio_lista: it.precio_lista,
        }));
      }

      const texto = base
        ? `Nueva versión del presupuesto: ${nombreVersion(nuevo)} (reemplaza a v${base.version}) · total ${conMoneda(nuevo.moneda, nuevo.total)}.`
        : `Presupuesto ${nombreVersion(nuevo)} creado · total ${conMoneda(nuevo.moneda, nuevo.total)}.`;
      if (op) {
        await registrarPresupuesto(op, nuevo, { cotizaciones: ctx.cotizaciones });
        await comentarSistema('op', op.id, texto, usuarioActualId);
      }
      if (trabajo) await comentarSistema('trabajo', trabajo.id, texto, usuarioActualId);

      if (conPdf) await descargarPdfPresupuesto(nuevo, guardados);
      toast(`Presupuesto ${nombreVersion(nuevo)} guardado`);
      navigate(`/presupuestos/${nuevo.id}`, { replace: true });
    } catch (err) {
      console.error('Error al guardar presupuesto:', err);
      toast('No se pudo guardar el presupuesto', 'err');
      setGuardando(false);
    }
  }

  const volver = ctx.base ? `/presupuestos/${ctx.base.id}` : ctx.op ? `/comercial/${ctx.op.id}` : `/service/${ctx.trabajo.id}`;
  const rojo = (k) => (errores[k] ? { borderColor: 'var(--red)' } : undefined);

  return (
    <div>
      <PageHeader
        titulo={ctx.base ? `Nueva versión de ${ctx.base.numero}` : 'Nuevo presupuesto'}
        sub={`${nombreCliente(ctx.cliente)} · ${ctx.op ? `Oportunidad #${ctx.op.id}` : `Trabajo ${ctx.trabajo.nro}`}`}>
        <BackButton to={volver} />
      </PageHeader>

      {ctx.base && (
        <div className="aviso">La versión anterior (v{ctx.base.version}) no se modifica: se crea una versión nueva con los cambios.</div>
      )}

      <div className="pres-grid">
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-h">Cliente</div>
            <div className="card-pad pres-datos">
              <span className="muted sm">Razón social</span><b>{nombreCliente(ctx.cliente)}</b>
              <span className="muted sm">CUIT</span><span>{ctx.cliente.cuit || '—'}</span>
              <span className="muted sm">Domicilio</span><span>{ctx.cliente.domicilio || '—'}</span>
              <span className="muted sm">Teléfono</span><span>{ctx.cliente.telefono || '—'}</span>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-h">Ítems</div>
            <div className="card-pad">
              <BuscadorCatalogo onElegir={agregarProducto} />
              <button className="btn ghost sm" onClick={agregarManual} style={{ marginTop: 8 }}>
                <Icon name="plus" size={14} /> Ítem manual (mano de obra, flete, etc.)
              </button>
            </div>
            {items.length === 0 ? (
              <Empty>{errores.items || 'Buscá un producto del catálogo o agregá un ítem manual.'}</Empty>
            ) : (
              <div className="table-wrap">
                <table className="pres-items">
                  <thead>
                    <tr><th>Descripción</th><th style={{ width: 80 }}>Cant.</th><th style={{ width: 130 }}>P. unit. U$S</th><th style={{ textAlign: 'right' }}>Subtotal {MONEDAS[form.moneda]}</th><th /></tr>
                  </thead>
                  <tbody>
                    {items.map((it, i) => {
                      const precioFijo = it.producto_id != null && !esAdmin;
                      return (
                        <tr key={it.key}>
                          <td>
                            {it.producto_id != null ? (
                              <>
                                <div className="strong sm">{it.descripcion}</div>
                                <div className="muted" style={{ fontSize: 11 }}>{[it.sku, it.codigo].filter(Boolean).join(' · ')}</div>
                              </>
                            ) : (
                              <input value={it.descripcion} onChange={(e) => setItem(it.key, 'descripcion', e.target.value)}
                                placeholder="Descripción del ítem" style={rojo(`d${it.key}`)} />
                            )}
                          </td>
                          <td>
                            <input type="number" min="1" step="1" value={it.cantidad}
                              onChange={(e) => setItem(it.key, 'cantidad', e.target.value)} style={rojo(`c${it.key}`)} />
                          </td>
                          <td>
                            <input type="number" min="0" step="0.01" value={it.precio_unit} disabled={precioFijo}
                              title={precioFijo ? 'Precio de lista: solo un administrador puede cambiarlo' : undefined}
                              onChange={(e) => setItem(it.key, 'precio_unit', e.target.value)} style={rojo(`p${it.key}`)} />
                            {esAdmin && it.precio_lista != null && Number(it.precio_unit) !== Number(it.precio_lista) && (
                              <div className="muted" style={{ fontSize: 11 }}>Lista: {formatoNumero(it.precio_lista)}</div>
                            )}
                          </td>
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }} className="strong">
                            {formatoNumero(precioEnMoneda(pres, it.precio_unit) * Number(it.cantidad || 0))}
                          </td>
                          <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                            <button className="ibtn" onClick={() => mover(it.key, -1)} disabled={i === 0} title="Subir">↑</button>
                            <button className="ibtn" onClick={() => mover(it.key, 1)} disabled={i === items.length - 1} title="Bajar">↓</button>
                            <button className="ibtn del" onClick={() => quitarItem(it.key)} title="Quitar"><Icon name="del" size={14} /></button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-h">Condiciones</div>
            <div className="card-pad">
              <div className="form-grid">
                <div className="field">
                  <label>Tipo de presupuesto</label>
                  <select value={form.tipo} onChange={(e) => set('tipo', e.target.value)}>
                    {opciones(cfg?.pres_tipos, form.tipo)}
                  </select>
                </div>
                <div className="field">
                  <label>Condición de pago</label>
                  <select value={form.condicion_pago} onChange={(e) => set('condicion_pago', e.target.value)}>
                    {opciones(cfg?.pres_condiciones, form.condicion_pago)}
                  </select>
                </div>
                <div className="field full">
                  <label>Validez</label>
                  <select value={form.validez} onChange={(e) => set('validez', e.target.value)}>
                    {opciones(cfg?.pres_validez, form.validez)}
                  </select>
                </div>
                <div className="field full">
                  <label>Notas</label>
                  <textarea rows={2} value={form.notas} onChange={(e) => set('notas', e.target.value)}
                    placeholder="Ej: stock sujeto a disponibilidad, plazo de entrega…" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="pres-lateral">
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-h">Emitido por</div>
            <div className="card-pad">
              {esAdmin ? (
                <div className="field">
                  <label>Vendedor que figura en el presupuesto</label>
                  <select value={form.vendedor_id} onChange={(e) => set('vendedor_id', e.target.value)} style={rojo('vendedor_id')}>
                    {elegibles.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                  </select>
                </div>
              ) : (
                <div className="strong" style={{ marginBottom: 6 }}>{vendedor?.nombre}</div>
              )}
              <div className="muted sm">
                {vendedor?.cargo || 'Asesor Comercial'} · Tel. {vendedor?.telefono || '—'} · WhatsApp {vendedor?.whatsapp || '—'}
              </div>
              {faltaContacto && (
                <div className="aviso warn" style={{ marginTop: 10, marginBottom: 0 }}>
                  {vendedor.id === usuarioActualId
                    ? <span>Te falta cargar tu teléfono o WhatsApp: van a salir vacíos. <a onClick={() => navigate('/perfil')}>Completalos en Mi perfil</a>.</span>
                    : <span>{vendedor.nombre} no tiene cargado su teléfono o WhatsApp: van a salir vacíos en el PDF.</span>}
                </div>
              )}
            </div>
          </div>

          <div className="card" style={{ position: 'sticky', top: 12 }}>
            <div className="card-h">Totales</div>
            <div className="card-pad">
              <div className="form-grid">
                <div className="field">
                  <label>Moneda</label>
                  <select value={form.moneda} onChange={(e) => set('moneda', e.target.value)}>
                    <option value="USD">Dólares (U$S)</option>
                    <option value="ARS">Pesos ($)</option>
                  </select>
                </div>
                {form.moneda === 'ARS' ? (
                  <div className="field">
                    <label>Cotización U$S 1 = $ <span className="req">*</span></label>
                    <input type="number" min="0" step="0.01" value={form.cotizacion}
                      onChange={(e) => set('cotizacion', e.target.value)} style={rojo('cotizacion')} placeholder="Ej: 1250" />
                  </div>
                ) : <div />}
                <div className="field full">
                  <label>Descuento ({MONEDAS[form.moneda]})</label>
                  <input type="number" min="0" step="0.01" value={form.descuento}
                    onChange={(e) => { set('descuento', e.target.value); setMonedaDescuento(form.moneda); }} style={rojo('descuento')} placeholder="0" />
                  <div className="hint">Monto fijo sobre el subtotal. Si queda en 0 no aparece en el presupuesto.</div>
                  {Number(form.descuento) > 0 && form.moneda !== monedaDescuento && (
                    <div className="hint" style={{ color: 'var(--amber)' }}>
                      Cambiaste la moneda: revisá el descuento, ahora está expresado en {MONEDAS[form.moneda]}.
                    </div>
                  )}
                </div>
              </div>
              <div className="pres-totales">
                <span>Subtotal</span><span>{conMoneda(form.moneda, t.subtotal)}</span>
                {t.descuento > 0 && <><span>Descuento</span><span>- {conMoneda(form.moneda, t.descuento)}</span></>}
                <b>Total sin IVA</b><b>{conMoneda(form.moneda, t.total)}</b>
              </div>
              <button className="btn full" onClick={() => guardar(true)} disabled={guardando} style={{ marginTop: 12 }}>
                <Icon name="check" size={16} /> {guardando ? 'Guardando…' : 'Guardar y descargar PDF'}
              </button>
              <button className="btn ghost full" onClick={() => guardar(false)} disabled={guardando} style={{ marginTop: 8 }}>
                Guardar sin descargar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Opciones de una lista de Parámetros; incluye el valor actual aunque ya no
// esté en la lista (versiones nuevas de presupuestos viejos).
function opciones(lista, actual) {
  const vals = [...(lista || [])];
  if (actual && !vals.includes(actual)) vals.unshift(actual);
  return vals.map((v) => <option key={v}>{v}</option>);
}

// Buscador del catálogo con resultados desplegables (consulta a la base).
function BuscadorCatalogo({ onElegir }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState([]);
  const [abierto, setAbierto] = useState(false);
  const caja = useRef(null);

  useEffect(() => {
    if (q.trim().length < 2) { setRes([]); return; }
    let cancelado = false;
    const t = setTimeout(async () => {
      try {
        const { filas } = await buscarCatalogo(q);
        if (!cancelado) { setRes(filas); setAbierto(true); }
      } catch (e) { console.error(e); }
    }, 250);
    return () => { cancelado = true; clearTimeout(t); };
  }, [q]);

  useEffect(() => {
    const cerrar = (e) => { if (caja.current && !caja.current.contains(e.target)) setAbierto(false); };
    document.addEventListener('mousedown', cerrar);
    return () => document.removeEventListener('mousedown', cerrar);
  }, []);

  return (
    <div className="field" style={{ margin: 0, position: 'relative' }} ref={caja}>
      <label>Buscar en el catálogo</label>
      <input value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => res.length && setAbierto(true)}
        placeholder="Descripción, SKU o código DJI (mínimo 2 letras)" />
      {abierto && q.trim().length >= 2 && (
        <div className="pres-drop">
          {res.length === 0 ? <div className="pres-drop-item muted">Sin resultados</div> : res.map((p) => (
            <div key={p.id} className="pres-drop-item" onClick={() => { onElegir(p); setQ(''); setAbierto(false); }}>
              <div className="strong sm">{p.descripcion}</div>
              <div className="muted" style={{ fontSize: 11 }}>
                <span className="badge" style={{ padding: '1px 7px', fontSize: 10 }}>{p.marca || 'DJI'}</span>
                {' '}{[p.sku, p.codigo].filter(Boolean).join(' · ')} · <b>U$S {formatoNumero(p.precio)}</b> + IVA
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
