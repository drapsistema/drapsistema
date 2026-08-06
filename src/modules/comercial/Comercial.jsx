import { useState, useEffect } from 'react';
import { listar, actualizar, obtener } from '../../lib/db';
import { PageHeader, nombreCliente } from '../../shared/ui.jsx';
import Board from '../../shared/Board.jsx';

// Estados del pipeline comercial.
const ESTADOS = [
  { id: 'Contacto inicial', label: 'Contacto inicial' },
  { id: 'Cotización', label: 'Cotización' },
  { id: 'Seguimiento', label: 'Seguimiento' },
  { id: 'Cierre', label: 'Cierre' },
];

// Campos obligatorios para pasar de un estado a otro (feature 2).
// Devuelve [] cuando la transición no pide nada.
function camposTransicion(desde, hacia) {
  if (hacia === 'Cotización') {
    return [{ name: 'fecha_envio', label: 'Fecha de envío de la cotización', type: 'date', required: true }];
  }
  if (hacia === 'Cierre') {
    return [
      { name: 'resultado', label: 'Resultado', type: 'select', options: ['Ganada', 'Perdida'], required: true },
      { name: 'motivo', label: 'Motivo (si es perdida)', type: 'text', required: false },
    ];
  }
  return [];
}

export default function Comercial() {
  const [ops, setOps] = useState([]);
  const [clientes, setClientes] = useState([]);

  useEffect(() => {
    listar('oportunidades').then(setOps);
    listar('clientes').then(setClientes);
  }, []);

  // mapea cada oportunidad a un item del board (usa 'etapa' como estado)
  const items = ops.map((o) => ({ ...o, estado: o.etapa }));

  async function mover(item, nuevoEstado, valores) {
    // Se aplican los valores del modal + el nuevo estado.
    const cambios = { etapa: nuevoEstado };
    if (valores.resultado) cambios.resultado = valores.resultado;
    if (valores.motivo) cambios.motivo = valores.motivo;
    await actualizar('oportunidades', item.id, cambios);
    setOps((prev) => prev.map((o) => (o.id === item.id ? { ...o, ...cambios } : o)));
  }

  const nombrePorId = (id) => {
    const c = clientes.find((x) => x.id === id);
    return c ? nombreCliente(c) : `Cliente #${id}`;
  };

  return (
    <div>
      <PageHeader titulo="CRM comercial" sub="Arrastrá las tarjetas para cambiar de etapa. Alterná entre Kanban y Lista." />
      <Board
        estados={ESTADOS}
        items={items}
        camposTransicion={camposTransicion}
        onMover={mover}
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
