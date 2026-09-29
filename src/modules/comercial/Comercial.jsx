import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { listar, obtener } from '../../lib/db';
import { PageHeader, nombreCliente, diasDesde } from '../../shared/ui.jsx';
import { useToast } from '../../shared/Toast.jsx';
import Board, { TotalVisibles } from '../../shared/Board.jsx';
import { ETAPAS, camposFaltantes, avanzarEtapa } from './etapas.js';
import ListaOportunidades from './ListaOportunidades.jsx';
import { esGanada, claseResultado, BadgeResultado } from './resultado.jsx';
import { todosPlegados } from '../../shared/ListaAgrupada.jsx';

const ESTADOS = ETAPAS.map((e) => ({ id: e, label: e }));
const MAX_CIERRE_KANBAN = 10;
const GRUPOS_INICIALES = todosPlegados(ESTADOS);

// Agrupa una lista por una clave (para armar el contexto por oportunidad).
function agrupar(lista, clave) {
  const m = {};
  (lista || []).forEach((x) => {
    const k = x[clave];
    (m[k] = m[k] || []).push(x);
  });
  return m;
}

// Cerradas más recientes primero (por fecha de cierre; sin fecha, al final).
const porCierre = (a, b) => (b.fecha_cierre || '').localeCompare(a.fecha_cierre || '') || b.id - a.id;

export default function Comercial() {
  const [ops, setOps] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [cfg, setCfg] = useState(null);
  const [params] = useSearchParams();
  const filtroEtapa = params.get('etapa'); // viene del dashboard (KPI clickeable)
  const [q, setQ] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [vista, setVista] = useState('kanban');
  const [grupos, setGrupos] = useState(GRUPOS_INICIALES);
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    cargar();
    listar('usuarios').then(setUsuarios).catch(() => setUsuarios([]));
    obtener('configuracion', 1).then(setCfg).catch(() => {});
  }, []);

  async function cargar() {
    // Cargamos también cotizaciones y seguimientos para saber qué datos
    // ya tiene cada oportunidad, y así calcular qué falta al arrastrar.
    const [opsR, clsR, cotsR, segsR] = await Promise.all([
      listar('oportunidades'), listar('clientes'),
      listar('cotizaciones'), listar('seguimientos'),
    ]);
    const cotsPorOp = agrupar(cotsR, 'oportunidad_id');
    const segsPorOp = agrupar(segsR, 'oportunidad_id');
    const enriquecidas = opsR.map((o) => ({
      ...o,
      estado: o.etapa,
      _ctx: { cotizaciones: cotsPorOp[o.id] || [], seguimientos: segsPorOp[o.id] || [] },
    }));
    setOps(enriquecidas);
    setClientes(clsR);
  }

  const nombrePorId = (id) => {
    const c = clientes.find((x) => x.id === id);
    return c ? nombreCliente(c) : `Cliente #${id}`;
  };
  const nombreVendedor = (id) => usuarios.find((u) => u.id === id)?.nombre || '— sin asignar —';

  // Datos calculados para la lista: último contacto (el seguimiento más
  // reciente o el primer contacto) y semáforo por días sin contacto.
  const verde = cfg?.sem_com_verde ?? 7;
  const amarillo = cfg?.sem_com_amarillo ?? 15;
  const conDatos = ops.map((o) => {
    const ultimo = [o.fecha_contacto, ...o._ctx.seguimientos.map((s) => s.fecha)].filter(Boolean).sort().pop() || null;
    const dias = ultimo ? Math.max(0, diasDesde(ultimo)) : 0;
    return {
      ...o,
      _cliente: nombrePorId(o.cliente_id),
      _vendedor: nombreVendedor(o.vendedor_id),
      _ultimo: ultimo,
      _dias: dias,
      _sem: dias <= verde ? 'g' : dias <= amarillo ? 'a' : 'r',
    };
  });

  let items = conDatos;
  if (filtroEtapa) items = items.filter((i) => i.estado === filtroEtapa);

  // Qué campos faltan para llevar esta oportunidad a `hacia` (acumulativo).
  const camposTransicion = (item, hacia) => camposFaltantes(item, hacia, item._ctx);

  async function mover(item, hacia, valores) {
    const iA = ETAPAS.indexOf(item.estado), iH = ETAPAS.indexOf(hacia);
    if (iH < iA) { toast('No se puede volver a una etapa anterior', 'err'); return; }
    if (iH === iA) return;
    try {
      const res = await avanzarEtapa(item, hacia, valores, item._ctx);
      if (res.ventaId) {
        toast('Oportunidad ganada · venta creada');
        navigate(`/ventas/${res.ventaId}`);
        return;
      }
      toast('Oportunidad movida a ' + hacia);
      await cargar();
    } catch (e) {
      console.error(e);
      toast('No se pudo actualizar la oportunidad', 'err');
    }
  }

  // Buscador + filtro temporal (por fecha de primer contacto).
  const term = q.trim().toLowerCase();
  if (term) {
    items = items.filter((i) => i._cliente.toLowerCase().includes(term)
      || (i.relevamiento || '').toLowerCase().includes(term)
      || i._vendedor.toLowerCase().includes(term));
  }
  if (desde) items = items.filter((i) => (i.fecha_contacto || '') >= desde);
  if (hasta) items = items.filter((i) => (i.fecha_contacto || '') <= hasta);

  // Columna Cierre del Kanban: solo las 10 cerradas más recientes, en dos
  // secciones. El resto sigue disponible en la vista Lista.
  function columnaCierre(estado, lista, tarjeta) {
    if (estado.id !== 'Cierre') return null;
    const recientes = [...lista].sort(porCierre).slice(0, MAX_CIERRE_KANBAN);
    const ganadas = recientes.filter(esGanada);
    const perdidas = recientes.filter((o) => !esGanada(o));
    const restantes = lista.length - recientes.length;
    // Los contadores muestran el total real, aunque se vean solo algunas tarjetas.
    const totalGanadas = lista.filter(esGanada).length;
    const totalPerdidas = lista.length - totalGanadas;
    return (
      <>
        {restantes > 0 && (
          <div className="kcol-nota">Mostrando las {recientes.length} más recientes de {lista.length}</div>
        )}
        <div className="kcol-sec"><span>Ganadas</span><TotalVisibles total={totalGanadas} visibles={ganadas.length} /></div>
        {ganadas.map(tarjeta)}
        <div className="kcol-sec" style={{ marginTop: 6 }}><span>Perdidas</span><TotalVisibles total={totalPerdidas} visibles={perdidas.length} /></div>
        {perdidas.map(tarjeta)}
        {restantes > 0 && (
          <div className="kcol-mas">
            <a onClick={() => { setGrupos((g) => ({ ...g, Cierre: true })); setVista('lista'); }}>
              Ver las {restantes} restantes →
            </a>
          </div>
        )}
      </>
    );
  }

  return (
    <div>
      <PageHeader titulo="CRM comercial"
        sub="Arrastrá las tarjetas para cambiar de etapa. Tocá una tarjeta para ver el detalle.">
        <button className="btn" onClick={() => navigate('/comercial/nueva')}>Nueva oportunidad</button>
      </PageHeader>

      {filtroEtapa && (
        <div className="aviso">
          Mostrando solo la etapa <b style={{ margin: '0 4px' }}>{filtroEtapa}</b>.
          <a onClick={() => navigate('/comercial')} style={{ marginLeft: 8 }}>Ver todas</a>
        </div>
      )}

      <div className="card card-pad" style={{ marginBottom: 14, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field" style={{ margin: 0, flex: '1 1 240px' }}>
          <label>Buscar</label>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cliente, relevamiento o vendedor" />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Contacto desde</label>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Contacto hasta</label>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
        {(q || desde || hasta) && <button className="btn ghost sm" onClick={() => { setQ(''); setDesde(''); setHasta(''); }}>Limpiar</button>}
      </div>

      <Board
        estados={ESTADOS}
        items={items}
        vista={vista}
        onVista={setVista}
        camposTransicion={camposTransicion}
        onMover={mover}
        onCardClick={(o) => navigate(`/comercial/${o.id}`)}
        cardClass={claseResultado}
        renderColumna={columnaCierre}
        contador={(estado, lista) => (estado.id === 'Cierre'
          ? <TotalVisibles total={lista.length} visibles={Math.min(lista.length, MAX_CIERRE_KANBAN)} />
          : null)}
        renderLista={(lista) => (
          <ListaOportunidades items={lista} abiertos={grupos}
            onToggle={(etapa) => setGrupos((g) => ({ ...g, [etapa]: !g[etapa] }))}
            onAbrir={(o) => navigate(`/comercial/${o.id}`)} />
        )}
        render={(o) => (
          <div>
            <div className="kcard-t" style={{ display: 'flex', gap: 6, alignItems: 'baseline', justifyContent: 'space-between' }}>
              <span>{o._cliente}</span>
              {o.resultado && <BadgeResultado o={o} />}
            </div>
            <div className="kcard-s">{o.relevamiento}</div>
          </div>
        )}
      />
    </div>
  );
}
