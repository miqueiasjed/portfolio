// Botão da ferramenta, nas três formas que as telas usam. Cantos retos, sem
// sombra, alvo de toque de pelo menos 44 px.
// - `principal`: acento vermelho. No máximo um por tela, e nenhum enquanto a
//   Confirmar destrutiva estiver aberta.
// - `secundario`: contorno na cor do texto, o mesmo da Confirmar e da tela Cliente.
// - `texto`: só o texto sublinhado, para ações de menos peso.

// Props:
// - `variante`: 'principal' | 'secundario' (padrão) | 'texto'.
// - `href`: com ele, vira <a>; sem ele, <button>.
// - `onClick`: repassado ao elemento.
// - `tipo`: 'button' (padrão) ou 'submit', só para <button>.
// - `largura`: 'total' ocupa a linha inteira.
// - `desabilitado` (bool): <button disabled>; no <a>, tira o href e marca aria-disabled.
// - `fundo`: 'claro' (creme, padrão) ou 'escuro' (grafite), para acertar as cores.
// - `className`, `children` e o resto (aria-*, ref, ...) vão para o elemento.

const BASE =
    'min-h-[44px] min-w-[44px] items-center justify-center text-center text-base disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60';

const CORES = {
    claro: {
        principal: 'bg-caneta-creme px-4 font-medium text-papel',
        secundario: 'border border-tinta px-4 font-medium text-tinta',
        texto: 'px-1 text-tinta underline underline-offset-4',
    },
    escuro: {
        principal: 'bg-caneta px-4 font-medium text-papel',
        secundario: 'border border-papel px-4 font-medium text-papel',
        texto: 'px-1 text-papel underline underline-offset-4',
    },
};

export default function Botao({
    variante = 'secundario',
    href,
    onClick,
    tipo = 'button',
    largura,
    desabilitado = false,
    fundo = 'claro',
    className = '',
    children,
    ...resto
}) {
    const cores = (CORES[fundo] ?? CORES.claro)[variante] ?? CORES.claro.secundario;
    const tamanho = largura === 'total' ? 'flex w-full' : 'inline-flex';
    const classes = `${tamanho} ${BASE} ${cores} ${className}`.trim();

    if (href !== undefined) {
        if (desabilitado) {
            return (
                <a role="link" aria-disabled="true" className={classes} {...resto}>
                    {children}
                </a>
            );
        }
        return (
            <a href={href} onClick={onClick} className={classes} {...resto}>
                {children}
            </a>
        );
    }

    return (
        <button
            type={tipo === 'submit' ? 'submit' : 'button'}
            onClick={onClick}
            disabled={desabilitado}
            className={classes}
            {...resto}
        >
            {children}
        </button>
    );
}
