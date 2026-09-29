-- ============================================================
-- TANDA 3: fecha de cierre en el CRM y número de postventa.
-- ------------------------------------------------------------
-- Correr en Supabase -> SQL Editor (todo junto). Idempotente.
-- Requiere haber corrido antes tanda2.sql.
-- Después, volver a correr clientes_unificacion.sql (ahora también
-- mueve las postventas al unificar clientes).
-- ============================================================


-- ============================================================
-- 1) CRM: fecha de cierre de la oportunidad
-- ============================================================
alter table oportunidades add column if not exists fecha_cierre date;

-- Completar las ya cerradas: ganadas -> fecha de la venta; perdidas ->
-- fecha del comentario de cierre; si no hay nada, la fecha de alta.
update oportunidades o set fecha_cierre = v.fecha_ganada
from ventas v
where v.oportunidad_id = o.id and o.fecha_cierre is null
  and o.resultado in ('Ganada', 'Venta cancelada') and v.fecha_ganada is not null;

update oportunidades o set fecha_cierre = c.fecha
from (
  select ref_id, max(fecha) as fecha from comentarios
  where entidad = 'op' and texto like '[sistema] Oportunidad cerrada como perdida%'
  group by ref_id
) c
where c.ref_id = o.id and o.fecha_cierre is null and o.resultado = 'Perdida';

update oportunidades set fecha_cierre = coalesce(creado_en::date, fecha_contacto, current_date)
where fecha_cierre is null and coalesce(resultado, '') <> '';


-- ============================================================
-- 2) POSTVENTA con número propio (PV-0001)
-- Cada postventa es una fila; puede tener venta asociada o no
-- (equipos comprados en otro lado). Las tareas cuelgan de ella.
-- ============================================================
create table if not exists postventas (
  id            bigint generated always as identity primary key,
  venta_id      bigint unique references ventas(id) on delete cascade,
  cliente_id    bigint not null references clientes(id),
  equipo        text,
  observaciones text,
  creado_en     timestamptz default now(),
  creado_por    bigint references usuarios(id) default app_uid()
);

alter table postventas enable row level security;
drop policy if exists postventas_all on postventas;
create policy postventas_all on postventas for all using (
  app_es_admin() or app_tiene_rol('Postventa')
) with check (
  app_es_admin() or app_tiene_rol('Postventa')
);

alter table tareas_postventa add column if not exists postventa_id bigint references postventas(id) on delete cascade;

-- 2.a) Una postventa por cada venta entregada (tenga o no tareas).
insert into postventas (venta_id, cliente_id, creado_en)
select v.id, v.cliente_id, coalesce(v.fecha_entrega::timestamptz, now())
from ventas v
where v.fecha_entrega is not null and v.estado <> 'Cancelada'
  and not exists (select 1 from postventas p where p.venta_id = v.id);

-- Ventas con tareas pero sin postventa (por si alguna quedó afuera).
insert into postventas (venta_id, cliente_id)
select distinct t.venta_id, v.cliente_id
from tareas_postventa t join ventas v on v.id = t.venta_id
where not exists (select 1 from postventas p where p.venta_id = t.venta_id);

update tareas_postventa t set postventa_id = p.id
from postventas p
where t.postventa_id is null and t.venta_id is not null and p.venta_id = t.venta_id;

-- 2.b) Tareas sin venta (equipos de otro lado): una postventa por cliente.
insert into postventas (cliente_id, equipo)
select t.cliente_id, max(t.equipo)
from tareas_postventa t
where t.venta_id is null and t.postventa_id is null and t.cliente_id is not null
group by t.cliente_id;

update tareas_postventa t set postventa_id = (
  select p.id from postventas p
  where p.venta_id is null and p.cliente_id = t.cliente_id
  order by p.id desc limit 1)
where t.venta_id is null and t.postventa_id is null and t.cliente_id is not null;

-- 2.c) Los comentarios pasan a colgar de la postventa.
update comentarios c set entidad = 'pv', ref_id = p.id
from postventas p
where c.entidad = 'post' and p.venta_id = c.ref_id;

update comentarios c set entidad = 'pv', ref_id = (
  select p.id from postventas p
  where p.venta_id is null and p.cliente_id = c.ref_id
  order by p.id limit 1)
where c.entidad = 'post-cli'
  and exists (select 1 from postventas p where p.venta_id is null and p.cliente_id = c.ref_id);

-- 2.d) Generar postventa al entregar: ahora crea también la fila de postventa.
create or replace function generar_postventa(p_venta_id bigint)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_id bigint; v_fecha date; v_cliente bigint; v_pv bigint; n int;
begin
  select id, fecha_entrega, cliente_id into v_id, v_fecha, v_cliente from ventas where id = p_venta_id;
  if v_id is null or v_fecha is null then return 0; end if;

  select id into v_pv from postventas where venta_id = p_venta_id;
  if v_pv is null then
    insert into postventas (venta_id, cliente_id) values (p_venta_id, v_cliente) returning id into v_pv;
  end if;

  select count(*) into n from tareas_postventa where venta_id = p_venta_id;
  if n > 0 then return 0; end if;
  insert into tareas_postventa (venta_id, postventa_id, cliente_id, hito, objetivo, estado) values
    (p_venta_id, v_pv, v_cliente, '1 semana', v_fecha + 7,  'Pendiente'),
    (p_venta_id, v_pv, v_cliente, '1 mes',    v_fecha + 30, 'Pendiente'),
    (p_venta_id, v_pv, v_cliente, '2 meses',  v_fecha + 60, 'Pendiente');
  return 3;
end;
$$;
grant execute on function generar_postventa(bigint) to authenticated;
