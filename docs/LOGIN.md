# Login y autenticación — puesta en marcha en Supabase

La app usa **Supabase Auth** para el login. Las contraseñas se guardan hasheadas
con bcrypt del lado de Supabase: nunca pasan por el código ni por las tablas de
la app. Este documento explica cómo dejarlo funcionando.

> **Recordá:** en modo demo (sin credenciales de Supabase) la app entra directo
> sin login, para desarrollar. El login solo se exige en producción (con Supabase
> conectado), que es tu caso en Vercel.

---

## 1. Activar el login por mail

1. Entrá a tu proyecto en Supabase.
2. Menú lateral → **Authentication** → **Providers**.
3. Verificá que **Email** esté habilitado (viene así por defecto).
4. En **Authentication → Providers → Email**, por ahora **desactivá "Confirm email"**
   si querés que los usuarios puedan entrar apenas definen su contraseña sin un
   paso extra de confirmación. (Es opcional; con confirmación activada, reciben un
   mail para confirmar antes del primer ingreso.)

---

## 2. Decidir quién se puede registrar

Como los usuarios los da de alta el administrador (opción A que elegiste), conviene
**desactivar el auto-registro público**:

1. **Authentication → Providers → Email**.
2. Desactivá **"Allow new users to sign up"**.

Así nadie puede crearse una cuenta solo: las cuentas las crea el admin.

---

## 3. Crear el primer usuario administrador

Como desactivaste el auto-registro, tenés que crear el primer usuario a mano
(si no, no podés entrar ni vos):

1. **Authentication → Users** → botón **Add user** → **Create new user**.
2. Cargá el **mail** y una **contraseña** para vos (el admin).
3. Confirmá.

Ese usuario ya puede iniciar sesión en la app.

### Importante: vincular con la tabla `usuarios`

La app, además del login, lee el **rol** desde tu tabla `usuarios`. Para que tu
usuario admin tenga rol y aparezca con su nombre:

1. Menú lateral → **Table Editor** → tabla **usuarios**.
2. Insertá una fila (o editá la que ya exista) con:
   - **mail**: el mismo mail con el que lo creaste en Authentication.
   - **nombre**: tu nombre.
   - **rol**: `Administrador`.
   - **acceso**: `Activo`.
   - **estado_cuenta**: `Activa`.

El vínculo entre el login y el perfil es **el mail**: tienen que coincidir.

---

## 4. Cómo se dan de alta los demás usuarios (flujo normal)

Una vez que vos (admin) podés entrar, el alta de usuarios se hace desde la app,
en **Configuración → Usuarios y roles → Nuevo usuario**. El flujo completo con
Supabase es:

1. En la app cargás nombre, mail y rol. Se crea la fila en la tabla `usuarios`
   con estado "Invitación pendiente".
2. Para que la persona pueda definir su contraseña, se le envía una invitación
   desde Supabase. Esto se puede hacer de dos formas:
   - **Manual (rápido para arrancar):** Authentication → Users → **Invite user**,
     ponés su mail. Supabase le manda un mail para que ponga su contraseña.
   - **Automático (ideal):** conectar el alta de la app con la invitación de
     Supabase. Requiere una función del lado del servidor (Edge Function) porque
     invitar usuarios necesita permisos de administrador que no pueden estar en el
     frontend. Se puede armar en una etapa posterior.

> Para el piloto, el camino manual (Invite user desde el panel) es suficiente y no
> requiere programar nada más.

---

## 5. Blanqueo de contraseña (por el administrador)

Cuando un usuario olvida su contraseña, **no la recupera solo** (así lo definiste).
El admin la blanquea:

- **Desde la app:** Configuración → botón "Blanquear" del usuario. Marca la cuenta
  como "Blanqueo pendiente".
- **Desde Supabase (para que el mail salga de verdad):** Authentication → Users →
  el usuario → **Send password recovery**. Supabase le manda el enlace para poner
  una nueva.

Igual que con la invitación, esto se puede automatizar más adelante con una Edge
Function para que el botón de la app dispare el mail directamente.

---

## 6. Verificar que todo anda

1. Cerrá sesión (o abrí una ventana de incógnito) y entrá a tu app en Vercel.
2. Debe aparecer la pantalla **Iniciar sesión**.
3. Ingresá con el mail y contraseña del admin que creaste.
4. Entrás a la app y en el sidebar aparece tu nombre y rol, con el botón de cerrar
   sesión.

Si te equivocás 5 veces, aparece el cartel para contactar al administrador. La
protección real contra ataques de fuerza bruta la maneja Supabase automáticamente
(limita los intentos del lado del servidor).

---

## Resumen del reparto de responsabilidades

| Cosa | Quién la maneja |
|------|-----------------|
| Guardar contraseñas (hasheadas) | Supabase Auth (bcrypt) |
| Validar el login | Supabase Auth |
| Protección contra fuerza bruta | Supabase (rate limiting) |
| Rol y permisos del usuario | Tabla `usuarios` de la app |
| Pantalla de login y cartel de intentos | La app (frontend) |
| Alta / invitación / blanqueo | Admin, desde la app + panel de Supabase |

La contraseña **nunca** está en tu base de datos ni en tu código. Ni vos como
admin la ves.
