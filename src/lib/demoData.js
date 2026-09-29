// Datos de ejemplo para el MODO DEMO (sin Supabase).
// Reflejan la misma estructura que las tablas del schema.sql,
// para que el comportamiento sea igual al de la base real.

export const demoSeed = {
  clientes: [
    { id: 1, tipo: 'Empresa', razon_social: 'Agro Sur S.A.', nombre: '', apellido: '',
      cuit: '30-71234567-9', domicilio: 'Ruta 9 km 1284, Salta', telefono: '387-4567890',
      mail: 'compras@agrosur.com', observaciones: 'Cliente desde 2023.', vendedor_id: 2, activo: true },
    { id: 2, tipo: 'Empresa', razon_social: 'Campos del Norte S.R.L.', nombre: '', apellido: '',
      cuit: '30-70998877-1', domicilio: 'Ruta 34 km 22, R. de la Frontera', telefono: '387-4111222',
      mail: 'info@camposdelnorte.com', observaciones: '', vendedor_id: 3, activo: true },
    { id: 3, tipo: 'Persona física', razon_social: '', nombre: 'Carlos', apellido: 'Medina',
      cuit: '20-28456789-3', domicilio: 'Av. Belgrano 1450, Salta', telefono: '387-5556677',
      mail: 'cmedina@gmail.com', observaciones: 'Productor independiente.', vendedor_id: 2, activo: true },
    { id: 4, tipo: 'Sociedad', razon_social: 'Hermanos Ruiz Soc. de Hecho', nombre: '', apellido: '',
      cuit: '30-71122334-5', domicilio: 'Zona rural, Cerrillos', telefono: '387-4998877',
      mail: 'ruizhnos@outlook.com', observaciones: '', vendedor_id: 3, activo: true },
    { id: 5, tipo: 'Persona física', razon_social: 'SANZ NAVAMUEL AGUSTIN', nombre: '', apellido: '', cuit: '20352810097', domicilio: '', telefono: '3874156688', mail: '', observaciones: 'Importado del Excel de clientes.', activo: true, localidad: 'El Carril', provincia: 'Salta', actividad: 'Productor' },
  ],
  contactos: [
    { id: 1, cliente_id: 1, nombre: 'Marta', apellido: 'Giménez', cargo: 'Jefa de Compras', telefono: '387-4567891', mail: 'mgimenez@agrosur.com' },
    { id: 2, cliente_id: 1, nombre: 'Luis', apellido: 'Ortiz', cargo: 'Encargado de Campo', telefono: '387-4567892', mail: '' },
    { id: 3, cliente_id: 2, nombre: 'Roberto', apellido: 'Sosa', cargo: 'Gerente', telefono: '387-4111223', mail: 'rsosa@camposdelnorte.com' },
  ],
  // Cada usuario puede tener MÁS DE UN rol (ej: Vendedor + Postventa).
  // Ve la suma de lo que permiten sus roles.
  usuarios: [
    { id: 1, nombre: 'M. Alvarez', mail: 'malvarez@empresa.com', roles: ['Administrador'], acceso: 'Activo', acceso_desde: '', estado_cuenta: 'Activa' },
    { id: 2, nombre: 'J. Pérez', mail: 'jperez@empresa.com', roles: ['Vendedor'], acceso: 'Activo', acceso_desde: '', estado_cuenta: 'Activa', telefono: '+54 387 4100200', whatsapp: '+54 9 387 4100200', cargo: 'Asesor Comercial' },
    { id: 3, nombre: 'L. Gómez', mail: 'lgomez@empresa.com', roles: ['Vendedor', 'Postventa'], acceso: 'Activo', acceso_desde: '', estado_cuenta: 'Activa' },
    { id: 4, nombre: 'O. Vera', mail: 'overa@externo.com', roles: ['Vendedor tercerizado'], acceso: 'Inactivo', acceso_desde: '2025-06-30', estado_cuenta: 'Activa' },
    { id: 5, nombre: 'R. Luna', mail: 'rluna@empresa.com', roles: ['Postventa'], acceso: 'Activo', acceso_desde: '', estado_cuenta: 'Restablecer' },
    { id: 6, nombre: 'D. Herrera', mail: 'dherrera@empresa.com', roles: ['Técnico'], acceso: 'Activo', acceso_desde: '', estado_cuenta: 'Activa' },
    { id: 7, nombre: 'P. Molina', mail: 'pmolina@empresa.com', roles: ['Técnico'], acceso: 'Bloqueado', acceso_desde: '2025-07-09', estado_cuenta: 'Pendiente' },
  ],
  oportunidades: [
    { id: 1, cliente_id: 1, etapa: 'Seguimiento', fecha_contacto: '2025-07-02', relevamiento: '2 drones de pulverización, cobertura 400 ha', resultado: null, motivo: '', motivo_detalle: '', vendedor_id: 2 },
    { id: 2, cliente_id: 4, etapa: 'Cotización', fecha_contacto: '2025-07-08', relevamiento: '1 dron + capacitación', resultado: null, motivo: '', motivo_detalle: '', vendedor_id: 3 },
    { id: 3, cliente_id: 2, etapa: 'Contacto inicial', fecha_contacto: '2025-07-10', relevamiento: '3 drones Agras T40', resultado: null, motivo: '', motivo_detalle: '', vendedor_id: 3 },
    { id: 4, cliente_id: 3, etapa: 'Cierre', fecha_contacto: '2025-06-01', relevamiento: '1 dron DJI T25', resultado: 'Ganada', motivo: '', motivo_detalle: '', vendedor_id: 2, fecha_cierre: '2025-06-20' },
    ...[
      ['Ganada', '2025-05-02'], ['Perdida', '2025-05-10'], ['Perdida', '2025-05-21'], ['Ganada', '2025-06-03'],
      ['Perdida', '2025-06-11'], ['Ganada', '2025-06-28'], ['Perdida', '2025-07-04'], ['Perdida', '2025-07-15'],
      ['Ganada', '2025-04-12'], ['Perdida', '2025-04-02'], ['Perdida', '2025-03-20'], ['Ganada', '2025-03-05'],
    ].map(([resultado, fecha_cierre], i) => ({
      id: 5 + i, cliente_id: (i % 4) + 1, etapa: 'Cierre', fecha_contacto: '2025-02-15',
      relevamiento: `Consulta por dron de pulverización · lote ${i + 1}`, resultado,
      motivo: resultado === 'Perdida' ? 'Precio' : '', motivo_detalle: '', vendedor_id: i % 2 ? 3 : 2, fecha_cierre,
    })),
  ],
  cotizaciones: [
    { id: 1, oportunidad_id: 1, version: 1, pdf: 'cotizacion_agrosur_v1.pdf', fecha_envio: '2025-07-05' },
    { id: 2, oportunidad_id: 1, version: 2, pdf: 'cotizacion_agrosur_v2.pdf', fecha_envio: '2025-07-12' },
    { id: 3, oportunidad_id: 2, version: 1, pdf: 'cotizacion_ruiz_v1.pdf', fecha_envio: '2025-07-10' },
    { id: 4, oportunidad_id: 4, version: 1, pdf: 'cotizacion_medina_v1.pdf', fecha_envio: '2025-06-05' },
  ],
  seguimientos: [
    { id: 1, oportunidad_id: 1, tipo: 'Llamada', fecha: '2025-07-14', observaciones: 'Interesado, pide mejorar plazo de entrega.', proximo_contacto: '2025-07-21' },
    { id: 2, oportunidad_id: 1, tipo: 'WhatsApp', fecha: '2025-07-16', observaciones: 'Envié ficha técnica.', proximo_contacto: '' },
  ],
  ventas: [
    { id: 1, oportunidad_id: 4, cliente_id: 3, vendedor_id: 2, fecha_ganada: '2025-06-20',
      direccion_entrega: 'Av. Belgrano 1450, Salta', fecha_entrega: '2025-07-01', observaciones: 'Capacitación incluida.',
      cobrado: true, registrado: true, comision: 0, estado: 'Entregada', motivo_cancel: '', fecha_cancel: '' },
    { id: 2, oportunidad_id: null, cliente_id: 1, vendedor_id: 2, fecha_ganada: '2025-03-10',
      direccion_entrega: 'Ruta 9 km 1284, Salta', fecha_entrega: '2025-03-18', observaciones: '',
      cobrado: true, registrado: false, comision: 0, estado: 'Entregada', motivo_cancel: '', fecha_cancel: '' },
  ],
  productos: [
    { id: 1, venta_id: 1, modelo: 'DJI Agras T25', nro_serie: 'T25-88213', activado: true, alta_dji: true, garantia: '2026-07-01' },
    { id: 2, venta_id: 2, modelo: 'DJI Agras T40', nro_serie: 'T40-77120', activado: true, alta_dji: true, garantia: '2026-03-18' },
    { id: 3, venta_id: 2, modelo: 'DJI Agras T40', nro_serie: 'T40-77121', activado: true, alta_dji: false, garantia: '2026-03-18' },
    { id: 4, venta_id: null, cliente_id: 5, equipo: 'T50', ns_dron: '63YBM76002003V', fecha_activacion: '2025-04-14', activado: true, localidad: 'El Carril', entrega_a_cargo: 'Lautaro' },
  ],
  postventas: [
    { id: 1, venta_id: 1, cliente_id: 3, equipo: null, creado_en: '2025-07-01' },
    { id: 2, venta_id: 2, cliente_id: 1, equipo: null, creado_en: '2025-03-18' },
  ],
  tareas_postventa: [
    { id: 1, venta_id: 1, postventa_id: 1, hito: '1 semana', objetivo: '2025-07-08', estado: 'Realizada', fecha_real: '2025-07-09', observaciones: 'Cliente conforme.', hectareas: 120, visita: false, visita_estado: '', visita_agenda: '', visita_real: '', responsable_id: 5 },
    { id: 2, venta_id: 1, postventa_id: 1, hito: '1 mes', objetivo: '2025-08-01', estado: 'Pendiente', fecha_real: '', observaciones: '', hectareas: null, visita: false, visita_estado: '', visita_agenda: '', visita_real: '', responsable_id: 5 },
    { id: 3, venta_id: 1, postventa_id: 1, hito: '2 meses', objetivo: '2025-09-01', estado: 'Pendiente', fecha_real: '', observaciones: '', hectareas: null, visita: false, visita_estado: '', visita_agenda: '', visita_real: '', responsable_id: 5 },
    { id: 4, venta_id: 2, postventa_id: 2, hito: '1 semana', objetivo: '2025-03-25', estado: 'Realizada', fecha_real: '2025-03-26', observaciones: 'Todo ok.', hectareas: 80, visita: false, visita_estado: '', visita_agenda: '', visita_real: '', responsable_id: 5 },
    { id: 5, venta_id: 2, postventa_id: 2, hito: '1 mes', objetivo: '2025-04-18', estado: 'Realizada', fecha_real: '2025-05-02', observaciones: 'Coordinó visita técnica.', hectareas: 340, visita: true, visita_estado: 'Solicitada', visita_agenda: '', visita_real: '', responsable_id: 5 },
    { id: 6, venta_id: 2, postventa_id: 2, hito: '2 meses', objetivo: '2025-05-18', estado: 'Pendiente', fecha_real: '', observaciones: '', hectareas: null, visita: false, visita_estado: '', visita_agenda: '', visita_real: '', responsable_id: 5 },
  ],
  trabajos: [
    { id: 1, cliente_id: 1, tipo: 'Service', nro: 'OT-0442', ingreso: '2025-07-05', egreso: '',
      marca: 'DJI', modelo: 'Agras T40', nro_serie: 'T40-77120', garantia: true, registrado: true,
      estado: 'En reparación', observaciones: 'Falla en motor 2.', informe: '' },
    { id: 2, cliente_id: 3, tipo: 'Reparación', nro: 'R-001284', ingreso: '2025-06-28', egreso: '2025-07-04',
      marca: 'DJI', modelo: 'Agras T25', nro_serie: 'T25-88213', garantia: false, registrado: true,
      estado: 'Entregada', observaciones: 'Cambio de tren de aterrizaje.', informe: 'informe_r001284.pdf' },
  ],
  tareas: [
    { id: 1, trabajo_id: 1, descripcion: 'Diagnóstico de motores', tecnico_id: 6, horas: 2, estado: 'Hecha' },
    { id: 2, trabajo_id: 1, descripcion: 'Reemplazo motor 2', tecnico_id: 6, horas: 3, estado: 'Pendiente' },
    { id: 3, trabajo_id: 2, descripcion: 'Cambio tren de aterrizaje', tecnico_id: 6, horas: 2.5, estado: 'Hecha' },
  ],
  repuestos: [
    { id: 1, trabajo_id: 1, articulo: 'Motor 2306', cantidad: 1, pieza_vieja: 'MV-88213', pieza_nueva: 'MV-90441', garantia: true, registrado: true },
    { id: 2, trabajo_id: 2, articulo: 'Tren aterrizaje', cantidad: 1, pieza_vieja: 'TA-1120', pieza_nueva: 'TA-3390', garantia: false, registrado: true },
  ],
  comentarios: [
    { id: 1, entidad: 'op', ref_id: 1, texto: 'Cliente muy interesado, pidió mejorar el plazo.', fecha: '2025-07-14', autor_id: 2 },
    { id: 2, entidad: 'venta', ref_id: 1, texto: 'Capacitación coordinada para la semana de entrega.', fecha: '2025-06-25', autor_id: 2 },
    { id: 3, entidad: 'trabajo', ref_id: 1, texto: 'Se pidió el motor al proveedor, demora 5 días.', fecha: '2025-07-06', autor_id: 6 },
  ],
  configuracion: [
    { id: 1, ot_inicial: 440, ot_actual: 442, rem_inicial: 1280, rem_actual: 1284,
      sem_com_verde: 7, sem_com_amarillo: 15, sem_post_verde: 30, sem_post_amarillo: 60, sem_serv_verde: 7, sem_serv_amarillo: 15,
      pres_tipos: ['Venta de drones DJI', 'Servicio técnico / reparación', 'Capacitación', 'Productos Ligier', 'Mixto'],
      pres_condiciones: ['Contado', '50% adelanto / 50% contra entrega', '30 días', 'A convenir'],
      pres_validez: ['15 días corridos desde la fecha de emisión', '30 días corridos desde la fecha de emisión', '7 días corridos desde la fecha de emisión', 'A convenir'],
      pres_anio: null, pres_actual: 0,
      mail_host: 'smtp.gmail.com', mail_port: '587', mail_seg: 'TLS', mail_user: 'sistema@empresa.com', mail_from: 'DRAP - Sistema de Gestión',
      // alcance de datos para vendedores (no aplica a tercerizados, que siempre ven solo lo suyo)
      vendedores_ven_todo: false },
  ],
  // Matriz de permisos configurable por el admin: qué módulos ve cada rol.
  // El admin la edita desde Configuración. 'Administrador' no está: ve todo siempre.
  permisos: [
    { id: 1, rol: 'Vendedor', modulos: ['dashboard', 'clientes', 'comercial', 'ventas', 'postventa'] },
    { id: 2, rol: 'Vendedor tercerizado', modulos: ['dashboard', 'clientes', 'comercial', 'ventas'] },
    { id: 3, rol: 'Técnico', modulos: ['dashboard', 'clientes', 'service'] },
    { id: 4, rol: 'Postventa', modulos: ['dashboard', 'clientes', 'ventas', 'postventa'] },
  ],
  productos_catalogo: [{"id":1,"sku":"ALEMOR-80L","codigo":"","descripcion":"Mezclador de Caldo 80 Litros – Alemor","precio":2503,"marca":"Alemor","activo":true},{"id":2,"sku":"ALEMOR-140L","codigo":"","descripcion":"Mezclador de Caldo 140 Litros – Alemor","precio":2713,"marca":"Alemor","activo":true},{"id":3,"sku":"ALEMOR-240L","codigo":"","descripcion":"Mezclador de Caldo 240 Litros – Alemor","precio":3658,"marca":"Alemor","activo":true},{"id":4,"sku":"LIGIER-GRASS-BIO","codigo":"","descripcion":"Ligier Grass Bio – Penetrante / Estabilizante / Tensioactivo","precio":30,"marca":"Ligier","activo":true},{"id":5,"sku":"LIGIER-VERDE-BIO","codigo":"","descripcion":"Ligier Verde Bio – Tensioactivo / Adherente / Antievaporante","precio":34.9,"marca":"Ligier","activo":true},{"id":6,"sku":"LIGIER-PH-BIO","codigo":"","descripcion":"Ligier pH Bio – Regulador de pH / Secuestrante / Buffer / Humectante","precio":39.9,"marca":"Ligier","activo":true},{"id":7,"sku":"YC.ST.LL000229.01","codigo":"DJI-R1090","descripcion":"T20-PR00500030-035013-1223-N","precio":0.83,"marca":"DJI","activo":true},{"id":8,"sku":"YC.WJ.LL000379.02","codigo":"DJI-R834","descripcion":"T14-PP00500050-025005-0323-N","precio":0.83,"marca":"DJI","activo":true},{"id":9,"sku":"YC.WJ.LL000375.02","codigo":"DJI-R796","descripcion":"T14-PC00300030-025006-0323-N","precio":0.83,"marca":"DJI","activo":true},{"id":10,"sku":"YC.JG.MQ001336.03","codigo":"DJI-R936","descripcion":"Status LED Shielding Foam","precio":0.83,"marca":"DJI","activo":true},{"id":11,"sku":"YC.JG.MY000605.01","codigo":"DJI-R1262","descripcion":"Scroll Wheel Waterproof Ring","precio":0.83,"marca":"DJI","activo":true},{"id":12,"sku":"YC.JG.TT000113.02","codigo":"DJI-R954","descripcion":"Scroll Wheel Spring","precio":0.83,"marca":"DJI","activo":true},{"id":13,"sku":"YC.JG.ZS001930.03","codigo":"DJI-R1357","descripcion":"Scroll Wheel Bracket","precio":0.83,"marca":"DJI","activo":true},{"id":14,"sku":"YC.ST.LL000273.01","codigo":"DJI-R857","descripcion":"Screw T20-HC00800080-040020-0323-N","precio":0.83,"marca":"DJI","activo":true},{"id":15,"sku":"YC.WJ.LL000394.03","codigo":"DJI-R1341","descripcion":"Screw (T20-PP00400040-035014-3123-N)","precio":0.83,"marca":"DJI","activo":true},{"id":16,"sku":"YC.ST.LL000069.03","codigo":"DJI-R1297","descripcion":"Screw (T20-PC00300030-030006-3123-N)","precio":0.83,"marca":"DJI","activo":true},{"id":17,"sku":"YC.JG.MY000753.05","codigo":"DJI-R892","descripcion":"Pause Button Silicone Rubber Pad","precio":0.83,"marca":"DJI","activo":true},{"id":18,"sku":"YC.WJ.LL000288.01","codigo":"DJI-R1087","descripcion":"M16-PC00300030-030008-0323-Y","precio":0.83,"marca":"DJI","activo":true},{"id":19,"sku":"YC.WJ.C00159","codigo":"DJI-R1092","descripcion":"Inspire 1 Remote Controller Ball Bearing","precio":0.83,"marca":"DJI","activo":true},{"id":20,"sku":"YC.JG.MQ001101.01","codigo":"DJI-R1083","descripcion":"Fan Anti-Backflow Foam(46*3*2mm)","precio":0.83,"marca":"DJI","activo":true}],
  presupuestos: [],
  presupuesto_items: [],
};
