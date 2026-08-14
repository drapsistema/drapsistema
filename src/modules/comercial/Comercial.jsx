import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { listar, actualizar, crear } from '../../lib/db';
import { PageHeader, nombreCliente, hoyISO } from '../../shared/ui.jsx';
import { comentarSistema } from '../../shared/Comentarios.jsx';
import { useToast } from '../../shared/Toast.jsx';
import Board from '../../shared/Board.jsx';

const ESTADOS = [
  { id: 'Contacto inicial', label: 'Contacto inicial' },
  { id: 'Cotización', label: 'Cotización' },
  { id: 'Seguimiento', label: 'Seguimiento' },
  { id: 'Cierre', label: 'Cierre' },
];

// Campos obligatorios para pasar de un estado a otro (feature 2).
function camposTransicion(desde, hacia) {
  if (hacia === 'Cierre') {
    return [
      { name: 'resultado', label: 'Resultado', type: 'select', options: ['Ganada', 'Perdida'], required: true },
      { name: 'motivo', label: 'Motivo (obligatorio si es perdida)', type: 'text', required: false },
    ];
  }
  return [];
}

export default function Comercial() {
  const [ops, setOps] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [params] = useSearchParams();
  const filtroEtapa = params.get('etapa'); // viene del dashboard (KPI clickeable)
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    listar('oportunidades').then(setOps);
    listar('clientes').then(setClientes);
  }, []);

  let items = ops.map((o) => ({ ...o, estado: o.etapa }));
  if (filtroEtapa) items = items.filter((i) => i.estado === filtroEtapa);

  async function mover(item, nuevoEstado, valores) {
    // Validación de negocio: no cerrar como perdida sin motivo.
    if (nuevoEstado === 'Cierre' && valores.resultado === 'Perdida' && !valores.motivo) {
      toast('Para cerrar como perdida, cargá el motivo', 'err');
      return;
    }
    const cambios = { etapa: nuevoEstado };
    if (valores.resultado) cambios.resultado = valores.resultado;
    if (valores.motivo) cambios.motivo = valores.motivo;
    await actualizar('oportunidades', item.id, cambios);
    setOps((prev) => prev.map((o) => (o.id === item.id ? { ...o, ...cambios } : o)));

    // Automatización: al ganar, se crea la venta enlazada (hereda vendedor).
    if (cambios.resultado === 'Ganada') {
      const venta = await crear('ventas', {
        oportunidad_id: item.id, cliente_id: item.cliente_id, vendedor_id: item.vendedor_id,
        fecha_ganada: hoyISO(), direccion_entrega: '', fecha_entrega: '', observaciones: '',
        cobrado: false, registrado: false, comision: 0, estado: 'Ganada', motivo_cancel: '', fecha_cancel: '',
      });
      await comentarSistema('op', item.id, 'Oportunidad ganada. Se creó la venta enlazada.');
      toast('Oportunidad ganada · venta creada');
      navigate(`/ventas/${venta.id}`);
    } else {
      toast('Oportunidad movida a ' + nuevoEstado);
    }
  }

  const nombrePorId = (id) => {
    const c = clientes.find((x) => x.id === id);
    return c ? nombreCliente(c) : `Cliente #${id}`;
  };

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
