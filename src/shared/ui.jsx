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
