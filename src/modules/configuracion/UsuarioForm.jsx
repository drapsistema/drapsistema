import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminUsuarios, passwordValida, generarPassword } from '../../lib/db';
import { PageHeader, BackButton } from '../../shared/ui.jsx';
import { ROLES, toggleRolExcluyente } from '../../shared/permisos';
import { useToast } from '../../shared/Toast.jsx';
import Icon from '../../shared/Icon.jsx';

export default function UsuarioForm() {
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({ nombre: '', mail: '', roles: ['Vendedor'], password: '' });
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [creado, setCreado] = useState(null); // { mail, password } para mostrar al admin

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function toggleRol(rol) {
    setForm((f) => ({ ...f, roles: toggleRolExcluyente(f.roles, rol) }));
  }

  const reglas = {
    largo: form.password.length >= 12,
    may: /[A-Z]/.test(form.password),
    min: /[a-z]/.test(form.password),
    num: /[0-9]/.test(form.password),
    sim: /[^A-Za-z0-9]/.test(form.password),
  };

  async function guardar() {
    const e = {};
    if (!form.nombre) e.nombre = true;
    if (!form.mail) e.mail = true;
    if (form.roles.length === 0) e.roles = true;
    if (!passwordValida(form.password)) e.password = true;
    setErrores(e);
    if (Object.keys(e).length) return;

    setGuardando(true);
    try {
      await adminUsuarios('crear', {
        nombre: form.nombre, mail: form.mail, password: form.password, roles: form.roles,
      });
      // Mostrar los datos para que el admin se los pase al usuario.
      setCreado({ mail: form.mail, password: form.password });
      toast('Usuario creado');
    } catch (err) {
      toast(err.message || 'No se pudo crear el usuario', 'err');
    } finally {
      setGuardando(false);
    }
  }

  // Pantalla de confirmación: muestra las credenciales una vez.
  if (creado) {
    return (
      <div>
        <PageHeader titulo="Usuario creado" sub="Pasale estos datos al usuario. No se vuelven a mostrar.">
          <BackButton to="/configuracion" />
        </PageHeader>
        <div className="card card-pad" style={{ maxWidth: 520 }}>
          <div className="aviso ok" style={{ marginBottom: 16 }}>
            El usuario ya puede ingresar con estas credenciales. Copialas y pasáselas por un medio seguro (en persona, WhatsApp, etc.).
          </div>
          <div className="inforow"><span className="k">Mail</span><span className="v strong">{creado.mail}</span></div>
          <div className="inforow"><span className="k">Contraseña</span><span className="v strong" style={{ fontFamily: 'monospace' }}>{creado.password}</span></div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button className="btn" onClick={() => { navigator.clipboard?.writeText(`Mail: ${creado.mail}\nContraseña: ${creado.password}`); toast('Datos copiados'); }}>
              <Icon name="check" size={16} /> Copiar datos
            </button>
            <button className="btn ghost" onClick={() => navigate('/configuracion')}>Volver a usuarios</button>
          </div>
          <div className="hint" style={{ marginTop: 12 }}>
            Por seguridad, pedile al usuario que cambie la contraseña cuando ingrese (o dejala, ya es segura).
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader titulo="Nuevo usuario" sub="El admin crea el usuario y le pasa la contraseña.">
        <BackButton to="/configuracion" />
      </PageHeader>
      <div className="two">
        <div className="card card-pad">
          <div className="field">
            <label>Nombre <span className="req">*</span></label>
            <input value={form.nombre} onChange={(e) => set('nombre', e.target.value)}
              style={errores.nombre ? { borderColor: 'var(--red)' } : undefined} />
          </div>
          <div className="field">
            <label>Mail <span className="req">*</span></label>
            <input type="email" value={form.mail} onChange={(e) => set('mail', e.target.value)}
              style={errores.mail ? { borderColor: 'var(--red)' } : undefined} />
            <div className="hint">Con este mail va a iniciar sesión.</div>
          </div>
          <div className="field">
            <label>Contraseña <span className="req">*</span></label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={form.password} onChange={(e) => set('password', e.target.value)}
                style={{ fontFamily: 'monospace', ...(errores.password ? { borderColor: 'var(--red)' } : {}) }} />
              <button className="btn ghost sm" type="button" onClick={() => set('password', generarPassword())}>Generar</button>
            </div>
            <div style={{ marginTop: 8, fontSize: 12, display: 'flex', flexWrap: 'wrap', gap: '2px 12px' }}>
              <Regla ok={reglas.largo}>12+ caracteres</Regla>
              <Regla ok={reglas.may}>Mayúscula</Regla>
              <Regla ok={reglas.min}>Minúscula</Regla>
              <Regla ok={reglas.num}>Número</Regla>
              <Regla ok={reglas.sim}>Símbolo</Regla>
            </div>
          </div>
          <div className="field">
            <label>Roles <span className="req">*</span> <span className="hint" style={{ display: 'inline' }}>(uno o más)</span></label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 4, border: errores.roles ? '1px solid var(--red)' : '1px solid var(--line)', borderRadius: 8, padding: 12 }}>
              {ROLES.map((rol) => (
                <label key={rol} style={{ display: 'flex', gap: 8, cursor: 'pointer', fontSize: 13.5 }}>
                  <input type="checkbox" checked={form.roles.includes(rol)} onChange={() => toggleRol(rol)} /> {rol}
                </label>
              ))}
            </div>
          </div>
          <button className="btn full" onClick={guardar} disabled={guardando}>
            <Icon name="check" size={16} /> {guardando ? 'Creando…' : 'Crear usuario'}
          </button>
        </div>

        <div className="card card-pad">
          <div className="card-h" style={{ margin: '-16px -16px 14px', padding: '13px 16px' }}>Cómo funciona el alta</div>
          <ol style={{ paddingLeft: 18, fontSize: 13, lineHeight: 1.8, color: 'var(--ink-2)' }}>
            <li>Cargás nombre, mail, contraseña y roles.</li>
            <li>El usuario queda <b>activo y listo para entrar</b>.</li>
            <li>Le pasás el mail y la contraseña por un medio seguro.</li>
            <li>Si algún día se va de la empresa, lo <b>deshabilitás</b> y no puede volver a entrar.</li>
          </ol>
          <div style={{ background: 'var(--panel-2)', borderRadius: 8, padding: 12, marginTop: 10, fontSize: 12.5 }}>
            <b>Roles múltiples:</b> un usuario puede ser, por ejemplo, Vendedor y Postventa. Ve la suma de lo que permite cada rol.
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
