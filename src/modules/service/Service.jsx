import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listar, actualizar, obtener } from '../../lib/db';
import { PageHeader, Empty, nombreCliente, fmtFecha, diasDesde } from '../../shared/ui.jsx';
import { comentarSistema } from '../../shared/Comentarios.jsx';
import { useToast } from '../../shared/Toast.jsx';
import { useAuth } from '../../shared/Auth.jsx';
import Board, { TotalVisibles } from '../../shared/Board.jsx';
import ListaAgrupada, { todosPlegados } from '../../shared/ListaAgrupada.jsx';
import { ESTADOS_SERVICE, validarTransicion } from './service.js';

const ESTADOS = ESTADOS_SERVICE.map((e) => ({ id: e, label: e }));
const MAX_ENTREGADOS_KANBAN = 10;
const cerrado = (t) => t.estado === 'Finalizada' || t.estado === 'Entregada';
// Entregados más recientes primero (sin fecha, al final).
const porEntrega = (a, b) => (b.fecha_entrega || b.egreso || '').localeCompare(a.fecha_entrega || a.egreso || '') || b.id - a.id;

export default function Service() {
  const [trabajos, setTrabajos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [tareas, setTareas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [q, setQ] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [vista, setVista] = useState('kanban');
  const [grupos, setGrupos] = useState(todosPlegados(ESTADOS));
  const [cfg, setCfg] = useState(null);
  const navigate = useNavigate();
  const toast = useToast();
  const { usuarioActualId, esAdmin } = useAuth();

  useEffect(() => {
    cargar();
    listar('usuarios').then(setUsuarios).catch(() => setUsuarios([]));
    obtener('configuracion', 1).then(setCfg).catch(() => {});
  }, []);

  async function cargar() {
    const [ts, cs, tk] = await Promise.all([listar('trabajos'), listar('clientes'), listar('tareas')]);
    setTrabajos(ts); setClientes(cs); setTareas(tk); setCargando(false);
  }

  const nombrePorId = (id) => { const c = clientes.find((x) => x.id === id); return c ? nombreCliente(c) : `Cliente #${id}`; };
  const tareasDe = (tid) => tareas.filter((t) => t.trabajo_id === tid);
  // Técnico del trabajo; en trabajos viejos figura solo en las tareas.
  const tecnicoDe = (t) => t.tecnico_id ?? tareasDe(t.id).find((ta) => ta.tecnico_id)?.tecnico_id ?? null;
  const nombreUsuario = (id) => usuarios.find((u) => u.id === id)?.nombre || '— sin asignar —';

  // Datos calculados para la lista. Días = en el taller desde el ingreso;
  // el semáforo usa los umbrales de Configuración → Parámetros.
  const verde = cfg?.sem_serv_verde ?? 7;
  const amarillo = cfg?.sem_serv_amarillo ?? 15;
  let items = trabajos.map((t) => {
    const dias = t.ingreso ? Math.max(0, diasDesde(t.ingreso)) : 0;
    return {
      ...t,
      _cliente: nombrePorId(t.cliente_id),
      _equipo: [`${t.marca || ''} ${t.modelo || ''}`.trim(), t.nro_serie].filter(Boolean).join(' · '),
      _tecnico: nombreUsuario(tecnicoDe(t)),
      _dias: dias,
      _sem: dias <= verde ? 'g' : dias <= amarillo ? 'a' : 'r',
    };
  });

  const term = q.trim().toLowerCase();
  if (term) {
    items = items.filter((t) =>
      (t.nro || '').toLowerCase().includes(term)
      || t._cliente.toLowerCase().includes(term)
      || t._equipo.toLowerCase().includes(term)
      || t._tecnico.toLowerCase().includes(term));
  }
  if (desde) items = items.filter((t) => (t.ingreso || '') >= desde);
  if (hasta) items = items.filter((t) => (t.ingreso || '') <= hasta);

  // Sin modal en el arrastre: los datos (técnico, informe) se cargan en el
  // detalle. Acá solo validamos el candado al soltar.
  const camposTransicion = () => [];

  async function mover(item, hacia) {
    if (item.estado === hacia) return;
    const iDesde = ESTADOS_SERVICE.indexOf(item.estado);
    const iHacia = ESTADOS_SERVICE.indexOf(hacia);
    if (iHacia < iDesde) {
      // Retroceder un ticket a un estado anterior: solo un administrador.
      if (!esAdmin) { toast('Solo un administrador puede volver un ticket a un estado anterior', 'err'); return; }
    } else {
      const motivo = validarTransicion(hacia, item, tareasDe(item.id));
      if (motivo) { toast(motivo, 'err'); return; }
    }
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

  // Columna Entregada del Kanban: solo los 10 más recientes; el resto
  // sigue en la vista Lista.
  function columnaEntregada(estado, lista, tarjeta) {
    if (estado.id !== 'Entregada') return null;
    const recientes = [...lista].sort(porEntrega).slice(0, MAX_ENTREGADOS_KANBAN);
    const restantes = lista.length - recientes.length;
    return (
      <>
        {restantes > 0 && (
          <div className="kcol-nota">Mostrando los {recientes.length} más recientes de {lista.length}</div>
        )}
        {recientes.map(tarjeta)}
        {restantes > 0 && (
          <div className="kcol-mas">
            <a onClick={() => { setGrupos((g) => ({ ...g, Entregada: true })); setVista('lista'); }}>
              Ver los {restantes} restantes →
            </a>
          </div>
        )}
      </>
    );
  }

  const fecha = (f) => (f ? fmtFecha(f) : <span className="muted">—</span>);
  const COLUMNAS = [
    { key: 'nro', label: 'N°', className: 'strong', valor: (t) => t.nro || '', render: (t) => t.nro },
    { key: 'tipo', label: 'Tipo', valor: (t) => t.tipo || '', render: (t) => <span className="badge">{t.tipo}</span> },
    { key: 'cliente', label: 'Cliente', valor: (t) => t._cliente.toLowerCase(), render: (t) => t._cliente },
    {
      key: 'equipo', label: 'Equipo', className: 'celda-corta', valor: (t) => t._equipo.toLowerCase(),
      render: (t) => <span title={t._equipo}>{t._equipo || <span className="muted">—</span>}</span>,
    },
    { key: 'tecnico', label: 'Técnico', valor: (t) => t._tecnico.toLowerCase(), render: (t) => t._tecnico },
    {
      key: 'dias', label: 'Días', valor: (t) => (cerrado(t) ? -1 : t._dias),
      render: (t) => (cerrado(t)
        ? <span className="muted">—</span>
        : <span style={{ whiteSpace: 'nowrap' }}><span className={'dot ' + t._sem} />{t._dias} d</span>),
    },
    { key: 'ingreso', label: 'Ingreso', valor: (t) => t.ingreso || '', render: (t) => fecha(t.ingreso) },
    { key: 'entrega', label: 'Entrega', valor: (t) => t.fecha_entrega || '', render: (t) => fecha(t.fecha_entrega) },
  ];
  // Activos: más días en el taller primero. Finalizada/Entregada: los más recientes primero.
  const ordenPorDefecto = (estado) => (a, b) => (estado === 'Finalizada' || estado === 'Entregada'
    ? porEntrega(a, b)
    : b._dias - a._dias);

  return (
    <div>
      <PageHeader titulo="Service y reparación"
        sub="Arrastrá los tickets para cambiar de estado. Tocá uno para ver el detalle.">
        <button className="btn" onClick={() => navigate('/service/nuevo')}>Ingresar drone</button>
      </PageHeader>

      {!cargando && trabajos.length > 0 && (
        <div className="card card-pad" style={{ marginBottom: 14, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field" style={{ margin: 0, flex: '1 1 240px' }}>
            <label>Buscar</label>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="N°, cliente, equipo o técnico" />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Ingreso desde</label>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Ingreso hasta</label>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
          {(q || desde || hasta) && <button className="btn ghost sm" onClick={() => { setQ(''); setDesde(''); setHasta(''); }}>Limpiar</button>}
        </div>
      )}

      {cargando ? <Empty>Cargando…</Empty> : trabajos.length === 0 ? (
        <Empty>Todavía no hay trabajos. Ingresá un drone al taller.</Empty>
      ) : (
        <Board
          estados={ESTADOS}
          items={items}
          columnas={3}
          vista={vista}
          onVista={setVista}
          camposTransicion={camposTransicion}
          onMover={mover}
          onCardClick={(t) => navigate(`/service/${t.id}`)}
          renderColumna={columnaEntregada}
          contador={(estado, lista) => (estado.id === 'Entregada'
            ? <TotalVisibles total={lista.length} visibles={Math.min(lista.length, MAX_ENTREGADOS_KANBAN)} />
            : null)}
          renderLista={(lista) => (
            <ListaAgrupada estados={ESTADOS} items={lista} columnas={COLUMNAS}
              abiertos={grupos} onToggle={(id) => setGrupos((g) => ({ ...g, [id]: !g[id] }))}
              onAbrir={(t) => navigate(`/service/${t.id}`)} ordenPorDefecto={ordenPorDefecto} />
          )}
          render={(t) => (
            <div>
              <div className="kcard-t">{t.nro} · {t.tipo}</div>
              <div className="kcard-s">{t._cliente}</div>
              <div className="kcard-s muted">{t._equipo}</div>
            </div>
          )}
        />
      )}
    </div>
  );
}
