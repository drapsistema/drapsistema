// Campos de cada equipo cargado en una venta (detalle de venta y
// Equipos activados). Solo "Equipo" es obligatorio.
export const CAMPOS_EQUIPO = [
  { name: 'equipo', label: 'Equipo', type: 'text', required: true, full: true, placeholder: 'Ej: DJI Agras T50' },
  { name: 'ns_dron', label: 'N° de serie de dron', type: 'text' },
  { name: 'fecha_activacion', label: 'Fecha de activación', type: 'date' },
  { name: 'contrasena', label: 'Contraseña', type: 'text', placeholder: 'La inicial, hasta que el cliente la cambie' },
  { name: 'ns_caja_dron', label: 'NS caja de dron', type: 'text' },
  { name: 'ns_caja_tanque', label: 'NS caja tanque de líquidos', type: 'text' },
  { name: 'ns_tanque_solido', label: 'NS tanque sólido', type: 'text' },
  { name: 'ns_baterias', label: 'N° serie baterías', type: 'text' },
  { name: 'ns_hub', label: 'N° serie HUB', type: 'text' },
  { name: 'ns_wb37', label: 'N° serie WB37', type: 'text' },
  { name: 'ns_100w', label: 'N° serie 100W', type: 'text' },
  { name: 'ns_core_board', label: 'N° serie core board control', type: 'text' },
  { name: 'ns_generador', label: 'N° serie generador', type: 'text' },
  { name: 'localidad', label: 'Localidad', type: 'text' },
  { name: 'mail', label: 'Mail', type: 'text' },
  { name: 'entrega_a_cargo', label: 'Entrega a cargo de', type: 'text' },
];
