-- ============================================================
-- TANDA 6: clientes con localidad/provincia/actividad y equipos
-- activados sin venta (drones vendidos antes o por fuera del sistema).
-- ------------------------------------------------------------
-- Correr en Supabase -> SQL Editor (todo junto). Idempotente.
-- Después volver a correr clientes_unificacion.sql (ahora también mueve
-- los equipos sin venta al unificar clientes).
-- ============================================================


-- ---------- CLIENTES: datos nuevos ----------
alter table clientes add column if not exists localidad text;
alter table clientes add column if not exists provincia text;
alter table clientes add column if not exists actividad text;  -- Productor | Contratista | ...


-- ---------- EQUIPOS ACTIVADOS sin venta ----------
alter table productos alter column venta_id drop not null;
alter table productos add column if not exists cliente_id      bigint references clientes(id);
alter table productos add column if not exists entrega_a_cargo text;
alter table productos drop constraint if exists productos_venta_o_cliente;
alter table productos add constraint productos_venta_o_cliente check (venta_id is not null or cliente_id is not null);

-- Ver: los de una venta, quien ve esa venta; los sin venta, quien ve el
-- cliente (las subconsultas respetan las reglas de ventas y clientes).
-- Editar: los de una venta, como antes; los sin venta, solo el admin.
drop policy if exists productos_all on productos;
drop policy if exists productos_select on productos;
create policy productos_select on productos for select using (
  (venta_id is not null and exists (select 1 from ventas v where v.id = productos.venta_id))
  or (venta_id is null and exists (select 1 from clientes c where c.id = productos.cliente_id))
);
drop policy if exists productos_write on productos;
create policy productos_write on productos for all using (
  app_es_admin()
  or exists (select 1 from ventas v where v.id = productos.venta_id and (
    (app_tiene_rol('Vendedor') and app_vendedores_ven_todo()) or v.vendedor_id = app_uid()))
) with check (
  app_es_admin()
  or exists (select 1 from ventas v where v.id = productos.venta_id and (
    (app_tiene_rol('Vendedor') and app_vendedores_ven_todo()) or v.vendedor_id = app_uid()))
);


-- ---------- Nombre de personas físicas importadas ----------
-- Se importan con el nombre completo en razon_social (no se puede separar
-- nombre y apellido de forma confiable). Las búsquedas por CUIT y por nombre
-- parecido usan ese nombre si nombre/apellido están vacíos.
create or replace function cliente_por_cuit(p_cuit text)
returns table (cliente_id bigint, es_propio boolean, puede_ver boolean, nombre text)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_id bigint; v_creado bigint; v_tipo text; v_razon text; v_nombre text; v_apellido text;
begin
  select cl.id, cl.creado_por, cl.tipo, cl.razon_social, cl.nombre, cl.apellido
    into v_id, v_creado, v_tipo, v_razon, v_nombre, v_apellido
    from clientes cl where cl.cuit = p_cuit limit 1;
  if v_id is null then return; end if;
  cliente_id := v_id;
  es_propio  := (v_creado = app_uid());
  puede_ver  := (app_es_admin() or v_creado = app_uid());
  if puede_ver then
    nombre := coalesce(
      case when v_tipo = 'Persona física'
           then nullif(trim(coalesce(v_nombre, '') || ' ' || coalesce(v_apellido, '')), '') end,
      v_razon);
  else
    nombre := null;
  end if;
  return next;
end;
$$;

create or replace function clientes_parecidos(p_texto text, p_excluir bigint default null)
returns table (cliente_id bigint, puede_ver boolean, nombre text)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_texto text := lower(trim(coalesce(p_texto, '')));
begin
  if length(v_texto) < 3 then return; end if;
  return query
    with c as (
      select cl.id, cl.creado_por,
             coalesce(case when cl.tipo = 'Persona física'
                           then nullif(trim(coalesce(cl.nombre, '') || ' ' || coalesce(cl.apellido, '')), '') end,
                      cl.razon_social) as nombre_visible
      from clientes cl
      where coalesce(cl.activo, true) and (p_excluir is null or cl.id <> p_excluir)
    )
    select c.id,
           (app_es_admin() or c.creado_por = app_uid()),
           case when (app_es_admin() or c.creado_por = app_uid()) then c.nombre_visible end
    from c
    where lower(coalesce(c.nombre_visible, '')) like '%' || v_texto || '%'
    order by c.id
    limit 5;
end;
$$;

revoke execute on function cliente_por_cuit(text) from public, anon;
revoke execute on function clientes_parecidos(text, bigint) from public, anon;
grant execute on function cliente_por_cuit(text) to authenticated;
grant execute on function clientes_parecidos(text, bigint) to authenticated;
