import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listar } from '../../lib/db';
import { PageHeader, Empty, nombreCliente } from '../../shared/ui.jsx';
import Icon from '../../shared/Icon.jsx';

export default function ClientesList() {
  const [clientes, setClientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // La visibilidad la resuelve RLS en la base (admin ve todos; un
    // vendedor ve los que cargó él y aquellos con oportunidad abierta).
    // Por eso ya NO filtramos por vendedor_id del lado del cliente:
    // los clientes no llevan vendedor asignado.
    listar('clientes')
      .then((data) => setClientes(data.filter((c) => c.activo !== false)))
      .catch((e) => console.error('Error al listar clientes:', e))
      .finally(() => setCargando(false));
  }, []);

  return (
    <div>
      <PageHeader titulo="Clientes" sub={`${clientes.length} clientes visibles`}>
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
