import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { obtener, listar, crear, actualizar, eliminar } from '../../lib/db';
import { PageHeader, BackButton, Empty, nombreCliente, fmtFecha, hoyISO, diasDesde } from '../../shared/ui.jsx';
import { usuariosConRol } from '../../shared/permisos';
import Comentarios, { comentarSistema } from '../../shared/Comentarios.jsx';
import ModalCampos from '../../shared/ModalCampos.jsx';
import { useToast } from '../../shared/Toast.jsx';
import { useAuth } from '../../shared/Auth.jsx';
import Icon from '../../shared/Icon.jsx';
import { ESTADOS_SERVICE } from './service.js';

export default function TrabajoDetalle() {
  const { id } = useParams();
  const toast = useToast();
  const { usuarioActualId } = useAuth();
  const [trabajo, setTrabajo] = useState(null);
  const [cliente, setCliente] = useState(null);
  const [tareas, setTareas] = useState([]);
  const [repuestos, setRepuestos] = useState([]);
  const [tecnicos, setTecnicos] = useState([]);
  const [asignarTec, setAsignarTec] = useState('');
  const [diagInput, setDiagInput] = useState('');
  const [esperaFecha, setEsperaFecha] = useState(hoyISO());
  const [entregaFecha, setEntregaFecha] = useState(hoyISO());
  const [finalizando, setFinalizando] = useState(false);
  const [confirmNro, setConfirmNro] = useState('');

  useEffect(() => { cargar(); }, [id]);

  async function cargar() {
    const t = await obtener('trabajos', id);
    setTrabajo(t);
    if (t) {
      setCliente(await obtener('clientes', t.cliente_id));
      setTareas(await listar('tareas', { trabajo_id: Number(id) }));
      setRepuestos(await listar('repuestos', { trabajo_id: Number(id) }));
      setTecnicos(usuariosConRol(await listar('usuarios'), 'Técnico'));
      setDiagInput(t.diagnostico || '');
    }
  }

  if (!trabajo) return <Empty>Cargando…</Empty>;

  const estado = trabajo.estado;
  const cerrado = estado === 'Finalizada' || estado === 'Entregada';
  const idxEstado = ESTADOS_SERVICE.indexOf(estado);
  const nombreTec = (tid) => tecnicos.find((t) => t.id === tid)?.nombre || '— sin asignar —';
  const puedeAgregarTarea = (estado === 'En diagnóstico' && Boolean(trabajo.diagnostico))
    || estado === 'En reparación' || estado === 'Esperando repuestos';
  const puedeAgregarRep = estado === 'En reparación' || estado === 'Esperando repuestos';
  const puedeInforme = ['En reparación', 'Esperando repuestos', 'Finalizada', 'Entregada'].includes(estado);

  async function log(txt) { await comentarSistema('trabajo', id, txt, usuarioActualId); }

  async function asignarTecnico() {
    if (!asignarTec) { toast('Elegí un técnico', 'err'); return; }
    await actualizar('trabajos', id, { tecnico_id: Number(asignarTec), estado: 'En diagnóstico' });
    await log(`Técnico asignado: ${nombreTec(Number(asignarTec))}. Pasa a diagnóstico.`);
    toast('Técnico asignado · en diagnóstico'); cargar();
  }
  async function guardarDiagnostico() {
    if (!diagInput.trim()) { toast('Cargá el diagnóstico', 'err'); return; }
    await actualizar('trabajos', id, { diagnostico: diagInput.trim() });
    await log('Diagnóstico cargado.');
    toast('Diagnóstico guardado'); cargar();
  }
  async function registrarAprobacion() {
    if (!trabajo.diagnostico || tareas.length === 0) {
      toast('Primero cargá el diagnóstico y al menos una tarea', 'err'); return;
    }
    await actualizar('trabajos', id, { aprobacion_cliente: true, estado: 'En reparación' });
    await log('Aprobación del cliente registrada. Pasa a reparación.');
    toast('Aprobado · en reparación'); cargar();
  }
  async function ponerEspera() {
    if (!esperaFecha) { toast('Indicá la fecha', 'err'); return; }
    await actualizar('trabajos', id, { espera_desde: esperaFecha, estado: 'Esperando repuestos' });
    await log(`Esperando repuestos desde ${fmtFecha(esperaFecha)}.`);
    toast('En espera de repuestos'); cargar();
  }
  async function llegaronRepuestos() {
    await actualizar('trabajos', id, { espera_desde: null, estado: 'En reparación' });
    await log('Llegaron los repuestos. Vuelve a reparación.');
    toast('De vuelta en reparación'); cargar();
  }
  async function confirmarFinalizar() {
    if (confirmNro.trim() !== trabajo.nro) {
      toast(`Escribí el número exacto (${trabajo.nro}) para confirmar`, 'err'); return;
    }
    descargarInforme();
    await actualizar('trabajos', id, { estado: 'Finalizada', egreso: hoyISO() });
    await log('Trabajo finalizado. Se generó el informe técnico.');
    setFinalizando(false); setConfirmNro('');
    toast('Finalizado · informe generado'); cargar();
  }
  async function entregar() {
    if (!entregaFecha) { toast('Indicá la fecha de entrega', 'err'); return; }
    await actualizar('trabajos', id, { estado: 'Entregada', fecha_entrega: entregaFecha });
    await log(`Equipo entregado el ${fmtFecha(entregaFecha)}.`);
    toast('Entregado'); cargar();
  }

  // Informe técnico: se GENERA y descarga (no se guarda en la base).
  function descargarInforme() {
    const esc = (s) => String(s == null ? '' : s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
    const filasT = tareas.map((t) => `<tr><td>${esc(t.descripcion)}</td><td>${esc(nombreTec(t.tecnico_id))}</td><td>${esc(t.horas || 0)} h</td><td>${esc(t.estado)}</td></tr>`).join('') || '<tr><td colspan="4">Sin tareas</td></tr>';
    const filasR = repuestos.map((r) => `<tr><td>${esc(r.articulo)}</td><td>${esc(r.cantidad)}</td><td>${esc(r.pieza_vieja)}</td><td>${esc(r.pieza_nueva)}</td><td>${r.garantia ? 'Sí' : 'No'}</td></tr>`).join('') || '<tr><td colspan="5">Sin repuestos</td></tr>';
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Informe ${esc(trabajo.nro)}</title>
      <style>body{font-family:Arial,sans-serif;color:#1c2430;padding:32px;max-width:800px;margin:auto}
      h1{font-size:20px;margin:0 0 2px}h2{font-size:14px;margin:22px 0 6px;border-bottom:1px solid #ddd;padding-bottom:4px}
      .sub{color:#6b7686;font-size:12px;margin-bottom:16px}table{width:100%;border-collapse:collapse;font-size:12px}
      th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}th{background:#f2f5f8}
      .row{display:flex;gap:24px;font-size:13px;margin:3px 0}.k{color:#6b7686;min-width:120px}
      .diag{white-space:pre-wrap;font-size:13px;background:#f7f9fb;border:1px solid #eee;border-radius:6px;padding:10px}</style></head>
      <body>
      <h1>Informe técnico · ${esc(trabajo.nro)}</h1>
      <div class="sub">DRAP · Dron Aplicaciones · generado ${fmtFecha(hoyISO())}</div>
      <h2>Datos</h2>
      <div class="row"><span class="k">Cliente</span><span>${esc(nombreCliente(cliente))}</span></div>
      <div class="row"><span class="k">Tipo</span><span>${esc(trabajo.tipo)}</span></div>
      <div class="row"><span class="k">Equipo</span><span>${esc(trabajo.marca)} ${esc(trabajo.modelo)} · serie ${esc(trabajo.nro_serie)}</span></div>
      <div class="row"><span class="k">Técnico</span><span>${esc(nombreTec(trabajo.tecnico_id))}</span></div>
      <div class="row"><span class="k">Ingreso</span><span>${fmtFecha(trabajo.ingreso)}</span></div>
      <div class="row"><span class="k">En garantía</span><span>${trabajo.garantia ? 'Sí' : 'No'}</span></div>
      <h2>Diagnóstico</h2><div class="diag">${esc(trabajo.diagnostico) || '—'}</div>
      <h2>Tareas realizadas</h2><table><thead><tr><th>Tarea</th><th>Técnico</th><th>Horas</th><th>Estado</th></tr></thead><tbody>${filasT}</tbody></table>
      <h2>Repuestos</h2><table><thead><tr><th>Artículo</th><th>Cant.</th><th>Pieza vieja</th><th>Pieza nueva</th><th>Gar.</th></tr></thead><tbody>${filasR}</tbody></table>
      <h2>Observaciones</h2><div class="diag">${esc(trabajo.observaciones) || '—'}</div>
      </body></html>`;
    const w = window.open('', '_blank');
    if (!w) { toast('Permití las ventanas emergentes para descargar el informe', 'err'); return; }
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => { w.print(); }, 400);
  }

  return (
    <div>
      <PageHeader titulo={`${trabajo.nro} · ${nombreCliente(cliente)}`}
        sub={`${trabajo.tipo} · ${trabajo.marca} ${trabajo.modelo} · serie ${trabajo.nro_serie}`}>
        <BackButton to="/service" />
      </PageHeader>

      <div className="stepbar">
        {ESTADOS_SERVICE.map((e, i) => (
          <div key={e} className={'step' + (i < idxEstado ? ' done' : i === idxEstado ? ' cur' : '')} style={{ minWidth: 70, fontSize: 11 }}>{e}</div>
        ))}
      </div>

      <div className="two" style={{ marginTop: 16 }}>
        <div>
          <div className="card" style={{ marginBottom: 16, borderColor: 'var(--brand)' }}>
            <div className="card-h">Qué sigue</div>
            <div className="card-pad">
              {estado === 'Ingresada' && (
                <>
                  <p className="muted sm" style={{ marginBottom: 10 }}>Asigná un técnico para pasar a diagnóstico.</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select value={asignarTec} onChange={(e) => setAsignarTec(e.target.value)} style={{ flex: 1 }}>
                      <option value="">— Elegí técnico —</option>
                      {tecnicos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                    </select>
                    <button className="btn sm" onClick={asignarTecnico}>Asignar</button>
                  </div>
                </>
              )}

              {estado === 'En diagnóstico' && (
                <>
                  <p className="muted sm" style={{ marginBottom: 10 }}>Cargá en orden para pasar a reparación:</p>
                  <Paso ok={!!trabajo.diagnostico} n={1} txt="Diagnóstico (abajo)" />
                  <Paso ok={tareas.length > 0} n={2} txt="Tareas a realizar (abajo)" />
                  <Paso ok={trabajo.aprobacion_cliente} n={3} txt="Aprobación del cliente" />
                  <button className="btn sm" style={{ marginTop: 10 }} onClick={registrarAprobacion}
                    disabled={!trabajo.diagnostico || tareas.length === 0}>
                    <Icon name="check" size={14} /> Registrar aprobación del cliente
                  </button>
                </>
              )}

              {estado === 'En reparación' && (
                <>
                  <div className="field" style={{ marginBottom: 4 }}>
                    <label>Esperando repuestos desde</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input type="date" value={esperaFecha} onChange={(e) => setEsperaFecha(e.target.value)} style={{ flex: 1 }} />
                      <button className="btn ghost sm" onClick={ponerEspera}>Marcar en espera</button>
                    </div>
                  </div>
                  <div className="hint" style={{ marginBottom: 10 }}>Al cargar la fecha, el ticket pasa a “Esperando repuestos”.</div>
                  <button className="btn full" onClick={() => setFinalizando(true)}><Icon name="check" size={16} /> Finalizar (genera informe)</button>
                </>
              )}

              {estado === 'Esperando repuestos' && (
                <>
                  <div className="aviso a" style={{ marginBottom: 10 }}>
                    Esperando repuestos desde <b>{fmtFecha(trabajo.espera_desde)}</b> · {diasDesde(trabajo.espera_desde)} día{diasDesde(trabajo.espera_desde) === 1 ? '' : 's'}.
                  </div>
                  <button className="btn full" onClick={llegaronRepuestos}><Icon name="check" size={16} /> Llegaron los repuestos</button>
                </>
              )}

              {estado === 'Finalizada' && (
                <div className="field" style={{ margin: 0 }}>
                  <label>Fecha de entrega al cliente</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="date" value={entregaFecha} onChange={(e) => setEntregaFecha(e.target.value)} style={{ flex: 1 }} />
                    <button className="btn sm" onClick={entregar}>Registrar entrega</button>
                  </div>
                </div>
              )}

              {estado === 'Entregada' && (
                <div className="aviso ok">Trabajo entregado el {fmtFecha(trabajo.fecha_entrega)}. Circuito completo.</div>
              )}
            </div>
          </div>

          {(estado === 'En diagnóstico' || trabajo.diagnostico) && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-h">Diagnóstico</div>
              <div className="card-pad">
                {estado === 'En diagnóstico' ? (
                  <>
                    <textarea rows={4} value={diagInput} onChange={(e) => setDiagInput(e.target.value)}
                      placeholder="Describí el diagnóstico del equipo…" style={{ width: '100%', marginBottom: 8 }} />
                    <button className="btn sm" onClick={guardarDiagnostico}><Icon name="check" size={14} /> Guardar diagnóstico</button>
                  </>
                ) : (
                  <div className="sm" style={{ whiteSpace: 'pre-wrap' }}>{trabajo.diagnostico}</div>
                )}
              </div>
            </div>
          )}

          <TareasCard trabajoId={id} tareas={tareas} tecnicos={tecnicos} cerrado={cerrado}
            puedeAgregar={puedeAgregarTarea} recargar={cargar} toast={toast} usuarioActualId={usuarioActualId} />
          <RepuestosCard trabajoId={id} repuestos={repuestos} cerrado={cerrado}
            puedeAgregar={puedeAgregarRep} recargar={cargar} toast={toast} usuarioActualId={usuarioActualId} />
          <Comentarios entidad="trabajo" refId={trabajo.id} />
        </div>

        <div>
          <div className="card">
            <div className="card-h">Datos del trabajo</div>
            <div className="card-pad">
              <InfoRow k="Tipo" v={trabajo.tipo} />
              <InfoRow k="Técnico" v={nombreTec(trabajo.tecnico_id)} />
              <InfoRow k="Ingreso" v={fmtFecha(trabajo.ingreso)} />
              <InfoRow k="Egreso" v={trabajo.egreso ? fmtFecha(trabajo.egreso) : '—'} />
              <InfoRow k="Entrega" v={trabajo.fecha_entrega ? fmtFecha(trabajo.fecha_entrega) : '—'} />
              <InfoRow k="En garantía" v={trabajo.garantia ? 'Sí' : 'No'} />
              <InfoRow k="Aprobación cliente" v={trabajo.aprobacion_cliente ? 'Sí' : 'No'} />
              <InfoRow k="Observaciones" v={trabajo.observaciones || '—'} />
            </div>
          </div>

          {puedeInforme && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-h">Informe técnico</div>
              <div className="card-pad">
                <div className="muted sm" style={{ marginBottom: 10 }}>Se genera en PDF y se descarga; no se guarda en la base.</div>
                <button className="btn ghost full" onClick={descargarInforme}><Icon name="check" size={16} /> Descargar informe</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {finalizando && (
        <div className="modal-bg" onClick={(e) => e.target.className === 'modal-bg' && setFinalizando(false)}>
          <div className="modal">
            <div className="modal-h"><span>Finalizar trabajo</span><button className="modal-x" onClick={() => setFinalizando(false)}>✕</button></div>
            <div className="modal-b">
              <div className="aviso bad" style={{ marginBottom: 12 }}>
                Al finalizar se genera el informe y el trabajo pasa a <b>Finalizada</b>. Esta acción no tiene vuelta atrás.
              </div>
              <div className="field">
                <label>Para confirmar, escribí el número del ticket <span className="req">*</span></label>
                <input value={confirmNro} onChange={(e) => setConfirmNro(e.target.value)} placeholder={trabajo.nro} />
                <div className="hint">Escribí <b>{trabajo.nro}</b> tal cual figura.</div>
              </div>
              <div className="modal-foot">
                <button className="btn ghost" onClick={() => setFinalizando(false)}>Cancelar</button>
                <button className="btn" onClick={confirmarFinalizar}>Finalizar y generar informe</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Paso({ ok, n, txt }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}>
      <span className={'badge ' + (ok ? 'g' : 'a')}>{ok ? '✓' : n}</span>
      <span className="sm" style={{ color: ok ? 'var(--ink)' : 'var(--ink-3)' }}>{txt}</span>
    </div>
  );
}

function TareasCard({ trabajoId, tareas, tecnicos, cerrado, puedeAgregar, recargar, toast, usuarioActualId }) {
  const [modal, setModal] = useState(null);
  const nombreTec = (id) => tecnicos.find((t) => t.id === id)?.nombre || '— sin asignar —';

  const campos = [
    { name: 'descripcion', label: 'Descripción de la tarea', type: 'text', required: true, full: true, placeholder: 'Ej: Cambio de motor M3' },
    { name: 'tecnico_id', label: 'Técnico', type: 'select', options: tecnicos.map((t) => ({ value: t.id, label: t.nombre })) },
    { name: 'horas', label: 'Horas', type: 'number' },
    { name: 'estado', label: 'Estado', type: 'select', options: ['Pendiente', 'Hecha'], default: 'Pendiente' },
  ];

  async function guardar(valores) {
    const datos = {
      descripcion: valores.descripcion,
      tecnico_id: valores.tecnico_id ? Number(valores.tecnico_id) : null,
      horas: valores.horas ? Number(valores.horas) : 0,
      estado: valores.estado || 'Pendiente',
    };
    try {
      if (modal && modal.id) await actualizar('tareas', modal.id, datos);
      else await crear('tareas', { trabajo_id: Number(trabajoId), ...datos });
      await comentarSistema('trabajo', trabajoId, `Tarea ${modal && modal.id ? 'actualizada' : 'agregada'}: "${valores.descripcion}".`, usuarioActualId);
      setModal(null); toast('Tarea guardada'); recargar();
    } catch (e) { console.error(e); toast('No se pudo guardar la tarea', 'err'); }
  }
  async function borrar(t) { await eliminar('tareas', t.id); toast('Tarea eliminada'); recargar(); }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-h">
        <span className="grow">Tareas ({tareas.length})</span>
        {puedeAgregar && <button className="btn ghost sm" onClick={() => setModal({})}>+ Tarea</button>}
      </div>
      <div className="table-wrap">
        {tareas.length === 0 ? <Empty>Sin tareas.</Empty> : (
          <table>
            <thead><tr><th>Tarea</th><th>Técnico</th><th>Horas</th><th>Estado</th>{!cerrado && <th></th>}</tr></thead>
            <tbody>
              {tareas.map((t) => (
                <tr key={t.id}>
                  <td className="strong">{t.descripcion}</td>
                  <td>{nombreTec(t.tecnico_id)}</td>
                  <td>{t.horas ? t.horas + ' h' : '—'}</td>
                  <td><span className={'badge ' + (t.estado === 'Hecha' ? 'g' : 'a')}>{t.estado}</span></td>
                  {!cerrado && <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                    <button className="ibtn" onClick={() => setModal(t)}><Icon name="edit" size={14} /></button>
                    <button className="ibtn del" onClick={() => borrar(t)}><Icon name="del" size={14} /></button>
                  </td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {modal && (
        <ModalCampos titulo={modal.id ? 'Editar tarea' : 'Agregar tarea'} campos={campos} valoresIniciales={modal}
          textoConfirmar={modal.id ? 'Guardar cambios' : 'Agregar tarea'} onConfirm={guardar} onCancel={() => setModal(null)} />
      )}
    </div>
  );
}

function RepuestosCard({ trabajoId, repuestos, cerrado, puedeAgregar, recargar, toast, usuarioActualId }) {
  const [modal, setModal] = useState(null);
  const campos = [
    { name: 'articulo', label: 'Artículo', type: 'text', required: true, full: true, placeholder: 'Ej: Motor M3' },
    { name: 'cantidad', label: 'Cantidad', type: 'number', default: '1' },
    { name: 'pieza_vieja', label: 'N° pieza vieja', type: 'text' },
    { name: 'pieza_nueva', label: 'N° pieza nueva', type: 'text' },
    { name: 'garantia', label: 'En garantía', type: 'select', options: ['No', 'Sí'], default: 'No' },
    { name: 'registrado', label: 'Registrado', type: 'select', options: ['No', 'Sí'], default: 'No' },
  ];
  async function guardar(valores) {
    const datos = {
      articulo: valores.articulo, cantidad: valores.cantidad ? Number(valores.cantidad) : 1,
      pieza_vieja: valores.pieza_vieja || '', pieza_nueva: valores.pieza_nueva || '',
      garantia: valores.garantia === 'Sí', registrado: valores.registrado === 'Sí',
    };
    try {
      if (modal && modal.id) await actualizar('repuestos', modal.id, datos);
      else await crear('repuestos', { trabajo_id: Number(trabajoId), ...datos });
      await comentarSistema('trabajo', trabajoId, `Repuesto ${modal && modal.id ? 'actualizado' : 'agregado'}: "${valores.articulo}".`, usuarioActualId);
      setModal(null); toast('Repuesto guardado'); recargar();
    } catch (e) { console.error(e); toast('No se pudo guardar el repuesto', 'err'); }
  }
  async function borrar(r) { await eliminar('repuestos', r.id); toast('Repuesto eliminado'); recargar(); }
  const abrirEdicion = (r) => setModal({ ...r, garantia: r.garantia ? 'Sí' : 'No', registrado: r.registrado ? 'Sí' : 'No' });

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-h">
        <span className="grow">Repuestos ({repuestos.length})</span>
        {puedeAgregar && <button className="btn ghost sm" onClick={() => setModal({})}>+ Repuesto</button>}
      </div>
      <div className="table-wrap">
        {repuestos.length === 0 ? <Empty>Sin repuestos.</Empty> : (
          <table>
            <thead><tr><th>Artículo</th><th>Cant.</th><th>Vieja</th><th>Nueva</th><th>Gar.</th>{!cerrado && <th></th>}</tr></thead>
            <tbody>
              {repuestos.map((r) => (
                <tr key={r.id}>
                  <td className="strong">{r.articulo}</td>
                  <td>{r.cantidad}</td>
                  <td>{r.pieza_vieja || '—'}</td>
                  <td>{r.pieza_nueva || '—'}</td>
                  <td>{r.garantia ? <span className="badge g">Sí</span> : <span className="badge">No</span>}</td>
                  {!cerrado && <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                    <button className="ibtn" onClick={() => abrirEdicion(r)}><Icon name="edit" size={14} /></button>
                    <button className="ibtn del" onClick={() => borrar(r)}><Icon name="del" size={14} /></button>
                  </td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {modal && (
        <ModalCampos titulo={modal.id ? 'Editar repuesto' : 'Agregar repuesto'} campos={campos} valoresIniciales={modal}
          textoConfirmar={modal.id ? 'Guardar cambios' : 'Agregar repuesto'} onConfirm={guardar} onCancel={() => setModal(null)} />
      )}
    </div>
  );
}

function InfoRow({ k, v }) {
  return <div className="inforow"><span className="k">{k}</span><span className="v">{v}</span></div>;
}
