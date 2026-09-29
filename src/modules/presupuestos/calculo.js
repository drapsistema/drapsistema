// Cálculos y formato de un presupuesto. Los precios de los ítems se guardan
// siempre en U$S (como el catálogo); si el presupuesto es en pesos, se
// convierten con la cotización cargada en ese presupuesto.
export const MONEDAS = { USD: 'U$S', ARS: '$' };

export const formatoNumero = (n) =>
  Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const conMoneda = (moneda, n) => `${MONEDAS[moneda] || 'U$S'} ${formatoNumero(n)}`;

// Factor para pasar de U$S a la moneda del presupuesto.
export const factor = (p) => (p.moneda === 'ARS' ? Number(p.cotizacion) || 0 : 1);

export const precioEnMoneda = (p, precioUsd) => Number(precioUsd || 0) * factor(p);

// { subtotal, descuento, total } en la moneda del presupuesto.
export function totales(p, items) {
  const subtotal = items.reduce((a, it) => a + precioEnMoneda(p, it.precio_unit) * Number(it.cantidad || 0), 0);
  const descuento = Math.min(Math.max(Number(p.descuento) || 0, 0), subtotal);
  return { subtotal, descuento, total: subtotal - descuento };
}

export const nombreVersion = (p) => `${p.numero} v${p.version}`;
