import { Head, Link, router, usePage } from '@inertiajs/react';

export function Ponto() {
    return <span className="text-caneta">.</span>;
}

export default function Layout({ titulo, children, escuro = false }) {
    const { usuario } = usePage().props;

    return (
        <div className={escuro ? 'bg-grafite text-papel min-h-screen flex flex-col' : 'min-h-screen flex flex-col'}>
            <Head title={titulo} />
            <header className="bg-grafite text-papel">
                <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between gap-4">
                    <Link href={usuario ? '/' : '/entrar'} className="rotulo !text-papel no-underline">
                        Miquéias Mesquita
                    </Link>
                    {usuario && (
                        <div className="flex items-center gap-4 text-sm">
                            <span className="text-apoio hidden sm:inline">{usuario.email}</span>
                            <button
                                onClick={() => router.post('/sair')}
                                className="text-papel underline underline-offset-4 decoration-filete cursor-pointer"
                            >
                                Sair
                            </button>
                        </div>
                    )}
                </div>
            </header>
            <main className="flex-1">{children}</main>
            <footer className="bg-grafite text-apoio border-t border-filete">
                <div className="max-w-4xl mx-auto px-6 py-6 rotulo">
                    <b className="text-papel font-medium">Miquéias Mesquita</b> · Engenheiro de Operações Digitais
                </div>
            </footer>
        </div>
    );
}
