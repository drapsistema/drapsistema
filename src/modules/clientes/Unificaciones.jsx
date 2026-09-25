import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { listar, actualizar, unificarClientes } from '../../lib/db';
import { PageHeader, BackButton, Empty, nombreCliente, fmtFecha } from '../../shared/ui.jsx';
import { useToast } from '../../shared/Toast.jsx';
import { useAuth } from '../../shared/Auth.jsx';
import Icon from '../../shared/Icon.jsx';

const activo = (c) => c && c.activo !== false && !c.unificado_en;

// ============================================================
// LISTA DE SOLICITUDES
// El admin ve todas las pendientes; cada usuario ve las que pidió.
// ============================================================
export default function Unificaciones() {
  const navigate = useNavigate();
  const { esAdmin } = useAuth();
  const [solicitudes, setSolicitudes] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [usuarios, setUsuarios] = useState([]);

  useEffect(() => {
    Promise.all([listar('solicitudes_unificacion'), listar('clientes'), listar('usuarios')])
      .then(([ss, cs, us]) => {
        setSolicitudes(ss.sort((a, b) => (b.creado_en || '').localeCompare(a.creado_en || '')));
        setClientes(cs); setUsuarios(us);
      })
      .catch((e) => { console.error('Error al listar solicitudes:', e); setSolicitudes([]); });
  }, []);

  const cli = (id) => clientes.find((c) => c.id === id);
  const nombre = (id) => (cli(id) ? nombreCliente(cli(id)) : `Cliente #${id}`);
  const usuario = (id) => usuarios.find((u) => u.id === id)?.nombre || '—';

  const pendientes = (solicitudes || []).filter((s) => s.estado === 'Pendiente');
  const cerradas = (solicitudes || []).filter((s) => s.estado !== 'Pendiente').slice(0, 20);

  return (
    <div>
      <PageHeader titulo="Unificación de clientes"
        sub={esAdmin ? 'Clientes cargados dos veces que hay que juntar en uno solo' : 'Tus solicitudes de unificación'}>
        <BackButton to="/clientes" />
      </PageHeader>

      {solicitudes === null ? <Empty>Cargando…</Empty> : (
        <>
          <div className="card table-wrap" style={{ marginBottom: 16 }}>
            <div className="card-h">Pendientes ({pendientes.length})</div>
            {pendientes.length === 0 ? <Empty>No hay solicitudes pendientes.</Empty> : (
              <table>
                <thead><tr><th>Duplicado</th><th>Se une en</th><th>Pedida por</th><th>Fecha</th><th /></tr></thead>
                <tbody>
                  {pendientes.map((s) => (
                    <tr key={s.id}>
                      <td className="strong">{nombre(s.cliente_origen_id)}</td>
                      <td>{nombre(s.cliente_destino_id)}</td>
                      <td className="muted sm">{usuario(s.solicitado_por)}</td>
                      <td className="muted sm">{fmtFecha((s.creado_en || '').slice(0, 10))}</td>
                      <td>
                        {esAdmin && (
                          <button className="btn ghost sm" onClick={() =>
                            navigate(`/clientes/unificar?origen=${s.cliente_origen_id}&destino=${s.cliente_destino_id}&solicitud=${s.id}`)}>
                            Revisar →
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {cerradas.length > 0 && (
            <div className="card table-wrap">
              <div className="card-h">Últimas resueltas</div>
              <table>
                <thead><tr><th>Duplicado</th><th>Se une en</th><th>Estado</th><th>Resuelta</th></tr></thead>
                <tbody>
                  {cerradas.map((s) => (
                    <tr key={s.id}>
                      <td>{nombre(s.cliente_origen_id)}</td>
                      <td>{nombre(s.cliente_destino_id)}</td>
                      <td><span className={'badge ' + (s.estado === 'Resuelta' ? 'g' : '')}>{s.estado}</span></td>
                      <td className="muted sm">{s.resuelto_en ? fmtFecha(s.resuelto_en.slice(0, 10)) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================
// COMPARAR Y UNIFICAR (solo admin)
// /clientes/unificar?origen=X[&destino=Y][&solicitud=Z]
// ============================================================
export function UnificarClientes() {
  const navigate = useNavigate();
  const toast = useToast();
  const { esAdmin, usuarioActualId } = useAuth();
  const [params] = useSearchParams();
  const solicitudId = params.get('solicitud');
  const [origenId, setOrigenId] = useState(Number(params.get('origen')) || null);
  const [destinoId, setDestinoId] = useState(Number(params.get('destino')) || null);
  const [clientes, setClientes] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [rel, setRel] = useState({}); // { [clienteId]: { contactos, oportunidades, ventas, trabajos } }
  const [trabajando, setTrabajando] = useState(false);

  useEffect(() => {
    Promise.all([listar('clientes'), listar('usuarios')])
      .then(([cs, us]) => { setClientes(cs); setUsuarios(us); })
      .catch(() => setClientes([]));
  }, []);

  useEffect(() => {
    [origenId, destinoId].filter(Boolean).forEach(async (cid) => {
      const [contactos, oportunidades, ventas, trabajos] = await Promise.all(
        ['contactos', 'oportunidades', 'ventas', 'trabajos'].map((t) => listar(t, { cliente_id: cid }).catch(() => [])));
      setRel((r) => ({ ...r, [cid]: { contactos, oportunidades, ventas, trabajos } }));
    });
  }, [origenId, destinoId]);

  if (!esAdmin) return <Empty>Solo un administrador puede unificar clientes.</Empty>;
  if (!clientes) return <Empty>Cargando…</Empty>;

  const origen = clientes.find((c) => c.id === origenId);
  const destino = clientes.find((c) => c.id === destinoId);
  const candidatos = clientes.filter((c) => activo(c) && c.id !== origenId)
    .sort((a, b) => nombreCliente(a).localeCompare(nombreCliente(b)));
  const vendedor = (id) => usuarios.find((u) => u.id === id)?.nombre || '—';

  // Oportunidades abiertas de vendedores distintos en ambos clientes:
  // el admin decide si reasigna alguna después de unificar.
  const abiertas = (cid) => (rel[cid]?.oportunidades || []).filter((o) => !o.resultado);
  const vendO = new Set(abiertas(origenId).map((o) => o.vendedor_id));
  const conflicto = abiertas(destinoId).some((o) => vendO.size && !vendO.has(o.vendedor_id));

  const ambosConCuit = origen?.cuit && destino?.cuit;
  const yaUnificado = origen && !activo(origen);
  const puedeUnificar = origen && destino && !ambosConCuit && !yaUnificado && activo(destino) && !trabajando;

  async function unificar() {
    const ok = window.confirm(
      `Se va a unificar "${nombreCliente(origen)}" en "${nombreCliente(destino)}".\n\n`
      + 'Todo pasa al cliente que queda y el duplicado se desactiva. Esta acción no se puede deshacer. ¿Continuar?');
    if (!ok) return;
    setTrabajando(true);
    try {
      const r = await unificarClientes(origen.id, destino.id);
      toast(`Clientes unificados · ${r.oportunidades || 0} oportunidades, ${r.ventas || 0} ventas movidas`);
      navigate(`/clientes/${destino.id}`);
    } catch (e) {
      console.error('Error al unificar:', e);
      toast(e.message || 'No se pudo unificar', 'err');
      setTrabajando(false);
    }
  }

  async function descartar() {
    setTrabajando(true);
    try {
      await actualizar('solicitudes_unificacion', solicitudId, {
        estado: 'Descartada', resuelto_por: usuarioActualId, resuelto_en: new Date().toISOString(),
      });
      toast('Solicitud descartada');
      navigate('/clientes/unificaciones');
    } catch (e) {
      console.error('Error al descartar:', e);
      toast('No se pudo descartar la solicitud', 'err');
      setTrabajando(false);
    }
  }

  const invertir = () => { setOrigenId(destinoId); setDestinoId(origenId); };

  return (
    <div>
      <PageHeader titulo="Unificar clientes" sub="Todo lo del duplicado pasa al cliente que queda">
        <BackButton to={solicitudId ? '/clientes/unificaciones' : (origenId ? `/clientes/${origenId}` : '/clientes')} />
      </PageHeader>

      {yaUnificado && <div className="aviso bad">Este cliente ya fue unificado en otro.</div>}
      {ambosConCuit && <div className="aviso bad">Los dos clientes tienen CUIT distinto: no parecen ser el mismo cliente.</div>}
      {conflicto && (
        <div className="aviso warn">
          Los dos clientes tienen oportunidades abiertas con vendedores distintos. Después de unificar, revisá si hay que reasignar alguna.
        </div>
      )}

      <div className="two">
        <Lado titulo="Duplicado (se desactiva)" cliente={origen} rel={rel[origenId]} vendedor={vendedor} />
        <div>
          {!destinoId || !destino ? (
            <div className="card card-pad">
              <div className="field" style={{ margin: 0 }}>
                <label>¿En qué cliente se unifica?</label>
                <select value="" onChange={(e) => setDestinoId(Number(e.target.value))}>
                  <option value="">Elegí el cliente que queda…</option>
                  {candidatos.map((c) => (
                    <option key={c.id} value={c.id}>{nombreCliente(c)}{c.cuit ? ` · ${c.cuit}` : ''}</option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <Lado titulo="Queda (recibe todo)" cliente={destino} rel={rel[destinoId]} vendedor={vendedor} destacado />
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
        <button className="btn" onClick={unificar} disabled={!puedeUnificar}>
          <Icon name="check" size={16} /> {trabajando ? 'Unificando…' : 'Unificar'}
        </button>
        {origen && destino && (
          <button className="btn ghost" onClick={invertir} disabled={trabajando}>⇄ Invertir cuál queda</button>
        )}
        {destino && !solicitudId && (
          <button className="btn ghost" onClick={() => setDestinoId(null)} disabled={trabajando}>Elegir otro cliente</button>
        )}
        {solicitudId && (
          <button className="btn ghost" onClick={descartar} disabled={trabajando}>No son el mismo · descartar</button>
        )}
      </div>
    </div>
  );
}

function Lado({ titulo, cliente, rel, vendedor, destacado }) {
  if (!cliente) return <div className="card card-pad"><Empty>Cliente no encontrado.</Empty></div>;
  const fila = (k, v) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderBottom: '1px solid var(--line-2)' }}>
      <span className="muted sm">{k}</span><span style={{ textAlign: 'right' }}>{v || '—'}</span>
    </div>
  );
  const abiertas = (rel?.oportunidades || []).filter((o) => !o.resultado);
  return (
    <div className="card" style={destacado ? { outline: '2px solid var(--green)' } : undefined}>
      <div className="card-h">{titulo}</div>
      <div className="card-pad">
        <div className="strong" style={{ marginBottom: 6 }}>{nombreCliente(cliente)}</div>
        {fila('Tipo', cliente.tipo)}
        {fila('CUIT', cliente.cuit)}
        {fila('Domicilio', cliente.domicilio)}
        {fila('Teléfono', cliente.telefono)}
        {fila('Mail', cliente.mail)}
        {fila('Cargado por', vendedor(cliente.creado_por))}
        {rel ? (
          <>
            {fila('Contactos', String(rel.contactos.length))}
            {fila('Oportunidades', `${rel.oportunidades.length}${abiertas.length ? ` (${abiertas.length} abiertas: ${[...new Set(abiertas.map((o) => vendedor(o.vendedor_id)))].join(', ')})` : ''}`)}
            {fila('Ventas', String(rel.ventas.length))}
            {fila('Trabajos de service', String(rel.trabajos.length))}
          </>
        ) : <div className="muted sm" style={{ marginTop: 6 }}>Cargando relaciones…</div>}
      </div>
    </div>
  );
}
