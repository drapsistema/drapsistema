import { useState } from 'react';
import {
  DndContext, DragOverlay, useDraggable, useDroppable,
  PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import './board.css';

// ============================================================
// COMPONENTE BOARD REUTILIZABLE
// Cubre las tres features nuevas para CRM, postventa y service:
//   1. Toggle Kanban / Lista (el usuario elige cómo verlo).
//   2. Drag & drop entre estados. Al soltar en un estado nuevo,
//      si ese cambio exige campos obligatorios, se abre un modal
//      para completarlos antes de confirmar.
//
// Props:
//   estados: [{ id, label }]           columnas / estados posibles
//   items:   [{ id, estado, ... }]     tarjetas
//   render:  (item) => JSX             contenido de cada tarjeta
//   camposTransicion: (desde, hacia) => [{ name, label, type, required }]
//        devuelve los campos que hay que completar para pasar de un
//        estado a otro. Si devuelve [], la transición es directa.
//   onMover: (item, nuevoEstado, valores) => void
//        se llama al confirmar el cambio de estado.
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
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

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

    // ¿Esta transición exige campos obligatorios? (feature 2)
    const campos = camposTransicion ? camposTransicion(item.estado, hacia) : [];
    if (campos && campos.length > 0) {
      const valoresIniciales = {};
      campos.forEach((c) => { valoresIniciales[c.name] = ''; });
      setTransicion({ item, hacia, campos, valores: valoresIniciales });
    } else {
      onMover(item, hacia, {});
    }
  }

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
        <ModalTransicion
          trans={transicion} estados={estados}
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

// La tarjeta distingue click de arrastre: si el puntero se movió más de
// unos pocos px entre mousedown y mouseup, fue drag y no dispara el click.
function Tarjeta({ item, render, onCardClick }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: String(item.id) });
  const start = useState({ x: 0, y: 0 })[0];

  function onPointerDown(e) { start.x = e.clientX; start.y = e.clientY; }
  function onClick(e) {
    const movido = Math.abs(e.clientX - start.x) + Math.abs(e.clientY - start.y);
    if (movido < 6 && onCardClick) onCardClick(item);
  }

  return (
    <div ref={setNodeRef} {...listeners} {...attributes}
      onPointerDown={onPointerDown} onClick={onClick}
      className={'kcard' + (isDragging ? ' dragging' : '')}>
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
  const start = useState({ x: 0, y: 0 })[0];
  function onPointerDown(e) { start.x = e.clientX; start.y = e.clientY; }
  function onClick(e) {
    const movido = Math.abs(e.clientX - start.x) + Math.abs(e.clientY - start.y);
    if (movido < 6 && onCardClick) onCardClick(item);
  }
  return (
    <div ref={setNodeRef} {...listeners} {...attributes}
      onPointerDown={onPointerDown} onClick={onClick}
      style={{ padding: '11px 16px', borderBottom: '1px solid var(--line-2)', cursor: 'pointer', opacity: isDragging ? .5 : 1 }}>
      {render(item)}
    </div>
  );
}

function ModalTransicion({ trans, estados, onCancel, onConfirm }) {
  const [valores, setValores] = useState(trans.valores);
  const [errores, setErrores] = useState({});
  const destino = estados.find((e) => e.id === trans.hacia);

  function confirmar() {
    const e = {};
    trans.campos.forEach((c) => { if (c.required && !valores[c.name]) e[c.name] = true; });
    setErrores(e);
    if (Object.keys(e).length === 0) onConfirm(valores);
  }

  return (
    <div className="modal-bg" onClick={(e) => e.target.className === 'modal-bg' && onCancel()}>
      <div className="modal">
        <div className="modal-h">
          <span>Pasar a “{destino?.label}”</span>
          <button className="modal-x" onClick={onCancel}>✕</button>
        </div>
        <div className="modal-b">
          <p className="muted sm" style={{ marginBottom: 14 }}>
            Para completar este cambio de estado, cargá los siguientes datos:
          </p>
          {trans.campos.map((c) => (
            <div className="field" key={c.name}>
              <label>{c.label}{c.required && <span className="req"> *</span>}</label>
              {c.type === 'select' ? (
                <select value={valores[c.name]} onChange={(ev) => setValores({ ...valores, [c.name]: ev.target.value })}
                  style={errores[c.name] ? { borderColor: 'var(--red)' } : undefined}>
                  <option value="">— Elegí —</option>
                  {(c.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : c.type === 'textarea' ? (
                <textarea rows={2} value={valores[c.name]} onChange={(ev) => setValores({ ...valores, [c.name]: ev.target.value })}
                  style={errores[c.name] ? { borderColor: 'var(--red)' } : undefined} />
              ) : (
                <input type={c.type || 'text'} value={valores[c.name]} onChange={(ev) => setValores({ ...valores, [c.name]: ev.target.value })}
                  style={errores[c.name] ? { borderColor: 'var(--red)' } : undefined} />
              )}
            </div>
          ))}
          <div className="modal-foot">
            <button className="btn ghost" onClick={onCancel}>Cancelar</button>
            <button className="btn" onClick={confirmar}>Confirmar cambio</button>
          </div>
        </div>
      </div>
    </div>
  );
}
