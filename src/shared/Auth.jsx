import { createContext, useContext, useState, useEffect } from 'react';
import { supabase, modoDemo } from '../lib/supabase';
import { listar } from '../lib/db';
import { modulosVisibles, cargarPermisos, esAdministrador, rolesDe } from './permisos';

// ============================================================
// CONTEXTO DE AUTENTICACIÓN
// ------------------------------------------------------------
// Maneja la sesión del usuario.
//
//  - MODO DEMO (sin Supabase): no pide login. Entra directo como
//    el primer administrador de los datos de ejemplo, para poder
//    desarrollar cómodo.
//  - PRODUCCIÓN (con Supabase): exige login real. La sesión la
//    maneja Supabase Auth (contraseñas hasheadas con bcrypt del
//    lado de Supabase; nunca pasan por nuestro código ni tablas).
// ============================================================

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [sesion, setSesion] = useState(null);       // sesión de Supabase (o 'demo')
  const [perfil, setPerfil] = useState(null);       // fila de la tabla usuarios (nombre, roles, etc.)
  const [permisos, setPermisos] = useState([]);     // matriz de permisos (roles × módulos)
  const [cargando, setCargando] = useState(true);

  useEffect(() => { cargarPermisos().then(setPermisos); }, []);

  useEffect(() => {
    if (modoDemo) {
      // Sin backend: entra directo como el primer admin de ejemplo.
      listar('usuarios').then((us) => {
        const admin = us.find((u) => u.rol === 'Administrador') || us[0];
        setPerfil(admin || null);
        setSesion('demo');
        setCargando(false);
      });
      return;
    }

    // Producción: recuperar sesión activa (si el usuario ya se logueó antes).
    supabase.auth.getSession().then(({ data }) => {
      setSesion(data.session);
      if (data.session) cargarPerfil(data.session.user.email);
      else setCargando(false);
    });

    // Escuchar cambios de sesión (login / logout / token renovado).
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSesion(session);
      if (session) cargarPerfil(session.user.email);
      else { setPerfil(null); setCargando(false); }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Trae la fila de la tabla 'usuarios' que corresponde al mail logueado.
  // Ahí están el nombre, el rol y el estado de acceso.
  async function cargarPerfil(email) {
    try {
      const us = await listar('usuarios');
      const u = us.find((x) => x.mail === email) || null;
      setPerfil(u);
    } catch (e) {
      console.error('Error al cargar el perfil:', e);
    } finally {
      setCargando(false);
    }
  }

  // Iniciar sesión. Devuelve { error } si falla (mail/clave incorrectos,
  // o acceso bloqueado/inactivo).
  async function login(email, password) {
    if (modoDemo) return { error: null };
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error };

    // Chequear que el usuario no esté inactivo o bloqueado en nuestra tabla.
    const us = await listar('usuarios');
    const u = us.find((x) => x.mail === email);
    if (u && u.acceso !== 'Activo') {
      await supabase.auth.signOut();
      return { error: { message: `Tu cuenta está ${u.acceso.toLowerCase()}. Contactá a tu administrador.` } };
    }
    return { error: null };
  }

  async function logout() {
    if (modoDemo) return;
    await supabase.auth.signOut();
    setPerfil(null);
    setSesion(null);
  }

  const value = {
    sesion, perfil, cargando, login, logout, permisos,
    autenticado: Boolean(sesion),
    // usuario actual (id de la tabla usuarios) para comentarios, protecciones, etc.
    usuarioActualId: perfil?.id ?? null,
    esAdmin: esAdministrador(perfil),
    roles: rolesDe(perfil),
    // set de ids de módulos que el usuario puede ver (según sus roles + la matriz)
    modulos: modulosVisibles(perfil, permisos),
    recargarPermisos: () => cargarPermisos().then(setPermisos),
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
