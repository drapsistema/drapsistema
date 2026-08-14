import { crear, actualizar } from '../../lib/db';
import { hoyISO } from '../../shared/ui.jsx';
import { comentarSistema } from '../../shared/Comentarios.jsx';

// ============================================================
// FUENTE ÚNICA DE VERDAD DEL PIPELINE COMERCIAL
// ------------------------------------------------------------
// Este archivo define, en UN solo lugar, qué datos exige cada
// etapa del CRM. Tanto el arrastre en el tablero como los botones
// de la pantalla de detalle leen de acá, así que es imposible que
// se pidan datos distintos según por dónde entres. Ese era el
// requisito clave: los datos deben coincidir siempre.
//
// La idea de fondo: la ETAPA no es algo que el usuario "elige",
// es una consecuencia de los datos que cargó.
//   - Está en Cotización porque tiene una cotización.
//   - Está en Seguimiento porque además tiene un seguimiento.
//   - Está en Cierre porque tiene un resultado (Ganada/Perdida).
//
// Arrastrar una tarjeta a una etapa = "pedime los datos que faltan
// para llegar hasta ahí". Cargar esos datos hace avanzar la etapa
// sola. Las dos vías terminan siendo lo mismo por debajo.
// ============================================================

export const ETAPAS = ['Contacto inicial', 'Cotización', 'Seguimiento', 'Cierre'];

// ------------------------------------------------------------
// REQUISITOS de cada etapa.
//   cumplido(ctx, op): ¿la oportunidad YA tiene los datos para
//                      estar en esta etapa?
//   campos:            qué datos pedir para satisfacerla.
//   crearRegistro:     inserta el registro asociado (cotización /
//                      seguimiento) si la etapa lo requiere.
//   camposOp:          campos que se escriben en la propia
//                      oportunidad (el cierre).
// ------------------------------------------------------------
export const REQUISITOS = {
  'Contacto inicial': {
    // Etapa de entrada: se cumple con el alta (cliente + relevamiento).
    cumplido: () => true,
    campos: [],
  },

  'Cotización': {
    cumplido: (ctx) => (ctx.cotizaciones?.length || 0) > 0,
    campos: [
      { name: 'coti_ref', label: 'Referencia / archivo de la cotización', type: 'text', required: true,
        placeholder: 'Ej: Cotización DJI M30 · v1' },
      { name: 'coti_fecha', label: 'Fecha de envío', type: 'date', required: true, default: hoyISO() },
    ],
    crearRegistro: async (op, valores, ctx) => {
      const version = (ctx.cotizaciones?.length || 0) + 1;
      await crear('cotizaciones', {
        oportunidad_id: op.id,
        version,
        pdf: valores.coti_ref,
        fecha_envio: valores.coti_fecha || hoyISO(),
      });
    },
  },

  'Seguimiento': {
    cumplido: (ctx) => (ctx.seguimientos?.length || 0) > 0,
    campos: [
      { name: 'seg_tipo', label: 'Tipo de contacto', type: 'select', required: true,
        options: ['Llamada', 'Email', 'WhatsApp', 'Reunión', 'Visita'] },
      { name: 'seg_fecha', label: 'Fecha del contacto', type: 'date', required: true, default: hoyISO() },
      { name: 'seg_obs', label: 'Observaciones', type: 'textarea', required: true,
        placeholder: 'Qué se habló, qué quedó pendiente' },
      { name: 'seg_prox', label: 'Próximo contacto (opcional)', type: 'date', required: false },
    ],
    crearRegistro: async (op, valores) => {
      await crear('seguimientos', {
        oportunidad_id: op.id,
        tipo: valores.seg_tipo,
        fecha: valores.seg_fecha || hoyISO(),
        observaciones: valores.seg_obs,
        proximo_contacto: valores.seg_prox || null,
      });
    },
  },

  'Cierre': {
    cumplido: (ctx, op) => Boolean(op.resultado),
    campos: [
      { name: 'resultado', label: 'Resultado', type: 'select', required: true,
        options: ['Ganada', 'Perdida'] },
      // El motivo solo aparece y se exige si la oportunidad se pierde.
      { name: 'motivo', label: 'Motivo de la pérdida', type: 'select',
        options: ['Precio', 'Competencia', 'Sin presupuesto', 'No respondió', 'Otro'],
        showIf: (v) => v.resultado === 'Perdida',
        requiredIf: (v) => v.resultado === 'Perdida' },
      // El detalle solo aparece y se exige si el motivo es "Otro".
      { name: 'motivo_detalle', label: 'Detalle del motivo', type: 'text',
        placeholder: 'Contá brevemente por qué se perdió',
        showIf: (v) => v.resultado === 'Perdida' && v.motivo === 'Otro',
        requiredIf: (v) => v.resultado === 'Perdida' && v.motivo === 'Otro' },
    ],
    camposOp: (valores) => ({
      resultado: valores.resultado,
      motivo: valores.resultado === 'Perdida' ? (valores.motivo || '') : '',
      motivo_detalle: (valores.resultado === 'Perdida' && valores.motivo === 'Otro')
        ? (valores.motivo_detalle || '') : '',
    }),
  },
};

// ------------------------------------------------------------
// HELPERS de posición en el pipeline.
// ------------------------------------------------------------
const idx = (etapa) => ETAPAS.indexOf(etapa);
function etapaMax(a, b) {
  return ETAPAS[Math.max(idx(a), idx(b))] || b;
}

// Campos que faltan para que `op` llegue a la etapa `hacia`.
// Recorre todas las etapas intermedias no cumplidas y junta sus
// campos (acumulativo). Si no falta nada, devuelve [].
//   ctx = { cotizaciones: [...], seguimientos: [...] }
export function camposFaltantes(op, hacia, ctx) {
  const iH = idx(hacia), iA = idx(op.etapa);
  if (iH <= iA) return [];
  const campos = [];
  for (let i = 1; i <= iH; i++) {
    const req = REQUISITOS[ETAPAS[i]];
    if (req.cumplido(ctx, op)) continue;
    campos.push(...(req.campos || []));
  }
  return campos;
}

// Efectos colaterales del cierre: al ganar se crea la venta enlazada;
// al perder se deja constancia en el hilo de comentarios. Este es el
// ÚNICO lugar donde se crea la venta (antes estaba duplicado).
async function efectosCierre(op, camposOp) {
  if (!camposOp.resultado) return undefined;
  if (camposOp.resultado === 'Ganada') {
    const venta = await crear('ventas', {
      oportunidad_id: op.id, cliente_id: op.cliente_id, vendedor_id: op.vendedor_id,
      fecha_ganada: hoyISO(), direccion_entrega: '', fecha_entrega: '', observaciones: '',
      cobrado: false, registrado: false, comision: 0,
      estado: 'Ganada', motivo_cancel: '', fecha_cancel: '',
    });
    await comentarSistema('op', op.id, 'Oportunidad ganada. Se creó la venta enlazada.');
    return venta.id;
  }
  // Perdida
  const detalle = camposOp.motivo === 'Otro' ? camposOp.motivo_detalle : camposOp.motivo;
  await comentarSistema('op', op.id, `Oportunidad cerrada como perdida${detalle ? ' · motivo: ' + detalle : ''}.`);
  return undefined;
}

// ============================================================
// EL PORTERO ÚNICO (para el ARRASTRE / salto acumulativo)
// ------------------------------------------------------------
// Lleva la oportunidad HASTA la etapa `hacia`, completando en el
// camino todas las etapas intermedias que le falten con los datos
// que vienen en `valores`. Devuelve { ok, ventaId? }.
// Solo avanza hacia adelante; retroceder es un no-op.
// ============================================================
export async function avanzarEtapa(op, hacia, valores, ctx) {
  const iH = idx(hacia), iA = idx(op.etapa);
  if (iH <= iA) return { ok: true };

  let camposOp = {};
  for (let i = 1; i <= iH; i++) {
    const req = REQUISITOS[ETAPAS[i]];
    if (req.cumplido(ctx, op)) continue;
    if (req.crearRegistro) await req.crearRegistro(op, valores, ctx);
    if (req.camposOp) camposOp = { ...camposOp, ...req.camposOp(valores) };
  }

  await actualizar('oportunidades', op.id, { etapa: hacia, ...camposOp });
  const ventaId = await efectosCierre(op, camposOp);
  return { ok: true, ventaId };
}

// ============================================================
// COMPLETAR UNA ETAPA PUNTUAL (para los botones del DETALLE)
// ------------------------------------------------------------
// Agrega SIEMPRE el registro de esa etapa (permite, por ejemplo,
// cargar una segunda cotización estando ya en Seguimiento) y deja
// la etapa en el máximo entre la actual y la de este dato, sin
// retroceder nunca. Devuelve { ok, ventaId? }.
// ============================================================
export async function completarEtapa(op, etapa, valores, ctx) {
  const req = REQUISITOS[etapa];
  if (req.crearRegistro) await req.crearRegistro(op, valores, ctx);
  const camposOp = req.camposOp ? req.camposOp(valores) : {};
  await actualizar('oportunidades', op.id, { etapa: etapaMax(op.etapa, etapa), ...camposOp });
  const ventaId = await efectosCierre(op, camposOp);
  return { ok: true, ventaId };
}
