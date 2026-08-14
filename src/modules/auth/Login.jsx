import { useState } from 'react';
import { useAuth } from '../../shared/Auth.jsx';
import './login.css';

export default function Login() {
  const { login } = useAuth();
  const [mail, setMail] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [intentos, setIntentos] = useState(0);
  const [cargando, setCargando] = useState(false);

  const bloqueado = intentos >= 5;

  async function entrar(e) {
    e.preventDefault();
    if (bloqueado) return;
    if (!mail || !pass) { setError('Completá mail y contraseña.'); return; }

    setCargando(true);
    setError('');
    const { error } = await login(mail.trim(), pass);
    setCargando(false);

    if (error) {
      const nuevos = intentos + 1;
      setIntentos(nuevos);
      if (nuevos >= 5) {
        setError('Demasiados intentos fallidos. Para blanquear tu contraseña, contactá a tu administrador.');
      } else {
        setError(`Mail o contraseña incorrectos. Intento ${nuevos} de 5.`);
      }
    }
    // Si sale bien, el AuthProvider detecta la sesión y muestra la app.
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-logo">D</div>
          <div>
            <b>DRAP</b>
            <div className="login-sub">Gestión integral</div>
          </div>
        </div>

        <h1 className="login-title">Iniciar sesión</h1>

        <form onSubmit={entrar}>
          <div className="field">
            <label>Mail</label>
            <input type="email" value={mail} onChange={(e) => setMail(e.target.value)}
              disabled={bloqueado} autoComplete="username" placeholder="tu@empresa.com" />
          </div>
          <div className="field">
            <label>Contraseña</label>
            <input type="password" value={pass} onChange={(e) => setPass(e.target.value)}
              disabled={bloqueado} autoComplete="current-password" placeholder="••••••••" />
          </div>

          {error && <div className={'login-error' + (bloqueado ? ' fuerte' : '')}>{error}</div>}

          <button className="btn full" type="submit" disabled={cargando || bloqueado}>
            {cargando ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>

        <p className="login-nota">
          ¿No tenés acceso o olvidaste tu contraseña? Contactá a tu administrador
          para que te envíe una invitación o blanquee tu clave.
        </p>
      </div>
    </div>
  );
}
