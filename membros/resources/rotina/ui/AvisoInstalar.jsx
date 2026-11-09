// Faixa no topo para quem abre no Safari do iPhone/iPad sem ter adicionado à tela de início.
// Dados gravados no Safari não aparecem no app instalado, então o pedido vem antes do primeiro cadastro.
// Sem acento vermelho: a faixa é grafite com texto claro e deixa o acento livre para as telas.

import { useState } from 'react';
import { deveAvisar, ehAparelhoApple, estaInstalado } from './instalar.js';

const CHAVE = 'rotina-aviso-instalar-dispensado';

const PASSOS = [
    'Toque no botão de compartilhar do Safari.',
    'Escolha “Adicionar à Tela de Início”.',
    'Abra pelo ícone novo e entre com o código do e-mail.',
];

function lerDispensado() {
    try {
        return window.sessionStorage.getItem(CHAVE) === '1';
    } catch {
        return false;
    }
}

function gravarDispensado() {
    try {
        window.sessionStorage.setItem(CHAVE, '1');
    } catch {
        // Sem sessionStorage (modo privado, bloqueio): a faixa some só nesta tela.
    }
}

function precisaAvisar() {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;

    let displayModeStandalone = false;
    try {
        displayModeStandalone = window.matchMedia('(display-mode: standalone)').matches;
    } catch {
        displayModeStandalone = false;
    }

    return deveAvisar({
        apple: ehAparelhoApple({
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            maxTouchPoints: navigator.maxTouchPoints,
        }),
        instalado: estaInstalado({ standalone: navigator.standalone, displayModeStandalone }),
        dispensado: lerDispensado(),
    });
}

export default function AvisoInstalar() {
    const [visivel, setVisivel] = useState(precisaAvisar);
    const [aberto, setAberto] = useState(false);

    if (!visivel) return null;

    const dispensar = () => {
        gravarDispensado();
        setVisivel(false);
    };

    return (
        <aside
            aria-label="Adicionar à tela de início"
            className="fundo-escuro sticky top-0 z-10 border-b border-filete bg-grafite px-4 pt-[env(safe-area-inset-top)] text-papel"
        >
            <div className="mx-auto max-w-xl py-3">
                <p className="text-base">Antes de cadastrar seus clientes, adicione a Rotina do Dia à tela de início.</p>

                {aberto && (
                    <ol className="mt-3 list-decimal space-y-2 pl-5 text-base font-light">
                        {PASSOS.map((passo) => (
                            <li key={passo}>{passo}</li>
                        ))}
                    </ol>
                )}

                <div className="mt-2 flex">
                    <button
                        type="button"
                        aria-expanded={aberto}
                        onClick={() => setAberto((v) => !v)}
                        className="min-h-[44px] pr-4 text-base font-medium underline underline-offset-4"
                    >
                        {aberto ? 'Fechar passos' : 'Como fazer'}
                    </button>
                    <button
                        type="button"
                        onClick={dispensar}
                        className="min-h-[44px] px-4 text-base font-light text-apoio"
                    >
                        Agora não
                    </button>
                </div>
            </div>
        </aside>
    );
}
