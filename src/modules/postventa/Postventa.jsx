import { PageHeader, Empty } from '../../shared/ui.jsx';

// Módulo postventa — andamiaje listo para desarrollar.
// Seguí el patrón del módulo Clientes (CRUD con db.js) y, para las
// vistas Kanban/Lista con drag & drop, reutilizá <Board> como hace
// el módulo Comercial (src/modules/comercial/Comercial.jsx).
export default function Postventa() {
  return (
    <div>
      <PageHeader titulo="Postventa" sub="Módulo pendiente de desarrollo" />
      <div className="card">
        <Empty>
          Este módulo tiene el andamiaje listo.<br />
          Desarrollalo en <b>src/modules/postventa/</b> siguiendo el ejemplo de Clientes y Comercial.
        </Empty>
      </div>
    </div>
  );
}
