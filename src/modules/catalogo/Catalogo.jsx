import { useState, useEffect, useRef } from 'react';
import { crear, actualizar, buscarCatalogo, catalogoCompleto, importarCatalogo } from '../../lib/db';
import { Empty } from '../../shared/ui.jsx';
import ModalCampos from '../../shared/ModalCampos.jsx';
import { useToast } from '../../shared/Toast.jsx';
import Icon from '../../shared/Icon.jsx';
import { formatoNumero } from '../presupuestos/calculo.js';

// Catálogo de productos para presupuestar (precios en U$S sin IVA).
// Solo el administrador lo ve y lo edita. Para actualizar la lista de
// precios: Exportar → editar en Excel → Importar (actualiza por SKU).
const CAMPOS = [
  { name: 'sku', label: 'SKU', type: 'text', required: true },
  { name: 'codigo', label: 'Código DJI', type: 'text', placeholder: 'Ej: DJI-R880' },
  { name: 'descripcion', label: 'Descripción', type: 'text', required: true, full: true },
  { name: 'precio', label: 'Precio U$S (sin IVA)', type: 'number', required: true },
  { name: 'marca', label: 'Marca', type: 'select', options: ['DJI', 'Ligier', 'Alemor', 'Otra'] },
  { name: 'activo', label: 'Estado', type: 'select', options: [{ value: 'true', label: 'Activo (se puede presupuestar)' }, { value: 'false', label: 'Inactivo (no aparece en la búsqueda)' }] },
];
const COLUMNAS_CSV = ['sku', 'codigo', 'descripcion', 'precio', 'marca', 'activo'];

export default function Catalogo() {
  const [q, setQ] = useState('');
  const [filas, setFilas] = useState(null);
  const [total, setTotal] = useState(0);
  const [modal, setModal] = useState(null); // producto a editar ({} = nuevo)
  const [importacion, setImportacion] = useState(null); // { filas, errores }
  const [trabajando, setTrabajando] = useState(false);
  const archivo = useRef(null);
  const toast = useToast();

  const cargar = async (texto = q) => {
    try {
      const r = await buscarCatalogo(texto, { limite: 50, soloActivos: false });
      setFilas(r.filas); setTotal(r.total);
    } catch (e) { console.error(e); setFilas([]); }
  };
  useEffect(() => {
    const t = setTimeout(() => cargar(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  async function guardar(v) {
    const datos = {
      sku: v.sku.trim(), codigo: (v.codigo || '').trim() || null, descripcion: v.descripcion.trim(),
      precio: Number(v.precio) || 0, marca: v.marca || null, activo: String(v.activo) !== 'false',
      actualizado_en: new Date().toISOString(),
    };
    try {
      if (modal.id) await actualizar('productos_catalogo', modal.id, datos);
      else await crear('productos_catalogo', datos);
      setModal(null); toast(modal.id ? 'Producto actualizado' : 'Producto agregado'); cargar();
    } catch (e) {
      console.error(e);
      toast(e?.code === '23505' ? 'Ya existe un producto con ese SKU' : 'No se pudo guardar el producto', 'err');
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
      <div className="aviso">
        Precios en U$S sin IVA. Solo un administrador puede cambiarlos; al presupuestar, los vendedores usan siempre el precio de acá.
        Cambiar un precio no modifica los presupuestos ya emitidos.
      </div>
      <div className="card card-pad" style={{ marginBottom: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field" style={{ margin: 0, flex: '1 1 260px' }}>
          <label>Buscar</label>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Descripción, SKU o código DJI" />
        </div>
        <button className="btn" onClick={() => setModal({ marca: 'DJI', activo: 'true' })}><Icon name="plus" size={15} /> Producto</button>
        <button className="btn ghost" onClick={exportar} disabled={trabajando}>Exportar CSV</button>
        <button className="btn ghost" onClick={() => archivo.current?.click()} disabled={trabajando}>Importar CSV</button>
        <input ref={archivo} type="file" accept=".csv,text/csv" onChange={leerArchivo} style={{ display: 'none' }} />
      </div>

      {filas === null ? <Empty>Cargando…</Empty> : filas.length === 0 ? (
        <Empty>{q ? 'Ningún producto coincide con la búsqueda.' : 'El catálogo está vacío. Corré catalogo_inicial.sql o importá un CSV.'}</Empty>
      ) : (
        <div className="card table-wrap">
          <table>
            <thead><tr><th>Descripción</th><th>SKU</th><th>Código</th><th>Marca</th><th style={{ textAlign: 'right' }}>Precio U$S</th><th /></tr></thead>
            <tbody>
              {filas.map((p) => (
                <tr key={p.id} style={p.activo === false ? { opacity: 0.55 } : undefined}>
                  <td className="celda-corta strong" title={p.descripcion}>{p.descripcion}{p.activo === false && <span className="badge" style={{ marginLeft: 6 }}>Inactivo</span>}</td>
                  <td className="sm">{p.sku}</td>
                  <td className="sm">{p.codigo || <span className="muted">—</span>}</td>
                  <td><span className="badge">{p.marca || '—'}</span></td>
                  <td style={{ textAlign: 'right' }} className="strong">{formatoNumero(p.precio)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="ibtn" onClick={() => setModal({ ...p, activo: String(p.activo !== false) })} title="Editar"><Icon name="edit" size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="card-pad muted sm">
            {total > filas.length ? `Mostrando ${filas.length} de ${total}. Refiná la búsqueda para ver otros.` : `${total} productos.`}
          </div>
        </div>
      )}

      {modal && (
        <ModalCampos titulo={modal.id ? 'Editar producto' : 'Nuevo producto'} campos={CAMPOS} valoresIniciales={modal}
          grid ancho={620} textoConfirmar="Guardar" onConfirm={guardar} onCancel={() => setModal(null)} />
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
