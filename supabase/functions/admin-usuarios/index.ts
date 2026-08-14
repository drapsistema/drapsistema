// ============================================================
// Edge Function: admin-usuarios
// ------------------------------------------------------------
// Maneja las operaciones de usuario que necesitan la llave de
// administrador (service role), que NO puede vivir en el frontend.
//
// Operaciones (accion):
//   - crear:        crea el usuario en Auth (con contraseña) + su perfil.
//   - deshabilitar: bloquea el login del usuario (despido). No podrá
//                   volver a entrar. También lo marca Inactivo en la tabla.
//   - reactivar:    revierte lo anterior.
//   - blanquear:    le pone una nueva contraseña (el admin se la pasa).
//
// SEGURIDAD: sólo un usuario con rol Administrador puede invocarla.
// Se verifica con el token de quien llama antes de hacer nada.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Requisito de contraseña: mínimo 12, con mayúscula, minúscula, número y símbolo.
function passwordValida(p: string): boolean {
  if (!p || p.length < 12) return false;
  return /[A-Z]/.test(p) && /[a-z]/.test(p) && /[0-9]/.test(p) && /[^A-Za-z0-9]/.test(p);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // 1. Verificar que quien llama es un administrador.
    const authHeader = req.headers.get('Authorization') ?? '';
    const clienteLlamador = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await clienteLlamador.auth.getUser();
    if (!userData?.user) {
      return json({ error: 'No autenticado' }, 401);
    }
    // Buscar su perfil y confirmar rol Administrador.
    const admin = createClient(url, serviceKey);
    const { data: perfil } = await admin
      .from('usuarios').select('roles').eq('auth_uid', userData.user.id).single();
    if (!perfil || !(perfil.roles as string[]).includes('Administrador')) {
      return json({ error: 'Solo un administrador puede hacer esto' }, 403);
    }

    // 2. Ejecutar la acción pedida.
    const body = await req.json();
    const { accion } = body;

    if (accion === 'crear') {
      const { nombre, mail, password, roles } = body;
      if (!nombre || !mail || !roles?.length) return json({ error: 'Faltan datos' }, 400);
      if (!passwordValida(password)) {
        return json({ error: 'La contraseña debe tener 12+ caracteres, con mayúscula, minúscula, número y símbolo.' }, 400);
      }
      // Crear en Auth (confirmado, sin mail).
      const { data: nuevo, error: eAuth } = await admin.auth.admin.createUser({
        email: mail, password, email_confirm: true,
      });
      if (eAuth) return json({ error: eAuth.message }, 400);
      // Crear el perfil vinculado.
      const { error: ePerfil } = await admin.from('usuarios').insert({
        auth_uid: nuevo.user.id, nombre, mail, roles,
        acceso: 'Activo', estado_cuenta: 'Activa',
      });
      if (ePerfil) {
        // rollback: si falla el perfil, borrar el usuario de Auth para no dejar huérfanos.
        await admin.auth.admin.deleteUser(nuevo.user.id);
        return json({ error: ePerfil.message }, 400);
      }
      return json({ ok: true });
    }

    if (accion === 'deshabilitar' || accion === 'reactivar') {
      const { usuario_id } = body;
      const { data: u } = await admin.from('usuarios').select('auth_uid').eq('id', usuario_id).single();
      if (!u?.auth_uid) return json({ error: 'Usuario no encontrado' }, 404);
      const deshab = accion === 'deshabilitar';
      // ban_duration: 'none' reactiva; un plazo largo deshabilita el login.
      await admin.auth.admin.updateUserById(u.auth_uid, {
        ban_duration: deshab ? '876000h' : 'none', // ~100 años = deshabilitado
      });
      await admin.from('usuarios').update({
        acceso: deshab ? 'Inactivo' : 'Activo',
        acceso_desde: deshab ? new Date().toISOString().slice(0, 10) : null,
      }).eq('id', usuario_id);
      return json({ ok: true });
    }

    if (accion === 'blanquear') {
      const { usuario_id, password } = body;
      if (!passwordValida(password)) {
        return json({ error: 'La contraseña debe tener 12+ caracteres, con mayúscula, minúscula, número y símbolo.' }, 400);
      }
      const { data: u } = await admin.from('usuarios').select('auth_uid').eq('id', usuario_id).single();
      if (!u?.auth_uid) return json({ error: 'Usuario no encontrado' }, 404);
      await admin.auth.admin.updateUserById(u.auth_uid, { password });
      await admin.from('usuarios').update({ estado_cuenta: 'Activa' }).eq('id', usuario_id);
      return json({ ok: true });
    }

    return json({ error: 'Acción desconocida' }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status, headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
