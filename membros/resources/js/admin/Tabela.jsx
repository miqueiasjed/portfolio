import { Children } from 'react';
import { relativo } from './util';

/** Tabela com filetes finos. As linhas vêm como filhos. */
export function Tabela({ colunas, children, vazio, rotulo }) {
    const temLinhas = Children.toArray(children).length > 0;

    return (
        <div className="border border-filete-claro bg-white overflow-x-auto">
            <table className="w-full text-sm" aria-label={rotulo}>
                <thead>
                    <tr className="text-left border-b border-filete-claro bg-papel/60">
                        {colunas.map((c, i) => (
                            <th key={i} scope="col" className={`rotulo !text-[11px] !font-normal px-4 py-3 whitespace-nowrap ${c.className ?? ''}`}>
                                {c.sr ? <span className="sr-only">{c.titulo}</span> : c.titulo}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {temLinhas ? (
                        children
                    ) : (
                        <tr>
                            <td colSpan={colunas.length} className="px-4 py-0">
                                {vazio}
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}

/** Linha que abre algo ao clicar. O elemento principal da linha continua sendo um botão ou link de verdade. */
export function Linha({ onClick, children, ativa = false, className = '' }) {
    return (
        <tr
            onClick={onClick}
            className={`border-b border-filete-claro last:border-0 align-top transition-colors ${onClick ? 'cursor-pointer hover:bg-creme' : ''} ${ativa ? 'bg-creme' : ''} ${className}`}
        >
            {children}
        </tr>
    );
}

export function Celula({ children, className = '', ...resto }) {
    return (
        <td className={`px-4 py-3 ${className}`} {...resto}>
            {children}
        </td>
    );
}

/** Estado vazio com uma frase útil e, se fizer sentido, uma ação. */
export function Vazio({ titulo, children, acao }) {
    return (
        <div className="py-12 px-4 text-center max-w-md mx-auto">
            <p className="font-medium text-tinta">{titulo}</p>
            {children && <p className="text-sm text-apoio mt-1.5">{children}</p>}
            {acao && <div className="mt-5 flex justify-center">{acao}</div>}
        </div>
    );
}

/** Valor ausente, sem travessão. */
export function SemDado({ children = 'sem dado' }) {
    return <span className="text-apoio">{children}</span>;
}

/** "há 3 dias", com a data exata no title. */
export function DataRelativa({ data, vazio = 'sem dado' }) {
    if (!data) return <SemDado>{vazio}</SemDado>;
    return (
        <time title={data} className="whitespace-nowrap">
            {relativo(data) ?? data}
        </time>
    );
}
