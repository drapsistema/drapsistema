import { PageHeader, Empty } from '../../shared/ui.jsx';
import { modoDemo } from '../../lib/supabase';

// Módulo Configuración — andamiaje listo para desarrollar.
// Acá van: usuarios y roles (con el flujo de invitación, blanqueo de
// contraseña y bloqueo/baja ya diseñados en el prototipo) y los
// parámetros del sistema (numeración, semáforos, correo saliente).
export default function Configuracion() {
  return (
    <div>
      <PageHeader titulo="Configuración" sub="Usuarios, roles y parámetros del sistema" />
      <div className="card card-pad">
        <p className="muted sm" style={{ lineHeight: 1.7 }}>
          Andamiaje listo para desarrollar en <b>src/modules/configuracion/</b>.<br />
          El diseño de usuarios (invitación por mail, blanqueo, bloqueo/baja) y de
          parámetros (numeración, semáforos, correo saliente) está definido en el
          prototipo y en el manual de usuario.
        </p>
        <p className="sm" style={{ marginTop: 12 }}>
          Estado del backend: <b>{modoDemo ? 'modo demo (sin Supabase)' : 'conectado a Supabase'}</b>.
        </p>
      </div>
    </div>
  );
}
