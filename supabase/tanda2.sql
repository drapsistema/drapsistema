-- ============================================================
-- TANDA 2: ventas (cobro, número), equipos, garantías de service
-- y postventa sin venta.
-- ------------------------------------------------------------
-- Correr en Supabase -> SQL Editor (todo junto). Idempotente.
-- Después, volver a correr clientes_unificacion.sql (ahora también
-- mueve las postventas sin venta al unificar clientes).
-- ============================================================


-- ---------- VENTAS: cobro ----------
-- estado_cobro reemplaza al booleano `cobrado` (que se mantiene
-- sincronizado: cobrado = estado_cobro 'Total').
alter table ventas add column if not exists estado_cobro    text;   -- No | Parcial | Total
alter table ventas add column if not exists con_iva         boolean; -- null = sin definir
alter table ventas add column if not exists formas_pago     text[] not null default '{}';
alter table ventas add column if not exists forma_pago_otro text;

update ventas set estado_cobro = case when cobrado then 'Total' else 'No' end
where estado_cobro is null and cobrado;   -- las no cobradas quedan sin definir, para que se elija

-- ---------- VENTAS: número editable ----------
-- null = se muestra el correlativo automático VT-0000.
alter table ventas add column if not exists numero text;
create unique index if not exists ventas_numero_unico on ventas (numero) where numero is not null;


-- ---------- EQUIPOS ACTIVADOS ----------
alter table productos add column if not exists contrasena       text;
alter table productos add column if not exists ns_tanque_solido text;


-- ---------- SERVICE: garantías por pieza ----------
create table if not exists garantias_trabajo (
  id         bigint generated always as identity primary key,
  trabajo_id bigint not null references trabajos(id) on delete cascade,
  pieza      text not null,
  detalle    text,
  vence      date
);

alter table garantias_trabajo enable row level security;
drop policy if exists garantias_all on garantias_trabajo;
create policy garantias_all on garantias_trabajo for all using (
  app_es_admin() or app_tiene_rol('Técnico')
) with check (
  app_es_admin() or app_tiene_rol('Técnico')
);


-- ---------- POSTVENTA sin venta ----------
-- Tareas asociadas directo a un cliente (equipos comprados en otro lado).
alter table tareas_postventa add column if not exists cliente_id bigint references clientes(id);
alter table tareas_postventa add column if not exists equipo     text;
alter table tareas_postventa alter column venta_id drop not null;

alter table tareas_postventa drop constraint if exists tareas_postventa_venta_o_cliente;
alter table tareas_postventa add constraint tareas_postventa_venta_o_cliente
  check (venta_id is not null or cliente_id is not null);
