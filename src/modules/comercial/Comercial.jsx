import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { listar } from '../../lib/db';
import { PageHeader, nombreCliente } from '../../shared/ui.jsx';
import { useToast } from '../../shared/Toast.jsx';
import Board from '../../shared/Board.jsx';
import { ETAPAS, camposFaltantes, avanzarEtapa } from './etapas.js';

const ESTADOS = ETAPAS.map((e) => ({ id: e, label: e }));

// Agrupa una lista por una clave (para armar el contexto por oportunidad).
function agrupar(lista, clave) {
  const m = {};
  (lista || []).forEach((x) => {
    const k = x[clave];
    (m[k] = m[k] || []).push(x);
  });
  return m;
}

export default function Comercial() {
  const [ops, setOps] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [params] = useSearchParams();
  const filtroEtapa = params.get('etapa'); // viene del dashboard (KPI clickeable)
  const [q, setQ] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => { cargar(); }, []);

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

  let items = ops;
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

  const nombrePorId = (id) => {
    const c = clientes.find((x) => x.id === id);
    return c ? nombreCliente(c) : `Cliente #${id}`;
  };

  // Buscador + filtro temporal (por fecha de primer contacto).
  const term = q.trim().toLowerCase();
  if (term) items = items.filter((i) => nombrePorId(i.cliente_id).toLowerCase().includes(term) || (i.relevamiento || '').toLowerCase().includes(term));
  if (desde) items = items.filter((i) => (i.fecha_contacto || '') >= desde);
  if (hasta) items = items.filter((i) => (i.fecha_contacto || '') <= hasta);

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
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cliente o relevamiento" />
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
        camposTransicion={camposTransicion}
        onMover={mover}
        onCardClick={(o) => navigate(`/comercial/${o.id}`)}
        render={(o) => (
          <div>
            <div className="kcard-t">{nombrePorId(o.cliente_id)}</div>
            <div className="kcard-s">{o.relevamiento}</div>
          </div>
        )}
      />
    </div>
  );
}
