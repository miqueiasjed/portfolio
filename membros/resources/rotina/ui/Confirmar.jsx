// Confirmação própria da ferramenta, no lugar da caixa do navegador: excluir
// cliente, cancelar pendência, restaurar cópia. Painel creme sobre fundo
// grafite translúcido, cantos retos, sem sombra.
// Com `destrutivo`, o botão de confirmar leva o acento vermelho da tela:
// quem usa não põe outro acento enquanto a confirmação estiver aberta.

import { useEffect, useId, useRef } from 'react';

// Props:
// - `aberto` (bool): abre com showModal() e fecha com close().
// - `titulo`, `texto`: pergunta e explicação curta.
// - `rotuloConfirmar`: texto do botão que faz a ação (ex. "Excluir cliente").
// - `rotuloVoltar`: texto do botão seguro, padrão "Voltar".
// - `destrutivo` (bool): botão de confirmar em vermelho.
// - `aoConfirmar`, `aoVoltar`: chamados pelos botões; Esc e toque fora chamam `aoVoltar`.
export default function Confirmar({
    aberto = false,
    titulo,
    texto,
    rotuloConfirmar,
    rotuloVoltar = 'Voltar',
    destrutivo = false,
    aoConfirmar,
    aoVoltar,
}) {
    const caixa = useRef(null);
    const voltar = useRef(null);
    const toqueComecouFora = useRef(false);
    const abertoAgora = useRef(aberto);
    const idTitulo = useId();
    const idTexto = useId();

    abertoAgora.current = aberto;

    useEffect(() => {
        const dialogo = caixa.current;
        if (!dialogo) return;

        if (aberto && !dialogo.open) {
            dialogo.showModal();
            // O foco vai para o botão seguro, nunca para o que faz a ação.
            voltar.current?.focus();
        } else if (!aberto && dialogo.open) {
            dialogo.close();
        }
    }, [aberto]);

    // Esc: o navegador fecharia sozinho; quem decide é quem usa o componente.
    const aoCancelar = (evento) => {
        evento.preventDefault();
        aoVoltar?.();
    };

    // Alguns navegadores fecham na segunda Esc sem deixar cancelar. Se fechou
    // enquanto `aberto` ainda é true, avisa quem usa para o estado acompanhar.
    const aoFechar = () => {
        if (abertoAgora.current) aoVoltar?.();
    };

    // Toque no fundo cai no próprio <dialog>, porque o painel ocupa todo o
    // interior dele. Só conta se o toque começou e terminou fora do painel,
    // para não fechar quando alguém arrasta a seleção de texto para fora.
    const aoApertar = (evento) => {
        toqueComecouFora.current = evento.target === caixa.current;
    };

    const aoTocar = (evento) => {
        if (evento.target === caixa.current && toqueComecouFora.current) {
            aoVoltar?.();
        }
        toqueComecouFora.current = false;
    };

    const corConfirmar = destrutivo ? 'bg-caneta-creme text-papel' : 'bg-grafite text-papel';

    return (
        <dialog
            ref={caixa}
            aria-labelledby={idTitulo}
            aria-describedby={texto ? idTexto : undefined}
            onCancel={aoCancelar}
            onClose={aoFechar}
            onPointerDown={aoApertar}
            onClick={aoTocar}
            className="m-auto w-[calc(100%-2rem)] max-w-md border border-filete-claro bg-creme p-0 text-tinta [--foco:var(--color-tinta)] backdrop:bg-grafite/80"
        >
            <div className="p-5">
                <h2 id={idTitulo} className="text-lg font-medium">
                    {titulo}
                </h2>

                {texto && (
                    <p id={idTexto} className="mt-2 text-base font-light">
                        {texto}
                    </p>
                )}

                <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button
                        ref={voltar}
                        type="button"
                        onClick={() => aoVoltar?.()}
                        className="min-h-[44px] w-full border border-tinta px-4 text-base font-medium sm:w-auto"
                    >
                        {rotuloVoltar}
                    </button>
                    <button
                        type="button"
                        onClick={() => aoConfirmar?.()}
                        className={`min-h-[44px] w-full px-4 text-base font-medium sm:w-auto ${corConfirmar}`}
                    >
                        {rotuloConfirmar}
                    </button>
                </div>
            </div>
        </dialog>
    );
}
