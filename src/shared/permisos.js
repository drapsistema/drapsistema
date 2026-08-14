import { listar } from '../lib/db';

// ============================================================
// PERMISOS
// ------------------------------------------------------------
// Define los módulos del sistema y calcula qué ve cada usuario
// combinando SUS ROLES con la matriz de permisos que configura
// el administrador.
//
//  - El administrador ve TODO siempre (no depende de la matriz).
//  - Un usuario con varios roles ve la UNIÓN de lo que permite
//    cada uno de sus roles.
// ============================================================

// Módulos que se pueden habilitar/deshabilitar por rol.
export const MODULOS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'clientes', label: 'Clientes' },
  { id: 'comercial', label: 'CRM comercial' },
  { id: 'ventas', label: 'Ventas' },
  { id: 'postventa', label: 'Postventa' },
  { id: 'service', label: 'Service y reparación' },
];
// Configuración es aparte: SOLO el administrador. No se puede dar por matriz.

export const ROLES = ['Administrador', 'Vendedor', 'Vendedor tercerizado', 'Técnico', 'Postventa'];

// Normaliza un campo que debería ser un array de strings, contemplando
// los distintos formatos en que puede llegar desde Supabase (columna text[]):
//   - array real:        ['a','b']
//   - string de Postgres: '{a,b}'  (típico de text[] serializado)
//   - string suelto:     'a'
// Es la causa de varios bugs: Supabase a veces entrega text[] como el
// texto '{...}' en vez de un array JS. Este helper lo resuelve en un solo lugar.
export function parseArray(valor) {
  if (Array.isArray(valor)) return valor;
  if (typeof valor === 'string' && valor.length) {
    if (valor.startsWith('{') && valor.endsWith('}')) {
      return valor.slice(1, -1).split(',').map((x) => x.replace(/^"|"$/g, '').trim()).filter(Boolean);
    }
    return [valor];
  }
  return [];
}

// Normaliza los roles de un usuario a un array de strings.
export function rolesDe(usuario) {
  if (!usuario) return [];
  if (usuario.roles !== undefined && usuario.roles !== null) return parseArray(usuario.roles);
  if (usuario.rol) return [usuario.rol]; // compatibilidad con el campo viejo
  return [];
}

export function esAdministrador(usuario) {
  return rolesDe(usuario).includes('Administrador');
}

// Calcula el set de módulos visibles para un usuario, dada la matriz de permisos.
// matriz: filas [{ rol, modulos: [ids] }]
export function modulosVisibles(usuario, matriz) {
  if (esAdministrador(usuario)) {
    return new Set([...MODULOS.map((m) => m.id), 'configuracion']);
  }
  const roles = rolesDe(usuario);
  const set = new Set();
  roles.forEach((rol) => {
    const fila = matriz.find((p) => p.rol === rol);
    if (fila) parseArray(fila.modulos).forEach((m) => set.add(m));
  });
  return set;
}

// Carga la matriz de permisos desde la base (o demo).
export async function cargarPermisos() {
  try {
    return await listar('permisos');
  } catch (e) {
    console.error('Error al cargar permisos:', e);
    return [];
  }
}

// ------------------------------------------------------------
// ALCANCE DE DATOS
// Decide si un usuario ve TODOS los registros o solo los suyos
// (los que tiene asignados como vendedor).
//
//  - Tercerizado: SIEMPRE solo lo suyo.
//  - Vendedor: depende del parámetro global 'vendedores_ven_todo'.
//  - Admin y otros roles con acceso: ven todo.
// ------------------------------------------------------------
export function filtrarPorAlcance(registros, usuario, cfg, campoVendedor = 'vendedor_id') {
  if (!usuario) return registros;
  const roles = rolesDe(usuario);

  if (roles.includes('Administrador')) return registros;

  // Tercerizado: solo lo suyo (aunque tenga otros roles, el tercerizado limita).
  if (roles.includes('Vendedor tercerizado') && roles.length === 1) {
    return registros.filter((r) => r[campoVendedor] === usuario.id);
  }

  // Vendedor: según el parámetro global.
  if (roles.includes('Vendedor')) {
    const venTodo = cfg?.vendedores_ven_todo;
    if (!venTodo) return registros.filter((r) => r[campoVendedor] === usuario.id);
  }

  return registros;
}

// ------------------------------------------------------------
// Filtra usuarios que tengan alguno de los roles buscados.
// Solo incluye usuarios con acceso Activo (no tiene sentido asignar
// trabajo a alguien inactivo o bloqueado).
// Funciona con roles múltiples (array) y con el campo viejo (string).
// ------------------------------------------------------------
export function usuariosConRol(usuarios, ...rolesBuscados) {
  return usuarios.filter((u) => {
    if (u.acceso && u.acceso !== 'Activo') return false;
    const suyos = rolesDe(u);
    return suyos.some((r) => rolesBuscados.includes(r));
  });
}

// Variante: usuarios cuyo rol empieza con un prefijo (ej: 'Vendedor'
// agarra 'Vendedor' y 'Vendedor tercerizado'). Solo activos.
export function usuariosConRolPrefijo(usuarios, prefijo) {
  return usuarios.filter((u) => {
    if (u.acceso && u.acceso !== 'Activo') return false;
    return rolesDe(u).some((r) => r.startsWith(prefijo));
  });
}

// Alterna un rol en una lista, aplicando la regla de exclusión:
// 'Vendedor' y 'Vendedor tercerizado' son mutuamente excluyentes (no se
// puede ser interno y tercerizado a la vez). Al activar uno, se saca el otro.
export function toggleRolExcluyente(roles, rol) {
  const tiene = roles.includes(rol);
  if (tiene) return roles.filter((r) => r !== rol);
  let nuevos = [...roles, rol];
  if (rol === 'Vendedor') nuevos = nuevos.filter((r) => r !== 'Vendedor tercerizado');
  if (rol === 'Vendedor tercerizado') nuevos = nuevos.filter((r) => r !== 'Vendedor');
  return nuevos;
}
