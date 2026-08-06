// Datos de ejemplo para el MODO DEMO (sin Supabase).
// Reflejan la misma estructura que las tablas del schema.sql,
// para que el comportamiento sea igual al de la base real.
// Se clonan al iniciar para poder crear/editar sin perder el original.

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
    { id: 1, cliente_id: 1, nombre: 'Marta', apellido: 'Giménez', cargo: 'Jefa de Compras',
      telefono: '387-4567891', mail: 'mgimenez@agrosur.com' },
    { id: 2, cliente_id: 1, nombre: 'Luis', apellido: 'Ortiz', cargo: 'Encargado de Campo',
      telefono: '387-4567892', mail: '' },
    { id: 3, cliente_id: 2, nombre: 'Roberto', apellido: 'Sosa', cargo: 'Gerente',
      telefono: '387-4111223', mail: 'rsosa@camposdelnorte.com' },
  ],
  usuarios: [
    { id: 1, nombre: 'M. Alvarez', mail: 'malvarez@empresa.com', rol: 'Administrador', acceso: 'Activo' },
    { id: 2, nombre: 'J. Pérez', mail: 'jperez@empresa.com', rol: 'Vendedor', acceso: 'Activo' },
    { id: 3, nombre: 'L. Gómez', mail: 'lgomez@empresa.com', rol: 'Vendedor', acceso: 'Activo' },
    { id: 4, nombre: 'O. Vera', mail: 'overa@externo.com', rol: 'Vendedor tercerizado', acceso: 'Activo' },
    { id: 5, nombre: 'R. Luna', mail: 'rluna@empresa.com', rol: 'Postventa', acceso: 'Activo' },
    { id: 6, nombre: 'D. Herrera', mail: 'dherrera@empresa.com', rol: 'Técnico', acceso: 'Activo' },
  ],
  oportunidades: [
    { id: 1, cliente_id: 1, etapa: 'Seguimiento', fecha_contacto: '2025-07-02',
      relevamiento: '2 drones de pulverización, cobertura 400 ha', resultado: null,
      motivo: '', vendedor_id: 2 },
    { id: 2, cliente_id: 4, etapa: 'Cotización', fecha_contacto: '2025-07-08',
      relevamiento: '1 dron + capacitación', resultado: null, motivo: '', vendedor_id: 3 },
    { id: 3, cliente_id: 2, etapa: 'Contacto inicial', fecha_contacto: '2025-07-10',
      relevamiento: '3 drones Agras T40', resultado: null, motivo: '', vendedor_id: 3 },
  ],
};
