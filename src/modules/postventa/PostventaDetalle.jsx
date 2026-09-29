import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { obtener, listar, actualizar, crear, generarPostventa } from '../../lib/db';
import { PageHeader, BackButton, Empty, nombreCliente, fmtFecha, hoyISO, diasDesde, nroVenta, nroPostventa } from '../../shared/ui.jsx';
import Comentarios, { comentarSistema } from '../../shared/Comentarios.jsx';
import ModalCampos from '../../shared/ModalCampos.jsx';
import { useToast } from '../../shared/Toast.jsx';
import { useAuth } from '../../shared/Auth.jsx';
import Icon from '../../shared/Icon.jsx';

// Semáforo de urgencia de una tarea pendiente, según su fecha objetivo.
// (vencida = rojo · vence dentro de 7 días = amarillo · más lejos = verde)
function semaforoTarea(objetivo) {
  const d = diasDesde(objetivo); // >0 vencida · 0 hoy · <0 faltan (-d) días
  if (d > 0) return { cl: 'r', txt: `Vencida hace ${d} día${d === 1 ? '' : 's'}` };
  if (d === 0) return { cl: 'a', txt: 'Vence hoy' };
  if (d >= -7) return { cl: 'a', txt: `Faltan ${-d} día${-d === 1 ? '' : 's'}` };
  return { cl: 'g', txt: `Faltan ${-d} días` };
}

// /postventa/:id = id de la postventa. Puede venir de una venta o no
// (equipos comprados en otro lado): en ese caso se identifica solo por su
// número de postventa.
export default function PostventaDetalle() {
  const { id } = useParams();
  const entidadLog = 'pv';
  const refLog = id;
  const toast = useToast();
  const navigate = useNavigate();
  const { usuarioActualId } = useAuth();
  const [postventa, setPostventa] = useState(null);
  const [venta, setVenta] = useState(null);
  const [cliente, setCliente] = useState(null);
  const [tareas, setTareas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [nuevaTarea, setNuevaTarea] = useState(false);

  useEffect(() => { cargar(); }, [id]);

  async function cargar() {
    listar('usuarios').then(setUsuarios).catch(() => setUsuarios([]));
    const p = await obtener('postventas', id);
    if (!p) return;
    setVenta(p.venta_id ? await obtener('ventas', p.venta_id) : null);
    setCliente(await obtener('clientes', p.cliente_id));
    setTareas((await listar('tareas_postventa', { postventa_id: Number(id) })).sort((a, b) => a.id - b.id));
    setPostventa(p);
  }

  if (!postventa) return <Empty>Cargando…</Empty>;

  const conVenta = Boolean(postventa.venta_id);
  const faltaGenerar = conVenta && venta?.fecha_entrega && tareas.length === 0;
  const equipo = postventa.equipo || [...new Set(tareas.map((t) => t.equipo).filter(Boolean))].join(', ');

  async function generar() {
    try {
      const n = await generarPostventa(postventa.venta_id);
      if (n > 0) {
        await comentarSistema(entidadLog, refLog, `Se generó la postventa (${n} tareas de contacto).`, usuarioActualId);
        toast('Postventa generada');
      } else {
        toast('No había nada para generar', 'err');
      }
      cargar();
    } catch (e) {
      console.error(e);
      toast('No se pudo generar la postventa', 'err');
    }
  }

  async function agregarTarea(valores) {
    try {
      await crear('tareas_postventa', {
        postventa_id: postventa.id, venta_id: postventa.venta_id || null, cliente_id: postventa.cliente_id,
        equipo: postventa.equipo || null,
        hito: valores.hito, objetivo: valores.objetivo,
        estado: 'Pendiente', fecha_real: null, observaciones: '', hectareas: null,
        visita: false, visita_estado: '', visita_agenda: null, visita_real: null, responsable_id: null,
      });
      await comentarSistema(entidadLog, refLog, `Se agregó una tarea de contacto extra: "${valores.hito}".`, usuarioActualId);
      setNuevaTarea(false);
      toast('Tarea de contacto agregada');
      cargar();
    } catch (e) {
      console.error(e);
      toast('No se pudo agregar la tarea', 'err');
    }
  }

  async function marcarRealizada(t, datos) {
    await actualizar('tareas_postventa', t.id, {
      estado: 'Realizada', fecha_real: hoyISO(), observaciones: datos.obs, responsable_id: usuarioActualId,
      hectareas: datos.hectareas ? Number(datos.hectareas) : null,
      visita: datos.visita, visita_estado: datos.visita ? 'Solicitada' : '',
    });
    await comentarSistema(entidadLog, refLog, `Contacto de "${t.hito}" registrado${datos.hectareas ? ` · ${datos.hectareas} ha` : ''}.`, usuarioActualId);
    if (datos.visita) await comentarSistema(entidadLog, refLog, 'Se solicitó coordinar una visita técnica.', usuarioActualId);
    toast('Contacto registrado');
    cargar();
  }

  async function agendarVisita(t, fecha) {
    await actualizar('tareas_postventa', t.id, { visita_estado: 'Agendada', visita_agenda: fecha });
    await comentarSistema(entidadLog, refLog, `Visita técnica agendada para ${fmtFecha(fecha)}.`, usuarioActualId);
    toast('Visita agendada'); cargar();
  }
  async function registrarVisita(t, fecha) {
    await actualizar('tareas_postventa', t.id, { visita_estado: 'Realizada', visita_real: fecha });
    await comentarSistema(entidadLog, refLog, `Visita técnica realizada el ${fmtFecha(fecha)}.`, usuarioActualId);
    toast('Visita registrada'); cargar();
  }

  return (
    <div>
      <PageHeader titulo={`Postventa ${nroPostventa(postventa)} · ${nombreCliente(cliente)}`}
        sub={conVenta
          ? `Venta ${nroVenta(venta)}${venta?.fecha_entrega ? ` · entregada ${fmtFecha(venta.fecha_entrega)}` : ''}`
          : `Sin venta en el sistema${equipo ? ` · ${equipo}` : ''}`}>
        <BackButton to="/postventa" />
      </PageHeader>

      <div className="two" style={{ marginTop: 8 }}>
        <div>
          <div className="card">
            <div className="card-h">
              <span className="grow">Tareas de contacto ({tareas.length})</span>
              {tareas.length > 0 && <button className="btn ghost sm" onClick={() => setNuevaTarea(true)}>+ Tarea</button>}
            </div>
            <div className="card-pad">
              {faltaGenerar ? (
                <div className="aviso" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span className="grow">Esta venta está entregada pero todavía no tiene sus tareas de postventa.</span>
                  <button className="btn sm" onClick={generar}><Icon name="check" size={14} /> Generar postventa</button>
                </div>
              ) : tareas.length === 0 ? <Empty>Sin tareas.</Empty> :
                tareas.map((t) => <Tarea key={t.id} t={t} onMarcar={marcarRealizada} onAgendar={agendarVisita} onRegistrar={registrarVisita} />)}
            </div>
          </div>
          <Comentarios entidad={entidadLog} refId={refLog} />
        </div>
        <div>
          <div className="card">
            <div className="card-h">Resumen</div>
            <div className="card-pad">
              <InfoRow k="N° de postventa" v={<b>{nroPostventa(postventa)}</b>} />
              <InfoRow k="Cliente" v={nombreCliente(cliente)} />
              {conVenta ? (
                <>
                  <InfoRow k="Venta" v={venta
                    ? <a onClick={() => navigate(`/ventas/${venta.id}`)}>{nroVenta(venta)} →</a>
                    : `#${postventa.venta_id}`} />
                  <InfoRow k="Vendedor" v={usuarios.find((u) => u.id === venta?.vendedor_id)?.nombre || '— sin asignar —'} />
                  <InfoRow k="Entrega" v={venta?.fecha_entrega ? fmtFecha(venta.fecha_entrega) : '—'} />
                </>
              ) : (
                <>
                  <InfoRow k="Venta" v="Sin venta · equipo comprado fuera de la empresa" />
                  <InfoRow k="Equipo" v={equipo || '—'} />
                </>
              )}
              <InfoRow k="Realizadas" v={`${tareas.filter((t) => t.estado === 'Realizada').length} de ${tareas.length}`} />
            </div>
          </div>
        </div>
      </div>

      {nuevaTarea && (
        <ModalCampos
          titulo="Agregar tarea de contacto"
          subtitulo="Además de las 3 obligatorias, podés sumar los contactos extra que hagan falta."
          campos={[
            { name: 'hito', label: 'Descripción del contacto', type: 'text', required: true, placeholder: 'Ej: 3 meses · Contacto extra' },
            { name: 'objetivo', label: 'Fecha objetivo', type: 'date', required: true, default: hoyISO() },
          ]}
          textoConfirmar="Agregar tarea"
          onConfirm={agregarTarea}
          onCancel={() => setNuevaTarea(false)}
        />
      )}
    </div>
  );
}

function Tarea({ t, onMarcar, onAgendar, onRegistrar }) {
  const [abierto, setAbierto] = useState(false);
  const [obs, setObs] = useState('');
  const [hectareas, setHectareas] = useState('');
  const [visita, setVisita] = useState(false);
  const [fechaVisita, setFechaVisita] = useState(hoyISO());
  const sem = semaforoTarea(t.objetivo);

  if (t.estado === 'Realizada') {
    return (
      <div style={{ padding: '10px 0', borderBottom: '1px solid var(--line-2)' }}>
        <div className="strong sm">
          <span className="badge g">✓</span> {t.hito} · objetivo {fmtFecha(t.objetivo)}
          {t.visita_estado === 'Solicitada' && <span className="badge a" style={{ marginLeft: 6 }}>visita solicitada</span>}
          {t.visita_estado === 'Agendada' && <span className="badge b" style={{ marginLeft: 6 }}>visita {fmtFecha(t.visita_agenda)}</span>}
          {t.visita_estado === 'Realizada' && <span className="badge g" style={{ marginLeft: 6 }}>visita realizada</span>}
        </div>
        <div className="muted sm">Realizada el {fmtFecha(t.fecha_real)}{t.hectareas ? ` · ${t.hectareas} ha` : ''}</div>
        {t.observaciones && <div className="sm" style={{ marginTop: 3 }}>{t.observaciones}</div>}

        {t.visita_estado === 'Solicitada' && (
          <div style={{ marginTop: 8, padding: 10, background: 'var(--brand-bg)', borderRadius: 8 }}>
            <div className="sm" style={{ marginBottom: 6, fontWeight: 600 }}>Agendar la visita</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="date" value={fechaVisita} onChange={(e) => setFechaVisita(e.target.value)} />
              <button className="btn sm" onClick={() => onAgendar(t, fechaVisita)}>Agendar</button>
            </div>
          </div>
        )}
        {t.visita_estado === 'Agendada' && (
          <div style={{ marginTop: 8, padding: 10, background: 'var(--brand-bg)', borderRadius: 8 }}>
            <div className="sm" style={{ marginBottom: 6, fontWeight: 600 }}>Visita agendada para {fmtFecha(t.visita_agenda)}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="date" value={fechaVisita} onChange={(e) => setFechaVisita(e.target.value)} />
              <button className="btn sm" onClick={() => onRegistrar(t, fechaVisita)}>Registrar visita</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: '10px 0', borderBottom: '1px solid var(--line-2)' }}>
      <div className="strong sm" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span>{t.hito} · objetivo {fmtFecha(t.objetivo)}</span>
        {!abierto && <button className="btn ghost sm" onClick={() => setAbierto(true)}>Registrar</button>}
      </div>
      <div className="muted sm" style={{ marginTop: 2 }}>
        <span className={'dot ' + sem.cl} />{sem.txt}
      </div>
      {abierto && (
        <div style={{ marginTop: 8 }}>
          <div className="field"><label>Observaciones</label>
            <textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} /></div>
          <div className="field"><label>Hectáreas voladas</label>
            <input type="number" value={hectareas} onChange={(e) => setHectareas(e.target.value)} /></div>
          <label style={{ display: 'flex', gap: 8, marginBottom: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={visita} onChange={(e) => setVisita(e.target.checked)} /> Coordinar visita técnica
          </label>
          <button className="btn sm" onClick={() => onMarcar(t, { obs, hectareas, visita })}>
            <Icon name="check" size={14} /> Marcar realizada
          </button>
        </div>
      )}
    </div>
  );
}

function InfoRow({ k, v }) {
  return <div className="inforow"><span className="k">{k}</span><span className="v">{v}</span></div>;
}
