// ============================================================
// SERVICE · Estados y candados de transición (fuente única)
// ------------------------------------------------------------
// El flujo avanza SOLO al cumplirse las condiciones (auto-avance,
// como el CRM): las acciones del detalle empujan el estado. El
// tablero permite además arrastrar, pero solo si ya se cumplen las
// condiciones; para finalizar/entregar se obliga a usar el detalle,
// porque piden confirmación / generan el informe.
// ============================================================

export const ESTADOS_SERVICE = [
  'Ingresada', 'En diagnóstico', 'En reparación', 'Esperando repuestos', 'Finalizada', 'Entregada',
];

// Valida un intento de mover (arrastrar) un trabajo a `hacia`.
// Devuelve null si se puede, o un texto con el motivo del bloqueo.
export function validarTransicion(hacia, trabajo, tareas) {
  const t = trabajo || {};
  const hayTareas = (tareas || []).length > 0;
  switch (hacia) {
    case 'En diagnóstico':
      return t.tecnico_id ? null : 'Asigná un técnico en el detalle para pasar a diagnóstico.';
    case 'En reparación':
      return (t.diagnostico && hayTareas && t.aprobacion_cliente)
        ? null
        : 'Cargá diagnóstico, tareas y la aprobación del cliente en el detalle.';
    case 'Esperando repuestos':
      return t.espera_desde ? null : 'Indicá desde cuándo se esperan los repuestos en el detalle.';
    case 'Finalizada':
      return 'Finalizá desde el detalle: pide confirmación y genera el informe.';
    case 'Entregada':
      return 'Registrá la entrega desde el detalle del ticket.';
    default:
      return null; // Ingresada y retrocesos
  }
}
