import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { listar, crear } from '../../lib/db';
import { PageHeader, BackButton, nombreCliente, hoyISO, nroPostventa } from '../../shared/ui.jsx';
import { comentarSistema } from '../../shared/Comentarios.jsx';
import { useToast } from '../../shared/Toast.jsx';
import { useAuth } from '../../shared/Auth.jsx';
import Icon from '../../shared/Icon.jsx';

// Postventa para equipos que NO se vendieron por el sistema (comprados en
// otro lado). Las tareas quedan asociadas al cliente, sin venta.
const SEGUIMIENTO = 'Seguimiento completo (1 semana, 1 mes y 2 meses)';
const TIPOS = [SEGUIMIENTO, 'Contacto de seguimiento', 'Visita técnica', 'Capacitación', 'Otro'];

const sumarDias = (iso, n) => {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

export default function PostventaForm() {
  const navigate = useNavigate();
  const toast = useToast();
  const { usuarioActualId } = useAuth();
  const [params] = useSearchParams();
  const [clientes, setClientes] = useState([]);
  const [form, setForm] = useState({
    cliente_id: params.get('cliente') || '', tipo: SEGUIMIENTO, detalle: '', fecha: hoyISO(), equipo: '', observaciones: '',
  });
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    listar('clientes').then((cs) => setClientes(
      cs.filter((c) => c.activo !== false).sort((a, b) => nombreCliente(a).localeCompare(nombreCliente(b)))));
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const esSeguimiento = form.tipo === SEGUIMIENTO;

  async function guardar() {
    const e = {};
    if (!form.cliente_id) e.cliente_id = true;
    if (!form.tipo) e.tipo = true;
    if (form.tipo === 'Otro' && !form.detalle.trim()) e.detalle = true;
    if (!form.fecha) e.fecha = true;
    setErrores(e);
    if (Object.keys(e).length) return;

    setGuardando(true);
    try {
      const clienteId = Number(form.cliente_id);
      const pv = await crear('postventas', {
        venta_id: null, cliente_id: clienteId, equipo: form.equipo.trim() || null,
        observaciones: form.observaciones.trim(),
      });
      const base = {
        postventa_id: pv.id, venta_id: null, cliente_id: clienteId, equipo: pv.equipo,
        estado: 'Pendiente', fecha_real: null, observaciones: form.observaciones.trim(), hectareas: null,
        visita: false, visita_estado: '', visita_agenda: null, visita_real: null, responsable_id: null,
      };
      const tareas = esSeguimiento
        ? [['1 semana', 7], ['1 mes', 30], ['2 meses', 60]].map(([hito, dias]) => ({ ...base, hito, objetivo: sumarDias(form.fecha, dias) }))
        : [{
          ...base,
          hito: form.tipo === 'Otro' ? form.detalle.trim() : (form.detalle.trim() ? `${form.tipo} · ${form.detalle.trim()}` : form.tipo),
          objetivo: form.fecha,
        }];
      for (const t of tareas) await crear('tareas_postventa', t);
      await comentarSistema('pv', pv.id,
        `Postventa ${nroPostventa(pv)} cargada sin venta: ${esSeguimiento ? 'seguimiento completo (3 tareas)' : tareas[0].hito}${base.equipo ? ` · equipo: ${base.equipo}` : ''}.${base.observaciones ? ` Observaciones: ${base.observaciones}` : ''}`,
        usuarioActualId);
      toast(`Postventa ${nroPostventa(pv)} creada`);
      navigate(`/postventa/${pv.id}`);
    } catch (err) {
      console.error('Error al crear postventa:', err);
      toast('No se pudo crear la postventa', 'err');
      setGuardando(false);
    }
  }

  const rojo = (k) => (errores[k] ? { borderColor: 'var(--red)' } : undefined);

  return (
    <div>
      <PageHeader titulo="Nueva postventa" sub="Para equipos que el cliente compró en otro lado: se identifica por su número de postventa (PV-…), sin venta">
        <BackButton to="/postventa" />
      </PageHeader>

      <div className="card card-pad" style={{ maxWidth: 640 }}>
        <div className="form-grid">
          <div className="field full">
            <label>Cliente <span className="req">*</span></label>
            <select value={form.cliente_id} onChange={(e) => set('cliente_id', e.target.value)} style={rojo('cliente_id')}>
              <option value="">— Elegí —</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{nombreCliente(c)}</option>)}
            </select>
            <div className="hint">¿No está? <a onClick={() => navigate('/clientes/nuevo')}>Crealo primero</a>.</div>
          </div>

          <div className="field full">
            <label>Tipo de postventa / Tarea <span className="req">*</span></label>
            <select value={form.tipo} onChange={(e) => set('tipo', e.target.value)} style={rojo('tipo')}>
              {TIPOS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>

          {!esSeguimiento && (
            <div className="field full">
              <label>{form.tipo === 'Otro' ? <>Descripción <span className="req">*</span></> : 'Detalle (opcional)'}</label>
              <input value={form.detalle} onChange={(e) => set('detalle', e.target.value)} style={rojo('detalle')}
                placeholder="Ej: revisar calibración de boquillas" />
            </div>
          )}

          <div className="field">
            <label>{esSeguimiento ? 'Fecha de inicio' : 'Fecha objetivo'} <span className="req">*</span></label>
            <input type="date" value={form.fecha} onChange={(e) => set('fecha', e.target.value)} style={rojo('fecha')} />
            {esSeguimiento && <div className="hint">Las tareas vencen a los 7, 30 y 60 días de esta fecha.</div>}
          </div>

          <div className="field">
            <label>Equipo</label>
            <input value={form.equipo} onChange={(e) => set('equipo', e.target.value)} placeholder="Ej: DJI Agras T40" />
          </div>

          <div className="field full">
            <label>Observaciones</label>
            <textarea rows={2} value={form.observaciones} onChange={(e) => set('observaciones', e.target.value)} />
          </div>
        </div>

        <button className="btn full" onClick={guardar} disabled={guardando}>
          <Icon name="check" size={16} /> {guardando ? 'Creando…' : 'Crear postventa'}
        </button>
      </div>
    </div>
  );
}
