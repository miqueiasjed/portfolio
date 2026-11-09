import { Head, Link, router, usePage } from '@inertiajs/react';

export function Ponto() {
    return <span className="text-caneta">.</span>;
}

const foco = 'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-caneta';

// largo: páginas que precisam de mais espaço horizontal (player de aula)
export default function Layout({ titulo, children, escuro = false, largo = false }) {
    const { usuario } = usePage().props;
    const largura = largo ? 'max-w-6xl' : 'max-w-4xl';

    return (
        <div className={escuro ? 'bg-grafite text-papel min-h-screen flex flex-col' : 'min-h-screen flex flex-col'}>
            <Head title={titulo} />
            <a
                href="#conteudo"
                className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:bg-papel focus:text-grafite focus:px-4 focus:py-2 focus:font-medium"
            >
                Pular para o conteúdo
            </a>
            {/* links do cabeçalho com 44 px de toque; a margem negativa devolve a altura original do cabeçalho */}
            <header className="bg-grafite text-papel">
                <div className={`${largura} mx-auto px-6 py-5 flex items-center justify-between gap-4`}>
                    <Link href={usuario ? '/' : '/entrar'} className={`rotulo !text-papel no-underline inline-flex items-center min-h-11 -my-3.5 ${foco}`}>
                        Miquéias Mesquita
                    </Link>
                    {usuario && (
                        <div className="flex items-center gap-4 text-sm">
                            <span className="text-apoio hidden sm:inline">{usuario.email}</span>
                            <button
                                type="button"
                                onClick={() => router.post('/sair')}
                                className={`text-papel underline underline-offset-4 decoration-filete cursor-pointer inline-flex items-center min-h-11 min-w-11 justify-center -my-3 -mx-2 px-2 ${foco}`}
                            >
                                Sair
                            </button>
                        </div>
                    )}
                </div>
            </header>
            <main id="conteudo" tabIndex={-1} className="flex-1 outline-none">{children}</main>
            <footer className="bg-grafite text-apoio border-t border-filete">
                <div className={`${largura} mx-auto px-6 py-6 rotulo`}>
                    <b className="text-papel font-medium">Miquéias Mesquita</b> · Desenvolvedor de sistemas para operações
                </div>
            </footer>
        </div>
    );
}
