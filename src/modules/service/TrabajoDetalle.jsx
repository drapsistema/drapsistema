import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { obtener, listar, crear, actualizar, eliminar } from '../../lib/db';
import { PageHeader, BackButton, Empty, nombreCliente, fmtFecha, hoyISO } from '../../shared/ui.jsx';
import { usuariosConRol } from '../../shared/permisos';
import Comentarios, { comentarSistema } from '../../shared/Comentarios.jsx';
import ModalCampos from '../../shared/ModalCampos.jsx';
import { useToast } from '../../shared/Toast.jsx';
import { useAuth } from '../../shared/Auth.jsx';
import Icon from '../../shared/Icon.jsx';
import { ESTADOS_SERVICE, validarTransicion } from './service.js';

export default function TrabajoDetalle() {
  const { id } = useParams();
  const toast = useToast();
  const { usuarioActualId } = useAuth();
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
  const idxEstado = ESTADOS_SERVICE.indexOf(trabajo.estado);

  async function cambiarEstado(nuevo) {
    // Candados de transición (misma regla que el tablero).
    const motivo = validarTransicion(nuevo, { tareas, tieneInforme: Boolean(trabajo.informe) });
    if (motivo) { toast(motivo, 'err'); return; }
    const cambios = { estado: nuevo };
    if (nuevo === 'Finalizada') cambios.egreso = hoyISO();
    await actualizar('trabajos', id, cambios);
    await comentarSistema('trabajo', id, `Estado cambiado a ${nuevo}.`, usuarioActualId);
    toast('Estado actualizado');
    cargar();
  }

  async function adjuntarInforme() {
    await actualizar('trabajos', id, { informe: `informe_${trabajo.nro.toLowerCase().replace('-', '')}.pdf` });
    await comentarSistema('trabajo', id, 'Se adjuntó el informe técnico.', usuarioActualId);
    toast('Informe técnico adjunto'); cargar();
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

      {trabajo.estado !== 'Entregada' && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          {ESTADOS_SERVICE.filter((e) => e !== trabajo.estado).map((e) => (
            <button key={e} className="btn ghost sm" onClick={() => cambiarEstado(e)}>→ {e}</button>
          ))}
        </div>
      )}

      <div className="two" style={{ marginTop: 16 }}>
        <div>
          <TareasCard trabajoId={id} tareas={tareas} tecnicos={tecnicos} cerrado={cerrado} recargar={cargar} toast={toast} usuarioActualId={usuarioActualId} />
          <RepuestosCard trabajoId={id} repuestos={repuestos} cerrado={cerrado} recargar={cargar} toast={toast} usuarioActualId={usuarioActualId} />
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

function TareasCard({ trabajoId, tareas, tecnicos, cerrado, recargar, toast, usuarioActualId }) {
  const [modal, setModal] = useState(null); // {} nuevo | tarea (editar) | null
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
        {!cerrado && <button className="btn ghost sm" onClick={() => setModal({})}>+ Tarea</button>}
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
        <ModalCampos
          titulo={modal.id ? 'Editar tarea' : 'Agregar tarea'}
          campos={campos} valoresIniciales={modal}
          textoConfirmar={modal.id ? 'Guardar cambios' : 'Agregar tarea'}
          onConfirm={guardar} onCancel={() => setModal(null)}
        />
      )}
    </div>
  );
}

function RepuestosCard({ trabajoId, repuestos, cerrado, recargar, toast, usuarioActualId }) {
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
      articulo: valores.articulo,
      cantidad: valores.cantidad ? Number(valores.cantidad) : 1,
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

  // Al editar, mapeamos los booleanos a Sí/No para el select.
  const abrirEdicion = (r) => setModal({ ...r, garantia: r.garantia ? 'Sí' : 'No', registrado: r.registrado ? 'Sí' : 'No' });

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-h">
        <span className="grow">Repuestos ({repuestos.length})</span>
        {!cerrado && <button className="btn ghost sm" onClick={() => setModal({})}>+ Repuesto</button>}
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
        <ModalCampos
          titulo={modal.id ? 'Editar repuesto' : 'Agregar repuesto'}
          campos={campos} valoresIniciales={modal}
          textoConfirmar={modal.id ? 'Guardar cambios' : 'Agregar repuesto'}
          onConfirm={guardar} onCancel={() => setModal(null)}
        />
      )}
    </div>
  );
}

function InfoRow({ k, v }) {
  return <div className="inforow"><span className="k">{k}</span><span className="v">{v}</span></div>;
}
