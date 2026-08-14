import { useState } from 'react';

// ============================================================
// MODAL DE CAMPOS (reutilizable)
// ------------------------------------------------------------
// Pide una lista de campos y valida antes de confirmar. Lo usan
// tanto el tablero (al soltar una tarjeta) como la pantalla de
// detalle (botones de cotización / seguimiento / cierre), siempre
// con las mismas definiciones de campo, así nunca se desincronizan.
//
// Cada campo puede ser condicional:
//   showIf(valores)     -> se muestra solo si devuelve true.
//   requiredIf(valores) -> se exige solo si devuelve true.
//
// Comportamiento de errores (lo pedido): si falta algo, NO se
// confirma; aparece una alerta arriba y los campos se marcan en
// rojo, para que el usuario revea lo cargado o cancele. Como la
// tarjeta no se movió hasta confirmar, cancelar la deja donde
// estaba, sin efectos.
//
// Props:
//   titulo, subtitulo         textos del encabezado
//   campos                    [{ name, label, type, options, required, ... }]
//   valoresIniciales          (opcional) valores precargados
//   textoConfirmar            texto del botón principal
//   onConfirm(valores)        se llama solo si la validación pasa
//   onCancel()                cierra sin efectos
// ============================================================

export default function ModalCampos({
  titulo, subtitulo, campos, valoresIniciales,
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
      <div className="modal">
        <div className="modal-h">
          <span>{titulo}</span>
          <button className="modal-x" onClick={onCancel}>✕</button>
        </div>
        <div className="modal-b">
          {subtitulo && <p className="muted sm" style={{ marginBottom: 14 }}>{subtitulo}</p>}

          {hayErrores && (
            <div className="aviso bad" style={{ marginBottom: 14 }}>
              Faltan datos obligatorios. Revisalos abajo, o cancelá para dejar la oportunidad como estaba.
            </div>
          )}

          {visibles.map((c) => {
            const err = errores[c.name] ? { borderColor: 'var(--red)' } : undefined;
            return (
              <div className="field" key={c.name}>
                <label>{c.label}{esRequerido(c) && <span className="req"> *</span>}</label>
                {c.type === 'select' ? (
                  <select value={valores[c.name]} onChange={(ev) => set(c.name, ev.target.value)} style={err}>
                    <option value="">— Elegí —</option>
                    {(c.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
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

          <div className="modal-foot">
            <button className="btn ghost" onClick={onCancel}>Cancelar</button>
            <button className="btn" onClick={confirmar}>{textoConfirmar}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
