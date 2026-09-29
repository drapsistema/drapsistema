import { useState } from 'react';

// ============================================================
// LISTA AGRUPADA POR ESTADO (vista Lista de CRM y Service)
// Tabla con el estilo de Ventas, con un encabezado desplegable por
// estado: "▸ ESTADO · 7" (plegado) / "▾ ESTADO · 7" (desplegado).
//
// Props:
//   estados:  [{ id, label }]
//   items:    [{ id, estado, ... }]
//   columnas: [{ key, label, render(item), valor(item) para ordenar, className? }]
//   abiertos: { [estadoId]: bool } · onToggle(estadoId)
//   onAbrir(item) · filaClass(item) · ordenPorDefecto(estadoId) => comparador
// ============================================================
export default function ListaAgrupada({ estados, items, columnas, abiertos, onToggle, onAbrir, filaClass, ordenPorDefecto }) {
  const [sort, setSort] = useState(null); // null = orden por defecto de cada grupo

  const ordenar = (lista, estadoId) => {
    if (!sort) return ordenPorDefecto ? [...lista].sort(ordenPorDefecto(estadoId)) : lista;
    const col = columnas.find((c) => c.key === sort.col);
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...lista].sort((a, b) => {
      const va = col.valor(a), vb = col.valor(b);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  };
  const toggleSort = (key) => setSort((s) => (s && s.col === key ? { col: key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col: key, dir: 'asc' }));
  const flecha = (key) => (sort && sort.col === key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '');

  return (
    <div className="card table-wrap">
      <table>
        <thead>
          <tr>
            {columnas.map((c) => (
              <th key={c.key} onClick={() => toggleSort(c.key)} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                {c.label}{flecha(c.key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {estados.map((est) => {
            const grupo = items.filter((i) => i.estado === est.id);
            const abierto = Boolean(abiertos[est.id]);
            return [
              <tr key={`g-${est.id}`} className="grupo-h" onClick={() => onToggle(est.id)}>
                <td colSpan={columnas.length}>{abierto ? '▾' : '▸'} {est.label} · {grupo.length}</td>
              </tr>,
              ...(abierto ? (
                grupo.length === 0
                  ? [<tr key={`v-${est.id}`}><td colSpan={columnas.length} className="muted sm">Sin elementos en este estado.</td></tr>]
                  : ordenar(grupo, est.id).map((it) => (
                    <tr key={it.id} className={'clickable ' + (filaClass ? filaClass(it) || '' : '')} onClick={() => onAbrir(it)}>
                      {columnas.map((c) => <td key={c.key} className={c.className}>{c.render(it)}</td>)}
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

// Todos los grupos plegados.
export const todosPlegados = (estados) => Object.fromEntries(estados.map((e) => [e.id, false]));
