import { useState } from 'react';
import { crear, eliminar, actualizar } from '../../lib/db';
import { fmtFecha } from '../../shared/ui.jsx';
import { comentarSistema } from '../../shared/Comentarios.jsx';
import Icon from '../../shared/Icon.jsx';

// Cada pieza del equipo puede tener su propia garantía (el dron una, la
// batería otra, etc.). Se guardan en la tabla `garantias_trabajo`.
export const GARANTIA_VACIA = { pieza: '', detalle: '', vence: '' };

export const limpiarGarantia = (g) => ({
  pieza: g.pieza.trim(), detalle: (g.detalle || '').trim(), vence: g.vence || null, // '' no va a una columna date
});

export const textoGarantia = (g) =>
  [g.detalle, g.vence ? `vence ${fmtFecha(g.vence)}` : ''].filter(Boolean).join(' · ');

// Filas editables (formulario de ingreso del drone).
export function GarantiasFilas({ filas, onChange, errores = {} }) {
  const set = (i, k, v) => onChange(filas.map((f, j) => (j === i ? { ...f, [k]: v } : f)));
  return (
    <div>
      {filas.length === 0 && <div className="muted sm" style={{ marginBottom: 8 }}>Sin piezas en garantía.</div>}
      {filas.map((g, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1.2fr) minmax(0,0.9fr) auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
          <input value={g.pieza} onChange={(e) => set(i, 'pieza', e.target.value)} placeholder="Pieza (ej: Batería)"
            style={errores[i] ? { borderColor: 'var(--red)' } : undefined} />
          <input value={g.detalle} onChange={(e) => set(i, 'detalle', e.target.value)} placeholder="Garantía (ej: 12 meses, DJI Care)" />
          <input type="date" value={g.vence} onChange={(e) => set(i, 'vence', e.target.value)} title="Vencimiento (opcional)" />
          <button className="btn ghost sm" onClick={() => onChange(filas.filter((_, j) => j !== i))} title="Quitar">✕</button>
        </div>
      ))}
      <button className="btn ghost sm" onClick={() => onChange([...filas, { ...GARANTIA_VACIA }])}>
        <Icon name="plus" size={14} /> Agregar pieza en garantía
      </button>
    </div>
  );
}

// Tarjeta del detalle del trabajo: lista + alta/baja.
export function GarantiasCard({ trabajoId, garantias, editable, recargar, toast, usuarioActualId }) {
  const [nueva, setNueva] = useState(null);

  async function sincronizarFlag(cantidad) {
    await actualizar('trabajos', trabajoId, { garantia: cantidad > 0 });
  }

  async function agregar() {
    if (!nueva.pieza.trim()) { toast('Indicá qué pieza está en garantía', 'err'); return; }
    try {
      const g = limpiarGarantia(nueva);
      await crear('garantias_trabajo', { trabajo_id: Number(trabajoId), ...g });
      await sincronizarFlag(garantias.length + 1);
      await comentarSistema('trabajo', trabajoId, `Garantía agregada: ${g.pieza}${g.detalle ? ` (${g.detalle})` : ''}.`, usuarioActualId);
      setNueva(null); toast('Garantía agregada'); recargar();
    } catch (e) { console.error(e); toast('No se pudo agregar la garantía', 'err'); }
  }

  async function quitar(g) {
    try {
      await eliminar('garantias_trabajo', g.id);
      await sincronizarFlag(garantias.length - 1);
      await comentarSistema('trabajo', trabajoId, `Garantía quitada: ${g.pieza}.`, usuarioActualId);
      toast('Garantía quitada'); recargar();
    } catch (e) { console.error(e); toast('No se pudo quitar la garantía', 'err'); }
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-h">
        <span className="grow">Garantías ({garantias.length})</span>
        {editable && !nueva && <button className="btn ghost sm" onClick={() => setNueva({ ...GARANTIA_VACIA })}>+ Pieza</button>}
      </div>
      <div className="card-pad">
        {garantias.length === 0 && !nueva && <div className="muted sm">Ninguna pieza en garantía.</div>}
        {garantias.map((g) => (
          <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--line-2)' }}>
            <div className="grow">
              <div className="strong sm">{g.pieza}</div>
              {textoGarantia(g) && <div className="muted sm">{textoGarantia(g)}</div>}
            </div>
            {editable && <button className="btn ghost sm" onClick={() => quitar(g)} title="Quitar">✕</button>}
          </div>
        ))}
        {nueva && (
          <div style={{ marginTop: 8 }}>
            <div className="field"><label>Pieza <span className="req">*</span></label>
              <input value={nueva.pieza} onChange={(e) => setNueva({ ...nueva, pieza: e.target.value })} placeholder="Ej: Batería" autoFocus /></div>
            <div className="field"><label>Garantía</label>
              <input value={nueva.detalle} onChange={(e) => setNueva({ ...nueva, detalle: e.target.value })} placeholder="Ej: 12 meses, DJI Care" /></div>
            <div className="field"><label>Vence</label>
              <input type="date" value={nueva.vence} onChange={(e) => setNueva({ ...nueva, vence: e.target.value })} /></div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn sm" onClick={agregar}><Icon name="check" size={14} /> Guardar</button>
              <button className="btn ghost sm" onClick={() => setNueva(null)}>Cancelar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
