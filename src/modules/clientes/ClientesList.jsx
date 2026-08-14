import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listar, obtener } from '../../lib/db';
import { PageHeader, Empty, nombreCliente } from '../../shared/ui.jsx';
import { filtrarPorAlcance } from '../../shared/permisos';
import { useAuth } from '../../shared/Auth.jsx';
import Icon from '../../shared/Icon.jsx';

export default function ClientesList() {
  const [clientes, setClientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const navigate = useNavigate();
  const { perfil } = useAuth();

  useEffect(() => {
    Promise.all([listar('clientes'), obtener('configuracion', 1)])
      .then(([data, cfg]) => {
        const activos = data.filter((c) => c.activo !== false);
        setClientes(filtrarPorAlcance(activos, perfil, cfg, 'vendedor_id'));
      })
      .catch((e) => console.error('Error al listar clientes:', e))
      .finally(() => setCargando(false));
  }, [perfil]);

  return (
    <div>
      <PageHeader titulo="Clientes" sub={`${clientes.length} clientes registrados`}>
        <button className="btn" onClick={() => navigate('/clientes/nuevo')}>
          <Icon name="plus" size={16} /> Nuevo cliente
        </button>
      </PageHeader>

      {cargando ? (
        <Empty>Cargando…</Empty>
      ) : clientes.length === 0 ? (
        <Empty>Todavía no hay clientes. Creá el primero con “Nuevo cliente”.</Empty>
      ) : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr><th>Nombre / Razón social</th><th>Tipo</th><th>CUIT</th><th>Teléfono</th><th>Mail</th></tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.id} className="clickable" onClick={() => navigate(`/clientes/${c.id}`)}>
                  <td className="strong">{nombreCliente(c)}</td>
                  <td><span className="badge">{c.tipo}</span></td>
                  <td>{c.cuit}</td>
                  <td>{c.telefono}</td>
                  <td>{c.mail || <span className="muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
