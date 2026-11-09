// Tela de outra conta: o aparelho guarda clientes de uma conta e outra acabou de
// entrar. Aparece antes de qualquer cliente; nada foi gravado da conta nova.
// Fundo grafite como nas telas de acesso. O acento vermelho aparece uma vez só,
// no filete acima do título; o botão vermelho da confirmação é outra camada.

import { useState } from 'react';
import { apagarDadosEEntrar } from '../dados/acesso.js';
import { exportarBackup } from '../dados/backup.js';
import { nomeDoArquivoDeCopia, textoDaCopia } from '../regras/copia.js';
import { hojeEmFortaleza } from '../regras/datas.js';
import { baixarArquivo } from '../ui/baixarArquivo.js';
import Confirmar from '../ui/Confirmar.jsx';

const BOTAO =
    'flex min-h-[48px] w-full items-center justify-center bg-papel px-4 text-base font-medium text-grafite disabled:opacity-60';
const BOTAO_CONTORNO =
    'flex min-h-[48px] w-full items-center justify-center border border-papel px-4 text-base font-medium text-papel disabled:opacity-60';
const LINK_DISCRETO = 'flex min-h-[44px] items-center text-sm text-apoio underline underline-offset-4';

const ERRO_BAIXAR = 'Não deu para baixar a cópia agora. Tente de novo.';
const ERRO_APAGAR = 'Não deu para apagar agora. Nada foi alterado.';

// Props: `dono` (e-mail mascarado da conta dona dos dados, ou '' quando não há
// e-mail reconhecível), `email` (e-mail da conta que tentou entrar),
// `pendente` (a entrada da conta nova, só em memória), `aoVoltar()`, que pode
// devolver uma Promise, e `aoLiberar(usuario)`, chamado depois de apagar.
export default function OutraConta({ dono, email, pendente, aoVoltar, aoLiberar }) {
    // 'parado' | 'voltando' | 'baixando' | 'apagando'
    const [etapa, setEtapa] = useState('parado');
    const [confirmando, setConfirmando] = useState(false);
    const [aviso, setAviso] = useState('');
    const [erro, setErro] = useState('');
    const temDono = typeof dono === 'string' && dono.includes('@');
    const ocupado = etapa !== 'parado';

    function limpar() {
        setAviso('');
        setErro('');
    }

    async function voltar() {
        if (ocupado) return;
        setEtapa('voltando');
        try {
            await aoVoltar?.();
        } finally {
            setEtapa('parado');
        }
    }

    async function baixar() {
        if (ocupado) return;
        limpar();
        setEtapa('baixando');
        try {
            const dados = await exportarBackup();
            baixarArquivo(nomeDoArquivoDeCopia(hojeEmFortaleza()), textoDaCopia(dados), 'application/json');
            setAviso('Cópia baixada.');
        } catch {
            setErro(ERRO_BAIXAR);
        } finally {
            setEtapa('parado');
        }
    }

    function pedirConfirmacao() {
        if (ocupado) return;
        limpar();
        setConfirmando(true);
    }

    function desistir() {
        if (etapa === 'apagando') return;
        setConfirmando(false);
    }

    async function apagar() {
        if (etapa === 'apagando') return;
        setEtapa('apagando');
        let usuario;
        try {
            usuario = await apagarDadosEEntrar(pendente);
        } catch {
            setErro(ERRO_APAGAR);
            setConfirmando(false);
            setEtapa('parado');
            return;
        }
        aoLiberar?.(usuario);
    }

    const daConta = temDono ? `da conta ${dono}` : 'da outra conta';

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
                    <span className="wrap-anywhere">{email}</span>, eles precisam sair deste aparelho. Se forem
                    seus, baixe uma cópia antes.
                </p>

                <div className="flex flex-col gap-2">
                    <button type="button" onClick={baixar} disabled={ocupado} className={BOTAO}>
                        {etapa === 'baixando' ? 'Montando a cópia...' : 'Baixar cópia'}
                    </button>
                    <button type="button" onClick={pedirConfirmacao} disabled={ocupado} className={BOTAO_CONTORNO}>
                        Apagar e entrar
                    </button>
                </div>

                <div className="flex flex-col gap-3">
                    <div role="status">{aviso && <p>{aviso}</p>}</div>
                    {erro && (
                        <p role="alert" className="border-l-2 border-papel pl-3">
                            {erro}
                        </p>
                    )}
                    <button
                        type="button"
                        onClick={voltar}
                        disabled={ocupado}
                        className={`${LINK_DISCRETO} self-start disabled:opacity-60`}
                    >
                        Voltar
                    </button>
                </div>
            </main>

            <Confirmar
                aberto={confirmando}
                titulo="Apagar os dados da outra conta?"
                texto={`Clientes, pendências e ajustes ${daConta} saem deste aparelho. Isso não tem volta.`}
                rotuloConfirmar={etapa === 'apagando' ? 'Apagando...' : 'Apagar e entrar'}
                rotuloVoltar="Voltar"
                destrutivo
                aoConfirmar={apagar}
                aoVoltar={desistir}
            />
        </div>
    );
}
