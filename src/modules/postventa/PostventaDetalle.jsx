import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { obtener, listar, actualizar } from '../../lib/db';
import { PageHeader, BackButton, Empty, nombreCliente, fmtFecha, hoyISO } from '../../shared/ui.jsx';
import Comentarios, { comentarSistema } from '../../shared/Comentarios.jsx';
import { useToast } from '../../shared/Toast.jsx';
import Icon from '../../shared/Icon.jsx';

export default function PostventaDetalle() {
  const { id } = useParams(); // id de la venta
  const toast = useToast();
  const [venta, setVenta] = useState(null);
  const [cliente, setCliente] = useState(null);
  const [tareas, setTareas] = useState([]);

  useEffect(() => { cargar(); }, [id]);

  async function cargar() {
    const v = await obtener('ventas', id);
    setVenta(v);
    if (v) {
      setCliente(await obtener('clientes', v.cliente_id));
      setTareas((await listar('tareas_postventa', { venta_id: Number(id) })).sort((a, b) => a.id - b.id));
    }
  }

  if (!venta) return <Empty>Cargando…</Empty>;

  async function marcarRealizada(t, datos) {
    await actualizar('tareas_postventa', t.id, {
      estado: 'Realizada', fecha_real: hoyISO(), observaciones: datos.obs,
      hectareas: datos.hectareas ? Number(datos.hectareas) : null,
      visita: datos.visita, visita_estado: datos.visita ? 'Solicitada' : '',
    });
    if (datos.visita) await comentarSistema('post', id, 'Se solicitó coordinar una visita técnica.');
    toast('Contacto registrado');
    cargar();
  }

  async function agendarVisita(t, fecha) {
    await actualizar('tareas_postventa', t.id, { visita_estado: 'Agendada', visita_agenda: fecha });
    await comentarSistema('post', id, `Visita técnica agendada para ${fmtFecha(fecha)}.`);
    toast('Visita agendada'); cargar();
  }
  async function registrarVisita(t, fecha) {
    await actualizar('tareas_postventa', t.id, { visita_estado: 'Realizada', visita_real: fecha });
    await comentarSistema('post', id, `Visita técnica realizada el ${fmtFecha(fecha)}.`);
    toast('Visita registrada'); cargar();
  }

  return (
    <div>
      <PageHeader titulo={`Postventa · ${nombreCliente(cliente)}`}
        sub={`Venta VT-${String(venta.id).padStart(4, '0')} · entregada ${fmtFecha(venta.fecha_entrega)}`}>
        <BackButton to="/postventa" />
      </PageHeader>

      <div className="two" style={{ marginTop: 8 }}>
        <div>
          <div className="card">
            <div className="card-h">Tareas de contacto ({tareas.length})</div>
            <div className="card-pad">
              {tareas.length === 0 ? <Empty>Sin tareas.</Empty> :
                tareas.map((t) => <Tarea key={t.id} t={t} onMarcar={marcarRealizada} onAgendar={agendarVisita} onRegistrar={registrarVisita} />)}
            </div>
          </div>
          <Comentarios entidad="post" refId={venta.id} />
        </div>
        <div>
          <div className="card">
            <div className="card-h">Resumen</div>
            <div className="card-pad">
              <InfoRow k="Cliente" v={nombreCliente(cliente)} />
              <InfoRow k="Entrega" v={fmtFecha(venta.fecha_entrega)} />
              <InfoRow k="Realizadas" v={`${tareas.filter((t) => t.estado === 'Realizada').length} de ${tareas.length}`} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Tarea({ t, onMarcar, onAgendar, onRegistrar }) {
  const [abierto, setAbierto] = useState(false);
  const [obs, setObs] = useState('');
  const [hectareas, setHectareas] = useState('');
  const [visita, setVisita] = useState(false);
  const [fechaVisita, setFechaVisita] = useState(hoyISO());

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
      <div className="strong sm" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>{t.hito} · objetivo {fmtFecha(t.objetivo)}</span>
        {!abierto && <button className="btn ghost sm" onClick={() => setAbierto(true)}>Registrar</button>}
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
