import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { crear, obtener, actualizar, clientePorCuit } from '../../lib/db';
import { PageHeader, BackButton } from '../../shared/ui.jsx';
import Icon from '../../shared/Icon.jsx';

const VACIO = {
  tipo: 'Persona jurídica', razon_social: '', nombre: '', apellido: '', cuit: '',
  domicilio: '', telefono: '', mail: '', observaciones: '', activo: true,
};

// Helpers de formato/validación.
const soloNumeros = (s) => (s || '').replace(/\D/g, '');
const mailValido = (m) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m);
const normalizarTipo = (t) => (t === 'Persona física' ? 'Persona física' : 'Persona jurídica');

export default function ClienteForm() {
  const { id } = useParams();
  const editando = Boolean(id);
  const navigate = useNavigate();
  const [form, setForm] = useState(VACIO);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [duplicado, setDuplicado] = useState(null); // { cliente_id, es_propio, puede_ver, nombre }

  useEffect(() => {
    if (editando) {
      obtener('clientes', id).then((c) => c && setForm({ ...c, tipo: normalizarTipo(c.tipo) }));
    }
  }, [id, editando]);

  // Chequeo automático de CUIT duplicado (con debounce). Corre contra
  // TODOS los clientes vía la función global, más allá de RLS.
  useEffect(() => {
    const cuit = form.cuit;
    if (!cuit || cuit.length !== 11) { setDuplicado(null); return; }
    let cancelado = false;
    const t = setTimeout(async () => {
      try {
        const r = await clientePorCuit(cuit);
        // Si estoy editando este mismo cliente, no es un duplicado.
        if (r && editando && String(r.cliente_id) === String(id)) { if (!cancelado) setDuplicado(null); return; }
        if (!cancelado) setDuplicado(r || null);
      } catch { if (!cancelado) setDuplicado(null); }
    }, 400);
    return () => { cancelado = true; clearTimeout(t); };
  }, [form.cuit, id, editando]);

  const set = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  // Un vendedor no puede crear un cliente que ya existe y es de otro.
  const bloqueadoPorDuplicado = !editando && duplicado && !duplicado.puede_ver;

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
    if (bloqueadoPorDuplicado) return; // no se puede crear un cliente de otro
    if (!validar()) return;
    setGuardando(true);
    try {
      // Limpiamos el campo del tipo que no corresponde.
      const datos = { ...form };
      if (form.tipo === 'Persona física') { datos.razon_social = ''; }
      else { datos.nombre = ''; datos.apellido = ''; }

      if (editando) {
        await actualizar('clientes', id, datos);
        navigate(`/clientes/${id}`);
      } else {
        // El cliente NO lleva vendedor asignado (eso se define al crear
        // oportunidades) y 'creado_por' lo completa la base sola con el
        // usuario logueado (default app_uid()), así RLS siempre coincide.
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
        sub="Empezá por el CUIT: el sistema chequea que no exista ya"
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

          {/* Aviso de duplicado según quién esté cargando */}
          {duplicado && (
            <div className="field full">
              {duplicado.puede_ver ? (
                <div className="aviso bad" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span className="grow">
                    Ya existe un cliente con este CUIT{duplicado.nombre ? <>: <b>{duplicado.nombre}</b></> : ''}.
                  </span>
                  <button className="btn ghost sm" onClick={() => navigate(`/clientes/${duplicado.cliente_id}`)}>
                    Ver ficha →
                  </button>
                </div>
              ) : (
                <div className="aviso bad">
                  Este cliente ya existe y está asignado a otro vendedor. Contactate con un administrador para resolverlo.
                </div>
              )}
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

          <div className="field full">
            <label>Observaciones</label>
            <textarea rows={2} value={form.observaciones} onChange={(e) => set('observaciones', e.target.value)} />
          </div>
        </div>

        <button className="btn full" onClick={guardar} disabled={guardando || bloqueadoPorDuplicado}>
          <Icon name="check" size={16} /> {guardando ? 'Guardando…' : (editando ? 'Guardar cambios' : 'Crear cliente')}
        </button>
      </div>
    </div>
  );
}
