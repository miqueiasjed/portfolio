import { router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { IconeBusca, IconeFechar } from './icones';
import { semVazios } from './util';

/**
 * Filtros que vivem na URL. Selects e datas aplicam na hora; o texto da busca espera
 * o usuário parar de digitar.
 */
export function useFiltros(url, iniciais, { campoTexto = 'busca', espera = 400 } = {}) {
    const [valores, setValores] = useState(iniciais);
    const timer = useRef(null);

    function aplicar(novos) {
        clearTimeout(timer.current);
        router.get(url, semVazios(novos), { preserveState: true, preserveScroll: true, replace: true });
    }

    function mudar(campo, valor) {
        const novos = { ...valores, [campo]: valor };
        setValores(novos);
        if (campo === campoTexto) {
            clearTimeout(timer.current);
            timer.current = setTimeout(() => aplicar(novos), espera);
        } else {
            aplicar(novos);
        }
    }

    function limpar() {
        const vazios = Object.fromEntries(Object.keys(valores).map((k) => [k, '']));
        setValores(vazios);
        aplicar(vazios);
    }

    useEffect(() => () => clearTimeout(timer.current), []);

    const ativos = Object.values(iniciais).filter((v) => v !== '' && v !== null).length;

    return { valores, mudar, aplicar: () => aplicar(valores), limpar, ativos };
}

/** Campo de busca com ícone e botão para limpar. */
export function CampoBusca({ valor, onChange, rotulo = 'Buscar', placeholder, onEnter, className = '' }) {
    return (
        <div className={className}>
            <label className="sr-only" htmlFor="admin-busca">{rotulo}</label>
            <div className="flex items-center bg-white border border-filete-claro focus-within:border-tinta">
                <IconeBusca className="ml-3 text-apoio" tamanho={16} />
                <input
                    id="admin-busca"
                    type="search"
                    value={valor}
                    placeholder={placeholder}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            onEnter?.();
                        }
                    }}
                    className="flex-1 min-w-0 px-3 py-2.5 text-sm outline-none bg-transparent [&::-webkit-search-cancel-button]:hidden"
                />
                {valor && (
                    <button type="button" onClick={() => onChange('')} aria-label="Limpar busca" className="p-2 mr-1 text-apoio hover:text-tinta cursor-pointer">
                        <IconeFechar tamanho={14} />
                    </button>
                )}
            </div>
        </div>
    );
}
