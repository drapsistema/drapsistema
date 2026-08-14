import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listar } from '../../lib/db';
import { PageHeader, Empty, nombreCliente, fmtFecha } from '../../shared/ui.jsx';
import Icon from '../../shared/Icon.jsx';

export default function Service() {
  const [trabajos, setTrabajos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([listar('trabajos'), listar('clientes')]).then(([ts, cs]) => {
      setTrabajos(ts); setClientes(cs); setCargando(false);
    });
  }, []);

  const nombrePorId = (id) => { const c = clientes.find((x) => x.id === id); return c ? nombreCliente(c) : `Cliente #${id}`; };
  const badgeEstado = (e) => e === 'Entregada' ? 'g' : e === 'Finalizada' ? 'b' : e === 'Esperando repuestos' ? 'a' : '';

  return (
    <div>
      <PageHeader titulo="Service y reparación" sub={`${trabajos.length} trabajos registrados`}>
        <button className="btn" onClick={() => navigate('/service/nuevo')}><Icon name="plus" size={16} /> Ingresar drone</button>
      </PageHeader>
      {cargando ? <Empty>Cargando…</Empty> : trabajos.length === 0 ? (
        <Empty>Todavía no hay trabajos. Ingresá un drone al taller.</Empty>
      ) : (
        <div className="card table-wrap">
          <table>
            <thead><tr><th>N°</th><th>Tipo</th><th>Cliente</th><th>Equipo</th><th>Ingreso</th><th>Estado</th></tr></thead>
            <tbody>
              {trabajos.map((t) => (
                <tr key={t.id} className="clickable" onClick={() => navigate(`/service/${t.id}`)}>
                  <td className="strong">{t.nro}</td>
                  <td><span className="badge">{t.tipo}</span></td>
                  <td>{nombrePorId(t.cliente_id)}</td>
                  <td>{t.marca} {t.modelo} · {t.nro_serie}</td>
                  <td>{fmtFecha(t.ingreso)}</td>
                  <td><span className={'badge ' + badgeEstado(t.estado)}>{t.estado}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
