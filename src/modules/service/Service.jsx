import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listar, actualizar } from '../../lib/db';
import { PageHeader, Empty, nombreCliente } from '../../shared/ui.jsx';
import { comentarSistema } from '../../shared/Comentarios.jsx';
import { useToast } from '../../shared/Toast.jsx';
import { useAuth } from '../../shared/Auth.jsx';
import Board from '../../shared/Board.jsx';
import { ESTADOS_SERVICE, validarTransicion } from './service.js';

const ESTADOS = ESTADOS_SERVICE.map((e) => ({ id: e, label: e }));

export default function Service() {
  const [trabajos, setTrabajos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [tareas, setTareas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [q, setQ] = useState('');
  const navigate = useNavigate();
  const toast = useToast();
  const { usuarioActualId } = useAuth();

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    const [ts, cs, tk] = await Promise.all([listar('trabajos'), listar('clientes'), listar('tareas')]);
    setTrabajos(ts); setClientes(cs); setTareas(tk); setCargando(false);
  }

  const nombrePorId = (id) => { const c = clientes.find((x) => x.id === id); return c ? nombreCliente(c) : `Cliente #${id}`; };
  const tareasDe = (tid) => tareas.filter((t) => t.trabajo_id === tid);

  // Cada ticket lleva sus tareas para validar las transiciones al arrastrar.
  let items = trabajos.map((t) => ({ ...t, estado: t.estado }));

  const term = q.trim().toLowerCase();
  if (term) {
    items = items.filter((t) =>
      (t.nro || '').toLowerCase().includes(term)
      || nombrePorId(t.cliente_id).toLowerCase().includes(term)
      || `${t.marca || ''} ${t.modelo || ''} ${t.nro_serie || ''}`.toLowerCase().includes(term));
  }

  // Sin modal en el arrastre: los datos (técnico, informe) se cargan en el
  // detalle. Acá solo validamos el candado al soltar.
  const camposTransicion = () => [];

  async function mover(item, hacia) {
    if (item.estado === hacia) return;
    const motivo = validarTransicion(hacia, item, tareasDe(item.id));
    if (motivo) { toast(motivo, 'err'); return; }
    try {
      const cambios = { estado: hacia };
      if (hacia === 'Finalizada') cambios.egreso = new Date().toISOString().slice(0, 10);
      await actualizar('trabajos', item.id, cambios);
      await comentarSistema('trabajo', item.id, `Estado cambiado a ${hacia}.`, usuarioActualId);
      toast('Estado actualizado');
      await cargar();
    } catch (e) {
      console.error(e);
      toast('No se pudo cambiar el estado', 'err');
    }
  }

  return (
    <div>
      <PageHeader titulo="Service y reparación"
        sub="Arrastrá los tickets para cambiar de estado. Tocá uno para ver el detalle.">
        <button className="btn" onClick={() => navigate('/service/nuevo')}>Ingresar drone</button>
      </PageHeader>

      {!cargando && trabajos.length > 0 && (
        <div className="card card-pad" style={{ marginBottom: 14 }}>
          <div className="field" style={{ margin: 0 }}>
            <label>Buscar</label>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="N°, cliente o equipo" />
          </div>
        </div>
      )}

      {cargando ? <Empty>Cargando…</Empty> : trabajos.length === 0 ? (
        <Empty>Todavía no hay trabajos. Ingresá un drone al taller.</Empty>
      ) : (
        <Board
          estados={ESTADOS}
          items={items}
          columnas={3}
          camposTransicion={camposTransicion}
          onMover={mover}
          onCardClick={(t) => navigate(`/service/${t.id}`)}
          render={(t) => (
            <div>
              <div className="kcard-t">{t.nro} · {t.tipo}</div>
              <div className="kcard-s">{nombrePorId(t.cliente_id)}</div>
              <div className="kcard-s muted">{t.marca} {t.modelo} · {t.nro_serie}</div>
            </div>
          )}
        />
      )}
    </div>
  );
}
