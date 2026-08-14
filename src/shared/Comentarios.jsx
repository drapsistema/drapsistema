import { useState, useEffect } from 'react';
import { listar, crear } from '../lib/db';
import { fmtFecha, hoyISO } from './ui.jsx';
import { useToast } from './Toast.jsx';
import { useAuth } from './Auth.jsx';
import Icon from './Icon.jsx';

// Hilo de comentarios transversal.
// entidad: 'op' | 'venta' | 'post' | 'trabajo'  ·  refId: id de esa entidad
export default function Comentarios({ entidad, refId }) {
  const [comentarios, setComentarios] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [texto, setTexto] = useState('');
  const toast = useToast();
  const { usuarioActualId } = useAuth();

  useEffect(() => {
    listar('comentarios').then((cs) =>
      setComentarios(cs.filter((c) => c.entidad === entidad && c.ref_id === Number(refId))
        .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')))
    );
    listar('usuarios').then(setUsuarios);
  }, [entidad, refId]);

  const nombreAutor = (id) => usuarios.find((u) => u.id === id)?.nombre || '—';

  async function guardar() {
    if (!texto.trim()) { toast('Escribí algo antes de comentar', 'err'); return; }
    const nuevo = await crear('comentarios', {
      entidad, ref_id: Number(refId), texto: texto.trim(), fecha: hoyISO(), autor_id: usuarioActualId,
    });
    setComentarios((cs) => [nuevo, ...cs]);
    setTexto('');
    toast('Comentario agregado');
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-h"><Icon name="postventa" size={16} /> Comentarios ({comentarios.length})</div>
      <div className="card-pad">
        <div className="cmt-list">
          {comentarios.length === 0 ? (
            <div className="muted sm">Sin comentarios todavía.</div>
          ) : comentarios.map((c) => (
            <div key={c.id} className="cmt">
              <div className="cmt-h">
                <span className="cmt-au">{nombreAutor(c.autor_id)}</span>
                <span className="cmt-fe">{fmtFecha(c.fecha)}</span>
              </div>
              <div className="cmt-tx">{c.texto}</div>
            </div>
          ))}
        </div>
        <textarea rows={2} value={texto} onChange={(e) => setTexto(e.target.value)}
          placeholder="Escribí un comentario…" style={{ width: '100%', marginBottom: 8 }} />
        <button className="btn sm" onClick={guardar}><Icon name="check" size={14} /> Comentar</button>
      </div>
    </div>
  );
}

// Helper para registrar comentarios automáticos del sistema desde cualquier módulo.
// Opcionalmente recibe el id del autor (el usuario logueado que disparó la acción).
export async function comentarSistema(entidad, refId, texto, autorId = null) {
  await crear('comentarios', {
    entidad, ref_id: Number(refId), texto: '[sistema] ' + texto, fecha: hoyISO(), autor_id: autorId,
  });
}
