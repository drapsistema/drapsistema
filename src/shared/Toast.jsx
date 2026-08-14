import { createContext, useContext, useState, useCallback } from 'react';

// Sistema de avisos (toast) simple y global.
// Uso: const toast = useToast(); toast('Guardado');  o  toast('Error', 'err');
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [avisos, setAvisos] = useState([]);

  const toast = useCallback((msg, tipo = 'ok') => {
    const id = Date.now() + Math.random();
    setAvisos((a) => [...a, { id, msg, tipo }]);
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), 3000);
  }, []);

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="toast-wrap">
        {avisos.map((a) => (
          <div key={a.id} className={'toast ' + a.tipo}>{a.msg}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
