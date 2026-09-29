import { useState, useEffect } from 'react';
import { actualizarMiContacto } from '../../lib/db';
import { PageHeader } from '../../shared/ui.jsx';
import { useToast } from '../../shared/Toast.jsx';
import { useAuth } from '../../shared/Auth.jsx';
import { rolesDe } from '../../shared/permisos';
import Icon from '../../shared/Icon.jsx';

// Datos propios del usuario. El teléfono y el WhatsApp salen en los
// presupuestos que emite; el resto lo administra un administrador.
export default function MiPerfil() {
  const { perfil, recargarPerfil } = useAuth();
  const toast = useToast();
  const [telefono, setTelefono] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    setTelefono(perfil?.telefono || '');
    setWhatsapp(perfil?.whatsapp || '');
  }, [perfil]);

  if (!perfil) return null;

  async function guardar() {
    setGuardando(true);
    try {
      await actualizarMiContacto(perfil.id, telefono.trim(), whatsapp.trim());
      await recargarPerfil();
      toast('Datos de contacto guardados');
    } catch (e) {
      console.error(e);
      toast('No se pudieron guardar los datos', 'err');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div>
      <PageHeader titulo="Mi perfil" sub="Tus datos de contacto salen en los presupuestos que emitís" />
      <div className="card card-pad" style={{ maxWidth: 560 }}>
        <div className="pres-datos" style={{ marginBottom: 16 }}>
          <span className="muted sm">Nombre</span><b>{perfil.nombre}</b>
          <span className="muted sm">Mail</span><span>{perfil.mail}</span>
          <span className="muted sm">Roles</span><span>{rolesDe(perfil).join(', ')}</span>
          <span className="muted sm">Cargo</span><span>{perfil.cargo || 'Asesor Comercial'}</span>
        </div>
        <div className="form-grid">
          <div className="field">
            <label>Teléfono</label>
            <input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="+54 387 …" />
          </div>
          <div className="field">
            <label>WhatsApp</label>
            <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+54 9 387 …" />
          </div>
        </div>
        <div className="hint" style={{ marginBottom: 12 }}>El nombre y el cargo los cambia un administrador desde Configuración.</div>
        <button className="btn" onClick={guardar} disabled={guardando}>
          <Icon name="check" size={16} /> {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </div>
  );
}
