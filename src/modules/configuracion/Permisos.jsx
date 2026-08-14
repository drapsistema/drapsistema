import { useState, useEffect } from 'react';
import { listar, actualizar } from '../../lib/db';
import { MODULOS } from '../../shared/permisos';
import { useAuth } from '../../shared/Auth.jsx';
import { useToast } from '../../shared/Toast.jsx';
import Icon from '../../shared/Icon.jsx';

// Roles configurables (Administrador queda fuera: ve todo siempre).
const ROLES_CONFIG = ['Vendedor', 'Vendedor tercerizado', 'Técnico', 'Postventa'];

export default function Permisos() {
  const [permisos, setPermisos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const { recargarPermisos } = useAuth();
  const toast = useToast();

  useEffect(() => { cargar(); }, []);
  function cargar() { listar('permisos').then((p) => { setPermisos(p); setCargando(false); }); }

  // ¿El rol tiene acceso al módulo?
  const tiene = (rol, mod) => {
    const fila = permisos.find((p) => p.rol === rol);
    return fila ? fila.modulos.includes(mod) : false;
  };

  // Marca/desmarca un módulo para un rol (en memoria; se guarda con el botón).
  function toggle(rol, mod) {
    setPermisos((prev) => prev.map((p) => {
      if (p.rol !== rol) return p;
      const tiene = p.modulos.includes(mod);
      return { ...p, modulos: tiene ? p.modulos.filter((m) => m !== mod) : [...p.modulos, mod] };
    }));
  }

  async function guardar() {
    for (const fila of permisos) {
      await actualizar('permisos', fila.id, { modulos: fila.modulos });
    }
    await recargarPermisos();
    toast('Permisos guardados · el menú de cada usuario se actualiza según su rol');
  }

  if (cargando) return null;

  return (
    <div>
      <div className="aviso">
        Definí qué módulos ve cada rol. El <b style={{ margin: '0 4px' }}>Administrador</b> ve todo siempre.
        Un usuario con varios roles ve la suma de lo que permiten sus roles. Configuración es solo para administradores.
      </div>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Módulo</th>
              {ROLES_CONFIG.map((r) => <th key={r} style={{ textAlign: 'center' }}>{r}</th>)}
            </tr>
          </thead>
          <tbody>
            {MODULOS.map((m) => (
              <tr key={m.id}>
                <td className="strong">{m.label}</td>
                {ROLES_CONFIG.map((rol) => (
                  <td key={rol} style={{ textAlign: 'center' }}>
                    <label className="perm-check">
                      <input type="checkbox" checked={tiene(rol, m.id)} onChange={() => toggle(rol, m.id)} />
                    </label>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button className="btn" style={{ marginTop: 16 }} onClick={guardar}>
        <Icon name="check" size={16} /> Guardar permisos
      </button>
    </div>
  );
}
