import { useId } from 'react';
import { BotaoFechar, useDialogo } from './Modal';

/** Painel lateral à direita, para detalhes e edição sem sair da lista. */
export default function Drawer({ aberto, onFechar, titulo, subtitulo, children, rodape, largura = 'max-w-xl' }) {
    const id = useId();
    const dialogo = useDialogo(aberto, onFechar);

    return (
        <dialog
            {...dialogo}
            aria-labelledby={`${id}-titulo`}
            className={`admin-dialogo admin-gaveta-direita ml-auto mr-0 my-0 p-0 border-0 bg-transparent h-dvh max-h-dvh w-full ${largura} text-tinta`}
        >
            {aberto && (
                <div className="h-full bg-papel border-l border-filete-claro flex flex-col">
                    <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-filete-claro">
                        <div className="min-w-0">
                            {subtitulo && <p className="rotulo mb-1">{subtitulo}</p>}
                            <h2 id={`${id}-titulo`} className="text-xl font-medium break-words">{titulo}</h2>
                        </div>
                        <BotaoFechar onClick={onFechar} />
                    </div>
                    <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>
                    {rodape && <div className="border-t border-filete-claro px-6 py-4 bg-creme">{rodape}</div>}
                </div>
            )}
        </dialog>
    );
}
