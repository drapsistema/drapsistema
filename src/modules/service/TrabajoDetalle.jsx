import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { obtener, listar, crear, actualizar, eliminar } from '../../lib/db';
import { PageHeader, BackButton, Empty, nombreCliente, fmtFecha, hoyISO } from '../../shared/ui.jsx';
import { usuariosConRol } from '../../shared/permisos';
import Comentarios, { comentarSistema } from '../../shared/Comentarios.jsx';
import { useToast } from '../../shared/Toast.jsx';
import Icon from '../../shared/Icon.jsx';

const ESTADOS = ['Ingresada', 'En diagnóstico', 'En reparación', 'Esperando repuestos', 'Finalizada', 'Entregada'];

export default function TrabajoDetalle() {
  const { id } = useParams();
  const toast = useToast();
  const [trabajo, setTrabajo] = useState(null);
  const [cliente, setCliente] = useState(null);
  const [tareas, setTareas] = useState([]);
  const [repuestos, setRepuestos] = useState([]);
  const [tecnicos, setTecnicos] = useState([]);

  useEffect(() => { cargar(); }, [id]);

  async function cargar() {
    const t = await obtener('trabajos', id);
    setTrabajo(t);
    if (t) {
      setCliente(await obtener('clientes', t.cliente_id));
      setTareas(await listar('tareas', { trabajo_id: Number(id) }));
      setRepuestos(await listar('repuestos', { trabajo_id: Number(id) }));
      setTecnicos(usuariosConRol(await listar('usuarios'), 'Técnico'));
    }
  }

  if (!trabajo) return <Empty>Cargando…</Empty>;

  const cerrado = trabajo.estado === 'Finalizada' || trabajo.estado === 'Entregada';
  const idxEstado = ESTADOS.indexOf(trabajo.estado);

  async function cambiarEstado(nuevo) {
    // Regla: no finalizar sin informe técnico.
    if (nuevo === 'Finalizada' && !trabajo.informe) {
      toast('No se puede finalizar sin el informe técnico', 'err'); return;
    }
    const cambios = { estado: nuevo };
    if (nuevo === 'Finalizada') cambios.egreso = hoyISO();
    await actualizar('trabajos', id, cambios);
    await comentarSistema('trabajo', id, `Estado cambiado a ${nuevo}.`);
    toast('Estado actualizado');
    cargar();
  }

  async function adjuntarInforme() {
    await actualizar('trabajos', id, { informe: `informe_${trabajo.nro.toLowerCase().replace('-', '')}.pdf` });
    toast('Informe técnico adjunto'); cargar();
  }

  return (
    <div>
      <PageHeader titulo={`${trabajo.nro} · ${nombreCliente(cliente)}`}
        sub={`${trabajo.tipo} · ${trabajo.marca} ${trabajo.modelo} · serie ${trabajo.nro_serie}`}>
        <BackButton to="/service" />
      </PageHeader>

      <div className="stepbar">
        {ESTADOS.map((e, i) => (
          <div key={e} className={'step' + (i < idxEstado ? ' done' : i === idxEstado ? ' cur' : '')} style={{ minWidth: 70, fontSize: 11 }}>{e}</div>
        ))}
      </div>

      {!cerrado && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          {ESTADOS.filter((e) => e !== trabajo.estado).map((e) => (
            <button key={e} className="btn ghost sm" onClick={() => cambiarEstado(e)}>→ {e}</button>
          ))}
        </div>
      )}

      <div className="two" style={{ marginTop: 16 }}>
        <div>
          <TareasCard trabajoId={id} tareas={tareas} tecnicos={tecnicos} cerrado={cerrado} recargar={cargar} toast={toast} />
          <RepuestosCard trabajoId={id} repuestos={repuestos} cerrado={cerrado} recargar={cargar} toast={toast} />
          <Comentarios entidad="trabajo" refId={trabajo.id} />
        </div>

        <div>
          <div className="card">
            <div className="card-h">Informe técnico</div>
            <div className="card-pad">
              {trabajo.informe ? (
                <div><span className="badge g">Adjunto</span> <span className="sm">{trabajo.informe}</span></div>
              ) : (
                <>
                  <div className="muted sm" style={{ marginBottom: 10 }}>Sin informe. Es obligatorio para finalizar.</div>
                  {!cerrado && <button className="btn full" onClick={adjuntarInforme}><Icon name="check" size={16} /> Adjuntar informe</button>}
                </>
              )}
            </div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-h">Datos del trabajo</div>
            <div className="card-pad">
              <InfoRow k="Tipo" v={trabajo.tipo} />
              <InfoRow k="Ingreso" v={fmtFecha(trabajo.ingreso)} />
              <InfoRow k="Egreso" v={trabajo.egreso ? fmtFecha(trabajo.egreso) : '—'} />
              <InfoRow k="En garantía" v={trabajo.garantia ? 'Sí' : 'No'} />
              <InfoRow k="Observaciones" v={trabajo.observaciones || '—'} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TareasCard({ trabajoId, tareas, tecnicos, cerrado, recargar, toast }) {
  const [editando, setEditando] = useState(null);
  const nombreTec = (id) => tecnicos.find((t) => t.id === id)?.nombre || '—';

  async function agregar() {
    await crear('tareas', { trabajo_id: Number(trabajoId), descripcion: 'Nueva tarea', tecnico_id: tecnicos[0]?.id || null, horas: 0, estado: 'Pendiente' });
    toast('Tarea agregada'); recargar();
  }
  async function guardar(t, cambios) { await actualizar('tareas', t.id, cambios); setEditando(null); toast('Tarea actualizada'); recargar(); }
  async function borrar(t) { await eliminar('tareas', t.id); toast('Tarea eliminada'); recargar(); }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-h">
        <span className="grow">Tareas ({tareas.length})</span>
        {!cerrado && <button className="btn ghost sm" onClick={agregar}>+ Tarea</button>}
      </div>
      <div className="table-wrap">
        {tareas.length === 0 ? <Empty>Sin tareas.</Empty> : (
          <table>
            <thead><tr><th>Tarea</th><th>Técnico</th><th>Horas</th><th>Estado</th>{!cerrado && <th></th>}</tr></thead>
            <tbody>
              {tareas.map((t) => editando === t.id ? (
                <EditTareaRow key={t.id} t={t} tecnicos={tecnicos} onGuardar={guardar} onCancelar={() => setEditando(null)} />
              ) : (
                <tr key={t.id}>
                  <td className="strong">{t.descripcion}</td>
                  <td>{nombreTec(t.tecnico_id)}</td>
                  <td>{t.horas ? t.horas + ' h' : '—'}</td>
                  <td><span className={'badge ' + (t.estado === 'Hecha' ? 'g' : 'a')}>{t.estado}</span></td>
                  {!cerrado && <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                    <button className="ibtn" onClick={() => setEditando(t.id)}><Icon name="edit" size={14} /></button>
                    <button className="ibtn del" onClick={() => borrar(t)}><Icon name="del" size={14} /></button>
                  </td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function EditTareaRow({ t, tecnicos, onGuardar, onCancelar }) {
  const [tec, setTec] = useState(t.tecnico_id || '');
  const [horas, setHoras] = useState(t.horas);
  const [estado, setEstado] = useState(t.estado);
  return (
    <tr style={{ background: 'var(--brand-bg)' }}>
      <td className="strong">{t.descripcion}</td>
      <td><select value={tec} onChange={(e) => setTec(e.target.value)}>{tecnicos.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}</select></td>
      <td><input type="number" step="0.5" value={horas} onChange={(e) => setHoras(e.target.value)} style={{ width: 64 }} /></td>
      <td><select value={estado} onChange={(e) => setEstado(e.target.value)}><option>Pendiente</option><option>Hecha</option></select></td>
      <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
        <button className="ibtn ok" onClick={() => onGuardar(t, { tecnico_id: Number(tec), horas: Number(horas), estado })}><Icon name="check" size={14} /></button>
        <button className="ibtn" onClick={onCancelar}>✕</button>
      </td>
    </tr>
  );
}

function RepuestosCard({ trabajoId, repuestos, cerrado, recargar, toast }) {
  const [editando, setEditando] = useState(null);
  async function agregar() {
    await crear('repuestos', { trabajo_id: Number(trabajoId), articulo: 'Nuevo repuesto', cantidad: 1, pieza_vieja: '', pieza_nueva: '', garantia: false, registrado: false });
    toast('Repuesto agregado'); recargar();
  }
  async function guardar(r, cambios) { await actualizar('repuestos', r.id, cambios); setEditando(null); toast('Repuesto actualizado'); recargar(); }
  async function borrar(r) { await eliminar('repuestos', r.id); toast('Repuesto eliminado'); recargar(); }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-h">
        <span className="grow">Repuestos ({repuestos.length})</span>
        {!cerrado && <button className="btn ghost sm" onClick={agregar}>+ Repuesto</button>}
      </div>
      <div className="table-wrap">
        {repuestos.length === 0 ? <Empty>Sin repuestos.</Empty> : (
          <table>
            <thead><tr><th>Artículo</th><th>Cant.</th><th>Vieja</th><th>Nueva</th><th>Gar.</th>{!cerrado && <th></th>}</tr></thead>
            <tbody>
              {repuestos.map((r) => editando === r.id ? (
                <EditRepRow key={r.id} r={r} onGuardar={guardar} onCancelar={() => setEditando(null)} />
              ) : (
                <tr key={r.id}>
                  <td className="strong">{r.articulo}</td>
                  <td>{r.cantidad}</td>
                  <td>{r.pieza_vieja || '—'}</td>
                  <td>{r.pieza_nueva || '—'}</td>
                  <td>{r.garantia ? <span className="badge g">Sí</span> : <span className="badge">No</span>}</td>
                  {!cerrado && <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                    <button className="ibtn" onClick={() => setEditando(r.id)}><Icon name="edit" size={14} /></button>
                    <button className="ibtn del" onClick={() => borrar(r)}><Icon name="del" size={14} /></button>
                  </td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function EditRepRow({ r, onGuardar, onCancelar }) {
  const [gar, setGar] = useState(r.garantia ? 'Sí' : 'No');
  const [reg, setReg] = useState(r.registrado ? 'Sí' : 'No');
  return (
    <tr style={{ background: 'var(--brand-bg)' }}>
      <td className="strong">{r.articulo}</td><td>{r.cantidad}</td>
      <td>{r.pieza_vieja || '—'}</td><td>{r.pieza_nueva || '—'}</td>
      <td><select value={gar} onChange={(e) => setGar(e.target.value)}><option>Sí</option><option>No</option></select></td>
      <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
        <button className="ibtn ok" onClick={() => onGuardar(r, { garantia: gar === 'Sí', registrado: reg === 'Sí' })}><Icon name="check" size={14} /></button>
        <button className="ibtn" onClick={onCancelar}>✕</button>
      </td>
    </tr>
  );
}

function InfoRow({ k, v }) {
  return <div className="inforow"><span className="k">{k}</span><span className="v">{v}</span></div>;
}
