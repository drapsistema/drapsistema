import { useState } from 'react';

// ============================================================
// MODAL DE CAMPOS (reutilizable)
// ------------------------------------------------------------
// Pide una lista de campos y valida antes de confirmar. Lo usan
// tanto el tablero (al soltar una tarjeta) como las pantallas de
// detalle (cotización / seguimiento / cierre, y la carga de equipos
// en ventas), siempre con las mismas definiciones de campo.
//
// Cada campo puede ser condicional:
//   showIf(valores)     -> se muestra solo si devuelve true.
//   requiredIf(valores) -> se exige solo si devuelve true.
//   full                -> en modo grilla, ocupa el ancho completo.
//
// Props de presentación:
//   ancho     -> ancho máximo del modal en px (default 460).
//   grid      -> si es true, acomoda los campos en 2 columnas.
//
// El cuerpo tiene scroll propio y los botones quedan fijos abajo,
// así un formulario largo nunca empuja el "Confirmar" fuera de la
// pantalla.
// ============================================================

export default function ModalCampos({
  titulo, subtitulo, campos, valoresIniciales,
  ancho, grid = false,
  textoConfirmar = 'Confirmar', onConfirm, onCancel,
}) {
  const [valores, setValores] = useState(() => {
    const init = {};
    (campos || []).forEach((c) => {
      const dado = valoresIniciales && valoresIniciales[c.name] != null ? valoresIniciales[c.name] : undefined;
      init[c.name] = dado != null ? dado : (c.default != null ? c.default : '');
    });
    return init;
  });
  const [errores, setErrores] = useState({});

  const visibles = (campos || []).filter((c) => !c.showIf || c.showIf(valores));
  const esRequerido = (c) => Boolean(c.required || (c.requiredIf && c.requiredIf(valores)));
  const set = (name, v) => setValores((prev) => ({ ...prev, [name]: v }));

  function confirmar() {
    const e = {};
    visibles.forEach((c) => {
      if (esRequerido(c) && !String(valores[c.name] ?? '').trim()) e[c.name] = true;
    });
    setErrores(e);
    if (Object.keys(e).length === 0) onConfirm(valores);
  }

  const hayErrores = Object.keys(errores).length > 0;

  return (
    <div className="modal-bg" onClick={(e) => e.target.className === 'modal-bg' && onCancel()}>
      <div className="modal" style={{ maxWidth: ancho || 460, maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-h">
          <span>{titulo}</span>
          <button className="modal-x" onClick={onCancel}>✕</button>
        </div>

        <div className="modal-b" style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
          {subtitulo && <p className="muted sm" style={{ marginBottom: 14 }}>{subtitulo}</p>}

          {hayErrores && (
            <div className="aviso bad" style={{ marginBottom: 14 }}>
              Faltan datos obligatorios. Revisalos abajo, o cancelá para dejar todo como estaba.
            </div>
          )}

          <div className={grid ? 'form-grid' : undefined}>
            {visibles.map((c) => {
              const err = errores[c.name] ? { borderColor: 'var(--red)' } : undefined;
              const clase = 'field' + (grid && c.full ? ' full' : '');
              return (
                <div className={clase} key={c.name}>
                  <label>{c.label}{esRequerido(c) && <span className="req"> *</span>}</label>
                  {c.type === 'select' ? (
                    <select value={valores[c.name]} onChange={(ev) => set(c.name, ev.target.value)} style={err}>
                      <option value="">— Elegí —</option>
                      {(c.options || []).map((o) => {
                        const val = (o && typeof o === 'object') ? o.value : o;
                        const lab = (o && typeof o === 'object') ? o.label : o;
                        return <option key={String(val)} value={val}>{lab}</option>;
                      })}
                    </select>
                  ) : c.type === 'textarea' ? (
                    <textarea rows={3} value={valores[c.name]} placeholder={c.placeholder || ''}
                      onChange={(ev) => set(c.name, ev.target.value)} style={err} />
                  ) : (
                    <input type={c.type || 'text'} value={valores[c.name]} placeholder={c.placeholder || ''}
                      onChange={(ev) => set(c.name, ev.target.value)} style={err} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="modal-foot" style={{ margin: 0, padding: '12px 20px', borderTop: '1px solid var(--line-2)' }}>
          <button className="btn ghost" onClick={onCancel}>Cancelar</button>
          <button className="btn" onClick={confirmar}>{textoConfirmar}</button>
        </div>
      </div>
    </div>
  );
}
