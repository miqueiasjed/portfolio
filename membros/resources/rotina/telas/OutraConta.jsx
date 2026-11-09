// Tela de outra conta: o aparelho guarda clientes de uma conta e outra acabou de
// entrar. Aparece antes de qualquer cliente; nada foi gravado da conta nova.
// Fundo grafite como nas telas de acesso. O acento vermelho aparece uma vez só,
// no filete acima do título.

import { useState } from 'react';

const LINK_DISCRETO = 'flex min-h-[44px] items-center text-sm text-apoio underline underline-offset-4';

// Props: `dono` (e-mail mascarado da conta dona dos dados, ou '' quando não há
// e-mail reconhecível), `email` (e-mail da conta que tentou entrar) e
// `aoVoltar()`, que pode devolver uma Promise.
export default function OutraConta({ dono, email, aoVoltar }) {
    const [voltando, setVoltando] = useState(false);
    const temDono = typeof dono === 'string' && dono.includes('@');

    async function voltar() {
        if (voltando) return;
        setVoltando(true);
        try {
            await aoVoltar?.();
        } finally {
            setVoltando(false);
        }
    }

    return (
        <div className="fundo-escuro flex min-h-dvh items-center bg-grafite text-papel">
            <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-10">
                <div>
                    <span aria-hidden="true" className="mb-4 block h-0.5 w-10 bg-caneta" />
                    <h1 className="text-2xl font-medium">Este aparelho guarda os clientes de outra conta</h1>
                </div>
                <p>
                    {temDono ? (
                        <>
                            Os dados aqui são da conta <span className="wrap-anywhere">{dono}</span>.
                        </>
                    ) : (
                        'Os dados aqui são de outra conta.'
                    )}{' '}
                    Para entrar com{' '}
                    <span className="wrap-anywhere">{email}</span>, eles precisam sair deste aparelho.
                </p>
                <button
                    type="button"
                    onClick={voltar}
                    disabled={voltando}
                    className={`${LINK_DISCRETO} self-start disabled:opacity-60`}
                >
                    Voltar
                </button>
            </main>
        </div>
    );
}
