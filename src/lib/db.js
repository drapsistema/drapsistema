import { supabase, modoDemo } from './supabase';
import { demoSeed } from './demoData';

// ============================================================
// CAPA DE ACCESO A DATOS
// ============================================================
// Todos los módulos leen y escriben a través de estas funciones,
// nunca directamente contra Supabase. Así, el día de mañana se
// puede cambiar el backend tocando solo este archivo.
//
// Cada función funciona en los dos modos:
//   - MODO DEMO  -> opera sobre datos en memoria (demoStore)
//   - PRODUCCIÓN -> opera sobre Supabase
// ============================================================

// Copia mutable de los datos demo (para poder crear/editar/borrar).
const demoStore = JSON.parse(JSON.stringify(demoSeed));

// Genera el próximo id en modo demo.
function nextId(tabla) {
  const filas = demoStore[tabla] || [];
  return filas.reduce((max, f) => Math.max(max, f.id), 0) + 1;
}

// ---- LISTAR ----
// Devuelve todas las filas de una tabla, con filtros opcionales.
// filtros: objeto { columna: valor } para un WHERE simple.
export async function listar(tabla, filtros = {}) {
  if (modoDemo) {
    let filas = demoStore[tabla] ? [...demoStore[tabla]] : [];
    Object.entries(filtros).forEach(([col, val]) => {
      filas = filas.filter((f) => f[col] === val);
    });
    return filas;
  }
  let query = supabase.from(tabla).select('*');
  Object.entries(filtros).forEach(([col, val]) => {
    query = query.eq(col, val);
  });
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// ---- OBTENER UNO ----
export async function obtener(tabla, id) {
  if (modoDemo) {
    return (demoStore[tabla] || []).find((f) => f.id === Number(id)) || null;
  }
  const { data, error } = await supabase.from(tabla).select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

// ---- CREAR ----
export async function crear(tabla, datos) {
  if (modoDemo) {
    const fila = { ...datos, id: nextId(tabla) };
    if (!demoStore[tabla]) demoStore[tabla] = [];
    demoStore[tabla].push(fila);
    return fila;
  }
  const { data, error } = await supabase.from(tabla).insert(datos).select().single();
  if (error) throw error;
  return data;
}

// ---- ACTUALIZAR ----
// Campos que la base genera sola y NO se pueden actualizar (la base los rechaza).
const CAMPOS_NO_EDITABLES = ['id', 'creado_en'];

export async function actualizar(tabla, id, cambios) {
  if (modoDemo) {
    const fila = (demoStore[tabla] || []).find((f) => f.id === Number(id));
    if (fila) Object.assign(fila, cambios);
    return fila;
  }
  // Sacar campos autogenerados: si vienen en el objeto, la base rechaza el update
  // ("column id can only be updated to DEFAULT").
  const limpios = { ...cambios };
  CAMPOS_NO_EDITABLES.forEach((c) => delete limpios[c]);
  const { data, error } = await supabase.from(tabla).update(limpios).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

// ---- ELIMINAR (borrado lógico donde aplique) ----
export async function eliminar(tabla, id) {
  if (modoDemo) {
    demoStore[tabla] = (demoStore[tabla] || []).filter((f) => f.id !== Number(id));
    return true;
  }
  const { error } = await supabase.from(tabla).delete().eq('id', id);
  if (error) throw error;
  return true;
}

// ---- CHEQUEO GLOBAL DE CUIT ----
// Busca un cliente por CUIT contra TODOS los clientes (más allá de RLS),
// vía la función SECURITY DEFINER `cliente_por_cuit`. Devuelve null si no
// existe, o { cliente_id, es_propio, puede_ver, nombre }. El nombre viene
// solo si quien pregunta puede ver la ficha (admin o quien lo cargó).
export async function clientePorCuit(cuit) {
  if (modoDemo) {
    const c = (demoStore.clientes || []).find((x) => x.cuit === cuit);
    if (!c) return null;
    const nombre = c.tipo === 'Persona física'
      ? `${c.nombre || ''} ${c.apellido || ''}`.trim()
      : c.razon_social;
    return { cliente_id: c.id, es_propio: true, puede_ver: true, nombre };
  }
  const { data, error } = await supabase.rpc('cliente_por_cuit', { p_cuit: cuit });
  if (error) throw error;
  return (data && data[0]) || null;
}

// ---- GENERAR POSTVENTA ----
// Crea las 3 tareas de postventa de una venta entregada que no las tenga,
// vía la función SECURITY DEFINER `generar_postventa` (corre por fuera de
// RLS). Idempotente. Devuelve cuántas tareas creó (0 si no correspondía).
export async function generarPostventa(ventaId) {
  const vid = Number(ventaId);
  if (modoDemo) {
    const v = (demoStore.ventas || []).find((x) => x.id === vid);
    const yaHay = (demoStore.tareas_postventa || []).some((t) => t.venta_id === vid);
    if (!v || !v.fecha_entrega || yaHay) return 0;
    const base = new Date(v.fecha_entrega);
    for (const [hito, d] of [['1 semana', 7], ['1 mes', 30], ['2 meses', 60]]) {
      const obj = new Date(base); obj.setDate(obj.getDate() + d);
      await crear('tareas_postventa', {
        venta_id: vid, hito, objetivo: obj.toISOString().slice(0, 10), estado: 'Pendiente',
        fecha_real: null, observaciones: '', hectareas: null, visita: false,
        visita_estado: '', visita_agenda: null, visita_real: null, responsable_id: null,
      });
    }
    return 3;
  }
  const { data, error } = await supabase.rpc('generar_postventa', { p_venta_id: vid });
  if (error) throw error;
  return data;
}

// ============================================================
// ADMINISTRACIÓN DE USUARIOS (vía Edge Function)
// ------------------------------------------------------------
// Estas operaciones necesitan permisos de administrador que viven
// seguros en el servidor (Edge Function admin-usuarios). El frontend
// solo la invoca. En modo demo, se simula en memoria.
// ============================================================

// Valida la contraseña con la misma regla que la Edge Function.
export function passwordValida(p) {
  if (!p || p.length < 12) return false;
  return /[A-Z]/.test(p) && /[a-z]/.test(p) && /[0-9]/.test(p) && /[^A-Za-z0-9]/.test(p);
}

// Genera una contraseña segura que cumple la regla (12+, may/min/num/símbolo).
export function generarPassword() {
  const may = 'ABCDEFGHJKLMNPQRSTUVWXYZ', min = 'abcdefghijkmnpqrstuvwxyz';
  const num = '23456789', sim = '!@#$%&*?';
  const todos = may + min + num + sim;
  const pick = (s) => s[Math.floor(Math.random() * s.length)];
  let p = pick(may) + pick(min) + pick(num) + pick(sim);
  for (let i = 0; i < 10; i++) p += pick(todos);
  return p.split('').sort(() => Math.random() - 0.5).join('');
}

// Invoca la Edge Function. En demo, simula sobre los datos locales.
export async function adminUsuarios(accion, payload) {
  if (modoDemo) return adminUsuariosDemo(accion, payload);
  const { data, error } = await supabase.functions.invoke('admin-usuarios', {
    body: { accion, ...payload },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

// Simulación del modo demo (sin backend real).
async function adminUsuariosDemo(accion, payload) {
  if (accion === 'crear') {
    if (!passwordValida(payload.password)) throw new Error('Contraseña insegura');
    await crear('usuarios', {
      nombre: payload.nombre, mail: payload.mail, roles: payload.roles,
      acceso: 'Activo', estado_cuenta: 'Activa',
    });
    return { ok: true };
  }
  if (accion === 'deshabilitar' || accion === 'reactivar') {
    const deshab = accion === 'deshabilitar';
    await actualizar('usuarios', payload.usuario_id, {
      acceso: deshab ? 'Inactivo' : 'Activo',
      acceso_desde: deshab ? new Date().toISOString().slice(0, 10) : '',
    });
    return { ok: true };
  }
  if (accion === 'blanquear') {
    if (!passwordValida(payload.password)) throw new Error('Contraseña insegura');
    await actualizar('usuarios', payload.usuario_id, { estado_cuenta: 'Activa' });
    return { ok: true };
  }
  throw new Error('Acción desconocida');
}
