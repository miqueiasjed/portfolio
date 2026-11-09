// Telas de acesso: aparecem enquanto a ferramenta não está liberada neste aparelho.
// Fundo grafite. O acento vermelho aparece uma vez só, no filete acima do título.

import { useState } from 'react';
import { confirmarCodigo, pedirCodigo } from '../dados/acesso.js';

const MENSAGEM_SUPORTE = 'Oi, Miquéias! Meu acesso à Rotina do Dia não está ativo.';
const LINK_SUPORTE = `https://wa.me/5585994181234?text=${encodeURIComponent(MENSAGEM_SUPORTE)}`;

const BOTAO =
    'flex min-h-[48px] w-full items-center justify-center bg-papel px-4 text-base font-medium text-grafite';

const CAMPO =
    'min-h-[48px] w-full border border-filete bg-transparent px-3 text-base text-papel placeholder:text-apoio';

const LINK_DISCRETO = 'flex min-h-[44px] items-center text-sm text-apoio underline underline-offset-4';

// A meta csrf-token da casca. As rotas do código estão fora do CSRF, então a
// meta velha do cache não atrapalha; vai só como reforço.
function csrfDaCasca() {
    if (typeof document === 'undefined') return undefined;
    return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || undefined;
}

// Estado `entrar`: código por e-mail em dois passos, que funciona no app
// adicionado à tela de início; o link mágico fica como segunda opção.
function Entrar({ aoLiberar, aoOutraConta }) {
    const [passo, setPasso] = useState('email');
    const [email, setEmail] = useState('');
    // E-mail que de fato foi enviado: o passo 2 e a confirmação usam este, não o campo.
    const [enviado, setEnviado] = useState('');
    const [codigo, setCodigo] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [erro, setErro] = useState('');
    const [aviso, setAviso] = useState('');

    async function receber(evento) {
        evento?.preventDefault();
        if (enviando) return;
        setEnviando(true);
        setErro('');
        setAviso('');
        const alvo = passo === 'codigo' ? enviado : email.trim();
        const r = await pedirCodigo({ email: alvo, csrf: csrfDaCasca() });
        setEnviando(false);
        if (r === true) {
            setEnviado(alvo);
            if (passo === 'codigo') {
                setCodigo('');
                setAviso('Mandamos outro código. Use o do e-mail mais recente.');
            }
            setPasso('codigo');
            return;
        }
        setErro(r.erro);
    }

    async function entrar(evento) {
        evento.preventDefault();
        if (enviando) return;
        setEnviando(true);
        setErro('');
        setAviso('');
        const r = await confirmarCodigo({ email: enviado, codigo, csrf: csrfDaCasca() });
        if (r.estado === 'liberado') {
            aoLiberar?.(r.usuario);
            return;
        }
        if (r.estado === 'outra_conta') {
            // O aparelho guarda clientes de outra conta: nada foi gravado, o App decide.
            aoOutraConta?.(r);
            return;
        }
        setEnviando(false);
        setErro(r.erro);
    }

    function trocarEmail() {
        setPasso('email');
        setCodigo('');
        setErro('');
        setAviso('');
    }

    const mensagens = (
        <>
            {erro && (
                <p role="alert" className="text-papel">
                    {erro}
                </p>
            )}
            {aviso && (
                <p role="status" className="text-apoio">
                    {aviso}
                </p>
            )}
        </>
    );

    return (
        <>
            {passo === 'email' ? (
                <form onSubmit={receber} noValidate className="flex flex-col gap-4">
                    <label htmlFor="rotina-email">Digite o e-mail da compra.</label>
                    <input
                        id="rotina-email"
                        type="email"
                        autoComplete="email"
                        autoCapitalize="none"
                        spellCheck={false}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={enviando}
                        className={CAMPO}
                    />
                    {mensagens}
                    <button type="submit" disabled={enviando} className={`${BOTAO} disabled:opacity-60`}>
                        {enviando ? 'Enviando...' : 'Receber código'}
                    </button>
                </form>
            ) : (
                <form onSubmit={entrar} noValidate className="flex flex-col gap-4">
                    <p>
                        Mandamos um código de 6 dígitos para <span className="wrap-anywhere">{enviado}</span>.
                    </p>
                    <p className="text-sm text-apoio">Se este e-mail tiver uma compra, o código chega em instantes.</p>
                    <label htmlFor="rotina-codigo" className="sr-only">
                        Código de 6 dígitos
                    </label>
                    <input
                        id="rotina-codigo"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        autoFocus
                        value={codigo}
                        // Sem maxLength: colar "123 456" chega inteiro ao filtro, que tira o espaço e corta em 6.
                        onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className={`${CAMPO} tracking-[0.3em]`}
                    />
                    {mensagens}
                    <button type="submit" disabled={enviando} className={`${BOTAO} disabled:opacity-60`}>
                        {enviando ? 'Entrando...' : 'Entrar'}
                    </button>
                    <div className="flex flex-wrap gap-x-6">
                        <button
                            type="button"
                            onClick={receber}
                            disabled={enviando}
                            className={`${LINK_DISCRETO} disabled:opacity-60`}
                        >
                            Mandar outro código
                        </button>
                        <button
                            type="button"
                            onClick={trocarEmail}
                            disabled={enviando}
                            className={`${LINK_DISCRETO} disabled:opacity-60`}
                        >
                            Trocar e-mail
                        </button>
                    </div>
                </form>
            )}
            <a href="/rotina/entrar" className={`${LINK_DISCRETO} self-start`}>
                Prefere entrar pelo link do e-mail?
            </a>
        </>
    );
}

function Inativo() {
    return (
        <>
            <p>Seu acesso não está ativo.</p>
            <a href={LINK_SUPORTE} target="_blank" rel="noopener noreferrer" className={BOTAO}>
                Falar com o Miquéias no WhatsApp
            </a>
        </>
    );
}

function SemRede({ aoTentarDeNovo }) {
    return (
        <>
            <p>Sem conexão. Conecte o aparelho uma vez para confirmar seu acesso.</p>
            <button type="button" onClick={aoTentarDeNovo} className={BOTAO}>
                Tentar de novo
            </button>
        </>
    );
}

function Erro({ aoTentarDeNovo }) {
    return (
        <>
            <p>Não consegui abrir os dados deste aparelho. Feche outras abas da Rotina do Dia e tente de novo.</p>
            <button type="button" onClick={aoTentarDeNovo} className={BOTAO}>
                Tentar de novo
            </button>
        </>
    );
}

const CONTEUDOS = { entrar: Entrar, inativo: Inativo, sem_rede: SemRede, erro: Erro };

// Props: `estado` ('entrar' | 'inativo' | 'sem_rede' | 'erro'), `aoTentarDeNovo()`,
// `aoLiberar(usuario)`, que põe a ferramenta no estado liberado, e
// `aoOutraConta(resultado)`, que repassa ao App o `outra_conta` do código por e-mail.
export default function Acesso({ estado, aoTentarDeNovo, aoLiberar, aoOutraConta }) {
    const Conteudo = CONTEUDOS[estado] ?? Entrar;

    return (
        <div className="fundo-escuro flex min-h-dvh items-center bg-grafite text-papel">
            <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-10">
                <div>
                    <span aria-hidden="true" className="mb-4 block h-0.5 w-10 bg-caneta" />
                    <h1 className="text-2xl font-medium">Rotina do Dia</h1>
                </div>
                <Conteudo aoTentarDeNovo={aoTentarDeNovo} aoLiberar={aoLiberar} aoOutraConta={aoOutraConta} />
            </main>
        </div>
    );
}
