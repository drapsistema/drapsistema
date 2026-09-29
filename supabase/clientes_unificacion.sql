-- ============================================================
-- CLIENTES: unificación de duplicados
-- ------------------------------------------------------------
-- Correr en Supabase -> SQL Editor (todo junto). Idempotente.
-- Requiere haber corrido antes clientes_cuit_opcional.sql, tanda2.sql
-- y tanda3.sql.
-- ============================================================


-- ---------- Marca en el cliente duplicado ----------
-- El duplicado no se borra: queda inactivo y apuntando al cliente
-- en el que se unificó (para no perder historial).
alter table clientes add column if not exists unificado_en bigint references clientes(id);


-- ---------- Solicitudes de unificación ----------
create table if not exists solicitudes_unificacion (
  id                 bigint generated always as identity primary key,
  cliente_origen_id  bigint not null references clientes(id) on delete cascade,  -- el duplicado
  cliente_destino_id bigint not null references clientes(id) on delete cascade,  -- el que queda
  motivo             text,
  estado             text not null default 'Pendiente',  -- Pendiente | Resuelta | Descartada
  solicitado_por     bigint references usuarios(id) default app_uid(),
  creado_en          timestamptz default now(),
  resuelto_por       bigint references usuarios(id),
  resuelto_en        timestamptz
);

-- Una sola solicitud pendiente por par de clientes.
create unique index if not exists solicitudes_unificacion_pendiente_unica
  on solicitudes_unificacion (cliente_origen_id, cliente_destino_id)
  where estado = 'Pendiente';

alter table solicitudes_unificacion enable row level security;

-- Ver: el admin todas; cada usuario, las que pidió.
drop policy if exists solicitudes_unif_select on solicitudes_unificacion;
create policy solicitudes_unif_select on solicitudes_unificacion for select using (
  app_es_admin() or solicitado_por = app_uid()
);

-- Crear: cualquier usuario logueado, siempre a su nombre.
drop policy if exists solicitudes_unif_insert on solicitudes_unificacion;
create policy solicitudes_unif_insert on solicitudes_unificacion for insert with check (
  solicitado_por = app_uid()
);

-- Resolver/descartar: solo admin.
drop policy if exists solicitudes_unif_update on solicitudes_unificacion;
create policy solicitudes_unif_update on solicitudes_unificacion for update using (
  app_es_admin()
) with check (
  app_es_admin()
);


-- ---------- Función de unificación (solo admin) ----------
-- Pasa todo lo del cliente ORIGEN (duplicado) al DESTINO (el que queda):
-- contactos, oportunidades, ventas y trabajos de service. Completa en el
-- destino los datos que le falten, desactiva el origen y deja constancia
-- en los comentarios de cada oportunidad y venta movida. Todo en una sola
-- transacción: si algo falla, no se aplica nada.
create or replace function unificar_clientes(p_origen bigint, p_destino bigint)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  o clientes%rowtype;
  d clientes%rowtype;
  v_nombre_o text;
  v_nombre_d text;
  v_texto text;
  n_contactos int; n_ops int; n_ventas int; n_trabajos int;
begin
  if not app_es_admin() then
    raise exception 'Solo un administrador puede unificar clientes';
  end if;
  if p_origen = p_destino then
    raise exception 'No se puede unificar un cliente consigo mismo';
  end if;

  select * into o from clientes where id = p_origen for update;
  select * into d from clientes where id = p_destino for update;
  if o.id is null or d.id is null then
    raise exception 'Alguno de los clientes no existe';
  end if;
  if o.unificado_en is not null then
    raise exception 'El cliente % ya fue unificado', p_origen;
  end if;
  if d.unificado_en is not null then
    raise exception 'El cliente destino % fue unificado en otro; elegí ese', p_destino;
  end if;
  if o.cuit is not null and d.cuit is not null then
    raise exception 'Los dos clientes tienen CUIT distinto: no parecen ser el mismo';
  end if;

  v_nombre_o := case when o.tipo = 'Persona física'
                     then trim(coalesce(o.nombre, '') || ' ' || coalesce(o.apellido, ''))
                     else o.razon_social end;
  v_nombre_d := case when d.tipo = 'Persona física'
                     then trim(coalesce(d.nombre, '') || ' ' || coalesce(d.apellido, ''))
                     else d.razon_social end;
  v_texto := '[sistema] Cliente unificado: "' || coalesce(v_nombre_o, '') || '" (#' || p_origen
             || ') pasó a "' || coalesce(v_nombre_d, '') || '" (#' || p_destino || ').';

  -- Log en cada oportunidad y venta que se mueve.
  insert into comentarios (entidad, ref_id, texto, fecha, autor_id)
    select 'op', id, v_texto, current_date, app_uid() from oportunidades where cliente_id = p_origen;
  insert into comentarios (entidad, ref_id, texto, fecha, autor_id)
    select 'venta', id, v_texto, current_date, app_uid() from ventas where cliente_id = p_origen;

  update contactos     set cliente_id = p_destino where cliente_id = p_origen;
  get diagnostics n_contactos = row_count;
  update oportunidades set cliente_id = p_destino where cliente_id = p_origen;
  get diagnostics n_ops = row_count;
  update ventas        set cliente_id = p_destino where cliente_id = p_origen;
  get diagnostics n_ventas = row_count;
  update trabajos      set cliente_id = p_destino where cliente_id = p_origen;
  get diagnostics n_trabajos = row_count;
  -- Postventas (requiere tanda2.sql y tanda3.sql).
  insert into comentarios (entidad, ref_id, texto, fecha, autor_id)
    select 'pv', id, v_texto, current_date, app_uid() from postventas where cliente_id = p_origen;
  update postventas       set cliente_id = p_destino where cliente_id = p_origen;
  update tareas_postventa set cliente_id = p_destino where cliente_id = p_origen;

  -- El CUIT es único: primero se libera del origen, después pasa al destino.
  update clientes set activo = false, unificado_en = p_destino, cuit = null where id = p_origen;

  update clientes set
    cuit      = coalesce(d.cuit, o.cuit),
    domicilio = coalesce(nullif(d.domicilio, ''), o.domicilio),
    telefono  = coalesce(nullif(d.telefono, ''), o.telefono),
    mail      = coalesce(nullif(d.mail, ''), o.mail),
    observaciones = case
      when coalesce(o.observaciones, '') = '' then d.observaciones
      when coalesce(d.observaciones, '') = '' then o.observaciones
      else d.observaciones || E'\n' || o.observaciones end
  where id = p_destino;

  update solicitudes_unificacion
     set estado = 'Resuelta', resuelto_por = app_uid(), resuelto_en = now()
   where estado = 'Pendiente'
     and (cliente_origen_id in (p_origen, p_destino) and cliente_destino_id in (p_origen, p_destino));

  return json_build_object(
    'contactos', n_contactos, 'oportunidades', n_ops,
    'ventas', n_ventas, 'trabajos', n_trabajos
  );
end;
$$;
grant execute on function unificar_clientes(bigint, bigint) to authenticated;
