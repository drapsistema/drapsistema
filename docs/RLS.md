# Base de datos y seguridad (RLS) — guía paso a paso

Esta guía deja la base de Supabase actualizada y protegida con Row Level Security.

---

## PASO 1 — Actualizar las tablas ✅ (ya lo hiciste)

Correr `supabase/schema.sql` en el SQL Editor. Deja 15 tablas actualizadas con
roles múltiples, la tabla `permisos` y el vínculo `auth_uid`.

---

## PASO 2 — Crear el usuario admin y vincularlo ✅ (ya lo hiciste)

1. Authentication → Add user → crear con mail y contraseña.
2. Copiar su UID.
3. En SQL Editor, insertar la fila en `usuarios` con ese `auth_uid`, el mail,
   y `roles = '{Administrador}'`.
4. Probar el login en la app.

---

## PASO 3 — Activar las políticas RLS (este paso)

Ahora "cerramos" la base: cada usuario solo accederá a lo que su rol permite.
Aunque alguien tenga la clave pública de la app, la base no le entregará datos
fuera de su alcance.

> **Antes de empezar:** este paso asume que el login ya funciona (Paso 2). Las
> políticas se apoyan en el usuario logueado.

### Qué hace el script

- Crea **funciones auxiliares** que identifican al usuario logueado y sus roles
  (cruzando el `auth_uid` de la sesión con la tabla `usuarios`).
- **Activa RLS** en las 15 tablas.
- Crea **las políticas**: admin ve todo; vendedor ve lo suyo (o todo, según el
  parámetro); técnico y postventa ven sus módulos; sin sesión no se ve nada.

### Cómo aplicarlo

1. Supabase → **SQL Editor** → **New query**.
2. Abrí `supabase/rls.sql` de este repo y copiá **todo**.
3. Pegalo y apretá **Run**.

El script se puede correr varias veces sin romper nada (si algo sale mal, lo
corregís y volvés a correr).

### Verificar que salió bien

Después de correrlo, probá la app:

1. **Entrá como tu usuario admin.** Deberías ver **todo** normal (todos los
   clientes, ventas, service, configuración). Si ves todo, las políticas de admin
   andan.

2. **Entrá como un usuario vendedor** (si creaste uno). Debería ver **solo sus
   clientes** y no tener acceso a Service ni Configuración.

3. Si algo aparece **vacío cuando no debería**, es señal de que ese usuario no
   tiene bien cargado su `auth_uid` o sus `roles` en la tabla `usuarios`.
   Revisá esa fila.

### Si algo sale mal: cómo revertir

Si después de activar RLS la app deja de mostrar datos y no sabés por qué, podés
**desactivar RLS de una tabla** puntual para volver al estado anterior, por
ejemplo:

```sql
alter table clientes disable row level security;
```

Eso quita el candado de esa tabla (vuelve a ser accesible como antes) mientras
investigás. Cuando lo resolvés, la volvés a activar corriendo el `rls.sql` de nuevo.

### Importante sobre el alcance de datos

- El interruptor **"vendedores ven todo"** (Configuración → Parámetros) ahora tiene
  efecto **real en la base**, no solo en la pantalla. Si lo activás, los vendedores
  ven todos los clientes; si lo desactivás, solo los suyos.
- Los **tercerizados** siempre ven solo lo suyo.
- **Técnico** ve todo el taller (service); **Postventa** ve toda la postventa.

---

## Resumen del reparto de seguridad

| Capa | Qué protege | Dónde |
|------|-------------|-------|
| Login | Quién entra | Supabase Auth |
| Frontend (permisos) | Qué ve en el menú y los botones | La app |
| **RLS (este paso)** | **Qué datos entrega la base, pase lo que pase** | **Supabase (Postgres)** |

Con las tres capas, el sistema queda cerrado: aunque alguien saltee la app, la
base no le da nada que su rol no permita.

---

## ACTUALIZACIÓN de políticas (si ya tenías RLS activo)

Si ya habías corrido `rls.sql` antes y actualizamos las políticas (por ejemplo,
para permitir que los vendedores creen clientes sin que se los rechace), volvé a
correr el `rls.sql` completo:

1. Supabase → SQL Editor → New query.
2. Pegá todo `supabase/rls.sql` de nuevo.
3. Run.

El script usa `drop policy if exists`, así que reemplaza las políticas viejas por
las nuevas sin romper nada. Es seguro correrlo las veces que haga falta.
