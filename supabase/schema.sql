-- ============================================================
-- DRAP · Esquema de base de datos para Supabase (PostgreSQL)
-- ============================================================
-- Cómo usar:
--   1. Entrá a tu proyecto de Supabase.
--   2. Menú lateral -> SQL Editor -> New query.
--   3. Pegá TODO este archivo y ejecutá (Run).
--   4. Se crean todas las tablas con sus relaciones.
-- ============================================================

-- ---------- USUARIOS ----------
-- Los usuarios del sistema y su rol. La autenticación real se
-- integra con Supabase Auth; esta tabla guarda el perfil y el rol.
create table if not exists usuarios (
  id          bigint generated always as identity primary key,
  nombre      text not null,
  mail        text not null unique,
  rol         text not null default 'Vendedor',   -- Administrador | Vendedor | Vendedor tercerizado | Técnico | Postventa
  acceso      text not null default 'Activo',      -- Activo | Inactivo | Bloqueado
  acceso_desde date,
  estado_cuenta text not null default 'Pendiente', -- Activa | Pendiente | Restablecer
  invitado    date,
  creado_en   timestamptz default now()
);

-- ---------- CLIENTES ----------
create table if not exists clientes (
  id           bigint generated always as identity primary key,
  tipo         text not null default 'Empresa',    -- Persona física | Empresa | Sociedad
  razon_social text,
  nombre       text,
  apellido     text,
  cuit         text,
  domicilio    text,
  telefono     text,
  mail         text,
  observaciones text,
  vendedor_id  bigint references usuarios(id),
  activo       boolean not null default true,       -- borrado lógico
  creado_en    timestamptz default now()
);

-- ---------- CONTACTOS ----------
create table if not exists contactos (
  id         bigint generated always as identity primary key,
  cliente_id bigint not null references clientes(id) on delete cascade,
  nombre     text not null,
  apellido   text,
  cargo      text,
  telefono   text,
  mail       text
);

-- ---------- OPORTUNIDADES (pipeline comercial) ----------
create table if not exists oportunidades (
  id            bigint generated always as identity primary key,
  cliente_id    bigint not null references clientes(id),
  etapa         text not null default 'Contacto inicial', -- Contacto inicial | Cotización | Seguimiento | Cierre
  fecha_contacto date,
  relevamiento  text,
  resultado     text,                                -- Ganada | Perdida | Venta cancelada | null
  motivo        text,
  motivo_detalle text,
  vendedor_id   bigint references usuarios(id),
  creado_en     timestamptz default now()
);

-- ---------- COTIZACIONES ----------
create table if not exists cotizaciones (
  id             bigint generated always as identity primary key,
  oportunidad_id bigint not null references oportunidades(id) on delete cascade,
  version        int not null default 1,
  pdf            text,          -- nombre/URL del archivo
  fecha_envio    date
);

-- ---------- SEGUIMIENTOS COMERCIALES ----------
create table if not exists seguimientos (
  id             bigint generated always as identity primary key,
  oportunidad_id bigint not null references oportunidades(id) on delete cascade,
  tipo           text,          -- Llamada | WhatsApp | Mail | Visita
  fecha          date,
  observaciones  text,
  proximo_contacto date
);

-- ---------- VENTAS ----------
create table if not exists ventas (
  id             bigint generated always as identity primary key,
  oportunidad_id bigint references oportunidades(id),
  cliente_id     bigint not null references clientes(id),
  vendedor_id    bigint references usuarios(id),
  fecha_ganada   date,
  direccion_entrega text,
  fecha_entrega  date,
  observaciones  text,
  cobrado        boolean default false,
  registrado     boolean default false,
  comision       numeric default 0,
  estado         text not null default 'Ganada',   -- Ganada | Entregada | Cancelada
  motivo_cancel  text,
  fecha_cancel   date,
  creado_en      timestamptz default now()
);

-- ---------- PRODUCTOS ACTIVADOS ----------
create table if not exists productos (
  id        bigint generated always as identity primary key,
  venta_id  bigint not null references ventas(id) on delete cascade,
  modelo    text,
  nro_serie text,
  activado  boolean default false,
  alta_dji  boolean default false,
  garantia  date
);

-- ---------- TAREAS DE POSTVENTA ----------
create table if not exists tareas_postventa (
  id            bigint generated always as identity primary key,
  venta_id      bigint not null references ventas(id) on delete cascade,
  hito          text,          -- 1 semana | 1 mes | 2 meses
  objetivo      date,
  estado        text default 'Pendiente',  -- Pendiente | Realizada
  fecha_real    date,
  observaciones text,
  hectareas     numeric,
  visita        boolean default false,
  visita_estado text,          -- '' | Solicitada | Agendada | Realizada
  visita_agenda date,
  visita_real   date,
  responsable_id bigint references usuarios(id)
);

-- ---------- TRABAJOS (service / reparación) ----------
create table if not exists trabajos (
  id          bigint generated always as identity primary key,
  cliente_id  bigint not null references clientes(id),
  tipo        text not null default 'Service',  -- Service | Reparación
  nro         text,           -- OT-0442 | R-001284
  ingreso     date,
  egreso      date,
  marca       text,
  modelo      text,
  nro_serie   text,
  garantia    boolean default false,
  registrado  boolean default false,
  estado      text default 'Ingresada',
  observaciones text,
  informe     text,           -- nombre/URL del informe técnico
  creado_en   timestamptz default now()
);

-- ---------- TAREAS DE TRABAJO ----------
create table if not exists tareas (
  id         bigint generated always as identity primary key,
  trabajo_id bigint not null references trabajos(id) on delete cascade,
  descripcion text,
  tecnico_id bigint references usuarios(id),
  horas      numeric default 0,
  estado     text default 'Pendiente'  -- Pendiente | Hecha
);

-- ---------- REPUESTOS UTILIZADOS ----------
create table if not exists repuestos (
  id          bigint generated always as identity primary key,
  trabajo_id  bigint not null references trabajos(id) on delete cascade,
  articulo    text,
  cantidad    int default 1,
  pieza_vieja text,
  pieza_nueva text,
  garantia    boolean default false,
  registrado  boolean default false
);

-- ---------- COMENTARIOS (transversal) ----------
create table if not exists comentarios (
  id        bigint generated always as identity primary key,
  entidad   text not null,   -- op | venta | post | trabajo
  ref_id    bigint not null,
  texto     text not null,
  fecha     date default now(),
  autor_id  bigint references usuarios(id)
);

-- ---------- CONFIGURACIÓN (fila única de parámetros) ----------
create table if not exists configuracion (
  id             int primary key default 1,
  ot_inicial     int default 440,
  ot_actual      int default 442,
  rem_inicial    int default 1280,
  rem_actual     int default 1284,
  sem_com_verde  int default 7,
  sem_com_amarillo int default 15,
  sem_post_verde int default 30,
  sem_post_amarillo int default 60,
  mail_host      text,
  mail_port      text,
  mail_seg       text,
  mail_user      text,
  mail_from      text,
  constraint fila_unica check (id = 1)
);

-- Fila de configuración inicial
insert into configuracion (id) values (1) on conflict (id) do nothing;

-- ============================================================
-- DATOS DE EJEMPLO (opcional). Descomentá si querés arrancar
-- con algunos registros para probar la app conectada.
-- ============================================================
-- insert into usuarios (nombre, mail, rol) values
--   ('M. Alvarez','malvarez@empresa.com','Administrador'),
--   ('J. Pérez','jperez@empresa.com','Vendedor');
-- insert into clientes (tipo, razon_social, cuit, domicilio, telefono, vendedor_id) values
--   ('Empresa','Agro Sur S.A.','30-71234567-9','Ruta 9 km 1284','387-4567890',1);

-- ============================================================
-- SEGURIDAD (RLS). Para el piloto, se deja el acceso abierto a
-- la clave anónima. ANTES de producción real, activá Row Level
-- Security y definí políticas por rol. Ver README, sección
-- "Seguridad".
-- ============================================================
