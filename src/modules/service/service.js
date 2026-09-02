// ============================================================
// SERVICE · Estados y candados de transición (fuente única)
// ------------------------------------------------------------
// La usan tanto el tablero (al arrastrar un ticket) como el detalle
// (los botones de estado), así las reglas nunca se desincronizan.
// ============================================================

export const ESTADOS_SERVICE = [
  'Ingresada', 'En diagnóstico', 'En reparación', 'Esperando repuestos', 'Finalizada', 'Entregada',
];

const idx = (e) => ESTADOS_SERVICE.indexOf(e);

// Valida si un trabajo puede pasar a `hacia`, según lo cargado.
//   ctx = { tareas: [...], tieneInforme: boolean }
// Devuelve null si se puede, o un texto con el motivo del bloqueo.
// Reglas (del diseño original):
//   · Para estar en "En diagnóstico" o más allá: al menos un técnico
//     asignado (una tarea con técnico).
//   · Para "Finalizada" o "Entregada": informe técnico cargado.
export function validarTransicion(hacia, ctx) {
  const iH = idx(hacia);
  const conTecnico = (ctx.tareas || []).some((t) => t.tecnico_id);
  const tieneInforme = Boolean(ctx.tieneInforme);

  if (iH >= idx('En diagnóstico') && !conTecnico) {
    return 'Asigná al menos un técnico (agregá una tarea con su técnico) antes de avanzar.';
  }
  if (iH >= idx('Finalizada') && !tieneInforme) {
    return 'Cargá el informe técnico antes de finalizar.';
  }
  return null;
}
