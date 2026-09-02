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
    // Enviamos SOLO los campos reales y editables. Antes se mandaba todo el
    // objeto cfg, que incluía mail_pass (columna inexistente) y rompía el
    // guardado. Tampoco tocamos ot_actual/rem_actual: los maneja la
    // numeración automática.
    const payload = {
      ot_inicial: Number(cfg.ot_inicial) || 0,
      rem_inicial: Number(cfg.rem_inicial) || 0,
      sem_com_verde: Number(cfg.sem_com_verde) || 0,
      sem_com_amarillo: Number(cfg.sem_com_amarillo) || 0,
      sem_post_verde: Number(cfg.sem_post_verde) || 0,
      sem_post_amarillo: Number(cfg.sem_post_amarillo) || 0,
      vendedores_ven_todo: Boolean(cfg.vendedores_ven_todo),
    };
    try {
      await actualizar('configuracion', 1, payload);
      toast('Parámetros guardados');
    } catch (e) {
      console.error(e);
      toast('No se pudieron guardar los parámetros', 'err');
    }
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
