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
export async function actualizar(tabla, id, cambios) {
  if (modoDemo) {
    const fila = (demoStore[tabla] || []).find((f) => f.id === Number(id));
    if (fila) Object.assign(fila, cambios);
    return fila;
  }
  const { data, error } = await supabase.from(tabla).update(cambios).eq('id', id).select().single();
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
