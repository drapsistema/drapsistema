import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listar, crear } from '../../lib/db';
import { PageHeader, BackButton, nombreCliente, hoyISO } from '../../shared/ui.jsx';
import { usuariosConRolPrefijo } from '../../shared/permisos';
import { useToast } from '../../shared/Toast.jsx';
import Icon from '../../shared/Icon.jsx';

export default function OportunidadForm() {
  const navigate = useNavigate();
  const toast = useToast();
  const [clientes, setClientes] = useState([]);
  const [vendedores, setVendedores] = useState([]);
  const [form, setForm] = useState({ cliente_id: '', vendedor_id: '', fecha_contacto: hoyISO(), relevamiento: '' });
  const [errores, setErrores] = useState({});

  useEffect(() => {
    listar('clientes').then((cs) => setClientes(cs.filter((c) => c.activo !== false)));
    listar('usuarios').then((us) => setVendedores(usuariosConRolPrefijo(us, 'Vendedor')));
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function guardar() {
    const e = {};
    if (!form.cliente_id) e.cliente_id = true;
    if (!form.relevamiento) e.relevamiento = true;
    setErrores(e);
    if (Object.keys(e).length) return;

    const nueva = await crear('oportunidades', {
      cliente_id: Number(form.cliente_id), vendedor_id: form.vendedor_id ? Number(form.vendedor_id) : null,
      etapa: 'Contacto inicial', fecha_contacto: form.fecha_contacto, relevamiento: form.relevamiento,
      resultado: null, motivo: '', motivo_detalle: '',
    });
    toast('Oportunidad creada');
    navigate(`/comercial/${nueva.id}`);
  }

  return (
    <div>
      <PageHeader titulo="Nueva oportunidad" sub="Nace en etapa Contacto inicial">
        <BackButton to="/comercial" />
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
            <label>Vendedor</label>
            <select value={form.vendedor_id} onChange={(e) => set('vendedor_id', e.target.value)}>
              <option value="">— Sin asignar —</option>
              {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Fecha del primer contacto</label>
            <input type="date" value={form.fecha_contacto} onChange={(e) => set('fecha_contacto', e.target.value)} />
          </div>
          <div className="field full">
            <label>Relevamiento <span className="req">*</span></label>
            <textarea rows={3} value={form.relevamiento} onChange={(e) => set('relevamiento', e.target.value)}
              placeholder="Qué necesita el cliente" style={errores.relevamiento ? { borderColor: 'var(--red)' } : undefined} />
          </div>
        </div>
        <button className="btn full" onClick={guardar}><Icon name="check" size={16} /> Crear oportunidad</button>
      </div>
    </div>
  );
}
