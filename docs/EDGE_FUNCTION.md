# Gestión de usuarios — crear la Edge Function en Supabase

La app crea usuarios, los deshabilita (despido), los reactiva y les blanquea la
contraseña **desde la propia app**. Esas operaciones necesitan la "llave maestra"
de Supabase (service role key), que NO puede estar en el frontend porque es
público. La solución es una **Edge Function**: una porción de código que corre en
el servidor de Supabase, donde la llave está segura.

Esta guía te lleva paso a paso a crearla. Es la primera vez que hacés esto, así
que va con detalle. El código ya está escrito y probado; vos solo lo pegás y lo
publicás.

---

## Qué hace la función

Una sola función, llamada **admin-usuarios**, con cuatro operaciones:

- **crear**: da de alta el usuario con la contraseña que definís, y crea su perfil.
- **deshabilitar**: corta el acceso en el login (para despidos). No podrá volver a
  entrar. También lo marca Inactivo.
- **reactivar**: revierte lo anterior.
- **blanquear**: le pone una contraseña nueva (vos se la pasás).

Antes de hacer nada, la función verifica que **quien la llama sea administrador**.

---

## PASO 1 — Crear la función

1. En Supabase, menú lateral → **Edge Functions** (ícono de un rayo, o buscalo en
   el menú).
2. Clic en **Deploy a new function** (o **Create a new function**).
3. Si te da a elegir, elegí crearla **desde el editor** (via Editor / in the
   dashboard), no por línea de comandos.
4. Poné como nombre exactamente: **`admin-usuarios`** (con guion, todo en
   minúsculas; tiene que coincidir con lo que la app llama).

---

## PASO 2 — Pegar el código

1. Se abre un editor de código con un ejemplo por defecto.
2. **Borrá todo** lo que venga de ejemplo.
3. Abrí el archivo `supabase/functions/admin-usuarios/index.ts` de tu repo y copiá
   **todo** su contenido.
4. Pegalo en el editor de Supabase.

---

## PASO 3 — Configurar las variables (las llaves)

La función usa tres datos de tu proyecto. Dos ya vienen solos, pero conviene
confirmarlos, y la service role key hay que asegurarse de que esté disponible.

Las variables que usa son:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` ← la llave maestra

En Supabase, estas tres suelen estar **disponibles automáticamente** para las Edge
Functions (son "secrets" del proyecto). Si al probar la función te diera un error
de que falta alguna:

1. Menú → **Edge Functions** → **Secrets** (o **Manage secrets**).
2. Verificá que estén las tres. La `SUPABASE_SERVICE_ROLE_KEY` la encontrás en
   **Project Settings → API → service_role key** (es secreta, no la compartas).
3. Si falta, agregala ahí con ese nombre exacto.

---

## PASO 4 — Publicar

1. Clic en **Deploy** (o **Save and deploy**).
2. Esperá a que diga que se publicó (unos segundos).

Listo. La función ya está viva y la app puede usarla.

---

## PASO 5 — Probar desde la app

1. Entrá a tu app como **administrador**.
2. Configuración → **Nuevo usuario**.
3. Cargá nombre, mail, roles, y una contraseña (podés usar **Generar**).
4. Crear. Debería aparecer la pantalla que muestra el mail y la contraseña para
   que copies y le pases al nuevo usuario.
5. Cerrá sesión y probá entrar con ese nuevo usuario y su contraseña. Debe entrar.
6. Volvé como admin, y probá **Deshabilitar** ese usuario. Después intentá entrar
   con él: ya no debería poder.

Si todo eso funciona, la Edge Function quedó bien.

---

## Si algo falla

- **"Solo un administrador puede hacer esto":** tu usuario no tiene el rol
  Administrador en la tabla `usuarios`, o el `auth_uid` no coincide. Revisá tu fila.
- **Error sobre una variable/secret:** falta configurar la `SERVICE_ROLE_KEY`
  (Paso 3).
- **"Failed to send request" o similar:** revisá que el nombre de la función sea
  exactamente `admin-usuarios`.
- Cualquier otro error: copiámelo tal cual y lo vemos.

---

## Nota de seguridad

- La service role key **nunca** está en el frontend. Vive solo en el servidor de
  Supabase, dentro de la función.
- La función siempre verifica que quien la llama sea admin antes de actuar.
- Las contraseñas las procesa Supabase Auth (hasheadas con bcrypt). La app nunca
  las guarda en ninguna tabla.
