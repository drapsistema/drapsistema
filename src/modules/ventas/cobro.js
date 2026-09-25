// Estado de cobro de una venta: 'No' | 'Parcial' | 'Total'.
// Las ventas previas al cambio solo tienen el booleano `cobrado`.
export function estadoCobro(v) {
  return v.estado_cobro || (v.cobrado ? 'Total' : 'No');
}
