import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { crear, obtener, actualizar, listar } from '../../lib/db';
import { PageHeader, BackButton } from '../../shared/ui.jsx';
import Icon from '../../shared/Icon.jsx';

const VACIO = {
  tipo: 'Empresa', razon_social: '', nombre: '', apellido: '', cuit: '',
  domicilio: '', telefono: '', mail: '', observaciones: '', vendedor_id: '', activo: true,
};

export default function ClienteForm() {
  const { id } = useParams();
  const editando = Boolean(id);
  const navigate = useNavigate();
  const [form, setForm] = useState(VACIO);
  const [vendedores, setVendedores] = useState([]);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    listar('usuarios').then((us) =>
      setVendedores(us.filter((u) => u.rol && u.rol.startsWith('Vendedor')))
    );
    if (editando) {
      obtener('clientes', id).then((c) => c && setForm(c));
    }
  }, [id, editando]);

  const set = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  // Campos obligatorios según el tipo de cliente.
  function validar() {
    const e = {};
    if (form.tipo === 'Persona física') {
      if (!form.nombre) e.nombre = true;
      if (!form.apellido) e.apellido = true;
    } else {
      if (!form.razon_social) e.razon_social = true;
    }
    if (!form.cuit) e.cuit = true;
    if (!form.domicilio) e.domicilio = true;
    if (!form.telefono) e.telefono = true;
    setErrores(e);
    return Object.keys(e).length === 0;
  }

  async function guardar() {
    if (!validar()) return;
    setGuardando(true);
    try {
      const datos = { ...form, vendedor_id: form.vendedor_id ? Number(form.vendedor_id) : null };
      if (editando) {
        await actualizar('clientes', id, datos);
        navigate(`/clientes/${id}`);
      } else {
        const nuevo = await crear('clientes', datos);
        navigate(`/clientes/${nuevo.id}`);
      }
    } catch (err) {
      console.error('Error al guardar cliente:', err);
      alert('No se pudo guardar. Revisá la consola.');
    } finally {
      setGuardando(false);
    }
  }

  const esPF = form.tipo === 'Persona física';

  return (
    <div>
      <PageHeader
        titulo={editando ? 'Editar cliente' : 'Nuevo cliente'}
        sub="Los campos varían según el tipo de cliente"
      >
        <BackButton to={editando ? `/clientes/${id}` : '/clientes'} />
      </PageHeader>

      <div className="card card-pad" style={{ maxWidth: 720 }}>
        <div className="form-grid">
          <div className="field">
            <label>Tipo de cliente <span className="req">*</span></label>
            <select value={form.tipo} onChange={(e) => set('tipo', e.target.value)}>
              <option>Empresa</option>
              <option>Persona física</option>
              <option>Sociedad</option>
            </select>
          </div>
          <div className="field" />

          {esPF ? (
            <>
              <div className="field">
                <label>Nombre <span className="req">*</span></label>
                <input value={form.nombre} onChange={(e) => set('nombre', e.target.value)}
                  style={errores.nombre ? { borderColor: 'var(--red)' } : undefined} />
              </div>
              <div className="field">
                <label>Apellido <span className="req">*</span></label>
                <input value={form.apellido} onChange={(e) => set('apellido', e.target.value)}
                  style={errores.apellido ? { borderColor: 'var(--red)' } : undefined} />
              </div>
            </>
          ) : (
            <div className="field full">
              <label>Razón social <span className="req">*</span></label>
              <input value={form.razon_social} onChange={(e) => set('razon_social', e.target.value)}
                style={errores.razon_social ? { borderColor: 'var(--red)' } : undefined} />
            </div>
          )}

          <div className="field">
            <label>CUIT <span className="req">*</span></label>
            <input value={form.cuit} onChange={(e) => set('cuit', e.target.value)}
              placeholder="30-71234567-9"
              style={errores.cuit ? { borderColor: 'var(--red)' } : undefined} />
          </div>
          <div className="field">
            <label>Teléfono <span className="req">*</span></label>
            <input value={form.telefono} onChange={(e) => set('telefono', e.target.value)}
              style={errores.telefono ? { borderColor: 'var(--red)' } : undefined} />
          </div>

          <div className="field full">
            <label>Domicilio fiscal <span className="req">*</span></label>
            <input value={form.domicilio} onChange={(e) => set('domicilio', e.target.value)}
              style={errores.domicilio ? { borderColor: 'var(--red)' } : undefined} />
          </div>

          <div className="field">
            <label>Mail</label>
            <input value={form.mail} onChange={(e) => set('mail', e.target.value)} />
          </div>
          <div className="field">
            <label>Vendedor asignado</label>
            <select value={form.vendedor_id || ''} onChange={(e) => set('vendedor_id', e.target.value)}>
              <option value="">— Sin asignar —</option>
              {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
            </select>
          </div>

          <div className="field full">
            <label>Observaciones</label>
            <textarea rows={2} value={form.observaciones} onChange={(e) => set('observaciones', e.target.value)} />
          </div>
        </div>

        <button className="btn full" onClick={guardar} disabled={guardando}>
          <Icon name="check" size={16} /> {guardando ? 'Guardando…' : (editando ? 'Guardar cambios' : 'Crear cliente')}
        </button>
      </div>
    </div>
  );
}
