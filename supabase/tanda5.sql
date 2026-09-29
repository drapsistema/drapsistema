-- ============================================================
-- TANDA 5: PRESUPUESTOS
-- ------------------------------------------------------------
-- Los presupuestos se arman en el sistema, se guardan como datos (no
-- archivos) y el PDF se genera en el navegador cuando se pide.
-- Correr en Supabase -> SQL Editor (todo junto). Idempotente.
-- Después correr catalogo_inicial.sql (carga los productos).
-- ============================================================


-- ---------- USUARIOS: datos de contacto para el presupuesto ----------
alter table usuarios add column if not exists telefono text;
alter table usuarios add column if not exists whatsapp text;
alter table usuarios add column if not exists cargo    text not null default 'Asesor Comercial';

-- Cada usuario puede cargar su propio teléfono y WhatsApp (la tabla
-- usuarios solo la edita el admin, por eso va por función).
create or replace function actualizar_mi_contacto(p_telefono text, p_whatsapp text)
returns void
language sql security definer set search_path = public
as $$
  update usuarios set telefono = nullif(trim(p_telefono), ''), whatsapp = nullif(trim(p_whatsapp), '')
  where auth_uid = auth.uid();
$$;
grant execute on function actualizar_mi_contacto(text, text) to authenticated;


-- ---------- CONFIGURACIÓN: listas y numeración ----------
alter table configuracion add column if not exists pres_tipos text[] not null default array[
  'Venta de drones DJI', 'Servicio técnico / reparación', 'Capacitación', 'Productos Ligier', 'Mixto'];
alter table configuracion add column if not exists pres_condiciones text[] not null default array[
  'Contado', '50% adelanto / 50% contra entrega', '30 días', 'A convenir'];
alter table configuracion add column if not exists pres_validez text[] not null default array[
  '15 días corridos desde la fecha de emisión', '30 días corridos desde la fecha de emisión',
  '7 días corridos desde la fecha de emisión', 'A convenir'];
alter table configuracion add column if not exists pres_anio   int;
alter table configuracion add column if not exists pres_actual int not null default 0;

-- PRE-2026-0001, correlativo por año (vuelve a 0001 cada 1° de enero).
create or replace function siguiente_nro_presupuesto()
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_anio int := extract(year from current_date)::int;
  n int;
begin
  update configuracion
     set pres_actual = case when pres_anio = v_anio then pres_actual + 1 else 1 end,
         pres_anio = v_anio
   where id = 1
   returning pres_actual into n;
  return 'PRE-' || v_anio || '-' || lpad(n::text, 4, '0');
end;
$$;
grant execute on function siguiente_nro_presupuesto() to authenticated;


-- ---------- CATÁLOGO DE PRODUCTOS (precios en U$S sin IVA) ----------
create table if not exists productos_catalogo (
  id             bigint generated always as identity primary key,
  sku            text not null unique,
  codigo         text,           -- código DJI (ej: DJI-R880)
  descripcion    text not null,
  precio         numeric not null default 0,
  marca          text,           -- DJI | Ligier | Alemor
  activo         boolean not null default true,
  actualizado_en timestamptz default now()
);

alter table productos_catalogo enable row level security;
drop policy if exists catalogo_select on productos_catalogo;
create policy catalogo_select on productos_catalogo for select using (auth.uid() is not null);
drop policy if exists catalogo_admin on productos_catalogo;
create policy catalogo_admin on productos_catalogo for all
  using (app_es_admin()) with check (app_es_admin());


-- ---------- PRESUPUESTOS ----------
-- Cada versión es una fila. Las versiones de un presupuesto comparten
-- `numero` (PRE-2026-0012 v1, v2...). Una vez creado no se modifica:
-- los cambios se hacen creando una versión nueva.
create table if not exists presupuestos (
  id             bigint generated always as identity primary key,
  numero         text not null,
  version        int not null default 1,
  oportunidad_id bigint references oportunidades(id) on delete cascade,
  trabajo_id     bigint references trabajos(id) on delete cascade,
  cliente_id     bigint not null references clientes(id),
  vendedor_id    bigint references usuarios(id),          -- quien figura en el PDF
  creado_por     bigint references usuarios(id) default app_uid(),
  fecha          date not null default current_date,
  tipo           text,
  condicion_pago text,
  validez        text,
  notas          text,
  moneda         text not null default 'USD',            -- USD | ARS
  cotizacion     numeric,                                -- pesos por dólar si moneda = ARS
  descuento      numeric not null default 0,             -- monto fijo, en la moneda del presupuesto
  subtotal       numeric not null default 0,
  total          numeric not null default 0,
  cliente_datos  jsonb,  -- foto de los datos del cliente al emitir (el PDF sale siempre igual)
  vendedor_datos jsonb,  -- idem del vendedor (nombre, cargo, teléfono, WhatsApp)
  creado_en      timestamptz default now(),
  unique (numero, version),
  check (oportunidad_id is not null or trabajo_id is not null)
);

create table if not exists presupuesto_items (
  id             bigint generated always as identity primary key,
  presupuesto_id bigint not null references presupuestos(id) on delete cascade,
  orden          int not null default 0,
  producto_id    bigint references productos_catalogo(id),  -- null = ítem manual
  sku            text,
  codigo         text,
  descripcion    text not null,
  cantidad       numeric not null default 1,
  precio_unit    numeric not null default 0,  -- en U$S
  precio_lista   numeric                      -- precio del catálogo al momento de presupuestar
);

-- Solo el admin puede cambiar el precio de un producto del catálogo: para
-- el resto, el precio se toma siempre del catálogo, venga lo que venga.
create or replace function presupuesto_items_precio()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_precio numeric;
begin
  if new.producto_id is not null then
    select precio into v_precio from productos_catalogo where id = new.producto_id;
    new.precio_lista := v_precio;
    if not app_es_admin() then new.precio_unit := v_precio; end if;
  end if;
  return new;
end;
$$;
drop trigger if exists presupuesto_items_precio on presupuesto_items;
create trigger presupuesto_items_precio before insert on presupuesto_items
  for each row execute function presupuesto_items_precio();

-- Vínculo con el CRM: cada presupuesto ligado a una oportunidad deja su
-- registro en `cotizaciones` (así el pipeline sigue igual).
alter table cotizaciones add column if not exists presupuesto_id bigint references presupuestos(id) on delete set null;


-- ---------- RLS ----------
-- Ver: admin todo; cada uno los suyos (los creó o figura como vendedor);
-- el vendedor de la oportunidad; los técnicos, los de reparación (trabajos).
alter table presupuestos enable row level security;
drop policy if exists presupuestos_select on presupuestos;
create policy presupuestos_select on presupuestos for select using (
  app_es_admin()
  or creado_por = app_uid()
  or vendedor_id = app_uid()
  or exists (select 1 from oportunidades o where o.id = presupuestos.oportunidad_id and o.vendedor_id = app_uid())
  or (trabajo_id is not null and app_tiene_rol('Técnico'))
);
-- Crear: siempre a nombre propio. No hay update/delete: las versiones son fijas.
drop policy if exists presupuestos_insert on presupuestos;
create policy presupuestos_insert on presupuestos for insert with check (creado_por = app_uid());

alter table presupuesto_items enable row level security;
drop policy if exists presupuesto_items_select on presupuesto_items;
create policy presupuesto_items_select on presupuesto_items for select using (
  exists (select 1 from presupuestos p where p.id = presupuesto_items.presupuesto_id)
);
drop policy if exists presupuesto_items_insert on presupuesto_items;
create policy presupuesto_items_insert on presupuesto_items for insert with check (
  exists (select 1 from presupuestos p where p.id = presupuesto_items.presupuesto_id and p.creado_por = app_uid())
);
