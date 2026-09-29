// Presentación del resultado de una oportunidad (Kanban y Lista del CRM).
// "Venta cancelada" se trata como perdida: se ganó pero no se concretó.
export const esGanada = (o) => o.resultado === 'Ganada';
export const esPerdida = (o) => Boolean(o.resultado) && o.resultado !== 'Ganada';

export const claseResultado = (o) => (esGanada(o) ? 'res-ganada' : esPerdida(o) ? 'res-perdida' : '');

export function BadgeResultado({ o }) {
  if (esGanada(o)) return <span className="badge g">Ganada</span>;
  if (esPerdida(o)) return <span className="badge r">{o.resultado === 'Perdida' ? 'Perdida' : o.resultado}</span>;
  return <span className="badge b">Abierta</span>;
}
