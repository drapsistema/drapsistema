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
    { id: 2, nombre: 'J. Pérez', mail: 'jperez@empresa.com', roles: ['Vendedor'], acceso: 'Activo', acceso_desde: '', estado_cuenta: 'Activa' },
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
    { id: 4, cliente_id: 3, etapa: 'Cierre', fecha_contacto: '2025-06-01', relevamiento: '1 dron DJI T25', resultado: 'Ganada', motivo: '', motivo_detalle: '', vendedor_id: 2 },
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
  ],
  tareas_postventa: [
    { id: 1, venta_id: 1, hito: '1 semana', objetivo: '2025-07-08', estado: 'Realizada', fecha_real: '2025-07-09', observaciones: 'Cliente conforme.', hectareas: 120, visita: false, visita_estado: '', visita_agenda: '', visita_real: '', responsable_id: 5 },
    { id: 2, venta_id: 1, hito: '1 mes', objetivo: '2025-08-01', estado: 'Pendiente', fecha_real: '', observaciones: '', hectareas: null, visita: false, visita_estado: '', visita_agenda: '', visita_real: '', responsable_id: 5 },
    { id: 3, venta_id: 1, hito: '2 meses', objetivo: '2025-09-01', estado: 'Pendiente', fecha_real: '', observaciones: '', hectareas: null, visita: false, visita_estado: '', visita_agenda: '', visita_real: '', responsable_id: 5 },
    { id: 4, venta_id: 2, hito: '1 semana', objetivo: '2025-03-25', estado: 'Realizada', fecha_real: '2025-03-26', observaciones: 'Todo ok.', hectareas: 80, visita: false, visita_estado: '', visita_agenda: '', visita_real: '', responsable_id: 5 },
    { id: 5, venta_id: 2, hito: '1 mes', objetivo: '2025-04-18', estado: 'Realizada', fecha_real: '2025-05-02', observaciones: 'Coordinó visita técnica.', hectareas: 340, visita: true, visita_estado: 'Solicitada', visita_agenda: '', visita_real: '', responsable_id: 5 },
    { id: 6, venta_id: 2, hito: '2 meses', objetivo: '2025-05-18', estado: 'Pendiente', fecha_real: '', observaciones: '', hectareas: null, visita: false, visita_estado: '', visita_agenda: '', visita_real: '', responsable_id: 5 },
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
      sem_com_verde: 7, sem_com_amarillo: 15, sem_post_verde: 30, sem_post_amarillo: 60,
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
};
