import { useState, useRef } from 'react';
import {
  DndContext, DragOverlay, useDraggable, useDroppable,
  MouseSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import ModalCampos from './ModalCampos.jsx';
import './board.css';

// ============================================================
// COMPONENTE BOARD REUTILIZABLE
// Cubre las features de tablero para CRM, postventa y service:
//   1. Toggle Kanban / Lista (el usuario elige cómo verlo).
//   2. Drag & drop entre estados. Al soltar en un estado nuevo,
//      si ese cambio exige campos, se abre un modal para
//      completarlos (solo los que falten) antes de confirmar.
//   3. Click / tap en una tarjeta para abrir su detalle.
//
// SOBRE EL DRAG:
//   - Desktop: MouseSensor, arrastra apenas el puntero se mueve 8px.
//   - Mobile:  TouchSensor con delay; hay que mantener el dedo ~180ms
//     para arrastrar. Toque rápido = abre; deslizar = scrollea.
//   - Las coordenadas para distinguir click de drag van por
//     'pointerdown', que no pisa los listeners de dnd-kit.
//
// Props:
//   estados: [{ id, label }]
//   items:   [{ id, estado, ... }]
//   render:  (item) => JSX
//   camposTransicion: (item, hacia) => [{ name, label, type, required, ... }]
//        recibe la TARJETA completa (no solo el estado), así el que
//        la use puede devolver solo los campos que falten según los
//        datos de esa oportunidad. Si devuelve [], la transición es
//        directa.
//   onMover: (item, nuevoEstado, valores) => void
//   onCardClick: (item) => void
// ============================================================

export default function Board({ estados, items, render, camposTransicion, onMover, onCardClick }) {
  const [vista, setVista] = useState('kanban'); // 'kanban' | 'lista'

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <div className="view-toggle">
          <button className={vista === 'kanban' ? 'on' : ''} onClick={() => setVista('kanban')}>Kanban</button>
          <button className={vista === 'lista' ? 'on' : ''} onClick={() => setVista('lista')}>Lista</button>
        </div>
      </div>

      <BoardDnd
        vista={vista} estados={estados} items={items}
        render={render} camposTransicion={camposTransicion} onMover={onMover} onCardClick={onCardClick}
      />
    </div>
  );
}

function BoardDnd({ vista, estados, items, render, camposTransicion, onMover, onCardClick }) {
  const [activo, setActivo] = useState(null);          // item que se arrastra
  const [transicion, setTransicion] = useState(null);  // { item, hacia, campos }

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );

  function onDragStart(e) {
    setActivo(items.find((i) => String(i.id) === String(e.active.id)));
  }

  function onDragEnd(e) {
    setActivo(null);
    const { active, over } = e;
    if (!over) return;
    const item = items.find((i) => String(i.id) === String(active.id));
    const hacia = over.id;
    if (!item || item.estado === hacia) return;

    // ¿Faltan datos para llegar a esa etapa? (acumulativo, según el item)
    const campos = camposTransicion ? camposTransicion(item, hacia) : [];
    if (campos && campos.length > 0) {
      setTransicion({ item, hacia, campos });
    } else {
      onMover(item, hacia, {});
    }
    // La tarjeta NO se mueve acá: solo se moverá cuando onMover
    // actualice el estado en la base tras un guardado exitoso. Si el
    // usuario cancela el modal, vuelve sola a su columna original.
  }

  const destino = transicion ? estados.find((es) => es.id === transicion.hacia) : null;

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      {vista === 'kanban' ? (
        <div className="kanban">
          {estados.map((est) => (
            <Columna key={est.id} estado={est}
              items={items.filter((i) => i.estado === est.id)} render={render} onCardClick={onCardClick} />
          ))}
        </div>
      ) : (
        <ListaView estados={estados} items={items} render={render} onCardClick={onCardClick} />
      )}

      <DragOverlay>
        {activo ? <div className="kcard" style={{ cursor: 'grabbing' }}>{render(activo)}</div> : null}
      </DragOverlay>

      {transicion && (
        <ModalCampos
          titulo={`Pasar a “${destino?.label}”`}
          subtitulo="Para dejar la oportunidad en esta etapa, cargá los datos que faltan:"
          campos={transicion.campos}
          textoConfirmar="Confirmar cambio"
          onCancel={() => setTransicion(null)}
          onConfirm={(valores) => { onMover(transicion.item, transicion.hacia, valores); setTransicion(null); }}
        />
      )}
    </DndContext>
  );
}

function Columna({ estado, items, render, onCardClick }) {
  const { setNodeRef, isOver } = useDroppable({ id: estado.id });
  return (
    <div ref={setNodeRef} className={'kcol' + (isOver ? ' drop-hover' : '')}>
      <div className="kcol-h"><span>{estado.label}</span><span>{items.length}</span></div>
      <div className="kcol-body">
        {items.map((it) => <Tarjeta key={it.id} item={it} render={render} onCardClick={onCardClick} />)}
      </div>
    </div>
  );
}

// La tarjeta distingue click de arrastre: guarda la posición del puntero
// al apretar (pointerdown, que no interfiere con dnd-kit) y, si al soltar
// casi no se movió, lo trata como click y abre el detalle.
function Tarjeta({ item, render, onCardClick }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: String(item.id) });
  const start = useRef({ x: 0, y: 0 });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onPointerDown={(e) => { start.current = { x: e.clientX, y: e.clientY }; }}
      onClick={(e) => {
        const movido = Math.abs(e.clientX - start.current.x) + Math.abs(e.clientY - start.current.y);
        if (movido < 8 && onCardClick) onCardClick(item);
      }}
      className={'kcard' + (isDragging ? ' dragging' : '')}
    >
      {render(item)}
    </div>
  );
}

// Vista de lista: las mismas tarjetas, agrupadas por estado, también arrastrables.
function ListaView({ estados, items, render, onCardClick }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {estados.map((est) => {
        const propios = items.filter((i) => i.estado === est.id);
        return (
          <ListaGrupo key={est.id} estado={est} items={propios} render={render} onCardClick={onCardClick} />
        );
      })}
    </div>
  );
}

function ListaGrupo({ estado, items, render, onCardClick }) {
  const { setNodeRef, isOver } = useDroppable({ id: estado.id });
  return (
    <div ref={setNodeRef}>
      <div className="sec-title" style={{ margin: '0 0 8px', color: isOver ? 'var(--brand)' : undefined }}>
        {estado.label} <span className="muted">({items.length})</span>
      </div>
      <div className="card" style={{ borderColor: isOver ? 'var(--brand)' : undefined }}>
        {items.length === 0 ? (
          <div className="vacio">Sin elementos</div>
        ) : items.map((it) => (
          <ListaFila key={it.id} item={it} render={render} onCardClick={onCardClick} />
        ))}
      </div>
    </div>
  );
}

function ListaFila({ item, render, onCardClick }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: String(item.id) });
  const start = useRef({ x: 0, y: 0 });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onPointerDown={(e) => { start.current = { x: e.clientX, y: e.clientY }; }}
      onClick={(e) => {
        const movido = Math.abs(e.clientX - start.current.x) + Math.abs(e.clientY - start.current.y);
        if (movido < 8 && onCardClick) onCardClick(item);
      }}
      style={{ padding: '11px 16px', borderBottom: '1px solid var(--line-2)', cursor: 'pointer', opacity: isDragging ? .5 : 1 }}
    >
      {render(item)}
    </div>
  );
}
