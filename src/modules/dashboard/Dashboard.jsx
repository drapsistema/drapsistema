import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listar, obtener } from '../../lib/db';
import { PageHeader, money, diasDesde } from '../../shared/ui.jsx';
import { useAuth } from '../../shared/Auth.jsx';
import { rolesDe } from '../../shared/permisos';
import { estadoCobro } from '../ventas/cobro.js';

const ETAPAS_C = ['Contacto inicial', 'Cotización', 'Seguimiento', 'Cierre'];
const ESTADOS_S = ['Ingresada', 'En diagnóstico', 'En reparación', 'Esperando repuestos', 'Finalizada', 'Entregada'];

// ============================================================
// PERÍODO
// Por defecto, el mes en curso (se recalcula al abrir: en octubre
// muestra octubre). 'YYYY-MM' = un mes puntual · null = todo el historial.
// ============================================================
const pad = (n) => String(n).padStart(2, '0');
const mesDe = (dt) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}`;
const nombreMes = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
};
// Últimos 24 meses para el selector.
function mesesRecientes(n = 24) {
  const hoy = new Date();
  return Array.from({ length: n }, (_, i) => mesDe(new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)));
}

// Ventas de los 6 meses que terminan en `hastaMes` (o el actual).
function ventasPorMes(ventas, hastaMes, n = 6) {
  const [y, m] = (hastaMes || mesDe(new Date())).split('-').map(Number);
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const dt = new Date(y, m - 1 - i, 1);
    const ym = mesDe(dt);
    const label = dt.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '');
    out.push({ label, value: ventas.filter((v) => (v.fecha_ganada || '').slice(0, 7) === ym).length });
  }
  return out;
}

const vigente = (v) => v.estado !== 'Cancelada';
const porCobrar = (v) => vigente(v) && v.fecha_entrega && estadoCobro(v) !== 'Total';

// ---------- Componentes reutilizables ----------
function Kpi({ label, value, foot, to, cl }) {
  const navigate = useNavigate();
  const color = cl === 'g' ? 'var(--green)' : cl === 'a' ? 'var(--amber)' : cl === 'r' ? 'var(--red)' : undefined;
  return (
    <div className="kpi" onClick={() => to && navigate(to)} style={{ cursor: to ? 'pointer' : 'default' }}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={color ? { color } : undefined}>{value}</div>
      {foot && <div className="kpi-foot">{foot}</div>}
    </div>
  );
}

function Seccion({ titulo, children }) {
  return (
    <>
      <div className="sm muted" style={{ textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 600, margin: '18px 0 8px' }}>{titulo}</div>
      <div className="kpi-grid">{children}</div>
    </>
  );
}

function ChartCard({ titulo, children }) {
  return (
    <div className="card">
      <div className="card-h">{titulo}</div>
      <div className="card-pad">{children}</div>
    </div>
  );
}

// Barras horizontales (categorías).
function BarsH({ data }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.every((d) => d.value === 0)) return <div className="muted sm">Sin datos por ahora.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      {data.map((d) => (
        <div key={d.label} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 30px', alignItems: 'center', gap: 10 }}>
          <span className="sm muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.label}</span>
          <div style={{ height: 10, background: 'var(--panel-2)', borderRadius: 999 }}>
            <div style={{ height: '100%', width: `${(d.value / max) * 100}%`, minWidth: d.value ? 6 : 0, background: d.color || 'var(--brand)', borderRadius: 999, transition: 'width .3s' }} />
          </div>
          <span className="sm strong" style={{ textAlign: 'right' }}>{d.value}</span>
        </div>
      ))}
    </div>
  );
}

// Barras verticales (por mes).
function BarsV({ data }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
        {data.map((d) => <div key={d.label} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: 'var(--ink-3)' }}>{d.value || ''}</div>)}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120 }}>
        {data.map((d) => (
          <div key={d.label} title={`${d.label}: ${d.value}`}
            style={{ flex: 1, maxWidth: 34, margin: '0 auto', height: Math.max(3, Math.round((d.value / max) * 118)) + 'px', background: d.value ? 'var(--brand)' : 'var(--line)', borderRadius: '8px 8px 0 0', transition: 'height .3s' }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
        {data.map((d) => <div key={d.label} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: 'var(--ink-3)' }}>{d.label}</div>)}
      </div>
    </div>
  );
}

function Alertas({ items }) {
  const navigate = useNavigate();
  const activos = items.filter((a) => a.n > 0);
  return (
    <div className="card">
      <div className="card-h"><span className="grow">Alertas (hoy)</span>{activos.length > 0 && <span className="badge r">{activos.length}</span>}</div>
      <div className="card-pad">
        {activos.length === 0 ? (
          <div className="muted sm">Todo en orden, sin alertas.</div>
        ) : activos.map((a, i) => (
          <div key={i} onClick={() => a.to && navigate(a.to)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--line-2)', cursor: a.to ? 'pointer' : 'default' }}>
            <span className={'dot ' + (a.cl || 'r')} />
            <span className="grow sm">{a.texto}</span>
            <span className={'badge ' + (a.cl || 'r')}>{a.n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// PANELES
// Todos reciben `p` = { enP(fecha), etiqueta, mes } y `uid`:
// uid = null -> toda la empresa · uid = id -> solo ese usuario.
// ============================================================
function AdminDash({ d, usuarios, p }) {
  const vigentes = d.ventas.filter(vigente);
  const abiertas = d.op.filter((o) => !o.resultado);
  const trabajosAbiertos = d.trabajos.filter((t) => t.estado !== 'Entregada' && t.estado !== 'Finalizada');
  const postPend = d.tpost.filter((t) => t.estado === 'Pendiente');
  const postVenc = postPend.filter((t) => diasDesde(t.objetivo) > 0);
  const esperandoRep = d.trabajos.filter((t) => t.estado === 'Esperando repuestos');
  const visitas = d.tpost.filter((t) => t.visita_estado === 'Solicitada' || t.visita_estado === 'Agendada');
  const tercIds = new Set(usuarios.filter((u) => rolesDe(u).includes('Vendedor tercerizado')).map((u) => u.id));
  const comSinDef = vigentes.filter((v) => tercIds.has(v.vendedor_id) && !v.comision);

  const ventasP = vigentes.filter((v) => p.enP(v.fecha_ganada));
  const pipeline = ETAPAS_C.map((e) => ({ label: e, value: abiertas.filter((o) => o.etapa === e).length }));
  const porVendedor = usuarios.filter((u) => rolesDe(u).some((r) => r.indexOf('Vendedor') === 0))
    .map((u) => ({ label: u.nombre, value: ventasP.filter((v) => v.vendedor_id === u.id).length }))
    .filter((x) => x.value > 0).sort((a, b) => b.value - a.value).slice(0, 6);

  return (
    <>
      <Seccion titulo={`En ${p.etiqueta}`}>
        <Kpi label="Clientes nuevos" value={d.clientes.filter((c) => p.enP(c.creado_en)).length} foot="dados de alta" to="/clientes" />
        <Kpi label="Oportunidades nuevas" value={d.op.filter((o) => p.enP(o.fecha_contacto)).length} foot="primer contacto" to="/comercial" />
        <Kpi label="Ventas ganadas" value={ventasP.length} foot="no canceladas" cl="g" to="/ventas" />
        <Kpi label="Service ingresados" value={d.trabajos.filter((t) => p.enP(t.ingreso)).length} foot="drones recibidos" to="/service" />
      </Seccion>
      <Seccion titulo="Situación actual">
        <Kpi label="Oportunidades abiertas" value={abiertas.length} foot="en gestión" to="/comercial" />
        <Kpi label="Ventas por cobrar" value={vigentes.filter(porCobrar).length} foot="entregadas sin cobro total" cl="a" to="/ventas" />
        <Kpi label="Service en taller" value={trabajosAbiertos.length} foot="trabajos abiertos" to="/service" />
        <Kpi label="Postventa pendiente" value={postPend.length} foot={`${postVenc.length} vencidas`} cl={postVenc.length ? 'r' : undefined} to="/postventa" />
      </Seccion>
      <div className="two" style={{ marginTop: 18 }}>
        <ChartCard titulo="Pipeline comercial (abiertas hoy)"><BarsH data={pipeline} /></ChartCard>
        <ChartCard titulo="Ventas por mes"><BarsV data={ventasPorMes(vigentes, p.mes)} /></ChartCard>
      </div>
      <div className="two" style={{ marginTop: 18 }}>
        <ChartCard titulo={`Ventas por vendedor · ${p.etiqueta}`}><BarsH data={porVendedor} /></ChartCard>
        <Alertas items={[
          { texto: 'Ventas entregadas sin cobro total', n: vigentes.filter(porCobrar).length, cl: 'a', to: '/ventas' },
          { texto: 'Postventa vencida', n: postVenc.length, cl: 'r', to: '/postventa' },
          { texto: 'Visitas técnicas a coordinar', n: visitas.length, cl: 'a', to: '/postventa' },
          { texto: 'Service esperando repuestos', n: esperandoRep.length, cl: 'a', to: '/service' },
          { texto: 'Comisiones de tercerizados sin definir', n: comSinDef.length, cl: 'r', to: '/ventas' },
          { texto: 'Clientes duplicados para unificar', n: d.unif.length, cl: 'a', to: '/clientes/unificaciones' },
        ]} />
      </div>
    </>
  );
}

function VendedorDash({ d, uid, yo, cfg, tercerizado, p }) {
  const ops = uid ? d.op.filter((o) => o.vendedor_id === uid) : d.op;
  const ventas = (uid ? d.ventas.filter((v) => v.vendedor_id === uid) : d.ventas).filter(vigente);
  const mis = yo ? 'Mis ' : '';

  const abiertas = ops.filter((o) => !o.resultado);
  const umbral = cfg?.sem_com_amarillo ?? 15;
  const frias = abiertas.filter((o) => diasDesde(o.fecha_contacto) > umbral);
  const enCoti = abiertas.filter((o) => o.etapa === 'Cotización');
  const sinEntregar = ventas.filter((v) => !v.fecha_entrega);

  // Del período: oportunidades que arrancaron en el período y ventas ganadas/entregadas en él.
  const opsP = ops.filter((o) => p.enP(o.fecha_contacto));
  const ganadasP = opsP.filter((o) => o.resultado === 'Ganada');
  const perdidasP = opsP.filter((o) => o.resultado === 'Perdida');
  const conv = (ganadasP.length + perdidasP.length) ? Math.round((ganadasP.length / (ganadasP.length + perdidasP.length)) * 100) : 0;
  const ventasP = ventas.filter((v) => p.enP(v.fecha_ganada));
  const comisionesP = ventasP.reduce((a, v) => a + (Number(v.comision) || 0), 0);
  const sinComision = ventas.filter((v) => !v.comision);

  const pipeline = ETAPAS_C.map((e) => ({ label: e, value: abiertas.filter((o) => o.etapa === e).length }));
  const alertas = [
    { texto: 'Oportunidades frías (sin contacto)', n: frias.length, cl: 'r', to: '/comercial' },
    { texto: 'En cotización (esperando respuesta)', n: enCoti.length, cl: 'a', to: '/comercial' },
    { texto: `${yo ? 'Mis ventas' : 'Ventas'} sin entregar`, n: sinEntregar.length, cl: 'a', to: '/ventas' },
  ];
  if (tercerizado) alertas.unshift({ texto: 'Ventas sin comisión definida', n: sinComision.length, cl: 'a', to: '/ventas' });

  return (
    <>
      <Seccion titulo={`En ${p.etiqueta}`}>
        <Kpi label="Oportunidades nuevas" value={opsP.length} foot="primer contacto en el período" to="/comercial" />
        <Kpi label="Ventas ganadas" value={ventasP.length} foot="no canceladas" cl="g" to="/ventas" />
        <Kpi label="Ventas entregadas" value={ventas.filter((v) => p.enP(v.fecha_entrega)).length} foot="con entrega en el período" to="/ventas" />
        {tercerizado
          ? <Kpi label="Comisiones" value={money(comisionesP)} foot="de las ventas del período" to="/ventas" />
          : <Kpi label="Conversión" value={conv + '%'} foot="ganadas / cerradas del período" to="/comercial" />}
      </Seccion>
      <Seccion titulo="Situación actual">
        <Kpi label={`${mis}oportunidades abiertas`.replace(/^./, (c) => c.toUpperCase())} value={abiertas.length} foot="en gestión" to="/comercial" />
        <Kpi label="En cotización" value={enCoti.length} foot="esperando respuesta" cl="a" to="/comercial" />
        <Kpi label="Oportunidades frías" value={frias.length} foot={`más de ${umbral} días`} cl={frias.length ? 'r' : undefined} to="/comercial" />
        <Kpi label="Ventas por cobrar" value={ventas.filter(porCobrar).length} foot="entregadas sin cobro total" cl="a" to="/ventas" />
      </Seccion>
      <div className="two" style={{ marginTop: 18 }}>
        <ChartCard titulo="Pipeline (abiertas hoy)"><BarsH data={pipeline} /></ChartCard>
        <ChartCard titulo="Ventas por mes"><BarsV data={ventasPorMes(ventas, p.mes)} /></ChartCard>
      </div>
      <div className="two" style={{ marginTop: 18 }}>
        <Alertas items={alertas} />
        <ChartCard titulo={`Oportunidades del período · ${p.etiqueta}`}>
          <BarsH data={[
            { label: 'Ganadas', value: ganadasP.length, color: 'var(--green)' },
            { label: 'Perdidas', value: perdidasP.length, color: 'var(--red)' },
            { label: 'Abiertas', value: opsP.filter((o) => !o.resultado).length, color: 'var(--brand)' },
          ]} />
        </ChartCard>
      </div>
    </>
  );
}

function TecnicoDash({ d, uid, usuarios, p }) {
  // "Del técnico" = asignado al trabajo, o con alguna tarea a su nombre
  // (trabajos anteriores al campo tecnico_id se asignaban solo por tarea).
  let mis = d.trabajos;
  if (uid) {
    const conTarea = new Set(d.tareas.filter((ta) => ta.tecnico_id === uid).map((ta) => ta.trabajo_id));
    mis = d.trabajos.filter((t) => t.tecnico_id === uid || conTarea.has(t.id));
  }
  const activos = mis.filter((t) => t.estado !== 'Entregada' && t.estado !== 'Finalizada');
  const porEstado = ESTADOS_S.map((e) => ({ label: e, value: mis.filter((t) => t.estado === e).length }));
  const espera = mis.filter((t) => t.estado === 'Esperando repuestos');
  const esperaMucho = espera.filter((t) => diasDesde(t.espera_desde) > 7);
  const sinDiag = mis.filter((t) => t.estado === 'En diagnóstico' && !t.diagnostico);
  const sinAsignar = d.trabajos.filter((t) => t.estado === 'Ingresada' && !t.tecnico_id);

  const nombre = (id) => usuarios.find((u) => u.id === id)?.nombre || 'Sin asignar';
  const tecnicoDe = (t) => t.tecnico_id ?? d.tareas.find((ta) => ta.trabajo_id === t.id && ta.tecnico_id)?.tecnico_id;
  const porTecnico = uid ? null : Object.entries(
    activos.reduce((acc, t) => { const k = nombre(tecnicoDe(t)); acc[k] = (acc[k] || 0) + 1; return acc; }, {}))
    .map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);

  return (
    <>
      <Seccion titulo={`En ${p.etiqueta}`}>
        <Kpi label="Ingresados" value={mis.filter((t) => p.enP(t.ingreso)).length} foot="drones recibidos" to="/service" />
        <Kpi label="Finalizados" value={mis.filter((t) => p.enP(t.egreso)).length} foot="reparación terminada" cl="g" to="/service" />
        <Kpi label="Entregados" value={mis.filter((t) => p.enP(t.fecha_entrega)).length} foot="devueltos al cliente" to="/service" />
      </Seccion>
      <Seccion titulo="Situación actual">
        <Kpi label="Trabajos activos" value={activos.length} foot="en el taller" to="/service" />
        <Kpi label="En diagnóstico" value={mis.filter((t) => t.estado === 'En diagnóstico').length} to="/service" />
        <Kpi label="En reparación" value={mis.filter((t) => t.estado === 'En reparación').length} to="/service" />
        <Kpi label="Esperando repuestos" value={espera.length} cl={espera.length ? 'a' : undefined} to="/service" />
      </Seccion>
      <div className="two" style={{ marginTop: 18 }}>
        <ChartCard titulo="Trabajos por estado"><BarsH data={porEstado} /></ChartCard>
        <Alertas items={[
          { texto: 'Esperando repuestos hace +7 días', n: esperaMucho.length, cl: 'r', to: '/service' },
          { texto: 'En diagnóstico sin diagnóstico cargado', n: sinDiag.length, cl: 'a', to: '/service' },
          { texto: 'Ingresados sin técnico asignado', n: sinAsignar.length, cl: 'a', to: '/service' },
        ]} />
      </div>
      {porTecnico && (
        <div className="two" style={{ marginTop: 18 }}>
          <ChartCard titulo="Trabajos activos por técnico"><BarsH data={porTecnico} /></ChartCard>
        </div>
      )}
    </>
  );
}

// Las tareas pendientes son una cola compartida del equipo de postventa;
// con `uid`, lo realizado se cuenta solo para ese usuario.
function PostventaDash({ d, uid, p }) {
  const pend = d.tpost.filter((t) => t.estado === 'Pendiente');
  const venc = pend.filter((t) => diasDesde(t.objetivo) > 0);
  const prox = pend.filter((t) => { const dd = diasDesde(t.objetivo); return dd <= 0 && dd >= -7; });
  const visitas = d.tpost.filter((t) => t.visita_estado === 'Solicitada' || t.visita_estado === 'Agendada');
  const realizadasP = d.tpost.filter((t) => t.estado === 'Realizada' && p.enP(t.fecha_real) && (!uid || t.responsable_id === uid));
  const hitos = [...new Set(pend.map((t) => t.hito).filter(Boolean))];
  const porHito = hitos.map((h) => ({ label: h, value: pend.filter((t) => t.hito === h).length }))
    .sort((a, b) => b.value - a.value).slice(0, 6);

  return (
    <>
      <Seccion titulo={`En ${p.etiqueta}`}>
        <Kpi label="Tareas del período" value={d.tpost.filter((t) => p.enP(t.objetivo)).length} foot="con fecha objetivo en el período" to="/postventa" />
        <Kpi label="Realizadas" value={realizadasP.length} foot={uid ? 'contactos hechos por el usuario' : 'contactos hechos'} cl="g" to="/postventa" />
        <Kpi label="Visitas realizadas" value={d.tpost.filter((t) => p.enP(t.visita_real)).length} foot="visitas técnicas" to="/postventa" />
      </Seccion>
      <Seccion titulo="Situación actual (cola del equipo)">
        <Kpi label="Tareas pendientes" value={pend.length} foot="por hacer" to="/postventa" />
        <Kpi label="Vencidas" value={venc.length} foot="pasaron el objetivo" cl="r" to="/postventa" />
        <Kpi label="Próximas a vencer" value={prox.length} foot="dentro de 7 días" cl="a" to="/postventa" />
        <Kpi label="Visitas a coordinar" value={visitas.length} foot="solicitadas o agendadas" cl="a" to="/postventa" />
      </Seccion>
      <div className="two" style={{ marginTop: 18 }}>
        <ChartCard titulo="Pendientes por tarea"><BarsH data={porHito} /></ChartCard>
        <Alertas items={[
          { texto: 'Tareas vencidas', n: venc.length, cl: 'r', to: '/postventa' },
          { texto: 'Próximas a vencer (7 días)', n: prox.length, cl: 'a', to: '/postventa' },
          { texto: 'Visitas técnicas a coordinar', n: visitas.length, cl: 'a', to: '/postventa' },
        ]} />
      </div>
    </>
  );
}

// ============================================================
export default function Dashboard() {
  const [d, setD] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [cfg, setCfg] = useState(null);
  const [tab, setTab] = useState(null);
  const [verUsuarioId, setVerUsuarioId] = useState(''); // admin: '' = toda la empresa
  const [periodo, setPeriodo] = useState('');          // '' = mes en curso · 'todo' · 'YYYY-MM'
  const { roles, esAdmin, usuarioActualId } = useAuth();

  useEffect(() => {
    // Cada tabla por separado: si una falla (permisos, tabla nueva sin crear),
    // el resto del panel igual carga.
    const seguro = (tabla, filtros) => listar(tabla, filtros).catch((e) => {
      console.error(`Dashboard: no se pudo leer ${tabla}`, e); return [];
    });
    Promise.all([
      seguro('oportunidades'), seguro('clientes'), seguro('ventas'),
      seguro('tareas_postventa'), seguro('trabajos'), seguro('usuarios'),
      seguro('solicitudes_unificacion', { estado: 'Pendiente' }), seguro('tareas'),
    ]).then(([op, clientes, ventas, tpost, trabajos, us, unif, tareas]) => {
      setD({ op, clientes: clientes.filter((c) => c.activo !== false), ventas, tpost, trabajos, unif, tareas }); setUsuarios(us);
    });
    obtener('configuracion', 1).then(setCfg).catch(() => {});
  }, []);

  // Período elegido.
  const mesActual = mesDe(new Date());
  const mes = periodo === 'todo' ? null : (periodo || mesActual);
  const p = {
    mes,
    etiqueta: mes ? nombreMes(mes) : 'todo el historial',
    enP: (fecha) => !mes || (Boolean(fecha) && String(fecha).slice(0, 7) === mes),
  };

  // Usuario elegido (solo admin). Sin elegir, el admin ve toda la empresa.
  const verUsuario = esAdmin && verUsuarioId ? usuarios.find((u) => u.id === Number(verUsuarioId)) : null;
  const uid = esAdmin ? (verUsuario ? verUsuario.id : null) : usuarioActualId;
  const rr = verUsuario ? rolesDe(verUsuario) : (roles || []);

  const dashboards = [];
  if (esAdmin && !verUsuario) {
    dashboards.push({ id: 'admin', label: 'Administración' }, { id: 'vendedor', label: 'Comercial' },
      { id: 'tecnico', label: 'Técnico' }, { id: 'postventa', label: 'Postventa' });
  } else {
    if (rr.includes('Vendedor')) dashboards.push({ id: 'vendedor', label: 'Vendedor' });
    if (rr.includes('Vendedor tercerizado')) dashboards.push({ id: 'terc', label: 'Vendedor tercerizado' });
    if (rr.includes('Técnico')) dashboards.push({ id: 'tecnico', label: 'Técnico' });
    if (rr.includes('Postventa')) dashboards.push({ id: 'postventa', label: 'Postventa' });
  }
  const activo = dashboards.some((x) => x.id === tab) ? tab : dashboards[0]?.id;

  if (!d) return <div><PageHeader titulo="Dashboard" /><div className="vacio">Cargando…</div></div>;

  const yo = uid !== null && uid === usuarioActualId;
  function panel() {
    switch (activo) {
      case 'admin': return <AdminDash d={d} usuarios={usuarios} p={p} />;
      case 'vendedor': return <VendedorDash d={d} uid={uid} yo={yo} cfg={cfg} p={p} />;
      case 'terc': return <VendedorDash d={d} uid={uid} yo={yo} cfg={cfg} p={p} tercerizado />;
      case 'tecnico': return <TecnicoDash d={d} uid={uid} usuarios={usuarios} p={p} />;
      case 'postventa': return <PostventaDash d={d} uid={uid} p={p} />;
      default: return <div className="vacio">Este usuario no tiene un panel de Vendedor, Técnico ni Postventa.</div>;
    }
  }

  // Usuarios con algún panel propio (los que tienen sentido ver aislados).
  const usuariosConPanel = usuarios
    .filter((u) => rolesDe(u).some((r) => ['Vendedor', 'Vendedor tercerizado', 'Técnico', 'Postventa'].includes(r)))
    .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));

  return (
    <div>
      <PageHeader titulo="Dashboard" sub="Indicadores y alertas de tu operación. Tocá un indicador para ir al detalle." />

      <div className="card card-pad" style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {esAdmin && (
          <div className="field" style={{ margin: 0, flex: '1 1 220px' }}>
            <label>Usuario</label>
            <select value={verUsuarioId} onChange={(e) => { setVerUsuarioId(e.target.value); setTab(null); }}>
              <option value="">Todos · toda la empresa</option>
              {usuariosConPanel.map((u) => (
                <option key={u.id} value={u.id}>{u.nombre} · {rolesDe(u).filter((r) => r !== 'Administrador').join(', ')}{u.acceso && u.acceso !== 'Activo' ? ' (inactivo)' : ''}</option>
              ))}
            </select>
          </div>
        )}
        <div className="field" style={{ margin: 0, flex: '1 1 200px' }}>
          <label>Período</label>
          <select value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
            <option value="">Mes en curso · {nombreMes(mesActual)}</option>
            {mesesRecientes().slice(1).map((m) => <option key={m} value={m}>{nombreMes(m)}</option>)}
            <option value="todo">Todo el historial</option>
          </select>
        </div>
        {(verUsuarioId || periodo) && (
          <button className="btn ghost sm" onClick={() => { setVerUsuarioId(''); setPeriodo(''); setTab(null); }}>Limpiar filtros</button>
        )}
      </div>

      {verUsuario && (
        <div className="aviso" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="grow">Estás viendo solo lo de <b>{verUsuario.nombre}</b>, tal como lo ve esa persona.</span>
        </div>
      )}
      {dashboards.length > 1 && (
        <div className="tabs-row" style={{ marginBottom: 6 }}>
          {dashboards.map((x) => (
            <button key={x.id} className={'tab' + (activo === x.id ? ' on' : '')} onClick={() => setTab(x.id)}>{x.label}</button>
          ))}
        </div>
      )}
      {panel()}
    </div>
  );
}
