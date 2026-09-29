-- ============================================================
-- TANDA 4: semáforo de service configurable.
-- Correr en Supabase -> SQL Editor. Idempotente.
-- ============================================================
alter table configuracion add column if not exists sem_serv_verde    int not null default 7;
alter table configuracion add column if not exists sem_serv_amarillo int not null default 15;
