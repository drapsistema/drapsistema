import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { obtener, listar } from '../../lib/db';
import { PageHeader, BackButton, Empty, nombreCliente, fmtFecha, diasDesde } from '../../shared/ui.jsx';
import Comentarios from '../../shared/Comentarios.jsx';
import ModalCampos from '../../shared/ModalCampos.jsx';
import { useToast } from '../../shared/Toast.jsx';
import Icon from '../../shared/Icon.jsx';
import { ETAPAS, REQUISITOS, camposFaltantes, completarEtapa, avanzarEtapa, reabrirOportunidad } from './etapas.js';

export default function OportunidadDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [op, setOp] = useState(null);
  const [cliente, setCliente] = useState(null);
  const [cotizaciones, setCotizaciones] = useState([]);
  const [seguimientos, setSeguimientos] = useState([]);
  const [venta, setVenta] = useState(null);
  const [accion, setAccion] = useState(null); // 'coti' | 'seg' | 'cierre' | null

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
  const ctx = { cotizaciones, seguimientos };

  // Configuración de cada modal de acción. El cierre pide, además del
  // resultado, todo lo que falte para poder cerrar (misma lógica que
  // arrastrar la tarjeta hasta Cierre).
  const ACCIONES = {
    coti: {
      titulo: 'Agregar cotización',
      subtitulo: 'Registrá la cotización enviada al cliente.',
      campos: REQUISITOS['Cotización'].campos,
      textoConfirmar: 'Guardar cotización',
      run: (valores) => completarEtapa(op, 'Cotización', valores, ctx),
    },
    seg: {
      titulo: 'Registrar seguimiento',
      subtitulo: 'Dejá constancia del contacto con el cliente.',
      campos: REQUISITOS['Seguimiento'].campos,
      textoConfirmar: 'Guardar seguimiento',
      run: (valores) => completarEtapa(op, 'Seguimiento', valores, ctx),
    },
    cierre: {
      titulo: 'Cerrar oportunidad',
      subtitulo: 'Cargá el resultado. Si falta algún paso previo, se pide acá también.',
      campos: camposFaltantes(op, 'Cierre', ctx),
      textoConfirmar: 'Cerrar oportunidad',
      run: (valores) => avanzarEtapa(op, 'Cierre', valores, ctx),
    },
  };
  const accionActual = accion ? ACCIONES[accion] : null;

  async function onConfirmAccion(valores) {
    const cfg = ACCIONES[accion];
    setAccion(null);
    try {
      const res = await cfg.run(valores);
      if (res && res.ventaId) {
        toast('Oportunidad ganada · venta creada');
        navigate(`/ventas/${res.ventaId}`);
        return;
      }
      toast(accion === 'cierre' ? 'Oportunidad cerrada' : 'Guardado');
      await cargar();
    } catch (e) {
      console.error(e);
      toast('No se pudo guardar', 'err');
    }
  }

  async function recontactar() {
    try {
      await reabrirOportunidad(op);
      toast('Oportunidad reabierta en Contacto inicial');
      await cargar();
    } catch (e) {
      console.error(e);
      toast('No se pudo reabrir la oportunidad', 'err');
    }
  }

  const motivoPerdida = op.motivo === 'Otro' ? (op.motivo_detalle || 'Otro') : op.motivo;

  return (
    <div>
      <PageHeader titulo={`Oportunidad #${op.id} · ${nombreCliente(cliente)}`}
        sub={`Etapa: ${op.etapa} · primer contacto ${fmtFecha(op.fecha_contacto)}`}>
        <BackButton to="/comercial" />
        {!cerrada && <>
          <button className="btn ghost" onClick={() => setAccion('coti')}>+ Cotización</button>
          <button className="btn ghost" onClick={() => setAccion('seg')}>+ Seguimiento</button>
          <button className="btn" onClick={() => setAccion('cierre')}><Icon name="check" size={15} /> Cerrar</button>
        </>}
        {op.resultado === 'Ganada' && venta &&
          <button className="btn ghost" onClick={() => navigate(`/ventas/${venta.id}`)}>Ver venta</button>}
      </PageHeader>

      <div className="stepbar">
        {ETAPAS.map((e, i) => (
          <div key={e} className={'step' + (i < idxEtapa ? ' done' : i === idxEtapa ? ' cur' : '')}>{e}</div>
        ))}
      </div>

      {cerrada && (
        <div className={'aviso ' + (op.resultado === 'Ganada' ? 'ok' : 'bad')}
          style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span className="grow">
            Oportunidad cerrada como <b>{op.resultado}</b>
            {op.resultado === 'Perdida' && motivoPerdida && ` · motivo: ${motivoPerdida}`}
          </span>
          {op.resultado === 'Perdida' && (
            <button className="btn ghost sm" onClick={recontactar}>Recontactar</button>
          )}
        </div>
      )}

      <div className="two" style={{ marginTop: 16 }}>
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-h">
              <span className="grow">Cotizaciones ({cotizaciones.length})</span>
              {!cerrada && <button className="btn ghost sm" onClick={() => setAccion('coti')}>+ Agregar</button>}
            </div>
            <div className="table-wrap">
              {cotizaciones.length === 0 ? <Empty>Sin cotizaciones.</Empty> : (
                <table>
                  <thead><tr><th>Versión</th><th>Referencia</th><th>Envío</th><th>Días</th></tr></thead>
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
              {!cerrada && <button className="btn ghost sm" onClick={() => setAccion('seg')}>+ Registrar</button>}
            </div>
            <div className="card-pad">
              {seguimientos.length === 0 ? <div className="muted sm">Sin seguimientos.</div> :
                seguimientos.map((s) => (
                  <div key={s.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--line-2)' }}>
                    <div className="strong sm">{fmtFecha(s.fecha)} · {s.tipo}</div>
                    <div className="muted sm">{s.observaciones}</div>
                    {s.proximo_contacto && (
                      <div className="muted sm" style={{ marginTop: 2 }}>Próximo contacto: {fmtFecha(s.proximo_contacto)}</div>
                    )}
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

      {accionActual && (
        <ModalCampos
          titulo={accionActual.titulo}
          subtitulo={accionActual.subtitulo}
          campos={accionActual.campos}
          textoConfirmar={accionActual.textoConfirmar}
          onConfirm={onConfirmAccion}
          onCancel={() => setAccion(null)}
        />
      )}
    </div>
  );
}

function InfoRow({ k, v }) {
  return <div className="inforow"><span className="k">{k}</span><span className="v">{v}</span></div>;
}
