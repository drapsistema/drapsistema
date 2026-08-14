-- ============================================================
-- DRAP · Politicas de seguridad (Row Level Security)
-- ============================================================
-- Cierra la base para que cada usuario solo acceda a lo que su
-- rol permite. Se apoya en el login (auth_uid) que ya vinculaste.
--
-- COMO USAR: Supabase -> SQL Editor -> New query -> pegar TODO
-- -> Run. Corre en orden: primero las funciones, luego activa
-- RLS y crea las politicas.
--
-- Se puede correr varias veces sin romper nada (usa DROP IF EXISTS).
-- ============================================================

-- ============================================================
-- PARTE 1 · FUNCIONES AUXILIARES
-- Leen quien es el usuario logueado y que roles tiene, cruzando
-- el auth_uid de la sesion con la tabla usuarios.
-- ============================================================

-- id interno del usuario logueado (o null si no hay sesion / no existe)
create or replace function app_uid()
returns bigint
language sql stable security definer
set search_path = public
as $$
  select id from usuarios where auth_uid = auth.uid() limit 1;
$$;

-- roles del usuario logueado (array de texto)
create or replace function app_roles()
returns text[]
language sql stable security definer
set search_path = public
as $$
  select roles from usuarios where auth_uid = auth.uid() limit 1;
$$;

-- ¿el usuario logueado es administrador?
create or replace function app_es_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce('Administrador' = any(roles), false)
  from usuarios where auth_uid = auth.uid() limit 1;
$$;

-- ¿tiene alguno de estos roles? (para reglas por rol)
create or replace function app_tiene_rol(variadic buscados text[])
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(roles && buscados, false)
  from usuarios where auth_uid = auth.uid() limit 1;
$$;

-- ¿los vendedores ven todo? (lee el parametro de configuracion)
create or replace function app_vendedores_ven_todo()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(vendedores_ven_todo, false) from configuracion where id = 1;
$$;

-- ============================================================
-- PARTE 2 · ACTIVAR RLS EN TODAS LAS TABLAS
-- Al activar RLS sin politicas, el default es NEGAR todo. Por eso
-- inmediatamente despues creamos las politicas.
-- ============================================================
alter table usuarios         enable row level security;
alter table permisos         enable row level security;
alter table configuracion    enable row level security;
alter table clientes         enable row level security;
alter table contactos        enable row level security;
alter table oportunidades    enable row level security;
alter table cotizaciones     enable row level security;
alter table seguimientos     enable row level security;
alter table ventas           enable row level security;
alter table productos        enable row level security;
alter table tareas_postventa enable row level security;
alter table trabajos         enable row level security;
alter table tareas           enable row level security;
alter table repuestos        enable row level security;
alter table comentarios      enable row level security;

-- ============================================================
-- PARTE 3 · POLITICAS
-- ============================================================

-- ---------- USUARIOS ----------
-- Todos los logueados pueden leer (la app necesita la lista para
-- asignar vendedores, tecnicos, etc.). Solo el admin modifica.
drop policy if exists usuarios_select on usuarios;
create policy usuarios_select on usuarios for select
  using (auth.uid() is not null);

drop policy if exists usuarios_admin on usuarios;
create policy usuarios_admin on usuarios for all
  using (app_es_admin()) with check (app_es_admin());

-- ---------- PERMISOS ----------
-- Todos leen (la app calcula el menu con esto). Solo el admin edita.
drop policy if exists permisos_select on permisos;
create policy permisos_select on permisos for select
  using (auth.uid() is not null);

drop policy if exists permisos_admin on permisos;
create policy permisos_admin on permisos for all
  using (app_es_admin()) with check (app_es_admin());

-- ---------- CONFIGURACION ----------
-- Todos leen (semaforos, parametros). Solo el admin edita.
drop policy if exists config_select on configuracion;
create policy config_select on configuracion for select
  using (auth.uid() is not null);

drop policy if exists config_admin on configuracion;
create policy config_admin on configuracion for all
  using (app_es_admin()) with check (app_es_admin());

-- ---------- CLIENTES ----------
-- Admin: todo. Tecnico y Postventa: pueden leer todos (los necesitan
-- para service/postventa). Vendedor: sus clientes, salvo que el
-- parametro "ven todo" este activo. Tercerizado: solo los suyos.
drop policy if exists clientes_select on clientes;
create policy clientes_select on clientes for select using (
  app_es_admin()
  or app_tiene_rol('Técnico','Postventa')
  or (app_tiene_rol('Vendedor') and app_vendedores_ven_todo())
  or vendedor_id = app_uid()
);

-- Crear/editar: admin todo; vendedor puede crear/editar clientes propios.
-- Al crear, el cliente debe quedar asignado a sí mismo o sin asignar (la app
-- lo auto-asigna). Así un vendedor no puede asignárselo a otro vendedor, pero
-- sí puede dar de alta sus propios clientes.
drop policy if exists clientes_write on clientes;
create policy clientes_write on clientes for all using (
  app_es_admin()
  or (app_tiene_rol('Vendedor') and app_vendedores_ven_todo())
  or vendedor_id = app_uid()
  or vendedor_id is null
) with check (
  app_es_admin()
  or (app_tiene_rol('Vendedor') and app_vendedores_ven_todo())
  or vendedor_id = app_uid()
  or vendedor_id is null
);

-- ---------- CONTACTOS ----------
-- Siguen a su cliente: si podes ver el cliente, ves sus contactos.
drop policy if exists contactos_all on contactos;
create policy contactos_all on contactos for all using (
  exists (select 1 from clientes c where c.id = contactos.cliente_id and (
    app_es_admin()
    or app_tiene_rol('Técnico','Postventa')
    or (app_tiene_rol('Vendedor') and app_vendedores_ven_todo())
    or c.vendedor_id = app_uid()
  ))
) with check (
  exists (select 1 from clientes c where c.id = contactos.cliente_id and (
    app_es_admin()
    or (app_tiene_rol('Vendedor') and app_vendedores_ven_todo())
    or c.vendedor_id = app_uid()
  ))
);

-- ---------- OPORTUNIDADES ----------
drop policy if exists oport_all on oportunidades;
create policy oport_all on oportunidades for all using (
  app_es_admin()
  or (app_tiene_rol('Vendedor') and app_vendedores_ven_todo())
  or vendedor_id = app_uid()
  or vendedor_id is null
) with check (
  app_es_admin()
  or (app_tiene_rol('Vendedor') and app_vendedores_ven_todo())
  or vendedor_id = app_uid()
  or vendedor_id is null
);

-- ---------- COTIZACIONES / SEGUIMIENTOS ----------
-- Siguen a su oportunidad.
drop policy if exists cotiz_all on cotizaciones;
create policy cotiz_all on cotizaciones for all using (
  exists (select 1 from oportunidades o where o.id = cotizaciones.oportunidad_id and (
    app_es_admin()
    or (app_tiene_rol('Vendedor') and app_vendedores_ven_todo())
    or o.vendedor_id = app_uid()
  ))
) with check (
  exists (select 1 from oportunidades o where o.id = cotizaciones.oportunidad_id and (
    app_es_admin()
    or (app_tiene_rol('Vendedor') and app_vendedores_ven_todo())
    or o.vendedor_id = app_uid()
  ))
);

drop policy if exists segui_all on seguimientos;
create policy segui_all on seguimientos for all using (
  exists (select 1 from oportunidades o where o.id = seguimientos.oportunidad_id and (
    app_es_admin()
    or (app_tiene_rol('Vendedor') and app_vendedores_ven_todo())
    or o.vendedor_id = app_uid()
  ))
) with check (
  exists (select 1 from oportunidades o where o.id = seguimientos.oportunidad_id and (
    app_es_admin()
    or (app_tiene_rol('Vendedor') and app_vendedores_ven_todo())
    or o.vendedor_id = app_uid()
  ))
);

-- ---------- VENTAS ----------
-- Admin: todo. Postventa: lee todas (las necesita). Vendedor: las suyas
-- (o todas si el parametro lo permite). Tercerizado: las suyas.
drop policy if exists ventas_select on ventas;
create policy ventas_select on ventas for select using (
  app_es_admin()
  or app_tiene_rol('Postventa')
  or (app_tiene_rol('Vendedor') and app_vendedores_ven_todo())
  or vendedor_id = app_uid()
);

-- Editar: admin, o vendedor duenio. (Cancelar es solo admin, se controla en la app.)
drop policy if exists ventas_write on ventas;
create policy ventas_write on ventas for all using (
  app_es_admin()
  or (app_tiene_rol('Vendedor') and app_vendedores_ven_todo())
  or vendedor_id = app_uid()
) with check (
  app_es_admin()
  or (app_tiene_rol('Vendedor') and app_vendedores_ven_todo())
  or vendedor_id = app_uid()
);

-- ---------- PRODUCTOS (de una venta) ----------
drop policy if exists productos_all on productos;
create policy productos_all on productos for all using (
  exists (select 1 from ventas v where v.id = productos.venta_id and (
    app_es_admin() or app_tiene_rol('Postventa')
    or (app_tiene_rol('Vendedor') and app_vendedores_ven_todo())
    or v.vendedor_id = app_uid()
  ))
) with check (
  exists (select 1 from ventas v where v.id = productos.venta_id and (
    app_es_admin()
    or (app_tiene_rol('Vendedor') and app_vendedores_ven_todo())
    or v.vendedor_id = app_uid()
  ))
);

-- ---------- TAREAS DE POSTVENTA ----------
-- Admin y Postventa ven/gestionan todo.
drop policy if exists postventa_all on tareas_postventa;
create policy postventa_all on tareas_postventa for all using (
  app_es_admin() or app_tiene_rol('Postventa')
) with check (
  app_es_admin() or app_tiene_rol('Postventa')
);

-- ---------- SERVICE: TRABAJOS / TAREAS / REPUESTOS ----------
-- Admin y Tecnico ven/gestionan todo el taller.
drop policy if exists trabajos_all on trabajos;
create policy trabajos_all on trabajos for all using (
  app_es_admin() or app_tiene_rol('Técnico')
) with check (
  app_es_admin() or app_tiene_rol('Técnico')
);

drop policy if exists tareas_all on tareas;
create policy tareas_all on tareas for all using (
  app_es_admin() or app_tiene_rol('Técnico')
) with check (
  app_es_admin() or app_tiene_rol('Técnico')
);

drop policy if exists repuestos_all on repuestos;
create policy repuestos_all on repuestos for all using (
  app_es_admin() or app_tiene_rol('Técnico')
) with check (
  app_es_admin() or app_tiene_rol('Técnico')
);

-- ---------- COMENTARIOS ----------
-- Cualquier usuario logueado puede leer y agregar comentarios.
-- (Son transversales; el acceso al modulo ya se controla arriba.)
drop policy if exists comentarios_all on comentarios;
create policy comentarios_all on comentarios for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- ============================================================
-- FIN. La base quedo asegurada.
-- Para DESACTIVAR RLS de una tabla (si algo sale mal), por ejemplo:
--   alter table clientes disable row level security;
-- ============================================================
