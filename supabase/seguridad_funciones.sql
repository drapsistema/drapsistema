-- ============================================================
-- SEGURIDAD: funciones solo para usuarios logueados
-- ------------------------------------------------------------
-- Supabase da permiso de ejecución sobre las funciones a "anon" (sin
-- sesión) por defecto. Con la clave pública de la app, alguien sin
-- loguearse podía, por ejemplo, avanzar los contadores de OT, remito
-- o presupuesto. Esto deja esas funciones solo para usuarios logueados.
-- Correr en Supabase -> SQL Editor. Idempotente.
-- ============================================================
revoke execute on function siguiente_nro_presupuesto()            from public, anon;
revoke execute on function siguiente_nro_trabajo(text)            from public, anon;
revoke execute on function generar_postventa(bigint)              from public, anon;
revoke execute on function cliente_por_cuit(text)                 from public, anon;
revoke execute on function clientes_parecidos(text, bigint)       from public, anon;
revoke execute on function unificar_clientes(bigint, bigint)      from public, anon;
revoke execute on function actualizar_mi_contacto(text, text)     from public, anon;
revoke execute on function numero_venta_libre(bigint)             from public, anon;

grant execute on function siguiente_nro_presupuesto()            to authenticated;
grant execute on function siguiente_nro_trabajo(text)            to authenticated;
grant execute on function generar_postventa(bigint)              to authenticated;
grant execute on function cliente_por_cuit(text)                 to authenticated;
grant execute on function clientes_parecidos(text, bigint)       to authenticated;
grant execute on function unificar_clientes(bigint, bigint)      to authenticated;
grant execute on function actualizar_mi_contacto(text, text)     to authenticated;
grant execute on function numero_venta_libre(bigint)             to authenticated;

-- Que las funciones que se creen de acá en adelante tampoco queden abiertas.
alter default privileges in schema public revoke execute on functions from public, anon;


-- ------------------------------------------------------------
-- OPCIONAL: devolver el número de presupuesto que se consumió en la
-- verificación del 2026-09-29 (llamada sin sesión, sin presupuesto creado).
-- Correr SOLO si todavía no se emitió ningún presupuesto después de eso;
-- si ya hay alguno, no hace falta: solo queda un salto en la numeración.
-- update configuracion set pres_actual = greatest(pres_actual - 1, 0) where id = 1;
-- ------------------------------------------------------------
