// Registra o service worker da ferramenta e mostra a faixa de versão nova.
// A versão nova só assume quando o dono toca; nada recarrega sozinho.
// Sem acento vermelho: faixa papel com texto tinta.

import { useEffect, useRef, useState } from 'react';
import { acompanharVersao } from './versao.js';

// Marca no <html> que a faixa está acima da barra. O rotina.css usa a marca
// para a moldura reservar espaço extra no fim do conteúdo.
const MARCA = 'data-aviso-versao';

// Props: `acimaDaBarra`, true quando a moldura (com a barra inferior de
// 56 px mais o filete) está na tela; false na tela de acesso.
export default function AvisoVersao({ acimaDaBarra = false }) {
    const [visivel, setVisivel] = useState(false);
    const controle = useRef(null);

    useEffect(() => {
        // Em desenvolvimento não registra: o `npm run dev` não usa o build.
        if (!import.meta.env.PROD || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
            return undefined;
        }

        let ativo = true;

        navigator.serviceWorker
            .register('/rotina/sw.js', { scope: '/rotina' })
            .then((registro) => {
                if (!ativo) return;
                controle.current = acompanharVersao({
                    registro,
                    sw: navigator.serviceWorker,
                    aoAvisar: () => setVisivel(true),
                    recarregar: () => window.location.reload(),
                    documento: document,
                });
            })
            .catch((erro) => {
                // Sem service worker a ferramenta segue funcionando online.
                console.warn('Rotina: service worker não registrado.', erro);
            });

        return () => {
            ativo = false;
            controle.current?.parar();
            controle.current = null;
        };
    }, []);

    useEffect(() => {
        if (!visivel || !acimaDaBarra) return undefined;
        const raiz = document.documentElement;
        raiz.setAttribute(MARCA, '');
        return () => raiz.removeAttribute(MARCA);
    }, [visivel, acimaDaBarra]);

    const posicao = acimaDaBarra
        ? 'bottom-[calc(57px+env(safe-area-inset-bottom))] border-t border-filete-claro'
        : 'bottom-0 pb-[env(safe-area-inset-bottom)]';

    // A região viva fica sempre montada, vazia sem aviso: o leitor de tela só
    // anuncia o texto que entra numa região que já existia.
    return (
        <div role="status">
            {visivel && (
                <div className={`fixed inset-x-0 z-20 bg-papel p-1 text-tinta ${posicao}`}>
                    <button
                        type="button"
                        onClick={() => controle.current?.atualizar()}
                        className="mx-auto flex min-h-[44px] w-full max-w-xl items-center justify-center px-4 text-base font-medium"
                    >
                        Versão nova pronta. Toque para atualizar.
                    </button>
                </div>
            )}
        </div>
    );
}
