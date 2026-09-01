import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { obtener, listar, actualizar } from '../../lib/db';
import { PageHeader, BackButton, Empty, nombreCliente, fmtFecha, diasDesde } from '../../shared/ui.jsx';
import Comentarios, { comentarSistema } from '../../shared/Comentarios.jsx';
import ModalCampos from '../../shared/ModalCampos.jsx';
import { useToast } from '../../shared/Toast.jsx';
import { useAuth } from '../../shared/Auth.jsx';
import { esAdministrador, usuariosConRolPrefijo } from '../../shared/permisos';
import Icon from '../../shared/Icon.jsx';
import { ETAPAS, REQUISITOS, camposFaltantes, completarEtapa, avanzarEtapa, reabrirOportunidad } from './etapas.js';

export default function OportunidadDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [op, setOp] = useState(null);
  const [cliente, setCliente] = useState(null);
  const [cotizaciones, setCotizaciones] = useState([]);
  const [seguimientos, setSeguimientos] = useState([]);
  const [intentos, setIntentos] = useState([]); // cierres de intentos anteriores
  const [venta, setVenta] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [accion, setAccion] = useState(null); // 'coti' | 'seg' | 'cierre' | null
  const [reasignando, setReasignando] = useState(false);
  const [nuevoVendedorId, setNuevoVendedorId] = useState('');
  const { perfil } = useAuth();

  useEffect(() => { cargar(); }, [id]);
  useEffect(() => { listar('usuarios').then(setUsuarios).catch(() => setUsuarios([])); }, []);

  async function cargar() {
    const o = await obtener('oportunidades', id);
    setOp(o);
    if (o) {
      setCliente(await obtener('clientes', o.cliente_id));
      setCotizaciones((await listar('cotizaciones', { oportunidad_id: Number(id) }))
        .sort((a, b) => (a.intento || 1) - (b.intento || 1) || b.version - a.version));
      setSeguimientos((await listar('seguimientos', { oportunidad_id: Number(id) }))
        .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')));
      try {
        setIntentos((await listar('intentos_comercial', { oportunidad_id: Number(id) }))
          .sort((a, b) => a.intento - b.intento));
      } catch { setIntentos([]); } // por si aún no se corrió el SQL / modo demo
      const vs = await listar('ventas', { oportunidad_id: Number(id) });
      setVenta(vs[0] || null);
    }
  }

  if (!op) return <Empty>Cargando…</Empty>;

  const cerrada = Boolean(op.resultado);
  const idxEtapa = ETAPAS.indexOf(op.etapa);
  const ctx = { cotizaciones, seguimientos };

  // --- Separar el ciclo vigente del historial ---
  const intentoActual = op.intento || 1;
  const esActual = (r) => (r.intento || 1) === intentoActual;
  const cotisActuales = cotizaciones.filter(esActual);
  const segsActuales = seguimientos.filter(esActual);

  // Armar el historial: para cada intento anterior, su cierre + registros.
  const historial = [];
  for (let n = intentoActual - 1; n >= 1; n--) {
    historial.push({
      n,
      cierre: intentos.find((i) => i.intento === n) || null,
      cotis: cotizaciones.filter((c) => (c.intento || 1) === n),
      segs: seguimientos.filter((s) => (s.intento || 1) === n),
    });
  }

  const ACCIONES = {
    coti: {
      titulo: 'Agregar cotización',
      subtitulo: 'Registrá la cotización enviada al cliente.',
      campos: REQUISITOS['Cotización'].campos,
      textoConfirmar: 'Guardar cotización',
      run: (valores) => completarEtapa(op, 'Cotización', valores, ctx),
    },
    seg: {
      titulo: 'Registrar seguimiento',
      subtitulo: 'Dejá constancia del contacto con el cliente.',
      campos: REQUISITOS['Seguimiento'].campos,
      textoConfirmar: 'Guardar seguimiento',
      run: (valores) => completarEtapa(op, 'Seguimiento', valores, ctx),
    },
    cierre: {
      titulo: 'Cerrar oportunidad',
      subtitulo: 'Cargá el resultado. Si falta algún paso previo, se pide acá también.',
      campos: camposFaltantes(op, 'Cierre', ctx),
      textoConfirmar: 'Cerrar oportunidad',
      run: (valores) => avanzarEtapa(op, 'Cierre', valores, ctx),
    },
  };
  const accionActual = accion ? ACCIONES[accion] : null;

  async function onConfirmAccion(valores) {
    const cfg = ACCIONES[accion];
    setAccion(null);
    try {
      const res = await cfg.run(valores);
      if (res && res.ventaId) {
        toast('Oportunidad ganada · venta creada');
        navigate(`/ventas/${res.ventaId}`);
        return;
      }
      toast(accion === 'cierre' ? 'Oportunidad cerrada' : 'Guardado');
      await cargar();
    } catch (e) {
      console.error(e);
      toast('No se pudo guardar', 'err');
    }
  }

  async function recontactar() {
    try {
      await reabrirOportunidad(op);
      toast('Oportunidad reabierta en Contacto inicial');
      await cargar();
    } catch (e) {
      console.error(e);
      toast('No se pudo reabrir la oportunidad', 'err');
    }
  }

  const motivoPerdida = op.motivo === 'Otro' ? (op.motivo_detalle || 'Otro') : op.motivo;

  const esAdmin = esAdministrador(perfil);
  const vendedores = usuariosConRolPrefijo(usuarios, 'Vendedor');
  const vendedorActual = usuarios.find((u) => u.id === op.vendedor_id)?.nombre || '— sin asignar —';

  async function reasignar() {
    try {
      const nuevoId = nuevoVendedorId ? Number(nuevoVendedorId) : null;
      await actualizar('oportunidades', op.id, { vendedor_id: nuevoId });
      const nom = usuarios.find((u) => u.id === nuevoId)?.nombre || 'sin asignar';
      await comentarSistema('op', op.id, `Oportunidad reasignada a ${nom}.`);
      setReasignando(false);
      toast('Oportunidad reasignada');
      await cargar();
    } catch (e) {
      console.error(e);
      toast('No se pudo reasignar', 'err');
    }
  }

  return (
    <div>
      <PageHeader titulo={`Oportunidad #${op.id} · ${nombreCliente(cliente)}`}
        sub={`Etapa: ${op.etapa}${intentoActual > 1 ? ` · intento ${intentoActual}` : ''} · primer contacto ${fmtFecha(op.fecha_contacto)}`}>
        <BackButton to="/comercial" />
        {!cerrada && <>
          <button className="btn ghost" onClick={() => setAccion('coti')}>+ Cotización</button>
          <button className="btn ghost" onClick={() => setAccion('seg')}>+ Seguimiento</button>
          <button className="btn" onClick={() => setAccion('cierre')}><Icon name="check" size={15} /> Cerrar</button>
        </>}
        {op.resultado === 'Ganada' && venta &&
          <button className="btn ghost" onClick={() => navigate(`/ventas/${venta.id}`)}>Ver venta</button>}
        {esAdmin && !cerrada && (
          <button className="btn ghost" onClick={() => { setNuevoVendedorId(op.vendedor_id || ''); setReasignando(true); }}>
            Reasignar vendedor
          </button>
        )}
      </PageHeader>

      <div className="stepbar">
        {ETAPAS.map((e, i) => (
          <div key={e} className={'step' + (i < idxEtapa ? ' done' : i === idxEtapa ? ' cur' : '')}>{e}</div>
        ))}
      </div>

      {cerrada && (
        <div className={'aviso ' + (op.resultado === 'Ganada' ? 'ok' : 'bad')}
          style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span className="grow">
            Oportunidad cerrada como <b>{op.resultado}</b>
            {op.resultado === 'Perdida' && motivoPerdida && ` · motivo: ${motivoPerdida}`}
          </span>
          {op.resultado === 'Perdida' && (
            <button className="btn ghost sm" onClick={recontactar}>Recontactar</button>
          )}
        </div>
      )}

      {intentoActual > 1 && !cerrada && (
        <div className="aviso">
          Este es el <b>intento {intentoActual}</b> de contacto. Abajo podés ver el historial de los intentos anteriores.
        </div>
      )}

      <div className="two" style={{ marginTop: 16 }}>
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-h">
              <span className="grow">Cotizaciones ({cotisActuales.length})</span>
              {!cerrada && <button className="btn ghost sm" onClick={() => setAccion('coti')}>+ Agregar</button>}
            </div>
            <div className="table-wrap">
              {cotisActuales.length === 0 ? <Empty>Sin cotizaciones en este intento.</Empty> : (
                <table>
                  <thead><tr><th>Versión</th><th>Referencia</th><th>Envío</th><th>Días</th></tr></thead>
                  <tbody>
                    {cotisActuales.map((c) => (
                      <tr key={c.id}>
                        <td className="strong">v{c.version}</td>
                        <td><span className="badge b">{c.pdf}</span></td>
                        <td>{fmtFecha(c.fecha_envio)}</td>
                        <td>{diasDesde(c.fecha_envio)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <span className="grow">Seguimientos ({segsActuales.length})</span>
              {!cerrada && <button className="btn ghost sm" onClick={() => setAccion('seg')}>+ Registrar</button>}
            </div>
            <div className="card-pad">
              {segsActuales.length === 0 ? <div className="muted sm">Sin seguimientos en este intento.</div> :
                segsActuales.map((s) => (
                  <div key={s.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--line-2)' }}>
                    <div className="strong sm">{fmtFecha(s.fecha)} · {s.tipo}</div>
                    <div className="muted sm">{s.observaciones}</div>
                    {s.proximo_contacto && (
                      <div className="muted sm" style={{ marginTop: 2 }}>Próximo contacto: {fmtFecha(s.proximo_contacto)}</div>
                    )}
                  </div>
                ))}
            </div>
          </div>

          {historial.length > 0 && <HistorialIntentos historial={historial} />}

          <Comentarios entidad="op" refId={op.id} />
        </div>

        <div>
          <div className="card">
            <div className="card-h">Resumen</div>
            <div className="card-pad">
              <InfoRow k="Cliente" v={nombreCliente(cliente)} />
              <InfoRow k="Etapa" v={op.etapa} />
              <InfoRow k="Vendedor" v={vendedorActual} />
              {intentoActual > 1 && <InfoRow k="Intento actual" v={`#${intentoActual}`} />}
              <InfoRow k="Primer contacto" v={fmtFecha(op.fecha_contacto)} />
              <InfoRow k="Relevamiento" v={op.relevamiento} />
              {venta && <InfoRow k="Venta" v={<a onClick={() => navigate(`/ventas/${venta.id}`)}>VT-{String(venta.id).padStart(4, '0')} →</a>} />}
            </div>
          </div>
        </div>
      </div>

      {accionActual && (
        <ModalCampos
          titulo={accionActual.titulo}
          subtitulo={accionActual.subtitulo}
          campos={accionActual.campos}
          textoConfirmar={accionActual.textoConfirmar}
          onConfirm={onConfirmAccion}
          onCancel={() => setAccion(null)}
        />
      )}

      {reasignando && (
        <div className="modal-bg" onClick={(e) => e.target.className === 'modal-bg' && setReasignando(false)}>
          <div className="modal">
            <div className="modal-h">
              <span>Reasignar vendedor</span>
              <button className="modal-x" onClick={() => setReasignando(false)}>✕</button>
            </div>
            <div className="modal-b">
              <p className="muted sm" style={{ marginBottom: 14 }}>
                Elegí el vendedor que se hará cargo de esta oportunidad. El cambio queda registrado en el historial.
              </p>
              <div className="field">
                <label>Vendedor</label>
                <select value={nuevoVendedorId} onChange={(e) => setNuevoVendedorId(e.target.value)}>
                  <option value="">— Sin asignar —</option>
                  {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
                </select>
              </div>
              <div className="modal-foot">
                <button className="btn ghost" onClick={() => setReasignando(false)}>Cancelar</button>
                <button className="btn" onClick={reasignar}>Reasignar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Historial de intentos anteriores, en tono apagado para diferenciarlo
// visualmente del proceso vigente. Deja ver qué se cotizó, qué se habló
// y cómo cerró cada intento previo.
function HistorialIntentos({ historial }) {
  return (
    <div className="card" style={{ marginTop: 16, background: 'var(--panel-2)', borderStyle: 'dashed' }}>
      <div className="card-h">
        <span className="grow">Intentos anteriores ({historial.length})</span>
        <span className="badge">Historial</span>
      </div>
      <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {historial.map((h) => {
          const motivo = h.cierre
            ? (h.cierre.motivo === 'Otro' ? (h.cierre.motivo_detalle || 'Otro') : h.cierre.motivo)
            : null;
          return (
            <div key={h.n} style={{
              border: '1px solid var(--line-2)', borderRadius: 10,
              padding: '10px 12px', background: 'var(--panel)', opacity: .92,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                <span className="strong sm">Intento {h.n}</span>
                {h.cierre && (
                  <span className={'badge ' + (h.cierre.resultado === 'Ganada' ? 'ok' : 'bad')}>
                    {h.cierre.resultado || 'Cerrado'}
                  </span>
                )}
                {motivo && <span className="muted sm">motivo: {motivo}</span>}
                {h.cierre?.cerrado_en && (
                  <span className="muted sm" style={{ marginLeft: 'auto' }}>{fmtFecha(h.cierre.cerrado_en)}</span>
                )}
              </div>

              {h.cotis.length > 0 && (
                <div className="muted sm" style={{ marginBottom: 4 }}>
                  Cotizaciones: {h.cotis.map((c) => `v${c.version} (${c.pdf})`).join(' · ')}
                </div>
              )}
              {h.segs.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {h.segs.map((s) => (
                    <div key={s.id} className="muted sm">
                      {fmtFecha(s.fecha)} · {s.tipo}: {s.observaciones}
                    </div>
                  ))}
                </div>
              ) : (
                h.cotis.length === 0 && <div className="muted sm">Sin registros en este intento.</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InfoRow({ k, v }) {
  return <div className="inforow"><span className="k">{k}</span><span className="v">{v}</span></div>;
}
