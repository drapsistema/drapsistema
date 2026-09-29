import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { obtener, listar } from '../../lib/db';
import { PageHeader, BackButton, Empty, fmtFecha } from '../../shared/ui.jsx';
import { useToast } from '../../shared/Toast.jsx';
import Icon from '../../shared/Icon.jsx';
import { conMoneda, formatoNumero, precioEnMoneda, totales, nombreVersion, MONEDAS } from './calculo.js';
import { descargarPdfPresupuesto } from './pdf.js';

// Detalle de un presupuesto (una versión). No se edita: los cambios se
// hacen con "Nueva versión", que deja la anterior intacta.
export default function PresupuestoVer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [p, setP] = useState(null);
  const [items, setItems] = useState([]);
  const [versiones, setVersiones] = useState([]);
  const [descargando, setDescargando] = useState(false);

  useEffect(() => {
    (async () => {
      const pr = await obtener('presupuestos', id);
      setP(pr);
      if (!pr) return;
      setItems((await listar('presupuesto_items', { presupuesto_id: pr.id })).sort((a, b) => a.orden - b.orden));
      setVersiones((await listar('presupuestos', { numero: pr.numero })).sort((a, b) => b.version - a.version));
    })();
  }, [id]);

  if (!p) return <Empty>Cargando…</Empty>;

  const t = totales(p, items);
  const ultima = versiones[0];
  const esUltima = !ultima || ultima.id === p.id;
  const cli = p.cliente_datos || {};
  const ven = p.vendedor_datos || {};
  const volver = p.oportunidad_id ? `/comercial/${p.oportunidad_id}` : `/service/${p.trabajo_id}`;

  async function descargar() {
    setDescargando(true);
    try { await descargarPdfPresupuesto(p, items); }
    catch (e) { console.error(e); toast('No se pudo generar el PDF', 'err'); }
    finally { setDescargando(false); }
  }

  return (
    <div>
      <PageHeader titulo={`Presupuesto ${nombreVersion(p)}`} sub={`${cli.nombre || ''} · ${fmtFecha(p.fecha)}`}>
        <BackButton to={volver} />
        <button className="btn ghost" onClick={() => navigate(`/presupuestos/nuevo?base=${p.id}`)}>Nueva versión</button>
        <button className="btn" onClick={descargar} disabled={descargando}>
          <Icon name="check" size={15} /> {descargando ? 'Generando…' : 'Descargar PDF'}
        </button>
      </PageHeader>

      {!esUltima && (
        <div className="aviso warn" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="grow">Esta no es la última versión: la vigente es <b>{nombreVersion(ultima)}</b>.</span>
          <button className="btn ghost sm" onClick={() => navigate(`/presupuestos/${ultima.id}`)}>Ver v{ultima.version} →</button>
        </div>
      )}

      <div className="pres-grid">
        <div>
          <div className="card table-wrap" style={{ marginBottom: 16 }}>
            <div className="card-h">Detalle</div>
            <table>
              <thead>
                <tr><th>Descripción</th><th style={{ textAlign: 'right' }}>Cant.</th><th style={{ textAlign: 'right' }}>P. unit. {MONEDAS[p.moneda]}</th><th style={{ textAlign: 'right' }}>Subtotal</th></tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const unit = precioEnMoneda(p, it.precio_unit);
                  return (
                    <tr key={it.id}>
                      <td>
                        <div className="strong sm">{it.descripcion}</div>
                        <div className="muted" style={{ fontSize: 11 }}>
                          {[it.sku, it.codigo].filter(Boolean).join(' · ') || 'Ítem manual'}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>{Number(it.cantidad)}</td>
                      <td style={{ textAlign: 'right' }}>{formatoNumero(unit)}</td>
                      <td style={{ textAlign: 'right' }} className="strong">{formatoNumero(unit * Number(it.cantidad))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="card-pad">
              <div className="pres-totales" style={{ maxWidth: 320, marginLeft: 'auto' }}>
                <span>Subtotal</span><span>{conMoneda(p.moneda, t.subtotal)}</span>
                {t.descuento > 0 && <><span>Descuento</span><span>- {conMoneda(p.moneda, t.descuento)}</span></>}
                <b>Total sin IVA</b><b>{conMoneda(p.moneda, t.total)}</b>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-h">Condiciones</div>
            <div className="card-pad pres-datos">
              <span className="muted sm">Tipo</span><span>{p.tipo || '—'}</span>
              <span className="muted sm">Pago</span><span>{p.condicion_pago || '—'}</span>
              <span className="muted sm">Validez</span><span>{p.validez || '—'}</span>
              <span className="muted sm">Moneda</span>
              <span>{p.moneda === 'ARS' ? `Pesos · cotización U$S 1 = $ ${formatoNumero(p.cotizacion)}` : 'Dólares'}</span>
              {p.notas && <><span className="muted sm">Notas</span><span style={{ whiteSpace: 'pre-wrap' }}>{p.notas}</span></>}
            </div>
          </div>
        </div>

        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-h">Cliente</div>
            <div className="card-pad pres-datos">
              <span className="muted sm">Razón social</span><b>{cli.nombre || '—'}</b>
              <span className="muted sm">CUIT</span><span>{cli.cuit || '—'}</span>
              <span className="muted sm">Domicilio</span><span>{cli.domicilio || '—'}</span>
              <span className="muted sm">Teléfono</span><span>{cli.telefono || '—'}</span>
            </div>
          </div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-h">Emitido por</div>
            <div className="card-pad pres-datos">
              <span className="muted sm">Nombre</span><b>{ven.nombre || '—'}</b>
              <span className="muted sm">Cargo</span><span>{ven.cargo || '—'}</span>
              <span className="muted sm">Teléfono</span><span>{ven.telefono || '—'}</span>
              <span className="muted sm">WhatsApp</span><span>{ven.whatsapp || '—'}</span>
            </div>
          </div>
          <div className="card">
            <div className="card-h">Versiones ({versiones.length})</div>
            <div className="card-pad">
              {versiones.map((v) => (
                <div key={v.id} onClick={() => v.id !== p.id && navigate(`/presupuestos/${v.id}`)}
                  style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--line-2)', cursor: v.id === p.id ? 'default' : 'pointer' }}>
                  <span className={'badge ' + (v.id === p.id ? 'b' : '')}>v{v.version}</span>
                  <span className="grow sm">{fmtFecha(v.fecha)}</span>
                  <span className="sm strong">{conMoneda(v.moneda, v.total)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
