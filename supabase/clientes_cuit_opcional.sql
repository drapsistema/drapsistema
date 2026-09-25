-- ============================================================
-- CLIENTES: CUIT opcional pero único + búsqueda de parecidos
-- ------------------------------------------------------------
-- Correr en Supabase -> SQL Editor, EN ORDEN, un paso a la vez.
-- Todo es idempotente (se puede volver a correr sin romper nada).
-- ============================================================


-- ---------- PASO 1: normalizar CUITs existentes ----------
-- Deja solo dígitos y convierte los vacíos en NULL (NULL = "sin CUIT";
-- varios clientes pueden no tener CUIT sin chocar entre sí).
update clientes set cuit = nullif(regexp_replace(coalesce(cuit, ''), '\D', '', 'g'), '')
where cuit is distinct from nullif(regexp_replace(coalesce(cuit, ''), '\D', '', 'g'), '');


-- ---------- PASO 2: revisar si ya hay CUITs duplicados ----------
-- Si esta consulta devuelve filas, NO sigas al paso 3: hay que resolver
-- esos duplicados primero (pasame el resultado y vemos cómo unificarlos).
select cuit, count(*) as cantidad, array_agg(id order by id) as ids_clientes
from clientes
where cuit is not null
group by cuit
having count(*) > 1;


-- ---------- PASO 3: índice único (solo si el paso 2 no devolvió nada) ----------
-- Impide a nivel base dos clientes con el mismo CUIT, incluso si dos
-- personas cargan al mismo tiempo. Los clientes sin CUIT no cuentan.
create unique index if not exists clientes_cuit_unico
  on clientes (cuit) where cuit is not null;


-- ---------- PASO 4: función de clientes con nombre parecido ----------
-- Busca en TODOS los clientes (SECURITY DEFINER, saltea RLS) para avisar
-- de posibles duplicados cuando se carga un cliente sin CUIT. Igual que
-- cliente_por_cuit: el nombre solo se devuelve si quien pregunta puede
-- ver la ficha (admin o quien lo cargó); si no, solo avisa que existe.
create or replace function clientes_parecidos(p_texto text, p_excluir bigint default null)
returns table (cliente_id bigint, puede_ver boolean, nombre text)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_texto text := lower(trim(coalesce(p_texto, '')));
begin
  if length(v_texto) < 3 then return; end if;
  return query
    select cl.id,
           (app_es_admin() or cl.creado_por = app_uid()),
           case when (app_es_admin() or cl.creado_por = app_uid()) then
             case when cl.tipo = 'Persona física'
                  then nullif(trim(coalesce(cl.nombre, '') || ' ' || coalesce(cl.apellido, '')), '')
                  else cl.razon_social end
           end
    from clientes cl
    where coalesce(cl.activo, true)
      and (p_excluir is null or cl.id <> p_excluir)
      and lower(case when cl.tipo = 'Persona física'
                     then coalesce(cl.nombre, '') || ' ' || coalesce(cl.apellido, '')
                     else coalesce(cl.razon_social, '') end) like '%' || v_texto || '%'
    order by cl.id
    limit 5;
end;
$$;
grant execute on function clientes_parecidos(text, bigint) to authenticated;
