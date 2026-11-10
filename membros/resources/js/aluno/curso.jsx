import { Link } from '@inertiajs/react';
import { useEffect, useId, useMemo, useState } from 'react';

// arquivo .jsx de propósito: o Tailwind só varre resources/js/**/*.jsx atrás de classes
export const foco = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-caneta';
// para itens dentro de listas com rolagem, onde o contorno de fora seria cortado
export const focoDentro = 'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-caneta';

export const urlAula = (slug, id) => `/produtos/${slug}/aulas/${id}`;

export function duracao(minutos) {
    if (!minutos) return null;
    if (minutos < 60) return `${minutos} min`;
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    return m ? `${h} h ${String(m).padStart(2, '0')} min` : `${h} h`;
}

export function contagem(concluidas, total) {
    return `${concluidas} de ${total} ${total === 1 ? 'aula' : 'aulas'}`;
}

export function concluidasTexto(concluidas, total) {
    return `${contagem(concluidas, total)} ${total === 1 ? 'concluída' : 'concluídas'}`;
}

export function BarraProgresso({ percentual, escuro = false, rotulo = 'Progresso do curso' }) {
    return (
        <div
            role="progressbar"
            aria-label={rotulo}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percentual}
            className={`h-1 w-full ${escuro ? 'bg-filete' : 'bg-filete-claro'}`}
        >
            <div className="h-full bg-caneta transition-[width] duration-500" style={{ width: `${percentual}%` }} />
        </div>
    );
}

export function IconeCheck({ className = 'w-4 h-4' }) {
    return (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden="true">
            <path d="M3 8.5l3 3 7-7" strokeLinecap="square" />
        </svg>
    );
}

export function IconeSeta({ aberto, className = 'w-4 h-4' }) {
    return (
        <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            className={`${className} transition-transform ${aberto ? 'rotate-180' : ''}`}
            aria-hidden="true"
        >
            <path d="M4 6l4 4 4-4" strokeLinecap="square" />
        </svg>
    );
}

export function IconeArquivo({ className = 'w-3.5 h-3.5' }) {
    return (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" className={className} aria-hidden="true">
            <path d="M4 1.5h5.5L12.5 4.5v10h-8.5z M9.5 1.5v3h3" strokeLinejoin="miter" />
        </svg>
    );
}

/**
 * Lista do curso em acordeão: módulos com as aulas numeradas na ordem do curso.
 * Abre o módulo da aula atual (ou da próxima, ou o primeiro).
 */
export function ListaCurso({ slug, modulos, atualId = null, proximaId = null, escuro = false }) {
    const base = useId();

    const numero = useMemo(() => {
        const mapa = {};
        let n = 0;
        modulos.forEach((m) => m.aulas.forEach((a) => { mapa[a.id] = ++n; }));
        return mapa;
    }, [modulos]);

    const alvo = useMemo(() => {
        const procurado = atualId ?? proximaId;
        return (modulos.find((m) => m.aulas.some((a) => a.id === procurado)) ?? modulos[0])?.id;
    }, [modulos, atualId, proximaId]);

    const [abertos, setAbertos] = useState(() => new Set(alvo ? [alvo] : []));

    // trocou de aula: garante o módulo dela aberto, sem fechar os que a pessoa abriu
    useEffect(() => {
        if (alvo) setAbertos((s) => (s.has(alvo) ? s : new Set(s).add(alvo)));
    }, [alvo]);

    function alternar(id) {
        setAbertos((s) => {
            const novo = new Set(s);
            novo.has(id) ? novo.delete(id) : novo.add(id);
            return novo;
        });
    }

    const filete = escuro ? 'border-filete' : 'border-filete-claro';
    // cinza de apoio só sobre grafite; sobre creme fica abaixo do contraste legível
    const fraco = escuro ? 'text-apoio' : 'text-tinta';
    const hover = escuro ? 'hover:bg-white/5' : 'hover:bg-white';

    return (
        <div className={`border-t ${filete}`}>
            {modulos.map((m, i) => {
                const aberto = abertos.has(m.id);
                const feitas = m.aulas.filter((a) => a.concluida).length;
                const painel = `${base}-modulo-${m.id}`;

                return (
                    <div key={m.id} className={`border-b ${filete}`}>
                        <h3>
                            <button
                                type="button"
                                onClick={() => alternar(m.id)}
                                aria-expanded={aberto}
                                aria-controls={painel}
                                className={`w-full flex items-center gap-4 text-left px-4 py-4 cursor-pointer ${hover} ${focoDentro}`}
                            >
                                <span className="flex-1 min-w-0">
                                    <span className={`block rotulo mb-1 ${fraco}`}>Módulo {i + 1}</span>
                                    <span className="block font-medium leading-snug">{m.titulo}</span>
                                </span>
                                <span className={`text-xs shrink-0 ${feitas === m.aulas.length ? 'text-caneta' : fraco}`}>
                                    {feitas}/{m.aulas.length}
                                </span>
                                <IconeSeta aberto={aberto} className={`w-4 h-4 shrink-0 ${fraco}`} />
                            </button>
                        </h3>

                        <ol id={painel} hidden={!aberto} className="pb-2">
                            {m.aulas.map((a) => {
                                const atual = a.id === atualId;
                                const ehProxima = a.id === proximaId && !atual;

                                return (
                                    <li key={a.id}>
                                        <Link
                                            href={urlAula(slug, a.id)}
                                            aria-current={atual ? 'page' : undefined}
                                            className={`flex items-start gap-3 px-4 py-3 no-underline border-l-2 ${focoDentro} ${
                                                atual
                                                    ? `border-caneta ${escuro ? 'bg-white/10 text-papel' : 'bg-white text-tinta'}`
                                                    : `border-transparent ${escuro ? 'text-papel' : 'text-tinta'} ${hover}`
                                            }`}
                                        >
                                            <span
                                                className={`w-6 h-6 shrink-0 flex items-center justify-center text-xs border ${
                                                    a.concluida ? 'bg-caneta border-caneta text-papel' : `${filete} ${fraco}`
                                                }`}
                                            >
                                                {a.concluida ? <IconeCheck className="w-3.5 h-3.5" /> : String(numero[a.id]).padStart(2, '0')}
                                            </span>
                                            <span className="flex-1 min-w-0">
                                                <span className={`block text-[15px] leading-snug ${atual ? 'font-medium' : ''}`}>{a.titulo}</span>
                                                <span className={`flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs ${fraco}`}>
                                                    {a.concluida && <span className="sr-only">Concluída.</span>}
                                                    {atual && <span className="text-caneta">Assistindo agora</span>}
                                                    {ehProxima && <span className="text-caneta">Próxima</span>}
                                                    {duracao(a.duracao_minutos) && <span>{duracao(a.duracao_minutos)}</span>}
                                                    {a.tem_anexo && (
                                                        <span className="inline-flex items-center gap-1">
                                                            <IconeArquivo /> Material
                                                        </span>
                                                    )}
                                                </span>
                                            </span>
                                        </Link>
                                    </li>
                                );
                            })}
                        </ol>
                    </div>
                );
            })}
        </div>
    );
}
