import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { IconeAlerta, IconeCheck, IconeFechar } from './icones';

const ToastContexto = createContext({ mostrar: () => {} });

export const useToast = () => useContext(ToastContexto);

const DURACAO = 4000;

function Aviso({ toast, onFechar }) {
    const [pausado, setPausado] = useState(false);

    useEffect(() => {
        if (pausado) return;
        const t = setTimeout(() => onFechar(toast.id), DURACAO);
        return () => clearTimeout(t);
    }, [pausado, onFechar, toast.id]);

    const erro = toast.tipo === 'erro';

    return (
        <div
            role={erro ? 'alert' : 'status'}
            onMouseEnter={() => setPausado(true)}
            onMouseLeave={() => setPausado(false)}
            onFocus={() => setPausado(true)}
            onBlur={() => setPausado(false)}
            className={`admin-toast pointer-events-auto flex items-start gap-3 w-full sm:w-96 px-4 py-3 border text-sm ${erro ? 'bg-papel border-caneta-creme text-tinta' : 'bg-grafite border-grafite text-papel'}`}
        >
            {erro ? <IconeAlerta className="text-caneta-creme mt-0.5" tamanho={16} /> : <IconeCheck className="text-caneta mt-0.5" tamanho={16} />}
            <p className="flex-1 leading-snug">{toast.texto}</p>
            <button type="button" onClick={() => onFechar(toast.id)} aria-label="Fechar aviso" className={`-m-1 p-1 cursor-pointer ${erro ? 'text-apoio hover:text-tinta' : 'text-apoio hover:text-papel'}`}>
                <IconeFechar tamanho={14} />
            </button>
        </div>
    );
}

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const proximo = useRef(1);

    const mostrar = useCallback((texto, tipo = 'ok') => {
        if (!texto) return;
        const id = proximo.current++;
        setToasts((lista) => [...lista.slice(-2), { id, texto, tipo }]);
    }, []);

    const fechar = useCallback((id) => setToasts((lista) => lista.filter((t) => t.id !== id)), []);

    const valor = useMemo(() => ({ mostrar }), [mostrar]);
    const caixa = useRef(null);

    // Os toasts vão para a camada de cima (popover) para aparecer por cima de gaveta e modal abertos.
    // Reabrir a cada aviso novo coloca a caixa acima do último diálogo aberto.
    useEffect(() => {
        const el = caixa.current;
        if (!el?.showPopover) return;
        try {
            if (el.matches(':popover-open')) el.hidePopover();
            if (toasts.length > 0) el.showPopover();
        } catch {
            // navegador sem suporte a popover: a caixa fica fixa no canto, abaixo dos diálogos
        }
    }, [toasts]);

    return (
        <ToastContexto.Provider value={valor}>
            {children}
            <div
                ref={caixa}
                popover="manual"
                className="fixed z-50 inset-auto w-auto h-auto bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 m-0 p-0 border-0 bg-transparent overflow-visible pointer-events-none"
                aria-live="polite"
            >
                <div className="flex flex-col items-end gap-2">
                    {toasts.map((t) => (
                        <Aviso key={t.id} toast={t} onFechar={fechar} />
                    ))}
                </div>
            </div>
        </ToastContexto.Provider>
    );
}
