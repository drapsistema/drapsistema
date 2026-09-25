import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listar, crear, obtener, siguienteNroTrabajo } from '../../lib/db';
import { PageHeader, BackButton, nombreCliente, hoyISO } from '../../shared/ui.jsx';
import { useToast } from '../../shared/Toast.jsx';
import Icon from '../../shared/Icon.jsx';
import { GarantiasFilas, limpiarGarantia } from './Garantias.jsx';

export default function TrabajoForm() {
  const navigate = useNavigate();
  const toast = useToast();
  const [clientes, setClientes] = useState([]);
  const [cfg, setCfg] = useState(null);
  const [form, setForm] = useState({
    cliente_id: '', tipo: 'Service', marca: '', modelo: '', nro_serie: '',
    observaciones: '',
  });
  const [garantias, setGarantias] = useState([]);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    listar('clientes').then((cs) => setClientes(cs.filter((c) => c.activo !== false)));
    obtener('configuracion', 1).then(setCfg);
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Próximo número según el tipo (feature del negocio: OT para service, remito para reparación).
  const proximoNro = () => {
    if (!cfg) return '';
    return form.tipo === 'Service'
      ? 'OT-' + String(cfg.ot_actual + 1).padStart(4, '0')
      : 'R-' + String(cfg.rem_actual + 1).padStart(6, '0');
  };

  async function guardar() {
    const e = {};
    if (!form.cliente_id) e.cliente_id = true;
    if (!form.nro_serie) e.nro_serie = true;
    const garantiasErr = {};
    garantias.forEach((g, i) => { if (!g.pieza.trim()) garantiasErr[i] = true; });
    if (Object.keys(garantiasErr).length) e.garantias = garantiasErr;
    setErrores(e);
    if (Object.keys(e).length) {
      if (e.garantias) toast('Indicá la pieza de cada garantía, o quitá la fila vacía', 'err');
      return;
    }

    setGuardando(true);
    try {
      // El número lo asigna la base de forma atómica (sirve también para
      // técnicos, que no pueden tocar `configuracion` directamente).
      const nro = await siguienteNroTrabajo(form.tipo);
      const nuevo = await crear('trabajos', {
        cliente_id: Number(form.cliente_id), tipo: form.tipo, nro, ingreso: hoyISO(),
        marca: form.marca, modelo: form.modelo, nro_serie: form.nro_serie,
        garantia: garantias.length > 0, registrado: false, estado: 'Ingresada',
        observaciones: form.observaciones, informe: '',
        // Sin `egreso`: es columna date y '' la rechaza Postgres (ese era el bug).
      });
      for (const g of garantias) {
        await crear('garantias_trabajo', { trabajo_id: nuevo.id, ...limpiarGarantia(g) });
      }
      toast(`Trabajo ${nro} creado`);
      navigate(`/service/${nuevo.id}`);
    } catch (err) {
      console.error('Error al ingresar drone:', err);
      toast('No se pudo ingresar el drone', 'err');
      setGuardando(false);
    }
  }

  return (
    <div>
      <PageHeader titulo="Ingresar drone" sub="El tipo de trabajo define la numeración">
        <BackButton to="/service" />
      </PageHeader>
      <div className="card card-pad" style={{ maxWidth: 640 }}>
        <div className="form-grid">
          <div className="field">
            <label>Cliente <span className="req">*</span></label>
            <select value={form.cliente_id} onChange={(e) => set('cliente_id', e.target.value)}
              style={errores.cliente_id ? { borderColor: 'var(--red)' } : undefined}>
              <option value="">— Elegí —</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{nombreCliente(c)}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Tipo de trabajo <span className="req">*</span></label>
            <select value={form.tipo} onChange={(e) => set('tipo', e.target.value)}>
              <option>Service</option><option>Reparación</option>
            </select>
          </div>
          <div className="field"><label>Marca</label><input value={form.marca} onChange={(e) => set('marca', e.target.value)} placeholder="DJI" /></div>
          <div className="field"><label>Modelo</label><input value={form.modelo} onChange={(e) => set('modelo', e.target.value)} placeholder="Agras T40" /></div>
          <div className="field">
            <label>N° de serie <span className="req">*</span></label>
            <input value={form.nro_serie} onChange={(e) => set('nro_serie', e.target.value)}
              style={errores.nro_serie ? { borderColor: 'var(--red)' } : undefined} />
          </div>
          <div className="field full">
            <label>Garantía</label>
            <div className="hint" style={{ marginBottom: 8 }}>Cargá cada pieza que esté en garantía: el dron, la batería, etc. pueden tener garantías distintas.</div>
            <GarantiasFilas filas={garantias} onChange={setGarantias} errores={errores.garantias} />
          </div>
          <div className="field full"><label>Observaciones</label>
            <textarea rows={2} value={form.observaciones} onChange={(e) => set('observaciones', e.target.value)} /></div>
        </div>

        <div className="aviso">Al guardar se asignará el número <b style={{ margin: '0 4px' }}>{proximoNro()}</b> (correlativo automático).</div>
        <button className="btn full" onClick={guardar} disabled={guardando}>
          <Icon name="check" size={16} /> {guardando ? 'Ingresando…' : 'Ingresar drone'}
        </button>
      </div>
    </div>
  );
}
