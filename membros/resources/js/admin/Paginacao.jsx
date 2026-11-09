import { Link } from '@inertiajs/react';
import { numero } from './util';
import { IconeDescer } from './icones';

const opcoesVisita = { preserveState: true };

/** Paginação do Laravel em português. Ignora os rótulos em inglês de anterior e próxima. */
export default function Paginacao({ pagina, nome = 'itens' }) {
    if (!pagina || pagina.total === 0) return null;

    const numeros = (pagina.links ?? []).slice(1, -1);
    const base = 'min-w-9 h-9 px-2 inline-flex items-center justify-center text-sm border no-underline';

    return (
        <nav aria-label="Paginação" className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4">
            <p className="text-sm text-apoio">
                Mostrando {numero(pagina.from)} a {numero(pagina.to)} de {numero(pagina.total)} {nome}
            </p>
            {pagina.last_page > 1 && (
                <ul className="flex flex-wrap items-center gap-1">
                    <li>
                        {pagina.prev_page_url ? (
                            <Link href={pagina.prev_page_url} {...opcoesVisita} className={`${base} border-filete-claro bg-white hover:border-tinta gap-1`} rel="prev">
                                <IconeDescer tamanho={14} className="rotate-90" /> Anterior
                            </Link>
                        ) : (
                            <span className={`${base} border-filete-claro text-apoio gap-1`} aria-disabled="true">
                                <IconeDescer tamanho={14} className="rotate-90" /> Anterior
                            </span>
                        )}
                    </li>
                    {numeros.map((l, i) => (
                        <li key={i} className="hidden sm:block">
                            {l.url === null ? (
                                <span className="px-2 text-apoio">...</span>
                            ) : l.active ? (
                                <span aria-current="page" className={`${base} border-grafite bg-grafite text-papel`}>{l.label}</span>
                            ) : (
                                <Link href={l.url} {...opcoesVisita} className={`${base} border-filete-claro bg-white hover:border-tinta`} aria-label={`Página ${l.label}`}>
                                    {l.label}
                                </Link>
                            )}
                        </li>
                    ))}
                    <li className="sm:hidden px-2 text-sm text-apoio">
                        {pagina.current_page} de {pagina.last_page}
                    </li>
                    <li>
                        {pagina.next_page_url ? (
                            <Link href={pagina.next_page_url} {...opcoesVisita} className={`${base} border-filete-claro bg-white hover:border-tinta gap-1`} rel="next">
                                Próxima <IconeDescer tamanho={14} className="-rotate-90" />
                            </Link>
                        ) : (
                            <span className={`${base} border-filete-claro text-apoio gap-1`} aria-disabled="true">
                                Próxima <IconeDescer tamanho={14} className="-rotate-90" />
                            </span>
                        )}
                    </li>
                </ul>
            )}
        </nav>
    );
}
