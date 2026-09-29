import { jsPDF } from 'jspdf';
import { conMoneda, formatoNumero, precioEnMoneda, totales, nombreVersion, MONEDAS } from './calculo.js';

// ============================================================
// PDF DEL PRESUPUESTO
// Se arma en el navegador con los datos guardados y se descarga en el
// dispositivo: no se guarda ningún archivo en el sistema. Diseño tomado
// del generador HTML que usaba la empresa.
// ============================================================

const VERDE = [30, 58, 53];
const NARANJA = [232, 105, 42];
const GRIS = [245, 245, 245];

// El PNG original mezcla zonas transparentes y blancas (los visores de PDF
// dibujan una línea en ese borde) y trae mucho margen vacío: se aplana sobre
// blanco y se recorta al contenido.
let logoCache = null;
async function cargarLogo() {
  if (logoCache) return logoCache;
  const img = new Image();
  img.src = '/presupuesto-logo.png';
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      const i = (y * c.width + x) * 4;
      if (d[i] < 235 || d[i + 1] < 235 || d[i + 2] < 235) {
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  const m = 8;
  x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m);
  const w = Math.min(c.width, x1 + m) - x0, h = Math.min(c.height, y1 + m) - y0;
  const recorte = document.createElement('canvas');
  recorte.width = w; recorte.height = h;
  recorte.getContext('2d').drawImage(c, x0, y0, w, h, 0, 0, w, h);
  logoCache = { dataUrl: recorte.toDataURL('image/jpeg', 0.92), w, h };
  return logoCache;
}

const fechaAR = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '');

export async function descargarPdfPresupuesto(p, items) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, M = 18, ANCHO = W - M * 2;
  const cli = p.cliente_datos || {};
  const ven = p.vendedor_datos || {};
  let y = 15;

  // ── Encabezado ──────────────────────────────────────────
  const logo = await cargarLogo();
  const logoW = 44, logoH = logoW * (logo.h / logo.w);
  doc.addImage(logo.dataUrl, 'JPEG', M, y, logoW, logoH, '', 'FAST');
  doc.setTextColor(...VERDE); doc.setFontSize(13); doc.setFont('helvetica', 'bold');
  doc.text('PRESUPUESTO', W - M, y + 6, { align: 'right' });
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(120, 120, 120);
  doc.text(`N°  ${nombreVersion(p)}`, W - M, y + 12, { align: 'right' });
  doc.text(`Fecha:  ${fechaAR(p.fecha)}`, W - M, y + 17, { align: 'right' });
  y += Math.max(logoH, 20) + 4;
  doc.setFillColor(...NARANJA); doc.rect(M, y, ANCHO, 0.8, 'F');
  y += 6;

  // ── Helpers ─────────────────────────────────────────────
  const checkPage = (necesario = 20) => { if (y + necesario > 278) { doc.addPage(); y = 15; } };
  const seccion = (titulo) => {
    checkPage(16);
    doc.setFillColor(...VERDE); doc.rect(M, y, 3, 5.5, 'F');
    doc.setTextColor(...VERDE); doc.setFontSize(8.5); doc.setFont('helvetica', 'bold');
    doc.text(titulo.toUpperCase(), M + 5, y + 4);
    y += 9;
  };
  // Fila de etiqueta/valor en dos columnas; el valor se corta en varias líneas si es largo.
  const fila = (l1, v1, l2, v2) => {
    const col = W / 2 + 2;
    const ancho1 = (l2 !== undefined ? col - M - 30 : ANCHO - 30);
    doc.setFontSize(7.5);
    const lineas1 = doc.splitTextToSize(String(v1 || '—'), ancho1);
    const lineas2 = l2 !== undefined ? doc.splitTextToSize(String(v2 || '—'), W - M - col - 30) : [];
    const alto = Math.max(lineas1.length, lineas2.length, 1) * 4 + 1.5;
    doc.setTextColor(130, 130, 130); doc.setFont('helvetica', 'normal'); doc.text(`${l1}:`, M + 2, y);
    doc.setTextColor(30, 30, 30); doc.setFont('helvetica', 'bold'); doc.text(lineas1, M + 30, y);
    if (l2 !== undefined) {
      doc.setTextColor(130, 130, 130); doc.setFont('helvetica', 'normal'); doc.text(`${l2}:`, col, y);
      doc.setTextColor(30, 30, 30); doc.setFont('helvetica', 'bold'); doc.text(lineas2, col + 28, y);
    }
    y += alto;
  };
  // ── Cliente ─────────────────────────────────────────────
  seccion('Datos del cliente');
  const yCli = y;
  doc.setFillColor(...GRIS); doc.rect(M, yCli, ANCHO, 18, 'F');
  y += 5;
  fila('Razón social', cli.nombre, 'CUIT', cli.cuit);
  fila('Domicilio', cli.domicilio, 'Teléfono', cli.telefono);
  if (cli.mail) fila('Mail', cli.mail);
  y = Math.max(y, yCli + 18) + 4;

  // ── Detalle ─────────────────────────────────────────────
  seccion('Detalle del presupuesto');
  const cCant = M + ANCHO - 62, cUnit = M + ANCHO - 30, cSub = W - M - 2;
  const anchoDesc = cCant - M - 14;
  const encabezado = () => {
    doc.setFillColor(...VERDE); doc.rect(M, y, ANCHO, 7, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.text('Descripción', M + 2, y + 4.8);
    doc.text('Cant.', cCant, y + 4.8, { align: 'right' });
    doc.text(`P. unit. ${MONEDAS[p.moneda]}`, cUnit, y + 4.8, { align: 'right' });
    doc.text('Subtotal', cSub, y + 4.8, { align: 'right' });
    y += 7;
  };
  encabezado();
  items.forEach((it, i) => {
    doc.setFontSize(8);
    const desc = doc.splitTextToSize(it.descripcion, anchoDesc);
    const codigo = [it.sku, it.codigo].filter(Boolean).join(' · ');
    const alto = desc.length * 3.8 + (codigo ? 3.6 : 0) + 3.4;
    if (y + alto > 270) { doc.addPage(); y = 15; encabezado(); }
    if (i % 2 === 0) { doc.setFillColor(...GRIS); doc.rect(M, y, ANCHO, alto, 'F'); }
    const unit = precioEnMoneda(p, it.precio_unit);
    doc.setTextColor(40, 40, 40); doc.setFont('helvetica', 'normal');
    doc.text(desc, M + 2, y + 4.4);
    if (codigo) {
      doc.setFontSize(6.5); doc.setTextColor(140, 140, 140);
      doc.text(codigo, M + 2, y + 4.4 + desc.length * 3.8);
      doc.setFontSize(8); doc.setTextColor(40, 40, 40);
    }
    doc.text(formatoNumero(it.cantidad).replace(/,00$/, ''), cCant, y + 4.4, { align: 'right' });
    doc.text(formatoNumero(unit), cUnit, y + 4.4, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(formatoNumero(unit * Number(it.cantidad)), cSub, y + 4.4, { align: 'right' });
    y += alto;
  });

  const t = totales(p, items);
  checkPage(30);
  y += 2;
  doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(80, 80, 80);
  if (t.descuento > 0) {
    doc.text('Subtotal', cUnit, y + 4, { align: 'right' });
    doc.text(conMoneda(p.moneda, t.subtotal), cSub, y + 4, { align: 'right' });
    y += 5.5;
    doc.text('Descuento', cUnit, y + 4, { align: 'right' });
    doc.text(`- ${conMoneda(p.moneda, t.descuento)}`, cSub, y + 4, { align: 'right' });
    y += 6.5;
  }
  doc.setFillColor(...NARANJA); doc.rect(M, y, ANCHO, 9, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
  doc.text('TOTAL SIN IVA', M + 4, y + 6.2);
  doc.text(conMoneda(p.moneda, t.total), cSub, y + 6.2, { align: 'right' });
  y += 14;

  // ── Condiciones ─────────────────────────────────────────
  seccion('Condiciones comerciales');
  const yCond = y;
  const altoCond = 5 + 5.5 * (p.moneda === 'ARS' ? 4 : 3);
  doc.setFillColor(...GRIS); doc.rect(M, yCond, ANCHO, altoCond, 'F');
  y += 5;
  fila('Tipo', p.tipo);
  fila('Condición de pago', p.condicion_pago);
  fila('Validez', p.validez);
  if (p.moneda === 'ARS') fila('Cotización', `U$S 1 = $ ${formatoNumero(p.cotizacion)}`);
  y = Math.max(y, yCond + altoCond) + 2;
  if (p.notas) {
    checkPage(12);
    doc.setTextColor(100, 100, 100); doc.setFontSize(7.5); doc.setFont('helvetica', 'italic');
    const lineas = doc.splitTextToSize(p.notas, ANCHO);
    doc.text(lineas, M, y + 3);
    y += lineas.length * 4 + 4;
  }
  y += 3;

  // ── Emitido por ─────────────────────────────────────────
  seccion('Emitido por');
  const yVen = y;
  doc.setFillColor(...GRIS); doc.rect(M, yVen, ANCHO, 16, 'F');
  y += 5;
  fila('Nombre', ven.nombre, 'Cargo', ven.cargo || 'Asesor Comercial');
  fila('Teléfono', ven.telefono, 'WhatsApp', ven.whatsapp);
  y = Math.max(y, yVen + 16) + 6;

  // Firma
  checkPage(22); y += 8;
  doc.setDrawColor(150, 150, 150); doc.setLineWidth(0.4);
  doc.line(W / 2 - 30, y, W / 2 + 30, y);
  doc.setTextColor(120, 120, 120); doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
  doc.text(ven.nombre || 'Asesor Comercial', W / 2, y + 5, { align: 'center' });
  doc.text('DRAP SAS', W / 2, y + 9, { align: 'center' });

  // ── Pie de página ───────────────────────────────────────
  const paginas = doc.internal.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    doc.setFillColor(...NARANJA); doc.rect(0, 287, 210, 0.8, 'F');
    doc.setTextColor(150, 150, 150); doc.setFontSize(7); doc.setFont('helvetica', 'normal');
    doc.text('DRAP SAS  |  Representante Oficial DJI Agricultura – Zona NOA  |  Salta, Argentina', M, 292);
    doc.text(`Pág. ${i}/${paginas}`, W - M, 292, { align: 'right' });
  }

  const cliente = (cli.nombre || 'cliente').replace(/[^\wÀ-ſ]+/g, '_');
  doc.save(`DRAP_Presupuesto_${p.numero}_v${p.version}_${cliente}.pdf`);
}
