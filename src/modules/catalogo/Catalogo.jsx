import { useState, useEffect, useRef } from 'react';
import { crear, actualizar, buscarCatalogo, catalogoCompleto, importarCatalogo } from '../../lib/db';
import { PageHeader, Empty } from '../../shared/ui.jsx';
import ModalCampos from '../../shared/ModalCampos.jsx';
import { useToast } from '../../shared/Toast.jsx';
import { useAuth } from '../../shared/Auth.jsx';
import Icon from '../../shared/Icon.jsx';
import { formatoNumero } from '../presupuestos/calculo.js';

// ============================================================
// CATÁLOGO DE PRODUCTOS (precios en U$S sin IVA)
// Vista en tabla. El administrador edita directo en las celdas (se guarda
// al salir de la celda o con Enter); el resto solo consulta. Para cambiar
// muchos precios juntos: Exportar → editar en Excel → Importar (por SKU).
// ============================================================
const MARCAS = ['DJI', 'Ligier', 'Alemor', 'Otra'];
const PAGINA = 50;
const CAMPOS_NUEVO = [
  { name: 'sku', label: 'SKU', type: 'text', required: true },
  { name: 'codigo', label: 'Código DJI', type: 'text', placeholder: 'Ej: DJI-R880' },
  { name: 'descripcion', label: 'Descripción', type: 'text', required: true, full: true },
  { name: 'precio', label: 'Precio U$S (sin IVA)', type: 'number', required: true },
  { name: 'marca', label: 'Marca', type: 'select', options: MARCAS },
];
const COLUMNAS_CSV = ['sku', 'codigo', 'descripcion', 'precio', 'marca', 'activo'];

export default function Catalogo() {
  const { esAdmin } = useAuth();
  const [q, setQ] = useState('');
  const [limite, setLimite] = useState(PAGINA);
  const [filas, setFilas] = useState(null);
  const [total, setTotal] = useState(0);
  const [nuevo, setNuevo] = useState(false);
  const [importacion, setImportacion] = useState(null); // { filas, errores }
  const [trabajando, setTrabajando] = useState(false);
  const archivo = useRef(null);
  const toast = useToast();

  const cargar = async (texto = q, lim = limite) => {
    try {
      // Los no admin solo ven los productos activos (los que se pueden presupuestar).
      const r = await buscarCatalogo(texto, { limite: lim, soloActivos: !esAdmin });
      setFilas(r.filas); setTotal(r.total);
    } catch (e) { console.error(e); setFilas([]); }
  };
  useEffect(() => { setLimite(PAGINA); }, [q]);
  useEffect(() => {
    const t = setTimeout(() => cargar(q, limite), 250);
    return () => clearTimeout(t);
  }, [q, limite, esAdmin]);

  // Guarda un campo de un producto (edición en la celda).
  async function guardarCampo(p, campo, valor) {
    let v = valor;
    if (campo === 'precio') {
      v = Number(String(valor).replace(',', '.'));
      if (Number.isNaN(v) || v < 0) { toast('Precio inválido', 'err'); return false; }
    }
    if (campo === 'descripcion' && !String(v).trim()) { toast('La descripción no puede quedar vacía', 'err'); return false; }
    if (typeof v === 'string') v = v.trim() || (campo === 'codigo' ? null : v.trim());
    if ((p[campo] ?? null) === (v ?? null)) return true;
    try {
      await actualizar('productos_catalogo', p.id, { [campo]: v, actualizado_en: new Date().toISOString() });
      setFilas((fs) => fs.map((x) => (x.id === p.id ? { ...x, [campo]: v } : x)));
      toast(campo === 'precio' ? `Precio de ${p.sku} actualizado` : 'Producto actualizado');
      return true;
    } catch (e) {
      console.error(e); toast('No se pudo guardar el cambio', 'err'); return false;
    }
  }

  async function crearProducto(v) {
    try {
      await crear('productos_catalogo', {
        sku: v.sku.trim(), codigo: (v.codigo || '').trim() || null, descripcion: v.descripcion.trim(),
        precio: Number(v.precio) || 0, marca: v.marca || null, activo: true,
      });
      setNuevo(false); toast('Producto agregado'); setQ(v.sku.trim());
    } catch (e) {
      console.error(e);
      toast(e?.code === '23505' ? 'Ya existe un producto con ese SKU' : 'No se pudo agregar el producto', 'err');
    }
  }

  async function exportar() {
    setTrabajando(true);
    try {
      const todas = await catalogoCompleto();
      const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const csv = [COLUMNAS_CSV.join(';'),
        ...todas.map((p) => [p.sku, p.codigo, p.descripcion, String(p.precio).replace('.', ','), p.marca, p.activo === false ? 'no' : 'si'].map(esc).join(';'))].join('\r\n');
      // BOM para que Excel abra bien los acentos.
      const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url; a.download = `DRAP_catalogo_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { console.error(e); toast('No se pudo exportar el catálogo', 'err'); }
    finally { setTrabajando(false); }
  }

  async function leerArchivo(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setImportacion(parsearCsv(await f.text()));
  }

  async function confirmarImportacion() {
    setTrabajando(true);
    try {
      const n = await importarCatalogo(importacion.filas);
      setImportacion(null); toast(`${n} productos importados`); cargar();
    } catch (e) { console.error(e); toast('No se pudo importar el catálogo', 'err'); }
    finally { setTrabajando(false); }
  }

  return (
    <div>
      <PageHeader titulo="Catálogo de productos"
        sub={esAdmin ? 'Precios en U$S sin IVA. Hacé clic en una celda para editarla.' : 'Lista de precios en U$S sin IVA. Solo un administrador puede modificarla.'}>
        {esAdmin && <button className="btn" onClick={() => setNuevo(true)}><Icon name="plus" size={15} /> Producto</button>}
      </PageHeader>

      <div className="card card-pad" style={{ marginBottom: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field" style={{ margin: 0, flex: '1 1 260px' }}>
          <label>Buscar</label>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Descripción, SKU o código DJI" />
        </div>
        {esAdmin && (
          <>
            <button className="btn ghost" onClick={exportar} disabled={trabajando}>Exportar CSV</button>
            <button className="btn ghost" onClick={() => archivo.current?.click()} disabled={trabajando}>Importar CSV</button>
            <input ref={archivo} type="file" accept=".csv,text/csv" onChange={leerArchivo} style={{ display: 'none' }} />
          </>
        )}
      </div>

      {esAdmin && (
        <div className="aviso">
          Cambiar un precio no modifica los presupuestos ya emitidos. Para actualizar muchos precios juntos: Exportar CSV, editarlo en Excel e Importar CSV.
        </div>
      )}

      {filas === null ? <Empty>Cargando…</Empty> : filas.length === 0 ? (
        <Empty>{q ? 'Ningún producto coincide con la búsqueda.' : 'El catálogo está vacío.'}</Empty>
      ) : (
        <div className="card table-wrap">
          <table className="tabla-catalogo">
            <thead>
              <tr>
                <th>SKU</th><th>Código</th><th>Descripción</th><th>Marca</th>
                <th style={{ textAlign: 'right' }}>Precio U$S</th>{esAdmin && <th>Estado</th>}
              </tr>
            </thead>
            <tbody>
              {filas.map((p) => (
                <tr key={p.id} style={p.activo === false ? { opacity: 0.55 } : undefined}>
                  <td className="sm" style={{ whiteSpace: 'nowrap' }}>{p.sku}</td>
                  <td className="sm" style={{ whiteSpace: 'nowrap' }}>
                    <Celda valor={p.codigo || ''} editable={esAdmin} onGuardar={(v) => guardarCampo(p, 'codigo', v)} vacio="—" />
                  </td>
                  <td className="strong">
                    <Celda valor={p.descripcion} editable={esAdmin} onGuardar={(v) => guardarCampo(p, 'descripcion', v)} ancho />
                  </td>
                  <td>
                    {esAdmin ? (
                      <select className="celda-select" value={p.marca || ''} onChange={(e) => guardarCampo(p, 'marca', e.target.value)}>
                        {!MARCAS.includes(p.marca) && <option value={p.marca || ''}>{p.marca || '—'}</option>}
                        {MARCAS.map((m) => <option key={m}>{m}</option>)}
                      </select>
                    ) : <span className="badge">{p.marca || '—'}</span>}
                  </td>
                  <td style={{ textAlign: 'right' }} className="strong">
                    <Celda valor={String(p.precio)} mostrar={formatoNumero(p.precio)} editable={esAdmin} numero
                      onGuardar={(v) => guardarCampo(p, 'precio', v)} />
                  </td>
                  {esAdmin && (
                    <td>
                      <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer', whiteSpace: 'nowrap' }} className="sm">
                        <input type="checkbox" checked={p.activo !== false} onChange={(e) => guardarCampo(p, 'activo', e.target.checked)} />
                        {p.activo !== false ? 'Activo' : 'Inactivo'}
                      </label>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="card-pad muted sm" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span className="grow">Mostrando {filas.length} de {total} productos.</span>
            {total > filas.length && (
              <button className="btn ghost sm" onClick={() => setLimite((l) => l + PAGINA)}>Mostrar {Math.min(PAGINA, total - filas.length)} más</button>
            )}
          </div>
        </div>
      )}

      {nuevo && (
        <ModalCampos titulo="Nuevo producto" campos={CAMPOS_NUEVO} valoresIniciales={{ marca: 'DJI' }}
          grid ancho={620} textoConfirmar="Agregar" onConfirm={crearProducto} onCancel={() => setNuevo(false)} />
      )}

      {importacion && (
        <div className="modal-bg" onClick={(e) => e.target.className === 'modal-bg' && setImportacion(null)}>
          <div className="modal">
            <div className="modal-h"><span>Importar catálogo</span><button className="modal-x" onClick={() => setImportacion(null)}>✕</button></div>
            <div className="modal-b">
              <p className="modal-p">
                Se van a crear o actualizar <b>{importacion.filas.length}</b> productos (por SKU). Los productos que no estén en el archivo no se tocan.
              </p>
              {importacion.errores.length > 0 && (
                <div className="aviso warn" style={{ display: 'block' }}>
                  {importacion.errores.length} fila(s) con problemas se van a omitir:
                  <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                    {importacion.errores.slice(0, 6).map((er) => <li key={er}>{er}</li>)}
                  </ul>
                </div>
              )}
              <div className="hint" style={{ marginBottom: 10 }}>Columnas: {COLUMNAS_CSV.join(';')} (la primera fila es el encabezado).</div>
              <div className="modal-foot">
                <button className="btn ghost" onClick={() => setImportacion(null)}>Cancelar</button>
                <button className="btn" onClick={confirmarImportacion} disabled={trabajando || importacion.filas.length === 0}>
                  {trabajando ? 'Importando…' : 'Importar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Celda editable: muestra el valor; al hacer clic pasa a campo de texto.
// Enter o salir de la celda guarda; Escape cancela.
function Celda({ valor, mostrar, editable, onGuardar, numero, ancho, vacio = '' }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(valor);
  const cerrando = useRef(false); // evita guardar dos veces (Enter + blur)

  if (!editable) return <span>{mostrar ?? (valor || <span className="muted">{vacio}</span>)}</span>;
  if (!editando) {
    return (
      <span className="celda-editable" title="Clic para editar"
        onClick={() => { setTexto(valor); cerrando.current = false; setEditando(true); }}>
        {mostrar ?? (valor || <span className="muted">{vacio || '—'}</span>)}
      </span>
    );
  }
  const guardar = async () => {
    if (cerrando.current) return;
    cerrando.current = true;
    const ok = await onGuardar(texto);
    if (ok === false) { cerrando.current = false; return; }
    setEditando(false);
  };
  const cancelar = () => { cerrando.current = true; setEditando(false); };
  return (
    <input className="celda-input" autoFocus value={texto} inputMode={numero ? 'decimal' : undefined}
      style={{ textAlign: numero ? 'right' : 'left', width: ancho ? '100%' : numero ? 110 : 140 }}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={guardar}
      onKeyDown={(e) => {
        if (e.key === 'Enter') guardar();
        if (e.key === 'Escape') cancelar();
      }} />
  );
}

// CSV separado por ";" o "," (lo que use Excel según la región), con
// comillas opcionales y precio con coma o punto decimal.
function parsearCsv(texto) {
  const lineas = texto.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (lineas.length === 0) return { filas: [], errores: ['El archivo está vacío'] };
  const sep = (lineas[0].match(/;/g) || []).length >= (lineas[0].match(/,/g) || []).length ? ';' : ',';
  const partir = (l) => {
    const out = []; let cur = ''; let comillas = false;
    for (let i = 0; i < l.length; i++) {
      const ch = l[i];
      if (ch === '"') { if (comillas && l[i + 1] === '"') { cur += '"'; i++; } else comillas = !comillas; }
      else if (ch === sep && !comillas) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const cab = partir(lineas[0]).map((c) => c.toLowerCase());
  const col = (n) => cab.indexOf(n);
  if (col('sku') < 0 || col('descripcion') < 0 || col('precio') < 0) {
    return { filas: [], errores: ['El encabezado tiene que incluir al menos: sku, descripcion y precio'] };
  }
  const filas = [], errores = [], vistos = new Set();
  lineas.slice(1).forEach((l, i) => {
    const v = partir(l);
    const sku = v[col('sku')], descripcion = v[col('descripcion')];
    const precioTxt = (v[col('precio')] || '').replace(/\./g, (m, pos, s) => (s.includes(',') ? '' : m)).replace(',', '.');
    const precio = Number(precioTxt);
    if (!sku || !descripcion || Number.isNaN(precio)) { errores.push(`Fila ${i + 2}: falta SKU, descripción o precio válido`); return; }
    if (vistos.has(sku)) { errores.push(`Fila ${i + 2}: SKU ${sku} repetido en el archivo`); return; }
    vistos.add(sku);
    const activoTxt = col('activo') >= 0 ? (v[col('activo')] || '').toLowerCase() : '';
    filas.push({
      sku, descripcion, precio,
      codigo: col('codigo') >= 0 ? (v[col('codigo')] || null) : null,
      marca: col('marca') >= 0 ? (v[col('marca')] || null) : null,
      activo: !['no', 'false', '0', 'inactivo'].includes(activoTxt),
    });
  });
  return { filas, errores };
}
