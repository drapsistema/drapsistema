import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listar, crear } from '../../lib/db';
import { PageHeader, BackButton, nombreCliente, hoyISO } from '../../shared/ui.jsx';
import { usuariosConRolPrefijo, esAdministrador } from '../../shared/permisos';
import { useAuth } from '../../shared/Auth.jsx';
import { useToast } from '../../shared/Toast.jsx';
import Icon from '../../shared/Icon.jsx';

export default function OportunidadForm() {
  const navigate = useNavigate();
  const toast = useToast();
  const [clientes, setClientes] = useState([]);
  const [vendedores, setVendedores] = useState([]);
  const [form, setForm] = useState({ cliente_id: '', vendedor_id: '', fecha_contacto: hoyISO(), relevamiento: '' });
  const { perfil, usuarioActualId } = useAuth();
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

    // Si un vendedor (no admin) crea la oportunidad, queda a su nombre.
    // Solo el admin puede asignarla a otro.
    let vendedor_id = form.vendedor_id ? Number(form.vendedor_id) : null;
    if (!esAdministrador(perfil) && !vendedor_id) vendedor_id = usuarioActualId;

    const nueva = await crear('oportunidades', {
      cliente_id: Number(form.cliente_id), vendedor_id,
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
            {esAdministrador(perfil) ? (
              <select value={form.vendedor_id} onChange={(e) => set('vendedor_id', e.target.value)}>
                <option value="">— Sin asignar —</option>
                {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
              </select>
            ) : (
              <>
                <input value={perfil?.nombre || 'Vos'} disabled style={{ background: 'var(--panel-2)', color: 'var(--ink-3)' }} />
                <div className="hint">Solo un administrador puede asignar la oportunidad a otro vendedor.</div>
              </>
            )}
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
