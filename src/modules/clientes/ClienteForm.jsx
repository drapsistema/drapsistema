import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { crear, obtener, actualizar, clientePorCuit, clientesParecidos } from '../../lib/db';
import { PageHeader, BackButton } from '../../shared/ui.jsx';
import { useToast } from '../../shared/Toast.jsx';
import { useAuth } from '../../shared/Auth.jsx';
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
  const [parecidos, setParecidos] = useState([]);   // [{ cliente_id, puede_ver, nombre }]
  const [solicitada, setSolicitada] = useState(false);
  const toast = useToast();
  const { esAdmin } = useAuth();

  useEffect(() => {
    if (editando) {
      obtener('clientes', id).then((c) => c && setForm({
        ...c,
        tipo: normalizarTipo(c.tipo),
        cuit: c.cuit || '', domicilio: c.domicilio || '', telefono: c.telefono || '',
        mail: c.mail || '', observaciones: c.observaciones || '',
        nombre: c.nombre || '', apellido: c.apellido || '', razon_social: c.razon_social || '',
      }));
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

  // Sin CUIT no hay forma segura de detectar un duplicado: avisamos (sin
  // bloquear) si ya hay clientes con un nombre parecido.
  const esPF = form.tipo === 'Persona física';
  const textoNombre = (esPF ? `${form.nombre} ${form.apellido}` : form.razon_social).trim();
  useEffect(() => {
    if (form.cuit || textoNombre.length < 3) { setParecidos([]); return; }
    let cancelado = false;
    const t = setTimeout(async () => {
      try {
        const r = await clientesParecidos(textoNombre, editando ? Number(id) : null);
        if (!cancelado) setParecidos(r);
      } catch { if (!cancelado) setParecidos([]); }
    }, 500);
    return () => { cancelado = true; clearTimeout(t); };
  }, [textoNombre, form.cuit, id, editando]);

  const set = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  // El CUIT es único: no se puede guardar uno que ya tiene otro cliente.
  const bloqueadoPorDuplicado = Boolean(duplicado);

  function validar() {
    const e = {};
    if (!form.tipo) e.tipo = true;
    if (esPF) {
      if (!form.nombre.trim()) e.nombre = true;
      if (!form.apellido.trim()) e.apellido = true;
    } else if (!form.razon_social.trim()) {
      e.razon_social = true;
    }
    if (form.cuit && form.cuit.length !== 11) e.cuit = true;
    if (form.mail && !mailValido(form.mail)) e.mail = true;
    setErrores(e);
    return Object.keys(e).length === 0;
  }

  async function guardar() {
    if (bloqueadoPorDuplicado) return;
    if (!validar()) return;
    setGuardando(true);
    try {
      const datos = { ...form, cuit: form.cuit || null };
      // Limpiamos el campo del tipo que no corresponde.
      if (esPF) { datos.razon_social = ''; }
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
      // 23505 = violación del índice único de CUIT (alguien lo cargó recién).
      alert(err?.code === '23505'
        ? 'Ya existe otro cliente con ese CUIT. No se guardaron los cambios.'
        : 'No se pudo guardar. Revisá la consola.');
    } finally {
      setGuardando(false);
    }
  }

  // Editando un cliente cuyo CUIT ya tiene otro: probablemente es el mismo
  // cliente cargado dos veces. El vendedor pide al admin que los unifique.
  async function solicitarUnificacion() {
    try {
      await crear('solicitudes_unificacion', {
        cliente_origen_id: Number(id),
        cliente_destino_id: duplicado.cliente_id,
        motivo: `Mismo CUIT: ${form.cuit}`,
        estado: 'Pendiente',
      });
      setSolicitada(true);
      toast('Solicitud enviada · un administrador va a unificar los clientes');
    } catch (err) {
      if (err?.code === '23505') { setSolicitada(true); toast('Ya hay una solicitud pendiente para estos clientes'); return; }
      console.error('Error al solicitar unificación:', err);
      toast('No se pudo enviar la solicitud', 'err');
    }
  }

  const cuitCorto = form.cuit && form.cuit.length !== 11;
  const estilo = (campo) => (errores[campo] ? { borderColor: 'var(--red)' } : undefined);

  return (
    <div>
      <PageHeader
        titulo={editando ? 'Editar cliente' : 'Nuevo cliente'}
        sub="Si tenés el CUIT, cargalo primero: el sistema chequea que el cliente no exista ya"
      >
        <BackButton to={editando ? `/clientes/${id}` : '/clientes'} />
      </PageHeader>

      <div className="card card-pad" style={{ maxWidth: 720 }}>
        <div className="form-grid">
          {/* CUIT primero */}
          <div className="field">
            <label>CUIT</label>
            <input value={form.cuit} inputMode="numeric" autoFocus
              onChange={(e) => set('cuit', soloNumeros(e.target.value).slice(0, 11))}
              placeholder="11 dígitos, sin guiones"
              style={estilo('cuit')} />
            {cuitCorto && <div className="hint" style={{ color: 'var(--red)' }}>El CUIT debe tener 11 dígitos.</div>}
          </div>

          <div className="field">
            <label>Tipo de cliente <span className="req">*</span></label>
            <select value={form.tipo} onChange={(e) => set('tipo', e.target.value)} style={estilo('tipo')}>
              <option>Persona jurídica</option>
              <option>Persona física</option>
            </select>
          </div>

          {/* Aviso de duplicado según quién esté cargando */}
          {duplicado && (
            <div className="field full">
              <div className="aviso bad" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span className="grow">
                  {duplicado.puede_ver
                    ? <>Ya existe un cliente con este CUIT{duplicado.nombre ? <>: <b>{duplicado.nombre}</b></> : ''}.</>
                    : 'Este cliente ya existe y está asignado a otro vendedor.'}
                  {editando
                    ? ' Es probable que sea el mismo cliente cargado dos veces: pedí que se unifiquen.'
                    : !duplicado.puede_ver && ' Contactate con un administrador para resolverlo.'}
                </span>
                {duplicado.puede_ver && (
                  <button className="btn ghost sm" onClick={() => navigate(`/clientes/${duplicado.cliente_id}`)}>
                    Ver ficha →
                  </button>
                )}
                {editando && esAdmin && (
                  <button className="btn sm" onClick={() => navigate(`/clientes/unificar?origen=${id}&destino=${duplicado.cliente_id}`)}>
                    Unificar ahora
                  </button>
                )}
                {editando && !esAdmin && (
                  <button className="btn sm" onClick={solicitarUnificacion} disabled={solicitada}>
                    {solicitada ? 'Solicitud enviada ✓' : 'Solicitar unificación'}
                  </button>
                )}
              </div>
            </div>
          )}

          {esPF ? (
            <>
              <div className="field">
                <label>Nombre <span className="req">*</span></label>
                <input value={form.nombre} onChange={(e) => set('nombre', e.target.value)} style={estilo('nombre')} />
              </div>
              <div className="field">
                <label>Apellido <span className="req">*</span></label>
                <input value={form.apellido} onChange={(e) => set('apellido', e.target.value)} style={estilo('apellido')} />
              </div>
            </>
          ) : (
            <div className="field full">
              <label>Razón social <span className="req">*</span></label>
              <input value={form.razon_social} onChange={(e) => set('razon_social', e.target.value)} style={estilo('razon_social')} />
            </div>
          )}

          {parecidos.length > 0 && (
            <div className="field full">
              <div className="aviso warn" style={{ display: 'block' }}>
                Hay clientes con un nombre parecido. Revisá que no sea el mismo antes de crearlo:
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {parecidos.map((p) => (
                    <li key={p.cliente_id}>
                      {p.puede_ver
                        ? <a onClick={() => navigate(`/clientes/${p.cliente_id}`)} style={{ cursor: 'pointer' }}>{p.nombre}</a>
                        : 'Un cliente cargado por otro vendedor'}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="field full">
            <label>Domicilio fiscal</label>
            <input value={form.domicilio} onChange={(e) => set('domicilio', e.target.value)} />
          </div>

          <div className="field">
            <label>Teléfono</label>
            <input value={form.telefono} inputMode="numeric"
              onChange={(e) => set('telefono', soloNumeros(e.target.value))}
              placeholder="Solo números" />
          </div>
          <div className="field">
            <label>Mail</label>
            <input value={form.mail} type="email" onChange={(e) => set('mail', e.target.value)}
              placeholder="tu@empresa.com" style={estilo('mail')} />
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
