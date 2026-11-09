import { useId, useState } from 'react';
import { real } from './util';

/**
 * Barras verticais em SVG. Passar o mouse (ou focar e usar as setas) mostra o dia e o valor.
 * itens: [{rotulo, valor, dia}]
 */
export default function GraficoBarras({ itens, formatar = real, altura = 180, titulo = 'Gráfico' }) {
    const [ativo, setAtivo] = useState(null);
    const id = useId();
    const max = Math.max(...itens.map((i) => i.valor), 0);
    const total = itens.length;
    const largura = 100 / total;
    const folga = largura * 0.22;
    const atual = ativo !== null ? itens[ativo] : null;

    function teclado(e) {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
        e.preventDefault();
        setAtivo((a) => {
            if (e.key === 'Home') return 0;
            if (e.key === 'End') return total - 1;
            if (a === null) return total - 1;
            return e.key === 'ArrowLeft' ? Math.max(0, a - 1) : Math.min(total - 1, a + 1);
        });
    }

    const meio = Math.floor((total - 1) / 2);

    return (
        <figure className="relative" aria-labelledby={`${id}-leg`}>
            <figcaption id={`${id}-leg`} className="sr-only">
                {titulo}. Use as setas para ver cada dia.
            </figcaption>
            <div className="flex">
                <div className="w-20 shrink-0 flex flex-col justify-between text-[11px] text-apoio pr-3 text-right tabular-nums" style={{ height: altura }} aria-hidden="true">
                    <span>{max > 0 ? formatar(max) : ''}</span>
                    <span>{formatar(0)}</span>
                </div>
                <div
                    className="relative flex-1 outline-offset-4"
                    style={{ height: altura }}
                    tabIndex={0}
                    role="group"
                    aria-roledescription="gráfico de barras"
                    aria-label={atual ? `${atual.rotulo}: ${formatar(atual.valor)}` : titulo}
                    onKeyDown={teclado}
                    onBlur={() => setAtivo(null)}
                    onMouseLeave={() => setAtivo(null)}
                >
                    <svg viewBox={`0 0 100 ${altura}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full overflow-visible" aria-hidden="true">
                        <line x1="0" x2="100" y1={altura - 0.5} y2={altura - 0.5} className="stroke-filete-claro" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                        <line x1="0" x2="100" y1="0.5" y2="0.5" className="stroke-filete-claro" strokeWidth="1" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
                        {itens.map((item, i) => {
                            const h = max > 0 ? (item.valor / max) * (altura - 2) : 0;
                            const visivel = item.valor > 0 ? Math.max(h, 2) : 0;
                            return (
                                <g key={item.dia ?? i}>
                                    <rect
                                        x={i * largura}
                                        y={0}
                                        width={largura}
                                        height={altura}
                                        fill="transparent"
                                        onMouseEnter={() => setAtivo(i)}
                                    />
                                    <rect
                                        x={i * largura + folga / 2}
                                        y={altura - 1 - visivel}
                                        width={largura - folga}
                                        height={visivel}
                                        className={ativo === i ? 'fill-caneta' : 'fill-grafite'}
                                        pointerEvents="none"
                                    />
                                </g>
                            );
                        })}
                    </svg>
                    {atual && (
                        <div
                            className="absolute -top-2 -translate-y-full -translate-x-1/2 bg-grafite text-papel text-xs px-2.5 py-1.5 whitespace-nowrap pointer-events-none z-10"
                            style={{ left: `${Math.min(Math.max((ativo + 0.5) * largura, 8), 92)}%` }}
                            aria-hidden="true"
                        >
                            <span className="text-apoio">{atual.rotulo}</span> <span className="font-medium ml-1">{formatar(atual.valor)}</span>
                        </div>
                    )}
                </div>
            </div>
            <div className="flex justify-between text-[11px] text-apoio mt-2 pl-20" aria-hidden="true">
                <span>{itens[0]?.rotulo}</span>
                <span>{itens[meio]?.rotulo}</span>
                <span>{itens[total - 1]?.rotulo}</span>
            </div>
            <table className="sr-only">
                <caption>{titulo}</caption>
                <tbody>
                    {itens.map((item, i) => (
                        <tr key={i}>
                            <th scope="row">{item.rotulo}</th>
                            <td>{formatar(item.valor)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </figure>
    );
}
