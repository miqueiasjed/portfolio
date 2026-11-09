// Telas de acesso: aparecem enquanto a ferramenta não está liberada neste aparelho.
// Fundo grafite. O acento vermelho aparece uma vez só, no filete acima do título.

const MENSAGEM_SUPORTE = 'Oi, Miquéias! Meu acesso à Rotina do Dia não está ativo.';
const LINK_SUPORTE = `https://wa.me/5585994181234?text=${encodeURIComponent(MENSAGEM_SUPORTE)}`;

const BOTAO =
    'flex min-h-[48px] w-full items-center justify-center bg-papel px-4 text-base font-medium text-grafite';

// Estado `entrar`. A task 2.13 acrescenta aqui a entrada por código, usando `aoLiberar`.
function Entrar() {
    return (
        <>
            <p>Para abrir a Rotina do Dia neste aparelho, entre com o e-mail da compra.</p>
            <a href="/rotina/entrar" className={BOTAO}>
                Entrar com meu e-mail
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

// Props: `estado` ('entrar' | 'inativo' | 'sem_rede' | 'erro'), `aoTentarDeNovo()`
// e `aoLiberar(usuario)`, que põe a ferramenta no estado liberado.
export default function Acesso({ estado, aoTentarDeNovo, aoLiberar }) {
    const Conteudo = CONTEUDOS[estado] ?? Entrar;

    return (
        <div className="flex min-h-dvh items-center bg-grafite text-papel">
            <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-10">
                <div>
                    <span aria-hidden="true" className="mb-4 block h-0.5 w-10 bg-caneta" />
                    <h1 className="text-2xl font-medium">Rotina do Dia</h1>
                </div>
                <Conteudo aoTentarDeNovo={aoTentarDeNovo} aoLiberar={aoLiberar} />
            </main>
        </div>
    );
}
