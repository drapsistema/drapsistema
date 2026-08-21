import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { crear, obtener, actualizar, listar } from '../../lib/db';
import { PageHeader, BackButton, nombreCliente } from '../../shared/ui.jsx';
import { usuariosConRolPrefijo, esAdministrador } from '../../shared/permisos';
import { useAuth } from '../../shared/Auth.jsx';
import Icon from '../../shared/Icon.jsx';

const VACIO = {
  tipo: 'Persona jurídica', razon_social: '', nombre: '', apellido: '', cuit: '',
  domicilio: '', telefono: '', mail: '', observaciones: '', vendedor_id: '', activo: true,
};

// Helpers de formato/validación.
const soloNumeros = (s) => (s || '').replace(/\D/g, '');
const mailValido = (m) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m);
// Normaliza tipos viejos ('Empresa', 'Sociedad') al binario actual.
const normalizarTipo = (t) => (t === 'Persona física' ? 'Persona física' : 'Persona jurídica');

export default function ClienteForm() {
  const { id } = useParams();
  const editando = Boolean(id);
  const navigate = useNavigate();
  const [form, setForm] = useState(VACIO);
  const [vendedores, setVendedores] = useState([]);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [duplicado, setDuplicado] = useState(null); // cliente existente con el mismo CUIT

  const { perfil, usuarioActualId } = useAuth();

  useEffect(() => {
    listar('usuarios').then((us) =>
      setVendedores(usuariosConRolPrefijo(us, 'Vendedor'))
    );
    if (editando) {
      obtener('clientes', id).then((c) => c && setForm({ ...c, tipo: normalizarTipo(c.tipo) }));
    }
  }, [id, editando]);

  // Chequeo automático de CUIT duplicado (con debounce). Solo avisa: no
  // bloquea el alta. Si RLS oculta clientes de otros vendedores, el aviso
  // solo detecta duplicados dentro de lo que el usuario puede ver.
  useEffect(() => {
    const cuit = form.cuit;
    if (!cuit || cuit.length !== 11) { setDuplicado(null); return; }
    let cancelado = false;
    const t = setTimeout(async () => {
      try {
        const encontrados = await listar('clientes', { cuit });
        const otro = encontrados.find((c) => String(c.id) !== String(id));
        if (!cancelado) setDuplicado(otro || null);
      } catch { if (!cancelado) setDuplicado(null); }
    }, 400);
    return () => { cancelado = true; clearTimeout(t); };
  }, [form.cuit, id]);

  const set = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  function validar() {
    const e = {};
    if (form.tipo === 'Persona física') {
      if (!form.nombre) e.nombre = true;
      if (!form.apellido) e.apellido = true;
    } else {
      if (!form.razon_social) e.razon_social = true;
    }
    if (!form.cuit || form.cuit.length !== 11) e.cuit = true;
    if (!form.domicilio) e.domicilio = true;
    if (!form.telefono) e.telefono = true;
    if (form.mail && !mailValido(form.mail)) e.mail = true;
    setErrores(e);
    return Object.keys(e).length === 0;
  }

  async function guardar() {
    if (!validar()) return;
    setGuardando(true);
    try {
      let vendedor_id = form.vendedor_id ? Number(form.vendedor_id) : null;
      if (!editando && !esAdministrador(perfil) && !vendedor_id) {
        vendedor_id = usuarioActualId;
      }
      // Limpiamos los campos del tipo que no corresponde, para no dejar
      // datos colgados (ej: razon_social en una persona física).
      const datos = { ...form, vendedor_id };
      if (form.tipo === 'Persona física') { datos.razon_social = ''; }
      else { datos.nombre = ''; datos.apellido = ''; }

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
  const cuitCorto = form.cuit && form.cuit.length !== 11;

  return (
    <div>
      <PageHeader
        titulo={editando ? 'Editar cliente' : 'Nuevo cliente'}
        sub="Empezá por el CUIT: el sistema chequea que no esté duplicado"
      >
        <BackButton to={editando ? `/clientes/${id}` : '/clientes'} />
      </PageHeader>

      <div className="card card-pad" style={{ maxWidth: 720 }}>
        <div className="form-grid">
          {/* CUIT primero */}
          <div className="field">
            <label>CUIT <span className="req">*</span></label>
            <input value={form.cuit} inputMode="numeric" autoFocus
              onChange={(e) => set('cuit', soloNumeros(e.target.value).slice(0, 11))}
              placeholder="11 dígitos, sin guiones"
              style={errores.cuit ? { borderColor: 'var(--red)' } : undefined} />
            {cuitCorto && <div className="hint" style={{ color: 'var(--red)' }}>El CUIT debe tener 11 dígitos.</div>}
          </div>

          <div className="field">
            <label>Tipo de cliente <span className="req">*</span></label>
            <select value={form.tipo} onChange={(e) => set('tipo', e.target.value)}>
              <option>Persona jurídica</option>
              <option>Persona física</option>
            </select>
          </div>

          {/* Aviso de duplicado (solo avisa, no bloquea) */}
          {duplicado && (
            <div className="field full">
              <div className="aviso bad" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span className="grow">
                  Ya existe un cliente con este CUIT: <b>{nombreCliente(duplicado)}</b>.
                </span>
                <button className="btn ghost sm" onClick={() => navigate(`/clientes/${duplicado.id}`)}>
                  Ver ficha →
                </button>
              </div>
            </div>
          )}

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

          <div className="field full">
            <label>Domicilio fiscal <span className="req">*</span></label>
            <input value={form.domicilio} onChange={(e) => set('domicilio', e.target.value)}
              style={errores.domicilio ? { borderColor: 'var(--red)' } : undefined} />
          </div>

          <div className="field">
            <label>Teléfono <span className="req">*</span></label>
            <input value={form.telefono} inputMode="numeric"
              onChange={(e) => set('telefono', soloNumeros(e.target.value))}
              placeholder="Solo números"
              style={errores.telefono ? { borderColor: 'var(--red)' } : undefined} />
          </div>
          <div className="field">
            <label>Mail</label>
            <input value={form.mail} type="email" onChange={(e) => set('mail', e.target.value)}
              placeholder="tu@empresa.com"
              style={errores.mail ? { borderColor: 'var(--red)' } : undefined} />
            {errores.mail && <div className="hint" style={{ color: 'var(--red)' }}>Formato de mail inválido.</div>}
          </div>

          <div className="field">
            <label>Vendedor asignado</label>
            {esAdministrador(perfil) ? (
              <select value={form.vendedor_id || ''} onChange={(e) => set('vendedor_id', e.target.value)}>
                <option value="">— Sin asignar —</option>
                {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
              </select>
            ) : (
              <>
                <input value={vendedores.find((v) => v.id === form.vendedor_id)?.nombre || 'Vos'} disabled
                  style={{ background: 'var(--panel-2)', color: 'var(--ink-3)' }} />
                <div className="hint">Solo un administrador puede reasignar el vendedor.</div>
              </>
            )}
          </div>
          <div className="field" />

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
