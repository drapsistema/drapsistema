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

// ---- CLIENTES CON NOMBRE PARECIDO ----
// Para avisar de posibles duplicados cuando se carga un cliente sin CUIT.
// Vía la función SECURITY DEFINER `clientes_parecidos`: busca en todos
// los clientes, pero el nombre solo vuelve si quien pregunta puede ver la
// ficha. Devuelve [{ cliente_id, puede_ver, nombre }].
export async function clientesParecidos(texto, excluirId = null) {
  if (modoDemo) {
    const t = texto.toLowerCase();
    return (demoStore.clientes || [])
      .filter((c) => c.id !== Number(excluirId))
      .map((c) => ({
        cliente_id: c.id, puede_ver: true,
        nombre: c.tipo === 'Persona física' ? `${c.nombre || ''} ${c.apellido || ''}`.trim() : c.razon_social,
      }))
      .filter((c) => (c.nombre || '').toLowerCase().includes(t))
      .slice(0, 5);
  }
  const { data, error } = await supabase.rpc('clientes_parecidos', { p_texto: texto, p_excluir: excluirId });
  if (error) throw error;
  return data || [];
}

// ---- UNIFICAR CLIENTES (solo admin) ----
// Pasa contactos, oportunidades, ventas y trabajos del cliente origen
// (duplicado) al destino, completa datos faltantes y desactiva el origen.
// Vía la función SECURITY DEFINER `unificar_clientes` (una transacción).
export async function unificarClientes(origenId, destinoId) {
  if (modoDemo) {
    const o = demoStore.clientes.find((c) => c.id === Number(origenId));
    const d = demoStore.clientes.find((c) => c.id === Number(destinoId));
    const movidos = {};
    ['contactos', 'oportunidades', 'ventas', 'trabajos', 'tareas_postventa', 'postventas'].forEach((t) => {
      const filas = (demoStore[t] || []).filter((f) => f.cliente_id === o.id);
      filas.forEach((f) => { f.cliente_id = d.id; });
      movidos[t] = filas.length;
    });
    ['cuit', 'domicilio', 'telefono', 'mail'].forEach((k) => { if (!d[k]) d[k] = o[k]; });
    Object.assign(o, { activo: false, unificado_en: d.id, cuit: null });
    (demoStore.solicitudes_unificacion || []).forEach((s) => {
      if (s.estado === 'Pendiente' && [o.id, d.id].includes(s.cliente_origen_id) && [o.id, d.id].includes(s.cliente_destino_id)) {
        s.estado = 'Resuelta';
      }
    });
    return movidos;
  }
  const { data, error } = await supabase.rpc('unificar_clientes', { p_origen: Number(origenId), p_destino: Number(destinoId) });
  if (error) throw error;
  return data;
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
    const pv = (demoStore.postventas || []).find((p) => p.venta_id === vid)
      || await crear('postventas', { venta_id: vid, cliente_id: v.cliente_id, equipo: null });
    const base = new Date(v.fecha_entrega);
    for (const [hito, d] of [['1 semana', 7], ['1 mes', 30], ['2 meses', 60]]) {
      const obj = new Date(base); obj.setDate(obj.getDate() + d);
      await crear('tareas_postventa', {
        venta_id: vid, postventa_id: pv.id, cliente_id: v.cliente_id,
        hito, objetivo: obj.toISOString().slice(0, 10), estado: 'Pendiente',
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

// ---- BUSCAR EN EL CATÁLOGO ----
// Busca por descripción, SKU o código DJI en la base (el catálogo supera
// las 1.000 filas que devuelve una consulta, así que no se trae entero).
// Devuelve { filas, total }. soloActivos=false para la pantalla de admin.
export async function buscarCatalogo(texto, { limite = 15, soloActivos = true } = {}) {
  const t = (texto || '').trim();
  if (modoDemo) {
    const q = t.toLowerCase();
    const filas = (demoStore.productos_catalogo || [])
      .filter((p) => (!soloActivos || p.activo !== false)
        && (!q || [p.descripcion, p.sku, p.codigo].some((v) => (v || '').toLowerCase().includes(q))));
    return { filas: filas.slice(0, limite), total: filas.length };
  }
  let query = supabase.from('productos_catalogo').select('*', { count: 'exact' });
  if (soloActivos) query = query.eq('activo', true);
  // Caracteres que rompen la sintaxis del filtro `or` de PostgREST.
  const limpio = t.replace(/[,()%*\\]/g, ' ').trim();
  if (limpio) query = query.or(`descripcion.ilike.%${limpio}%,sku.ilike.%${limpio}%,codigo.ilike.%${limpio}%`);
  const { data, error, count } = await query.order('descripcion').limit(limite);
  if (error) throw error;
  return { filas: data || [], total: count ?? (data || []).length };
}

// ---- CATÁLOGO COMPLETO (exportar) ----
// Trae todas las filas en tandas de 1.000 (límite por consulta de Supabase).
export async function catalogoCompleto() {
  if (modoDemo) return [...(demoStore.productos_catalogo || [])];
  const todas = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase.from('productos_catalogo').select('*').order('sku').range(desde, desde + 999);
    if (error) throw error;
    todas.push(...data);
    if (data.length < 1000) return todas;
  }
}

// ---- IMPORTAR CATÁLOGO ----
// Crea o actualiza productos por SKU (solo admin). Devuelve cuántos procesó.
export async function importarCatalogo(filas) {
  if (modoDemo) {
    filas.forEach((f) => {
      const p = (demoStore.productos_catalogo || []).find((x) => x.sku === f.sku);
      if (p) Object.assign(p, f);
      else demoStore.productos_catalogo.push({ ...f, id: nextId('productos_catalogo'), activo: f.activo ?? true });
    });
    return filas.length;
  }
  for (let i = 0; i < filas.length; i += 500) {
    const tanda = filas.slice(i, i + 500).map((f) => ({ ...f, actualizado_en: new Date().toISOString() }));
    const { error } = await supabase.from('productos_catalogo').upsert(tanda, { onConflict: 'sku' });
    if (error) throw error;
  }
  return filas.length;
}

// ---- NUMERACIÓN DE PRESUPUESTOS ----
// PRE-2026-0001, correlativo por año, vía la función SECURITY DEFINER
// `siguiente_nro_presupuesto` (atómica; sirve a vendedores y técnicos).
export async function siguienteNroPresupuesto() {
  if (modoDemo) {
    const cfg = (demoStore.configuracion || []).find((c) => c.id === 1);
    const anio = new Date().getFullYear();
    cfg.pres_actual = cfg.pres_anio === anio ? (cfg.pres_actual || 0) + 1 : 1;
    cfg.pres_anio = anio;
    return `PRE-${anio}-${String(cfg.pres_actual).padStart(4, '0')}`;
  }
  const { data, error } = await supabase.rpc('siguiente_nro_presupuesto');
  if (error) throw error;
  return data;
}

// ---- MI CONTACTO ----
// Cada usuario carga su teléfono y WhatsApp (salen en sus presupuestos).
export async function actualizarMiContacto(usuarioId, telefono, whatsapp) {
  if (modoDemo) {
    const u = (demoStore.usuarios || []).find((x) => x.id === Number(usuarioId));
    if (u) Object.assign(u, { telefono: telefono || null, whatsapp: whatsapp || null });
    return;
  }
  const { error } = await supabase.rpc('actualizar_mi_contacto', { p_telefono: telefono, p_whatsapp: whatsapp });
  if (error) throw error;
}

// ---- NUMERACIÓN DE SERVICE (OT / remito) ----
// Pide el próximo número correlativo a la función SECURITY DEFINER
// `siguiente_nro_trabajo` (atómica, y habilitada para técnicos).
export async function siguienteNroTrabajo(tipo) {
  if (modoDemo) {
    const cfg = (demoStore.configuracion || []).find((c) => c.id === 1);
    if (!cfg) return tipo === 'Service' ? 'OT-0001' : 'R-000001';
    if (tipo === 'Service') { cfg.ot_actual = (cfg.ot_actual || 0) + 1; return 'OT-' + String(cfg.ot_actual).padStart(4, '0'); }
    cfg.rem_actual = (cfg.rem_actual || 0) + 1; return 'R-' + String(cfg.rem_actual).padStart(6, '0');
  }
  const { data, error } = await supabase.rpc('siguiente_nro_trabajo', { p_tipo: tipo });
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
