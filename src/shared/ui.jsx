import { useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';

// Encabezado de página con título, subtítulo y acciones a la derecha.
export function PageHeader({ titulo, sub, children }) {
  return (
    <div className="page-h">
      <div className="grow">
        <h1>{titulo}</h1>
        {sub && <div className="sub">{sub}</div>}
      </div>
      {children}
    </div>
  );
}

// Botón "volver" reutilizable.
export function BackButton({ to }) {
  const navigate = useNavigate();
  return (
    <button className="btn ghost sm" onClick={() => (to ? navigate(to) : navigate(-1))}>
      <Icon name="back" size={15} /> Volver
    </button>
  );
}

// Estado vacío.
export function Empty({ children }) {
  return <div className="vacio">{children}</div>;
}

// Nombre visible de un cliente según su tipo.
export function nombreCliente(c) {
  if (!c) return '';
  return c.tipo === 'Persona física' ? `${c.nombre} ${c.apellido}`.trim() : c.razon_social;
}

// Número visible de una venta: el que cargó el usuario o el correlativo por id.
export function nroVenta(v) {
  if (!v) return '';
  return v.numero || `VT-${String(v.id).padStart(4, '0')}`;
}

// Número visible de una postventa.
export function nroPostventa(p) {
  if (!p) return '';
  return `PV-${String(p.id).padStart(4, '0')}`;
}

// Datos opcionales del cliente que conviene completar. Sin CUIT no se
// puede descartar que el cliente esté duplicado en la base.
export function datosFaltantesCliente(c) {
  if (!c) return [];
  const faltan = [];
  if (!c.cuit) faltan.push('CUIT');
  if (!c.domicilio) faltan.push('domicilio');
  if (!c.telefono) faltan.push('teléfono');
  return faltan;
}

export function AvisoClienteIncompleto({ cliente }) {
  const navigate = useNavigate();
  const faltan = datosFaltantesCliente(cliente);
  if (faltan.length === 0) return null;
  return (
    <div className="aviso warn" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
      <span className="grow">
        <b>{nombreCliente(cliente)}</b> tiene datos incompletos (falta: {faltan.join(', ')}).
        {!cliente.cuit && ' Sin CUIT, este cliente podría estar duplicado en la base.'}
        {' '}Completá los datos para asegurarte de que no sea el caso.
      </span>
      <button className="btn ghost sm" onClick={() => navigate(`/clientes/${cliente.id}/editar`)}>
        Completar datos →
      </button>
    </div>
  );
}

// Formatea una fecha ISO (YYYY-MM-DD) a formato local corto.
export function fmtFecha(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${d} ${meses[+m - 1]} ${y}`;
}

// Días transcurridos desde una fecha ISO hasta hoy.
export function diasDesde(iso) {
  if (!iso) return 0;
  const hoy = new Date();
  const f = new Date(iso);
  return Math.floor((hoy - f) / 86400000);
}

// Fecha de hoy en ISO.
export function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

// Formato de dinero en pesos argentinos.
export function money(n) {
  return '$ ' + (Number(n) || 0).toLocaleString('es-AR');
}
