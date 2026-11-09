// Folha que sobe do rodapé sobre um véu grafite (bottom sheet). Mesmo jeito de
// abrir da Confirmar: <dialog> nativo com showModal(), que já prende o foco.
// Esc e toque no véu chamam `aoFechar`; quem usa decide fechar. Ao fechar, o
// foco volta para quem abriu. A subida é só CSS (classe `folha` em rotina.css).

import { useEffect, useId, useRef } from 'react';

// Props:
// - `aberta` (bool): abre com showModal() e fecha com close().
// - `aoFechar`: chamado pelo botão Fechar, por Esc e pelo toque no véu.
// - `titulo`: título da folha.
// - `children`: conteúdo; rola sozinho se passar de 80% da altura da tela.
export default function Folha({ aberta = false, aoFechar, titulo, children }) {
    const caixa = useRef(null);
    const quemAbriu = useRef(null);
    const toqueComecouFora = useRef(false);
    const abertaAgora = useRef(aberta);
    const idTitulo = useId();

    abertaAgora.current = aberta;

    useEffect(() => {
        const dialogo = caixa.current;
        if (!dialogo) return;

        if (aberta && !dialogo.open) {
            quemAbriu.current = document.activeElement;
            dialogo.showModal();
        } else if (!aberta && dialogo.open) {
            dialogo.close();
        }
    }, [aberta]);

    // Esc: o navegador fecharia sozinho; quem decide é quem usa o componente.
    const aoCancelar = (evento) => {
        evento.preventDefault();
        aoFechar?.();
    };

    // Fechou por qualquer caminho: devolve o foco e, se fechou enquanto
    // `aberta` ainda é true (segunda Esc em alguns navegadores), avisa quem usa.
    const aoFecharDialogo = () => {
        const anterior = quemAbriu.current;
        quemAbriu.current = null;
        if (anterior?.isConnected && typeof anterior.focus === 'function') anterior.focus();
        if (abertaAgora.current) aoFechar?.();
    };

    // O véu é o próprio <dialog> fora do painel. Só conta o toque que começou
    // e terminou fora, para não fechar ao arrastar uma seleção de texto.
    const aoApertar = (evento) => {
        toqueComecouFora.current = evento.target === caixa.current;
    };

    const aoTocar = (evento) => {
        if (evento.target === caixa.current && toqueComecouFora.current) {
            aoFechar?.();
        }
        toqueComecouFora.current = false;
    };

    return (
        <dialog
            ref={caixa}
            aria-labelledby={idTitulo}
            onCancel={aoCancelar}
            onClose={aoFecharDialogo}
            onPointerDown={aoApertar}
            onClick={aoTocar}
            className="folha inset-x-0 top-auto bottom-0 mx-auto mb-0 w-full max-w-xl overflow-hidden border-t border-filete-claro bg-creme p-0 text-tinta [--foco:var(--color-tinta)]"
        >
            <div className="flex max-h-[80dvh] flex-col pb-[env(safe-area-inset-bottom)]">
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-filete-claro py-1 pr-1 pl-4">
                    <h2 id={idTitulo} className="min-w-0 text-lg font-medium">
                        {titulo}
                    </h2>
                    <button
                        type="button"
                        onClick={() => aoFechar?.()}
                        className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center px-3 text-base underline underline-offset-4"
                    >
                        Fechar
                    </button>
                </div>
                <div className="min-h-0 overflow-y-auto overscroll-contain px-4 pt-4 pb-6">{children}</div>
            </div>
        </dialog>
    );
}
