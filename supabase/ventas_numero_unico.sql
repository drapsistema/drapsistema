-- ============================================================
-- VENTAS: número de venta único de verdad
-- ------------------------------------------------------------
-- Antes, solo los números cargados a mano quedaban guardados; los
-- automáticos (VT-0015) se armaban en pantalla, así que la base no
-- podía detectar que alguien cargara "VT-0015" en otra venta.
-- Ahora TODA venta guarda su número y la unicidad ignora
-- mayúsculas y espacios.
--
-- Correr en Supabase -> SQL Editor, EN ORDEN, un paso a la vez.
-- Requiere haber corrido antes tanda2.sql.
-- ============================================================


-- ---------- PASO 1: función que da un número libre ----------
-- VT-0015 para la venta 15; si alguien ya lo usó a mano en otra
-- venta, VT-0015-2, VT-0015-3, etc.
create or replace function numero_venta_libre(p_id bigint)
returns text
language plpgsql volatile security definer set search_path = public
as $$
declare
  base text := 'VT-' || lpad(p_id::text, 4, '0');
  cand text := base;
  n int := 1;
begin
  while exists (select 1 from ventas
                where upper(trim(numero)) = upper(cand) and id <> p_id) loop
    n := n + 1;
    cand := base || '-' || n;
  end loop;
  return cand;
end;
$$;


-- ---------- PASO 2: detectar números cargados a mano que pisan uno automático ----------
-- Ej: a la venta 3 le pusieron "VT-0015", que es el número de la venta 15.
-- Si devuelve filas, corregí esas ventas ANTES del paso 3: desde la app,
-- ponele su número correcto a la venta de la columna "venta_con_numero_manual",
-- o volvela al automático con:
--   update ventas set numero = null where id = <venta_con_numero_manual>;
select v.id as venta_con_numero_manual, v.numero, o.id as venta_duenia_del_numero
from ventas v
join ventas o on o.id <> v.id
             and (o.numero is null or trim(o.numero) = '')
             and upper(trim(v.numero)) = 'VT-' || lpad(o.id::text, 4, '0');


-- ---------- PASO 3: guardar el número en las ventas que no lo tienen ----------
do $$
declare r record;
begin
  for r in select id from ventas where numero is null or trim(numero) = '' order by id loop
    update ventas set numero = numero_venta_libre(r.id) where id = r.id;
  end loop;
end $$;


-- ---------- PASO 4: revisar duplicados que ya existan ----------
-- Si devuelve filas, NO sigas: pasame el resultado (hay que decidir
-- qué número queda en cada venta).
select upper(trim(numero)) as numero, array_agg(id order by id) as ids_ventas
from ventas
group by upper(trim(numero))
having count(*) > 1;


-- ---------- PASO 5: regla de único (solo si el paso 4 no devolvió nada) ----------
drop index if exists ventas_numero_unico;
create unique index if not exists ventas_numero_unico_ci on ventas (upper(trim(numero)));

-- Toda venta nueva (o a la que se le borre el número) recibe uno automático.
create or replace function ventas_numero_auto()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.numero is null or trim(new.numero) = '' then
    new.numero := numero_venta_libre(new.id);
  else
    new.numero := trim(new.numero);
  end if;
  return new;
end;
$$;

drop trigger if exists ventas_numero_auto on ventas;
create trigger ventas_numero_auto before insert or update of numero on ventas
  for each row execute function ventas_numero_auto();
