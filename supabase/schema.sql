-- ============================================================
-- DRAP · Esquema de base de datos para Supabase (PostgreSQL)
-- VERSIÓN 2 · actualizado con roles múltiples, permisos y
-- vínculo con Supabase Auth (para las políticas RLS).
-- ============================================================
-- Cómo usar:
--   1. Supabase -> SQL Editor -> New query.
--   2. Pega TODO este archivo.
--   3. Run (con el boton normal "Run", NO "Run and enable RLS").
--
-- Este script primero BORRA las tablas viejas (si existen) y las
-- recrea actualizadas. Es seguro si tu base esta vacia o de prueba.
-- Si ya tuvieras datos reales, NO lo corras sin respaldo.
-- ============================================================

-- ---------- LIMPIEZA de tablas viejas ----------
drop table if exists comentarios cascade;
drop table if exists repuestos cascade;
drop table if exists tareas cascade;
drop table if exists trabajos cascade;
drop table if exists tareas_postventa cascade;
drop table if exists productos cascade;
drop table if exists ventas cascade;
drop table if exists seguimientos cascade;
drop table if exists cotizaciones cascade;
drop table if exists oportunidades cascade;
drop table if exists contactos cascade;
drop table if exists clientes cascade;
drop table if exists permisos cascade;
drop table if exists configuracion cascade;
drop table if exists usuarios cascade;

-- ============================================================
-- USUARIOS
--  - roles: ARRAY de texto. Un usuario puede tener varios roles
--    (ej: {'Vendedor','Postventa'}). Ve la suma de lo que permiten.
--  - auth_uid: vincula esta fila con el usuario de Supabase Auth.
--    Es lo que permite que RLS sepa quien esta logueado.
-- ============================================================
create table usuarios (
  id            bigint generated always as identity primary key,
  auth_uid      uuid unique,
  nombre        text not null,
  mail          text not null unique,
  roles         text[] not null default '{Vendedor}',
  acceso        text not null default 'Activo',
  acceso_desde  date,
  estado_cuenta text not null default 'Pendiente',
  invitado      date,
  creado_en     timestamptz default now()
);

-- ============================================================
-- PERMISOS (matriz configurable por el admin)
-- ============================================================
create table permisos (
  id       bigint generated always as identity primary key,
  rol      text not null unique,
  modulos  text[] not null default '{}'
);

-- ---------- CLIENTES ----------
create table clientes (
  id           bigint generated always as identity primary key,
  tipo         text not null default 'Empresa',
  razon_social text,
  nombre       text,
  apellido     text,
  cuit         text,
  domicilio    text,
  telefono     text,
  mail         text,
  observaciones text,
  vendedor_id  bigint references usuarios(id),
  activo       boolean not null default true,
  creado_en    timestamptz default now()
);

-- ---------- CONTACTOS ----------
create table contactos (
  id         bigint generated always as identity primary key,
  cliente_id bigint not null references clientes(id) on delete cascade,
  nombre     text not null,
  apellido   text,
  cargo      text,
  telefono   text,
  mail       text
);

-- ---------- OPORTUNIDADES ----------
create table oportunidades (
  id            bigint generated always as identity primary key,
  cliente_id    bigint not null references clientes(id),
  etapa         text not null default 'Contacto inicial',
  fecha_contacto date,
  relevamiento  text,
  resultado     text,
  motivo        text,
  motivo_detalle text,
  vendedor_id   bigint references usuarios(id),
  creado_en     timestamptz default now()
);

-- ---------- COTIZACIONES ----------
create table cotizaciones (
  id             bigint generated always as identity primary key,
  oportunidad_id bigint not null references oportunidades(id) on delete cascade,
  version        int not null default 1,
  pdf            text,
  fecha_envio    date
);

-- ---------- SEGUIMIENTOS COMERCIALES ----------
create table seguimientos (
  id             bigint generated always as identity primary key,
  oportunidad_id bigint not null references oportunidades(id) on delete cascade,
  tipo           text,
  fecha          date,
  observaciones  text,
  proximo_contacto date
);

-- ---------- VENTAS ----------
create table ventas (
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
  estado         text not null default 'Ganada',
  motivo_cancel  text,
  fecha_cancel   date,
  creado_en      timestamptz default now()
);

-- ---------- PRODUCTOS ACTIVADOS ----------
create table productos (
  id        bigint generated always as identity primary key,
  venta_id  bigint not null references ventas(id) on delete cascade,
  modelo    text,
  nro_serie text,
  activado  boolean default false,
  alta_dji  boolean default false,
  garantia  date
);

-- ---------- TAREAS DE POSTVENTA ----------
create table tareas_postventa (
  id            bigint generated always as identity primary key,
  venta_id      bigint not null references ventas(id) on delete cascade,
  hito          text,
  objetivo      date,
  estado        text default 'Pendiente',
  fecha_real    date,
  observaciones text,
  hectareas     numeric,
  visita        boolean default false,
  visita_estado text,
  visita_agenda date,
  visita_real   date,
  responsable_id bigint references usuarios(id)
);

-- ---------- TRABAJOS (service / reparacion) ----------
create table trabajos (
  id          bigint generated always as identity primary key,
  cliente_id  bigint not null references clientes(id),
  tipo        text not null default 'Service',
  nro         text,
  ingreso     date,
  egreso      date,
  marca       text,
  modelo      text,
  nro_serie   text,
  garantia    boolean default false,
  registrado  boolean default false,
  estado      text default 'Ingresada',
  observaciones text,
  informe     text,
  creado_en   timestamptz default now()
);

-- ---------- TAREAS DE TRABAJO ----------
create table tareas (
  id         bigint generated always as identity primary key,
  trabajo_id bigint not null references trabajos(id) on delete cascade,
  descripcion text,
  tecnico_id bigint references usuarios(id),
  horas      numeric default 0,
  estado     text default 'Pendiente'
);

-- ---------- REPUESTOS UTILIZADOS ----------
create table repuestos (
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
create table comentarios (
  id        bigint generated always as identity primary key,
  entidad   text not null,
  ref_id    bigint not null,
  texto     text not null,
  fecha     date default now(),
  autor_id  bigint references usuarios(id)
);

-- ---------- CONFIGURACION (fila unica) ----------
create table configuracion (
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
  vendedores_ven_todo boolean default false,
  constraint fila_unica check (id = 1)
);

-- ============================================================
-- DATOS INICIALES
-- ============================================================
insert into configuracion (id) values (1) on conflict (id) do nothing;

insert into permisos (rol, modulos) values
  ('Vendedor',              '{dashboard,clientes,comercial,ventas,postventa}'),
  ('Vendedor tercerizado',  '{dashboard,clientes,comercial,ventas}'),
  ('Técnico',               '{dashboard,clientes,service}'),
  ('Postventa',             '{dashboard,clientes,ventas,postventa}')
on conflict (rol) do nothing;

-- ============================================================
-- SIGUIENTE PASO
--   1. docs/RLS.md   -> crear tu usuario admin y vincularlo.
--   2. supabase/rls.sql -> el script de seguridad (RLS).
-- NO actives RLS hasta seguir RLS.md.
-- ============================================================
