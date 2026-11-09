// Moldura da ferramenta: área de conteúdo e barra inferior fixa com Hoje, Clientes e Ajustes.
// Sem acento vermelho aqui: ele fica livre para as telas.

const ITENS = [
    { chave: 'hoje', rotulo: 'Hoje', href: '#/hoje', telas: ['hoje', 'mensagem'] },
    { chave: 'clientes', rotulo: 'Clientes', href: '#/clientes', telas: ['clientes', 'cliente', 'novo'] },
    { chave: 'ajustes', rotulo: 'Ajustes', href: '#/ajustes', telas: ['ajustes'] },
];

// Props: `rota` ({ tela, params } vindo de useRota) e `children` (a tela atual).
export default function Moldura({ rota, children }) {
    const tela = rota?.tela;

    return (
        <div className="min-h-dvh bg-creme text-tinta">
            <main className="mx-auto w-full max-w-xl px-4 pt-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
                {children}
            </main>

            <nav
                aria-label="Principal"
                className="fixed inset-x-0 bottom-0 border-t border-filete bg-grafite pb-[env(safe-area-inset-bottom)]"
            >
                <ul className="mx-auto flex max-w-xl">
                    {ITENS.map((item) => {
                        const ativo = item.telas.includes(tela);
                        return (
                            <li key={item.chave} className="flex-1">
                                <a
                                    href={item.href}
                                    aria-current={ativo ? 'page' : undefined}
                                    className={`flex min-h-[56px] items-center justify-center px-2 text-base ${
                                        ativo ? 'font-medium text-papel' : 'font-light text-apoio'
                                    }`}
                                >
                                    {item.rotulo}
                                </a>
                            </li>
                        );
                    })}
                </ul>
            </nav>
        </div>
    );
}
