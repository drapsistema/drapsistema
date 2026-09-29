import { useState } from 'react';
import { fmtFecha } from '../../shared/ui.jsx';
import { ETAPAS } from './etapas.js';
import { claseResultado, BadgeResultado } from './resultado.jsx';

// Vista Lista del CRM: misma tabla que Ventas, agrupada por etapa con
// encabezados desplegables. Cada fila trae los campos calculados en
// Comercial.jsx (_cliente, _vendedor, _ultimo, _dias, _sem).
const COLS = [
  { key: 'cliente', label: 'Cliente' },
  { key: 'relevamiento', label: 'Relevamiento' },
  { key: 'vendedor', label: 'Vendedor' },
  { key: 'dias', label: 'Días' },
  { key: 'ultimo', label: 'Último contacto' },
  { key: 'estado', label: 'Estado' },
];

const valorCol = (o, key) => {
  switch (key) {
    case 'cliente': return o._cliente.toLowerCase();
    case 'relevamiento': return (o.relevamiento || '').toLowerCase();
    case 'vendedor': return o._vendedor.toLowerCase();
    case 'dias': return o.resultado ? -1 : o._dias;
    case 'ultimo': return o._ultimo || '';
    case 'estado': return o.resultado || '';
    default: return '';
  }
};

// Orden por defecto de cada grupo: los abiertos, los más urgentes primero
// (más días sin contacto); Cierre, los cerrados más recientes primero.
const ordenPorDefecto = (etapa) => (a, b) => (etapa === 'Cierre'
  ? (b.fecha_cierre || '').localeCompare(a.fecha_cierre || '') || b.id - a.id
  : b._dias - a._dias);

export default function ListaOportunidades({ items, abiertos, onToggle, onAbrir }) {
  const [sort, setSort] = useState(null); // null = orden por defecto de cada grupo

  const ordenar = (lista, etapa) => {
    if (!sort) return [...lista].sort(ordenPorDefecto(etapa));
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...lista].sort((a, b) => {
      const va = valorCol(a, sort.col), vb = valorCol(b, sort.col);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  };
  const toggleSort = (col) => setSort((s) => (s && s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' }));
  const flecha = (col) => (sort && sort.col === col ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '');

  return (
    <div className="card table-wrap">
      <table>
        <thead>
          <tr>
            {COLS.map((c) => (
              <th key={c.key} onClick={() => toggleSort(c.key)} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                {c.label}{flecha(c.key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ETAPAS.map((etapa) => {
            const grupo = items.filter((o) => o.estado === etapa);
            const abierto = Boolean(abiertos[etapa]);
            return [
              <tr key={`g-${etapa}`} className="grupo-h" onClick={() => onToggle(etapa)}>
                <td colSpan={COLS.length}>{abierto ? '▾' : '▸'} {etapa} · {grupo.length}</td>
              </tr>,
              ...(abierto ? (
                grupo.length === 0
                  ? [<tr key={`v-${etapa}`}><td colSpan={COLS.length} className="muted sm">Sin oportunidades en esta etapa.</td></tr>]
                  : ordenar(grupo, etapa).map((o) => (
                    <tr key={o.id} className={'clickable ' + claseResultado(o)} onClick={() => onAbrir(o)}>
                      <td className="strong">{o._cliente}</td>
                      <td className="celda-corta" title={o.relevamiento || ''}>{o.relevamiento || <span className="muted">—</span>}</td>
                      <td>{o._vendedor}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {o.resultado ? <span className="muted">—</span> : <><span className={'dot ' + o._sem} />{o._dias} d</>}
                      </td>
                      <td>{o._ultimo ? fmtFecha(o._ultimo) : <span className="muted">—</span>}</td>
                      <td><BadgeResultado o={o} /></td>
                    </tr>
                  ))
              ) : []),
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}
