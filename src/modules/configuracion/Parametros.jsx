import { useState, useEffect } from 'react';
import { obtener, actualizar } from '../../lib/db';
import { useToast } from '../../shared/Toast.jsx';
import Icon from '../../shared/Icon.jsx';

export default function Parametros() {
  const [cfg, setCfg] = useState(null);
  const toast = useToast();

  useEffect(() => { obtener('configuracion', 1).then(setCfg); }, []);
  if (!cfg) return null;

  const set = (k, v) => setCfg((c) => ({ ...c, [k]: v }));

  async function guardar() {
    await actualizar('configuracion', 1, cfg);
    toast('Parámetros guardados');
  }
  function probarMail() {
    if (!cfg.mail_host || !cfg.mail_user) { toast('Cargá servidor y casilla antes de probar', 'err'); return; }
    toast(`Mail de prueba enviado a ${cfg.mail_user}`);
  }

  return (
    <div style={{ maxWidth: 820 }}>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-h">Numeración de comprobantes</div>
        <div className="card-pad">
          <div className="aviso">Estos contadores mantienen la correlación con el sistema externo. Definí el número inicial y el sistema continúa solo.</div>
          <div className="form-grid">
            <Field label="N° inicial de OT (service)" value={cfg.ot_inicial} onChange={(v) => set('ot_inicial', +v)} type="number" />
            <Field label="Próximo OT" value={'OT-' + String(cfg.ot_actual + 1).padStart(4, '0')} disabled />
            <Field label="N° inicial de remito (reparación)" value={cfg.rem_inicial} onChange={(v) => set('rem_inicial', +v)} type="number" />
            <Field label="Próximo remito" value={'R-' + String(cfg.rem_actual + 1).padStart(6, '0')} disabled />
          </div>
        </div>
      </div>

      <div className="two" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-h">Semáforo comercial</div>
          <div className="card-pad">
            <div className="hint" style={{ marginBottom: 10 }}>Días desde el envío de la cotización</div>
            <div className="form-grid">
              <Field label="Verde hasta" value={cfg.sem_com_verde} onChange={(v) => set('sem_com_verde', +v)} type="number" />
              <Field label="Amarillo hasta" value={cfg.sem_com_amarillo} onChange={(v) => set('sem_com_amarillo', +v)} type="number" />
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-h">Semáforo postventa</div>
          <div className="card-pad">
            <div className="hint" style={{ marginBottom: 10 }}>Días desde el último contacto</div>
            <div className="form-grid">
              <Field label="Verde hasta" value={cfg.sem_post_verde} onChange={(v) => set('sem_post_verde', +v)} type="number" />
              <Field label="Amarillo hasta" value={cfg.sem_post_amarillo} onChange={(v) => set('sem_post_amarillo', +v)} type="number" />
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-h"><Icon name="mail" size={16} /> Correo saliente</div>
        <div className="card-pad">
          <div className="aviso">Desde esta cuenta el sistema envía las invitaciones y los enlaces de blanqueo. Suele ser una casilla dedicada tipo sistema@ o no-responder@.</div>
          <div className="form-grid">
            <Field label="Servidor SMTP" value={cfg.mail_host} onChange={(v) => set('mail_host', v)} placeholder="smtp.gmail.com" />
            <Field label="Puerto" value={cfg.mail_port} onChange={(v) => set('mail_port', v)} placeholder="587" />
            <div className="field">
              <label>Seguridad</label>
              <select value={cfg.mail_seg} onChange={(e) => set('mail_seg', e.target.value)}><option>TLS</option><option>SSL</option><option>Ninguna</option></select>
            </div>
            <Field label="Usuario / casilla" value={cfg.mail_user} onChange={(v) => set('mail_user', v)} placeholder="sistema@empresa.com" />
            <Field label="Contraseña de la casilla" value={cfg.mail_pass || ''} onChange={(v) => set('mail_pass', v)} type="password" placeholder="••••••••" />
            <Field label="Nombre del remitente" value={cfg.mail_from} onChange={(v) => set('mail_from', v)} />
          </div>
          <button className="btn ghost" onClick={probarMail}><Icon name="mail" size={15} /> Enviar mail de prueba</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-h"><Icon name="clientes" size={16} /> Alcance de datos de vendedores</div>
        <div className="card-pad">
          <div className="aviso">Define qué clientes, oportunidades y ventas ve un vendedor. No aplica a los vendedores tercerizados, que siempre ven solo lo suyo.</div>
          <label style={{ display: 'flex', gap: 10, cursor: 'pointer', padding: '8px 0', alignItems: 'flex-start' }}>
            <input type="radio" name="alcance" checked={!cfg.vendedores_ven_todo} onChange={() => set('vendedores_ven_todo', false)} style={{ marginTop: 3 }} />
            <div><b>Cada vendedor ve solo sus clientes</b><div className="hint">Ve únicamente los que tiene asignados. Más control.</div></div>
          </label>
          <label style={{ display: 'flex', gap: 10, cursor: 'pointer', padding: '8px 0', alignItems: 'flex-start' }}>
            <input type="radio" name="alcance" checked={cfg.vendedores_ven_todo} onChange={() => set('vendedores_ven_todo', true)} style={{ marginTop: 3 }} />
            <div><b>Los vendedores ven todos los clientes</b><div className="hint">Todos ven toda la cartera. Más simple para equipos chicos.</div></div>
          </label>
        </div>
      </div>

      <button className="btn" onClick={guardar}><Icon name="check" size={16} /> Guardar parámetros</button>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', disabled, placeholder }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input type={type} value={value} disabled={disabled} placeholder={placeholder}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        style={disabled ? { background: 'var(--panel-2)', color: 'var(--ink-3)' } : undefined} />
    </div>
  );
}
