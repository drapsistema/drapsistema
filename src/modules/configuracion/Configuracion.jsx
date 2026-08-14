import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listar, actualizar, adminUsuarios, passwordValida, generarPassword } from '../../lib/db';
import { PageHeader, fmtFecha, hoyISO } from '../../shared/ui.jsx';
import { useToast } from '../../shared/Toast.jsx';
import { useAuth } from '../../shared/Auth.jsx';
import { rolesDe, esAdministrador, ROLES, toggleRolExcluyente } from '../../shared/permisos';
import Icon from '../../shared/Icon.jsx';
import Parametros from './Parametros.jsx';
import Permisos from './Permisos.jsx';

export default function Configuracion() {
  const [tab, setTab] = useState('usuarios');
  return (
    <div>
      <PageHeader titulo="Configuración" sub="Usuarios, roles y parámetros del sistema" />
      <div className="tabs-row">
        <button className={'tab' + (tab === 'usuarios' ? ' on' : '')} onClick={() => setTab('usuarios')}>Usuarios y roles</button>
        <button className={'tab' + (tab === 'permisos' ? ' on' : '')} onClick={() => setTab('permisos')}>Permisos</button>
        <button className={'tab' + (tab === 'parametros' ? ' on' : '')} onClick={() => setTab('parametros')}>Parámetros</button>
      </div>
      <div style={{ marginTop: 16 }}>
        {tab === 'usuarios' ? <Usuarios /> : tab === 'permisos' ? <Permisos /> : <Parametros />}
      </div>
    </div>
  );
}

function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [modal, setModal] = useState(null); // { usuario } para blanqueo
  const [modalRoles, setModalRoles] = useState(null); // { usuario } para editar roles
  const navigate = useNavigate();
  const toast = useToast();
  const { usuarioActualId } = useAuth();

  useEffect(() => { cargar(); }, []);
  function cargar() { listar('usuarios').then(setUsuarios); }

  const badgeCuenta = (u) => u.estado_cuenta === 'Activa' ? <span className="badge g">Activa</span>
    : u.estado_cuenta === 'Pendiente' ? <span className="badge a">Invitación pendiente</span>
    : <span className="badge b">Blanqueo pendiente</span>;

  const badgeAcceso = (u) => u.acceso === 'Activo' ? <span className="badge g">Activo</span>
    : u.acceso === 'Bloqueado'
      ? <div><span className="badge r">Bloqueado</span>{u.acceso_desde && <div className="muted xs">desde {fmtFecha(u.acceso_desde)}</div>}</div>
      : <div><span className="badge a">Inactivo</span>{u.acceso_desde && <div className="muted xs">desde {fmtFecha(u.acceso_desde)}</div>}</div>;

  async function cambiarAcceso(u, nuevo) {
    // Protecciones: no auto-bloqueo, no dejar sin admin activo.
    if (u.id === usuarioActualId && nuevo !== 'Activo') { toast('No podés deshabilitar tu propia cuenta', 'err'); return; }
    if (esAdministrador(u) && nuevo !== 'Activo') {
      const adminsActivos = usuarios.filter((x) => esAdministrador(x) && x.acceso === 'Activo' && x.id !== u.id);
      if (adminsActivos.length === 0) { toast('No podés dejar el sistema sin ningún administrador activo', 'err'); return; }
    }
    try {
      // Deshabilitar/reactivar cortan el acceso en el login real (Edge Function).
      if (nuevo === 'Inactivo' || nuevo === 'Bloqueado') {
        await adminUsuarios('deshabilitar', { usuario_id: u.id });
      } else {
        await adminUsuarios('reactivar', { usuario_id: u.id });
      }
      toast(nuevo === 'Activo' ? `Cuenta de ${u.nombre} reactivada · ya puede ingresar`
        : `Cuenta de ${u.nombre} deshabilitada · no podrá volver a ingresar`);
      cargar();
    } catch (err) {
      toast(err.message || 'No se pudo cambiar el acceso', 'err');
    }
  }

  async function confirmarBlanqueo(u, nuevaPassword) {
    try {
      await adminUsuarios('blanquear', { usuario_id: u.id, password: nuevaPassword });
      setModal(null);
      toast(`Contraseña de ${u.nombre} restablecida · pasásela por un medio seguro`);
      cargar();
    } catch (err) {
      toast(err.message || 'No se pudo blanquear', 'err');
    }
  }

  async function guardarRoles(u, nuevosRoles) {
    if (nuevosRoles.length === 0) { toast('El usuario debe tener al menos un rol', 'err'); return; }
    // Protección: no dejar el sistema sin ningún administrador activo.
    const sacaAdmin = esAdministrador(u) && !nuevosRoles.includes('Administrador');
    if (sacaAdmin) {
      const otrosAdmins = usuarios.filter((x) => esAdministrador(x) && x.acceso === 'Activo' && x.id !== u.id);
      if (otrosAdmins.length === 0) { toast('No podés quitar el último administrador activo', 'err'); return; }
    }
    // Editar roles solo toca el perfil (no el login): va directo a la tabla.
    await actualizar('usuarios', u.id, { roles: nuevosRoles });
    setModalRoles(null);
    toast(`Roles de ${u.nombre} actualizados`);
    cargar();
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn" onClick={() => navigate('/configuracion/usuario-nuevo')}><Icon name="plus" size={16} /> Nuevo usuario</button>
      </div>
      <div className="aviso">Los usuarios se dan de alta con nombre, mail, roles y una contraseña que define el administrador. No se envían mails: el admin le pasa al usuario su contraseña por un medio seguro. El administrador puede blanquearla o deshabilitar el acceso cuando haga falta.</div>

      <div className="card table-wrap">
        <table>
          <thead><tr><th>Nombre</th><th>Mail</th><th>Rol</th><th>Acceso</th><th>Contraseña</th><th>Gestión</th></tr></thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className={u.acceso !== 'Activo' ? 'urow-off' : ''}>
                <td className="strong">{u.nombre}</td>
                <td>{u.mail}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {rolesDe(u).map((r) => <span key={r} className={'badge ' + (r === 'Administrador' ? 'b' : '')}>{r}</span>)}
                    <button className="ibtn" title="Editar roles" onClick={() => setModalRoles({ usuario: u })}><Icon name="edit" size={13} /></button>
                  </div>
                </td>
                <td>{badgeAcceso(u)}</td>
                <td>
                  <button className="btn ghost sm" onClick={() => setModal({ usuario: u })}><Icon name="key" size={14} /> Blanquear</button>
                </td>
                <td>
                  {u.acceso === 'Activo' ? (
                    <button className="btn ghost sm" onClick={() => cambiarAcceso(u, 'Inactivo')}><Icon name="lock" size={13} /> Deshabilitar</button>
                  ) : (
                    <button className="btn ghost sm" onClick={() => cambiarAcceso(u, 'Activo')}><Icon name="check" size={13} /> Reactivar</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="leyenda">
        <span className="badge g">Activo</span> ingresa normalmente ·{' '}
        <span className="badge a">Inactivo / Deshabilitado</span> no puede ingresar (se corta el acceso en el login). Se puede reactivar.
      </div>

      {modal && <ModalBlanqueo usuario={modal.usuario} onCerrar={() => setModal(null)} onConfirmar={confirmarBlanqueo} />}
      {modalRoles && <ModalRoles usuario={modalRoles.usuario} onCerrar={() => setModalRoles(null)} onConfirmar={guardarRoles} />}
    </div>
  );
}

function ModalBlanqueo({ usuario, onCerrar, onConfirmar }) {
  const [pass, setPass] = useState('');
  const reglas = {
    largo: pass.length >= 12, may: /[A-Z]/.test(pass), min: /[a-z]/.test(pass),
    num: /[0-9]/.test(pass), sim: /[^A-Za-z0-9]/.test(pass),
  };
  return (
    <div className="modal-bg" onClick={(e) => e.target.className === 'modal-bg' && onCerrar()}>
      <div className="modal">
        <div className="modal-h"><span>Blanquear contraseña</span><button className="modal-x" onClick={onCerrar}>✕</button></div>
        <div className="modal-b">
          <p className="modal-p">Definí una nueva contraseña para <b>{usuario.nombre}</b>. Después pasásela por un medio seguro (en persona, WhatsApp, etc.).</p>
          <div className="field">
            <label>Nueva contraseña</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={pass} onChange={(e) => setPass(e.target.value)} style={{ fontFamily: 'monospace' }} />
              <button className="btn ghost sm" type="button" onClick={() => setPass(generarPassword())}>Generar</button>
            </div>
            <div style={{ marginTop: 8, fontSize: 12, display: 'flex', flexWrap: 'wrap', gap: '2px 12px' }}>
              <Regla ok={reglas.largo}>12+ caracteres</Regla><Regla ok={reglas.may}>Mayúscula</Regla>
              <Regla ok={reglas.min}>Minúscula</Regla><Regla ok={reglas.num}>Número</Regla><Regla ok={reglas.sim}>Símbolo</Regla>
            </div>
          </div>
          <div className="modal-foot">
            <button className="btn ghost" onClick={onCerrar}>Cancelar</button>
            <button className="btn" disabled={!passwordValida(pass)} onClick={() => onConfirmar(usuario, pass)}><Icon name="key" size={15} /> Blanquear</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Regla({ ok, children }) {
  return (
    <span style={{ color: ok ? 'var(--green)' : 'var(--ink-3)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      {ok ? '✓' : '○'} {children}
    </span>
  );
}

function ModalRoles({ usuario, onCerrar, onConfirmar }) {
  const [roles, setRoles] = useState(rolesDe(usuario));
  const toggle = (rol) => setRoles((prev) => toggleRolExcluyente(prev, rol));

  return (
    <div className="modal-bg" onClick={(e) => e.target.className === 'modal-bg' && onCerrar()}>
      <div className="modal">
        <div className="modal-h"><span>Editar roles</span><button className="modal-x" onClick={onCerrar}>✕</button></div>
        <div className="modal-b">
          <p className="modal-p">Elegí los roles de <b>{usuario.nombre}</b>. Puede tener más de uno; ve la suma de lo que cada rol permite.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, border: '1px solid var(--line)', borderRadius: 8, padding: 12 }}>
            {ROLES.map((rol) => (
              <label key={rol} style={{ display: 'flex', gap: 8, cursor: 'pointer', fontSize: 13.5 }}>
                <input type="checkbox" checked={roles.includes(rol)} onChange={() => toggle(rol)} /> {rol}
              </label>
            ))}
          </div>
          <div className="modal-foot">
            <button className="btn ghost" onClick={onCerrar}>Cancelar</button>
            <button className="btn" disabled={roles.length === 0} onClick={() => onConfirmar(usuario, roles)}><Icon name="check" size={15} /> Guardar roles</button>
          </div>
        </div>
      </div>
    </div>
  );
}
