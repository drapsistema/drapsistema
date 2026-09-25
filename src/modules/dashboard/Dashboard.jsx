import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listar, obtener } from '../../lib/db';
import { PageHeader, money, diasDesde } from '../../shared/ui.jsx';
import { useAuth } from '../../shared/Auth.jsx';
import { rolesDe } from '../../shared/permisos';

const ETAPAS_C = ['Contacto inicial', 'Cotización', 'Seguimiento', 'Cierre'];
const ESTADOS_S = ['Ingresada', 'En diagnóstico', 'En reparación', 'Esperando repuestos', 'Finalizada', 'Entregada'];

// Parseo de fecha local (evita el corrimiento por zona horaria en agrupar por mes).
const D = (iso) => (iso ? new Date(iso + 'T00:00:00') : null);
const mesActual = (iso) => {
  const d = D(iso); if (!d) return false;
  const n = new Date();
  return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
};
function ventasPorMes(ventas, n = 6) {
  const now = new Date(); const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = dt.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '');
    const value = ventas.filter((v) => { const f = D(v.fecha_ganada); return f && f.getMonth() === dt.getMonth() && f.getFullYear() === dt.getFullYear(); }).length;
    out.push({ label, value });
  }
  return out;
}

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
      <div className="card-h"><span className="grow">Alertas</span>{activos.length > 0 && <span className="badge r">{activos.length}</span>}</div>
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
// PANELES POR ROL
// ============================================================
function AdminDash({ d, usuarios }) {
  const abiertas = d.op.filter((o) => !o.resultado);
  const vigentes = d.ventas.filter((v) => v.estado !== 'Cancelada');
  const trabajosAbiertos = d.trabajos.filter((t) => t.estado !== 'Entregada' && t.estado !== 'Finalizada');
  const porCobrar = vigentes.filter((v) => v.fecha_entrega && !v.cobrado);
  const postPend = d.tpost.filter((t) => t.estado === 'Pendiente');
  const postVenc = postPend.filter((t) => diasDesde(t.objetivo) > 0);
  const esperandoRep = d.trabajos.filter((t) => t.estado === 'Esperando repuestos');
  const visitas = d.tpost.filter((t) => t.visita_estado === 'Solicitada' || t.visita_estado === 'Agendada');
  const tercIds = new Set(usuarios.filter((u) => rolesDe(u).includes('Vendedor tercerizado')).map((u) => u.id));
  const comSinDef = vigentes.filter((v) => tercIds.has(v.vendedor_id) && !v.comision);

  const pipeline = ETAPAS_C.map((e) => ({ label: e, value: abiertas.filter((o) => o.etapa === e).length }));
  const porVendedor = usuarios.filter((u) => rolesDe(u).some((r) => r.indexOf('Vendedor') === 0))
    .map((u) => ({ label: u.nombre, value: vigentes.filter((v) => v.vendedor_id === u.id).length }))
    .filter((x) => x.value > 0).sort((a, b) => b.value - a.value).slice(0, 6);

  return (
    <>
      <div className="kpi-grid">
        <Kpi label="Clientes" value={d.clientes.length} foot="registrados" to="/clientes" />
        <Kpi label="Oportunidades abiertas" value={abiertas.length} foot="en gestión" to="/comercial" />
        <Kpi label="Ventas vigentes" value={vigentes.length} foot="no canceladas" to="/ventas" />
        <Kpi label="Service en taller" value={trabajosAbiertos.length} foot="trabajos abiertos" to="/service" />
      </div>
      <div className="two" style={{ marginTop: 18 }}>
        <ChartCard titulo="Pipeline comercial (abiertas)"><BarsH data={pipeline} /></ChartCard>
        <ChartCard titulo="Ventas por mes"><BarsV data={ventasPorMes(vigentes)} /></ChartCard>
      </div>
      <div className="two" style={{ marginTop: 18 }}>
        <ChartCard titulo="Ventas por vendedor"><BarsH data={porVendedor} /></ChartCard>
        <Alertas items={[
          { texto: 'Ventas entregadas sin cobrar', n: porCobrar.length, cl: 'a', to: '/ventas' },
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

function VendedorDash({ d, uid, cfg, tercerizado }) {
  const misOp = d.op.filter((o) => o.vendedor_id === uid);
  const abiertas = misOp.filter((o) => !o.resultado);
  const ganadas = misOp.filter((o) => o.resultado === 'Ganada');
  const perdidas = misOp.filter((o) => o.resultado === 'Perdida');
  const misVentas = d.ventas.filter((v) => v.vendedor_id === uid && v.estado !== 'Cancelada');
  const ganadasMes = misVentas.filter((v) => mesActual(v.fecha_ganada));
  const porCobrar = misVentas.filter((v) => v.fecha_entrega && !v.cobrado);
  const sinEntregar = misVentas.filter((v) => !v.fecha_entrega);
  const conv = (ganadas.length + perdidas.length) ? Math.round((ganadas.length / (ganadas.length + perdidas.length)) * 100) : 0;
  const umbral = cfg?.sem_com_amarillo ?? 15;
  const frias = abiertas.filter((o) => diasDesde(o.fecha_contacto) > umbral);
  const enCoti = abiertas.filter((o) => o.etapa === 'Cotización');
  const comisiones = misVentas.reduce((a, v) => a + (v.comision || 0), 0);
  const sinComision = misVentas.filter((v) => !v.comision);

  const pipeline = ETAPAS_C.map((e) => ({ label: e, value: abiertas.filter((o) => o.etapa === e).length }));

  const alertas = [
    { texto: 'Oportunidades frías (sin contacto)', n: frias.length, cl: 'r', to: '/comercial' },
    { texto: 'En cotización (esperando respuesta)', n: enCoti.length, cl: 'a', to: '/comercial' },
    { texto: 'Mis ventas sin entregar', n: sinEntregar.length, cl: 'a', to: '/ventas' },
  ];
  if (tercerizado) alertas.unshift({ texto: 'Ventas sin comisión definida', n: sinComision.length, cl: 'a', to: '/ventas' });

  return (
    <>
      <div className="kpi-grid">
        <Kpi label="Mis oportunidades abiertas" value={abiertas.length} foot="en gestión" to="/comercial" />
        <Kpi label="Ganadas este mes" value={ganadasMes.length} foot="nuevas ventas" cl="g" to="/ventas" />
        <Kpi label="Mis ventas por cobrar" value={porCobrar.length} foot="entregadas sin cobrar" cl="a" to="/ventas" />
        {tercerizado
          ? <Kpi label="Comisiones" value={money(comisiones)} foot="definidas" to="/ventas" />
          : <Kpi label="Conversión" value={conv + '%'} foot="ganadas / cerradas" to="/comercial" />}
      </div>
      <div className="two" style={{ marginTop: 18 }}>
        <ChartCard titulo="Mi pipeline (abiertas)"><BarsH data={pipeline} /></ChartCard>
        <ChartCard titulo="Mis ventas por mes"><BarsV data={ventasPorMes(misVentas)} /></ChartCard>
      </div>
      <div className="two" style={{ marginTop: 18 }}>
        <Alertas items={alertas} />
        <ChartCard titulo="Resultado de mis oportunidades">
          <BarsH data={[
            { label: 'Ganadas', value: ganadas.length, color: 'var(--green)' },
            { label: 'Perdidas', value: perdidas.length, color: 'var(--red)' },
            { label: 'Abiertas', value: abiertas.length, color: 'var(--brand)' },
          ]} />
        </ChartCard>
      </div>
    </>
  );
}

function TecnicoDash({ d, uid }) {
  // "Míos" = asignado como técnico del trabajo, o con alguna tarea a su nombre
  // (trabajos anteriores al campo tecnico_id se asignaban solo por tarea).
  const conTareaMia = new Set(d.tareas.filter((ta) => ta.tecnico_id === uid).map((ta) => ta.trabajo_id));
  const mis = d.trabajos.filter((t) => t.tecnico_id === uid || conTareaMia.has(t.id));
  const activos = mis.filter((t) => t.estado !== 'Entregada' && t.estado !== 'Finalizada');
  const diag = mis.filter((t) => t.estado === 'En diagnóstico');
  const rep = mis.filter((t) => t.estado === 'En reparación');
  const finMes = mis.filter((t) => (t.estado === 'Finalizada' || t.estado === 'Entregada') && mesActual(t.egreso));
  const porEstado = ESTADOS_S.map((e) => ({ label: e, value: mis.filter((t) => t.estado === e).length }));
  const espera = mis.filter((t) => t.estado === 'Esperando repuestos');
  const esperaMucho = espera.filter((t) => diasDesde(t.espera_desde) > 7);
  const sinDiag = mis.filter((t) => t.estado === 'En diagnóstico' && !t.diagnostico);
  const sinAsignar = d.trabajos.filter((t) => t.estado === 'Ingresada' && !t.tecnico_id);

  return (
    <>
      <div className="kpi-grid">
        <Kpi label="Mis trabajos activos" value={activos.length} foot="en el taller" to="/service" />
        <Kpi label="En diagnóstico" value={diag.length} foot="míos" to="/service" />
        <Kpi label="En reparación" value={rep.length} foot="míos" to="/service" />
        <Kpi label="Finalizados este mes" value={finMes.length} foot="terminados" cl="g" to="/service" />
      </div>
      <div className="two" style={{ marginTop: 18 }}>
        <ChartCard titulo="Mis trabajos por estado"><BarsH data={porEstado} /></ChartCard>
        <Alertas items={[
          { texto: 'Esperando repuestos hace +7 días', n: esperaMucho.length, cl: 'r', to: '/service' },
          { texto: 'En diagnóstico sin diagnóstico cargado', n: sinDiag.length, cl: 'a', to: '/service' },
          { texto: 'Ingresados sin técnico asignado', n: sinAsignar.length, cl: 'a', to: '/service' },
        ]} />
      </div>
    </>
  );
}

// Las tareas pendientes son una cola compartida del equipo de postventa;
// con `uid`, lo realizado se cuenta solo para ese usuario.
function PostventaDash({ d, uid }) {
  const pend = d.tpost.filter((t) => t.estado === 'Pendiente');
  const venc = pend.filter((t) => diasDesde(t.objetivo) > 0);
  const prox = pend.filter((t) => { const dd = diasDesde(t.objetivo); return dd <= 0 && dd >= -7; });
  const realMes = d.tpost.filter((t) => t.estado === 'Realizada' && mesActual(t.fecha_real)
    && (!uid || t.responsable_id === uid));
  const visitas = d.tpost.filter((t) => t.visita_estado === 'Solicitada' || t.visita_estado === 'Agendada');
  const porHito = ['1 semana', '1 mes', '2 meses'].map((h) => ({ label: h, value: pend.filter((t) => t.hito === h).length }));

  return (
    <>
      <div className="kpi-grid">
        <Kpi label="Tareas pendientes" value={pend.length} foot="por hacer" to="/postventa" />
        <Kpi label="Vencidas" value={venc.length} foot="pasaron el objetivo" cl="r" to="/postventa" />
        <Kpi label="Próximas a vencer" value={prox.length} foot="dentro de 7 días" cl="a" to="/postventa" />
        <Kpi label="Realizadas este mes" value={realMes.length} foot={uid ? 'contactos hechos por el usuario' : 'contactos hechos'} cl="g" to="/postventa" />
      </div>
      <div className="two" style={{ marginTop: 18 }}>
        <ChartCard titulo="Pendientes por hito"><BarsH data={porHito} /></ChartCard>
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
  const [verUsuarioId, setVerUsuarioId] = useState(''); // admin: ver el panel de otro usuario
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

  const verUsuario = esAdmin && verUsuarioId ? usuarios.find((u) => u.id === Number(verUsuarioId)) : null;
  const uid = verUsuario ? verUsuario.id : usuarioActualId;
  const rr = verUsuario ? rolesDe(verUsuario) : (roles || []);
  const dashboards = [];
  if (esAdmin && !verUsuario) dashboards.push({ id: 'admin', label: 'Administración' });
  if (rr.includes('Vendedor')) dashboards.push({ id: 'vendedor', label: 'Vendedor' });
  if (rr.includes('Vendedor tercerizado')) dashboards.push({ id: 'terc', label: 'Vendedor tercerizado' });
  if (rr.includes('Técnico')) dashboards.push({ id: 'tecnico', label: 'Técnico' });
  if (rr.includes('Postventa')) dashboards.push({ id: 'postventa', label: 'Postventa' });

  const activo = dashboards.some((x) => x.id === tab) ? tab : dashboards[0]?.id;

  if (!d) return <div><PageHeader titulo="Dashboard" /><div className="vacio">Cargando…</div></div>;

  function panel() {
    switch (activo) {
      case 'admin': return <AdminDash d={d} usuarios={usuarios} />;
      case 'vendedor': return <VendedorDash d={d} uid={uid} cfg={cfg} />;
      case 'terc': return <VendedorDash d={d} uid={uid} cfg={cfg} tercerizado />;
      case 'tecnico': return <TecnicoDash d={d} uid={uid} />;
      case 'postventa': return <PostventaDash d={d} uid={verUsuario ? uid : null} />;
      default: return <div className="vacio">Este usuario no tiene un panel de Vendedor, Técnico ni Postventa.</div>;
    }
  }

  // Usuarios con algún panel propio (los que tienen sentido ver aislados).
  const usuariosConPanel = usuarios
    .filter((u) => rolesDe(u).some((r) => ['Vendedor', 'Vendedor tercerizado', 'Técnico', 'Postventa'].includes(r)))
    .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));

  return (
    <div>
      <PageHeader titulo="Dashboard" sub="Indicadores y alertas de tu operación. Tocá un indicador para ir al detalle.">
        {esAdmin && (
          <div className="field" style={{ margin: 0, minWidth: 220 }}>
            <label>Ver situación de</label>
            <select value={verUsuarioId} onChange={(e) => { setVerUsuarioId(e.target.value); setTab(null); }}>
              <option value="">Todos (vista de administración)</option>
              {usuariosConPanel.map((u) => (
                <option key={u.id} value={u.id}>{u.nombre}{u.acceso && u.acceso !== 'Activo' ? ' (inactivo)' : ''}</option>
              ))}
            </select>
          </div>
        )}
      </PageHeader>
      {verUsuario && (
        <div className="aviso" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="grow">Estás viendo el panel de <b>{verUsuario.nombre}</b> ({rr.join(', ')}), tal como lo ve esa persona.</span>
          <button className="btn ghost sm" onClick={() => { setVerUsuarioId(''); setTab(null); }}>Volver a la vista general</button>
        </div>
      )}
      {dashboards.length > 1 && (
        <div className="tabs-row" style={{ marginBottom: 18 }}>
          {dashboards.map((x) => (
            <button key={x.id} className={'tab' + (activo === x.id ? ' on' : '')} onClick={() => setTab(x.id)}>{x.label}</button>
          ))}
        </div>
      )}
      {panel()}
    </div>
  );
}
