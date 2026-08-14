import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { obtener, listar, crear, actualizar } from '../../lib/db';
import { PageHeader, BackButton, Empty, nombreCliente, fmtFecha, diasDesde, hoyISO } from '../../shared/ui.jsx';
import Comentarios, { comentarSistema } from '../../shared/Comentarios.jsx';
import { useToast } from '../../shared/Toast.jsx';
import Icon from '../../shared/Icon.jsx';

const ETAPAS = ['Contacto inicial', 'Cotización', 'Seguimiento', 'Cierre'];

export default function OportunidadDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [op, setOp] = useState(null);
  const [cliente, setCliente] = useState(null);
  const [cotizaciones, setCotizaciones] = useState([]);
  const [seguimientos, setSeguimientos] = useState([]);
  const [venta, setVenta] = useState(null);

  useEffect(() => { cargar(); }, [id]);

  async function cargar() {
    const o = await obtener('oportunidades', id);
    setOp(o);
    if (o) {
      setCliente(await obtener('clientes', o.cliente_id));
      setCotizaciones((await listar('cotizaciones', { oportunidad_id: Number(id) }))
        .sort((a, b) => b.version - a.version));
      setSeguimientos((await listar('seguimientos', { oportunidad_id: Number(id) }))
        .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')));
      const vs = await listar('ventas', { oportunidad_id: Number(id) });
      setVenta(vs[0] || null);
    }
  }

  if (!op) return <Empty>Cargando…</Empty>;

  const cerrada = Boolean(op.resultado);
  const idxEtapa = ETAPAS.indexOf(op.etapa);

  async function subirCotizacion() {
    const version = cotizaciones.length + 1;
    await crear('cotizaciones', {
      oportunidad_id: Number(id), version, pdf: `cotizacion_v${version}.pdf`, fecha_envio: hoyISO(),
    });
    // Automatización: al subir la primera cotización, avanza a etapa Cotización.
    if (op.etapa === 'Contacto inicial') {
      await actualizar('oportunidades', id, { etapa: 'Cotización' });
    }
    toast('Cotización cargada');
    cargar();
  }

  async function registrarSeguimiento() {
    await crear('seguimientos', {
      oportunidad_id: Number(id), tipo: 'Llamada', fecha: hoyISO(),
      observaciones: 'Seguimiento registrado.', proximo_contacto: '',
    });
    if (op.etapa === 'Cotización') {
      await actualizar('oportunidades', id, { etapa: 'Seguimiento' });
    }
    toast('Seguimiento registrado');
    cargar();
  }

  async function ganar() {
    if (cotizaciones.length === 0) { toast('No podés ganar sin al menos una cotización', 'err'); return; }
    await actualizar('oportunidades', id, { resultado: 'Ganada', etapa: 'Cierre' });
    const nueva = await crear('ventas', {
      oportunidad_id: Number(id), cliente_id: op.cliente_id, vendedor_id: op.vendedor_id,
      fecha_ganada: hoyISO(), direccion_entrega: '', fecha_entrega: '', observaciones: '',
      cobrado: false, registrado: false, comision: 0, estado: 'Ganada', motivo_cancel: '', fecha_cancel: '',
    });
    await comentarSistema('op', id, 'Oportunidad ganada. Se creó la venta enlazada.');
    toast('Oportunidad ganada · venta creada');
    navigate(`/ventas/${nueva.id}`);
  }

  return (
    <div>
      <PageHeader titulo={`Oportunidad #${op.id} · ${nombreCliente(cliente)}`}
        sub={`Etapa: ${op.etapa} · primer contacto ${fmtFecha(op.fecha_contacto)}`}>
        <BackButton to="/comercial" />
        {!cerrada && <button className="btn" onClick={ganar}><Icon name="check" size={15} /> Marcar ganada</button>}
        {op.resultado === 'Ganada' && venta &&
          <button className="btn ghost" onClick={() => navigate(`/ventas/${venta.id}`)}>Ver venta</button>}
      </PageHeader>

      <div className="stepbar">
        {ETAPAS.map((e, i) => (
          <div key={e} className={'step' + (i < idxEtapa ? ' done' : i === idxEtapa ? ' cur' : '')}>{e}</div>
        ))}
      </div>

      {cerrada && (
        <div className={'aviso ' + (op.resultado === 'Ganada' ? 'ok' : 'bad')}>
          Oportunidad cerrada como <b style={{ margin: '0 4px' }}>{op.resultado}</b>
          {op.motivo && ` · motivo: ${op.motivo}`}
        </div>
      )}

      <div className="two" style={{ marginTop: 16 }}>
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-h">
              <span className="grow">Cotizaciones ({cotizaciones.length})</span>
              {!cerrada && <button className="btn ghost sm" onClick={subirCotizacion}>+ Subir PDF</button>}
            </div>
            <div className="table-wrap">
              {cotizaciones.length === 0 ? <Empty>Sin cotizaciones.</Empty> : (
                <table>
                  <thead><tr><th>Versión</th><th>Archivo</th><th>Envío</th><th>Días</th></tr></thead>
                  <tbody>
                    {cotizaciones.map((c) => (
                      <tr key={c.id}>
                        <td className="strong">v{c.version}</td>
                        <td><span className="badge b">{c.pdf}</span></td>
                        <td>{fmtFecha(c.fecha_envio)}</td>
                        <td>{diasDesde(c.fecha_envio)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <span className="grow">Seguimientos ({seguimientos.length})</span>
              {!cerrada && <button className="btn ghost sm" onClick={registrarSeguimiento}>+ Registrar</button>}
            </div>
            <div className="card-pad">
              {seguimientos.length === 0 ? <div className="muted sm">Sin seguimientos.</div> :
                seguimientos.map((s) => (
                  <div key={s.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--line-2)' }}>
                    <div className="strong sm">{fmtFecha(s.fecha)} · {s.tipo}</div>
                    <div className="muted sm">{s.observaciones}</div>
                  </div>
                ))}
            </div>
          </div>

          <Comentarios entidad="op" refId={op.id} />
        </div>

        <div>
          <div className="card">
            <div className="card-h">Resumen</div>
            <div className="card-pad">
              <InfoRow k="Cliente" v={nombreCliente(cliente)} />
              <InfoRow k="Etapa" v={op.etapa} />
              <InfoRow k="Primer contacto" v={fmtFecha(op.fecha_contacto)} />
              <InfoRow k="Relevamiento" v={op.relevamiento} />
              {venta && <InfoRow k="Venta" v={<a onClick={() => navigate(`/ventas/${venta.id}`)}>VT-{String(venta.id).padStart(4, '0')} →</a>} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ k, v }) {
  return <div className="inforow"><span className="k">{k}</span><span className="v">{v}</span></div>;
}
