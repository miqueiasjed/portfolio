import { Head, Link, router, usePage } from '@inertiajs/react';
import { useEffect, useId, useState } from 'react';
import { Botao } from './Campos';
import { IconeAlunos, IconeCompras, IconeCursos, IconeMais, IconeMenu, IconeSair, IconeVisao } from './icones';
import { LiberarProvider, useLiberar } from './LiberarAcesso';
import { BotaoFechar, useDialogo } from './Modal';
import { ToastProvider, useToast } from './Toast';

const ITENS = [
    { href: '/admin', rotulo: 'Visão geral', icone: IconeVisao, exato: true },
    { href: '/admin/compras', rotulo: 'Compras', icone: IconeCompras },
    { href: '/admin/alunos', rotulo: 'Alunos', icone: IconeAlunos },
    { href: '/admin/cursos', rotulo: 'Cursos', icone: IconeCursos },
];

function caminho(url) {
    return (url ?? '').split('?')[0].replace(/\/+$/, '') || '/';
}

function estaAtivo(item, url) {
    const atual = caminho(url);
    return item.exato ? atual === item.href : atual === item.href || atual.startsWith(item.href + '/');
}

function Marca() {
    return (
        <Link href="/admin" className="block no-underline text-papel">
            <span className="block text-sm font-medium tracking-wide">Miquéias Mesquita</span>
            <span className="rotulo !text-[10px]">Membros · Administração</span>
        </Link>
    );
}

function Navegacao({ url }) {
    return (
        <nav aria-label="Administração" className="flex-1 px-3 py-6">
            <ul className="space-y-1">
                {ITENS.map((item) => {
                    const ativo = estaAtivo(item, url);
                    const Icone = item.icone;
                    return (
                        <li key={item.href}>
                            <Link
                                href={item.href}
                                aria-current={ativo ? 'page' : undefined}
                                className={`flex items-center gap-3 px-3 py-2.5 text-sm no-underline border-l-2 transition-colors ${
                                    ativo ? 'border-caneta bg-filete/50 text-papel font-medium' : 'border-transparent text-apoio hover:text-papel hover:bg-filete/30'
                                }`}
                            >
                                <Icone tamanho={18} />
                                {item.rotulo}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}

function Rodape({ usuario }) {
    return (
        <div className="border-t border-filete px-6 py-5">
            <p className="text-xs text-apoio truncate" title={usuario?.email}>{usuario?.email}</p>
            <button
                type="button"
                onClick={() => router.post('/admin/sair')}
                className="mt-3 inline-flex items-center gap-2 text-sm text-papel hover:text-caneta cursor-pointer"
            >
                <IconeSair tamanho={16} /> Sair
            </button>
        </div>
    );
}

function Lateral({ url, usuario }) {
    return (
        <>
            <div className="px-6 py-6 border-b border-filete">
                <Marca />
            </div>
            <Navegacao url={url} />
            <Rodape usuario={usuario} />
        </>
    );
}

/** No celular a lateral vira gaveta: Esc fecha, clicar fora fecha, navegar fecha. */
function GavetaMenu({ aberto, onFechar, url, usuario }) {
    const dialogo = useDialogo(aberto, onFechar);
    const id = useId();
    return (
        <dialog
            {...dialogo}
            aria-labelledby={`${id}-t`}
            className="admin-dialogo admin-gaveta-esquerda lg:hidden mr-auto ml-0 my-0 p-0 border-0 h-dvh max-h-dvh w-72 max-w-[85vw] bg-grafite text-papel"
        >
            {aberto && (
                <div className="h-full flex flex-col">
                    <h2 id={`${id}-t`} className="sr-only">Menu</h2>
                    <div className="absolute right-4 top-6 text-apoio">
                        <BotaoFechar onClick={onFechar} rotulo="Fechar menu" />
                    </div>
                    <Lateral url={url} usuario={usuario} />
                </div>
            )}
        </dialog>
    );
}

function Migalhas({ itens }) {
    if (!itens?.length) return null;
    return (
        <nav aria-label="Trilha" className="mb-1">
            <ol className="flex flex-wrap items-center gap-1.5 text-xs text-apoio">
                {itens.map((m, i) => (
                    <li key={i} className="flex items-center gap-1.5 min-w-0">
                        {i > 0 && <span aria-hidden="true">/</span>}
                        {m.href ? (
                            <Link href={m.href} className="no-underline hover:text-tinta truncate">{m.rotulo}</Link>
                        ) : (
                            <span aria-current="page" className="truncate">{m.rotulo}</span>
                        )}
                    </li>
                ))}
            </ol>
        </nav>
    );
}

// guarda a última página cujo aviso já virou toast, para não repetir quando o layout remonta
let paginaComAvisoMostrado = null;

function Casca({ titulo, migalhas, acoes, children }) {
    const pagina = usePage();
    const { usuario, aviso } = pagina.props;
    const { mostrar } = useToast();
    const { abrir } = useLiberar();
    const [menuAberto, setMenuAberto] = useState(false);

    useEffect(() => {
        if (pagina !== paginaComAvisoMostrado) {
            paginaComAvisoMostrado = pagina;
            if (aviso) mostrar(aviso);
        }
    }, [pagina, aviso, mostrar]);

    useEffect(() => router.on('start', () => setMenuAberto(false)), []);

    return (
        <div className="admin min-h-screen bg-creme">
            <Head title={`${titulo} · Admin`} />
            <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-papel focus:px-3 focus:py-2 focus:text-sm">
                Pular para o conteúdo
            </a>

            <aside className="hidden lg:flex fixed inset-y-0 left-0 w-60 flex-col bg-grafite text-papel">
                <Lateral url={pagina.url} usuario={usuario} />
            </aside>
            <GavetaMenu aberto={menuAberto} onFechar={() => setMenuAberto(false)} url={pagina.url} usuario={usuario} />

            <div className="lg:pl-60">
                <header className="sticky top-0 z-20 bg-creme/95 backdrop-blur-sm border-b border-filete-claro">
                    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-4 flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setMenuAberto(true)}
                            aria-label="Abrir menu"
                            aria-expanded={menuAberto}
                            className="lg:hidden -ml-1 p-2 text-tinta hover:bg-tinta/5 cursor-pointer"
                        >
                            <IconeMenu />
                        </button>
                        <div className="flex-1 min-w-0">
                            <Migalhas itens={migalhas} />
                            <h1 className="text-xl sm:text-2xl font-medium truncate">{titulo}</h1>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            {acoes}
                            <Botao onClick={() => abrir()} icone={IconeMais} aria-label="Liberar acesso" className="max-sm:!px-2.5">
                                <span className="hidden sm:inline">Liberar acesso</span>
                            </Botao>
                        </div>
                    </div>
                </header>
                <main id="conteudo" className="max-w-6xl mx-auto px-4 sm:px-8 py-8">
                    {children}
                </main>
            </div>
        </div>
    );
}

/** Moldura de todas as telas do admin: lateral, topo com título e ação global, toasts. */
export default function AdminLayout(props) {
    return (
        <ToastProvider>
            <LiberarProvider>
                <Casca {...props} />
            </LiberarProvider>
        </ToastProvider>
    );
}

/** Bloco com título, usado para dividir as telas em seções. */
export function Secao({ titulo, descricao, acao, children, className = '' }) {
    return (
        <section className={`mb-10 ${className}`}>
            {(titulo || acao) && (
                <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
                    <div>
                        {titulo && <h2 className="text-lg font-medium">{titulo}</h2>}
                        {descricao && <p className="text-sm text-apoio mt-0.5">{descricao}</p>}
                    </div>
                    {acao}
                </div>
            )}
            {children}
        </section>
    );
}
