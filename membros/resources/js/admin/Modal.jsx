import { useEffect, useId, useRef } from 'react';
import { Botao } from './Campos';
import { IconeAlerta, IconeFechar } from './icones';

/**
 * Liga um <dialog> nativo ao estado do React: showModal() prende o foco e deixa o resto inerte,
 * Esc e clique fora chamam onFechar, e o foco volta para quem abriu.
 */
export function useDialogo(aberto, onFechar) {
    const ref = useRef(null);
    const quemAbriu = useRef(null);
    const cliqueComecouFora = useRef(false);

    function devolverFoco() {
        const alvo = quemAbriu.current;
        quemAbriu.current = null;
        if (alvo && document.contains(alvo)) alvo.focus();
    }

    useEffect(() => {
        const d = ref.current;
        if (!d) return;
        if (aberto && !d.open) {
            quemAbriu.current = document.activeElement;
            d.showModal();
            // autoFocus do React não funciona dentro de <dialog> fechado; quem quiser o foco marca data-autofocus
            d.querySelector('[data-autofocus]')?.focus();
        } else if (!aberto && d.open) {
            d.close();
            devolverFoco();
        }
    }, [aberto]);

    // desmontou aberto (a tela trocou ou o pai deixou de renderizar): fecha e devolve o foco
    useEffect(() => {
        const d = ref.current;
        return () => {
            if (d?.open) {
                d.close();
                devolverFoco();
            }
        };
    }, []);

    const props = {
        ref,
        onCancel: (e) => {
            e.preventDefault();
            onFechar?.();
        },
        onMouseDown: (e) => {
            cliqueComecouFora.current = e.target === ref.current;
        },
        onClick: (e) => {
            if (e.target === ref.current && cliqueComecouFora.current) onFechar?.();
        },
    };

    return props;
}

export function BotaoFechar({ onClick, rotulo = 'Fechar' }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={rotulo}
            className="p-2 -m-2 text-apoio hover:text-tinta cursor-pointer"
        >
            <IconeFechar />
        </button>
    );
}

/** Janela central. Conteúdo só monta quando aberta, assim o formulário volta limpo a cada vez. */
export function Modal({ aberto, onFechar, titulo, descricao, children, largura = 'max-w-lg' }) {
    const id = useId();
    const dialogo = useDialogo(aberto, onFechar);

    return (
        <dialog
            {...dialogo}
            aria-labelledby={`${id}-titulo`}
            aria-describedby={descricao ? `${id}-desc` : undefined}
            className={`admin-dialogo m-auto p-0 border-0 bg-transparent w-[calc(100%-2rem)] ${largura} max-h-[calc(100dvh-2rem)] text-tinta`}
        >
            {aberto && (
                <div className="bg-papel border border-filete-claro">
                    <div className="flex items-start justify-between gap-4 px-6 pt-6">
                        <div>
                            <h2 id={`${id}-titulo`} className="text-xl font-medium">{titulo}</h2>
                            {descricao && <p id={`${id}-desc`} className="text-sm text-apoio mt-1">{descricao}</p>}
                        </div>
                        <BotaoFechar onClick={onFechar} />
                    </div>
                    <div className="px-6 pb-6 pt-5">{children}</div>
                </div>
            )}
        </dialog>
    );
}

/** Confirmação para ações que não têm volta. */
export function ConfirmModal({
    aberto,
    onFechar,
    onConfirmar,
    titulo,
    children,
    rotuloConfirmar = 'Confirmar',
    perigo = true,
    processando = false,
}) {
    const id = useId();
    const dialogo = useDialogo(aberto, processando ? undefined : onFechar);

    return (
        <dialog
            {...dialogo}
            role="alertdialog"
            aria-labelledby={`${id}-titulo`}
            aria-describedby={`${id}-desc`}
            className="admin-dialogo m-auto p-0 border-0 bg-transparent w-[calc(100%-2rem)] max-w-md text-tinta"
        >
            {aberto && (
                <div className="bg-papel border border-filete-claro p-6">
                    <div className="flex gap-3">
                        {perigo && <IconeAlerta className="text-caneta-creme mt-1" />}
                        <div>
                            <h2 id={`${id}-titulo`} className="text-lg font-medium">{titulo}</h2>
                            <div id={`${id}-desc`} className="text-sm mt-2 text-tinta/80 space-y-2">{children}</div>
                        </div>
                    </div>
                    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-6">
                        <Botao variante="secundario" onClick={onFechar} disabled={processando} data-autofocus>
                            Cancelar
                        </Botao>
                        <Botao variante={perigo ? 'perigo' : 'primario'} onClick={onConfirmar} carregando={processando}>
                            {rotuloConfirmar}
                        </Botao>
                    </div>
                </div>
            )}
        </dialog>
    );
}
