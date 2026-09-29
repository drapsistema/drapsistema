import { fmtFecha } from '../../shared/ui.jsx';
import ListaAgrupada from '../../shared/ListaAgrupada.jsx';
import { ETAPAS } from './etapas.js';
import { claseResultado, BadgeResultado } from './resultado.jsx';

// Vista Lista del CRM. Cada fila trae los campos calculados en
// Comercial.jsx (_cliente, _vendedor, _ultimo, _dias, _sem).
const ESTADOS = ETAPAS.map((e) => ({ id: e, label: e }));
const fecha = (f) => (f ? fmtFecha(f) : <span className="muted">—</span>);

const COLUMNAS = [
  { key: 'cliente', label: 'Cliente', className: 'strong', valor: (o) => o._cliente.toLowerCase(), render: (o) => o._cliente },
  {
    key: 'relevamiento', label: 'Relevamiento', className: 'celda-corta',
    valor: (o) => (o.relevamiento || '').toLowerCase(),
    render: (o) => <span title={o.relevamiento || ''}>{o.relevamiento || <span className="muted">—</span>}</span>,
  },
  { key: 'vendedor', label: 'Vendedor', valor: (o) => o._vendedor.toLowerCase(), render: (o) => o._vendedor },
  {
    key: 'dias', label: 'Días', valor: (o) => (o.resultado ? -1 : o._dias),
    render: (o) => (o.resultado
      ? <span className="muted">—</span>
      : <span style={{ whiteSpace: 'nowrap' }}><span className={'dot ' + o._sem} />{o._dias} d</span>),
  },
  { key: 'primero', label: 'Primer contacto', valor: (o) => o.fecha_contacto || '', render: (o) => fecha(o.fecha_contacto) },
  { key: 'ultimo', label: 'Último contacto', valor: (o) => o._ultimo || '', render: (o) => fecha(o._ultimo) },
  { key: 'estado', label: 'Estado', valor: (o) => o.resultado || '', render: (o) => <BadgeResultado o={o} /> },
];

// Abiertas: más días sin contacto primero. Cierre: las más recientes primero.
const ordenPorDefecto = (etapa) => (a, b) => (etapa === 'Cierre'
  ? (b.fecha_cierre || '').localeCompare(a.fecha_cierre || '') || b.id - a.id
  : b._dias - a._dias);

export default function ListaOportunidades({ items, abiertos, onToggle, onAbrir }) {
  return (
    <ListaAgrupada estados={ESTADOS} items={items} columnas={COLUMNAS}
      abiertos={abiertos} onToggle={onToggle} onAbrir={onAbrir}
      filaClass={claseResultado} ordenPorDefecto={ordenPorDefecto} />
  );
}
