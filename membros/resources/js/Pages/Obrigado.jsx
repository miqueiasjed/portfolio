import { Link } from '@inertiajs/react';
import Layout, { Ponto } from '../Layout';
import { foco } from '../aluno/curso';

const ROTINA = 'rotina-do-dia';

const PASSOS_TELA_INICIAL = [
    { aparelho: 'iPhone', passo: 'Abra no Safari, toque no botão Compartilhar e escolha "Adicionar à Tela de Início".' },
    { aparelho: 'Android', passo: 'Abra no Chrome, toque no menu de três pontos e escolha "Adicionar à tela inicial" ou "Instalar app".' },
];

function TelaInicial() {
    return (
        <div className="mt-14 border-t border-filete pt-10">
            <p className="rotulo mb-4">Depois de abrir</p>
            <h2 className="text-2xl font-medium leading-tight mb-3">Deixe a ferramenta na tela do celular</h2>
            <p className="text-apoio max-w-xl">Assim ela abre com um toque, como um aplicativo. Basta fazer uma vez.</p>
            <dl className="mt-8 grid gap-6 sm:grid-cols-2">
                {PASSOS_TELA_INICIAL.map(({ aparelho, passo }) => (
                    <div key={aparelho} className="border-l border-filete pl-5">
                        <dt className="font-medium mb-1">{aparelho}</dt>
                        <dd className="text-apoio">{passo}</dd>
                    </div>
                ))}
            </dl>
        </div>
    );
}

export default function Obrigado({ paga, produto, slug }) {
    const rotina = slug === ROTINA;

    return (
        <Layout titulo="Obrigado" escuro>
            <section className="max-w-2xl mx-auto px-6 py-24">
                <p className="rotulo mb-4">{produto ?? 'Sua compra'}</p>
                <h1 className="text-4xl sm:text-5xl font-medium leading-tight mb-6">
                    {paga ? 'Pagamento confirmado' : 'Recebemos o seu pedido'}
                    <Ponto />
                </h1>
                <p className="text-lg text-apoio max-w-xl">
                    {/* "e-mail" sem quebra no hífen: em 375 px a linha partia em "e-" e "mail" */}
                    {paga ? (
                        <>O link de acesso já foi para o seu <span className="whitespace-nowrap">e-mail</span>. Clique nele para entrar na sua área.</>
                    ) : (
                        <>Assim que o pagamento for confirmado, o link de acesso chega no seu <span className="whitespace-nowrap">e-mail</span>. No Pix e no cartão isso costuma levar poucos minutos.</>
                    )}
                </p>
                {rotina && !paga && (
                    <p className="text-lg text-apoio max-w-xl mt-4">
                        Nesse mesmo e-mail vem o caminho para abrir a ferramenta.
                    </p>
                )}
                <p className="text-sm text-apoio mt-6">Não chegou? Olhe a caixa de spam ou peça um link novo.</p>
                {rotina && paga ? (
                    <>
                        <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
                            {/* link comum: a ferramenta fica fora do Inertia */}
                            <a href="/rotina/entrar" className={`btn-claro ${foco}`}>Abrir a ferramenta</a>
                            <Link
                                href="/entrar"
                                className={`inline-flex items-center min-h-11 font-medium text-papel underline underline-offset-4 decoration-filete ${foco}`}
                            >
                                Pedir link de entrada
                            </Link>
                        </div>
                        <TelaInicial />
                    </>
                ) : (
                    <div className="mt-10">
                        <Link href="/entrar" className="btn-claro">Pedir link de entrada</Link>
                    </div>
                )}
            </section>
        </Layout>
    );
}
