// Campo de formulário da ferramenta, sobre o fundo creme: rótulo sempre
// visível em cima, controle com filete e cantos retos, ajuda e erro embaixo,
// ligados ao controle por aria-describedby. Mesmo visual dos campos das telas
// Novo e Cliente.

import { useCallback, useId, useLayoutEffect, useRef } from 'react';

// Props:
// - `rotulo`: texto do rótulo (obrigatório; o campo nunca fica sem nome visível).
// - `tipo`: 'text' (padrão), 'textarea', 'number' ou 'select'.
// - `id`: opcional; sem ele, o componente gera um.
// - `inputMode`: repassado ao controle (ex. 'decimal', 'tel').
// - `ajuda`: texto curto de orientação, abaixo do controle.
// - `erro`: mensagem de erro; marca aria-invalid.
// - `opcoes`: no select, lista de { valor, rotulo }. Também aceita <option> em `children`.
// - `ref`: chega ao controle (input, textarea ou select).
// - O resto (value, onChange, placeholder, autoComplete, ...) vai para o controle.
// No textarea, a altura acompanha o texto, a partir de 3 linhas.

const CONTROLE =
    'min-h-[44px] w-full min-w-0 appearance-none border border-filete-claro bg-transparent px-3 text-base text-tinta placeholder:text-apoio';

export default function Campo({
    rotulo,
    tipo = 'text',
    id,
    inputMode,
    ajuda,
    erro,
    opcoes,
    ref,
    className = '',
    children,
    onChange,
    ...resto
}) {
    const idGerado = useId();
    const idCampo = id ?? `campo-${idGerado}`;
    const idAjuda = `${idCampo}-ajuda`;
    const idErro = `${idCampo}-erro`;
    const descrito = [ajuda ? idAjuda : null, erro ? idErro : null].filter(Boolean).join(' ') || undefined;

    const controle = useRef(null);

    // Junta o ref interno (para a altura do textarea) com o de quem usa.
    const ligarRef = useCallback(
        (no) => {
            controle.current = no;
            if (typeof ref === 'function') return ref(no);
            if (ref) ref.current = no;
            return undefined;
        },
        [ref],
    );

    const ajustarAltura = useCallback(() => {
        const no = controle.current;
        if (tipo !== 'textarea' || !no) return;
        no.style.height = 'auto';
        const bordas = no.offsetHeight - no.clientHeight;
        no.style.height = `${no.scrollHeight + bordas}px`;
    }, [tipo]);

    // Valor trocado por fora (limpar, carregar rascunho) também mexe na altura.
    useLayoutEffect(() => {
        ajustarAltura();
    }, [ajustarAltura, resto.value, resto.defaultValue]);

    const mudar = (evento) => {
        ajustarAltura();
        onChange?.(evento);
    };

    const comum = {
        id: idCampo,
        ref: ligarRef,
        inputMode,
        'aria-invalid': erro ? true : undefined,
        'aria-describedby': descrito,
        onChange: mudar,
        ...resto,
    };

    let campo;
    if (tipo === 'textarea') {
        campo = (
            <textarea
                rows={3}
                {...comum}
                className={`${CONTROLE} min-h-[88px] resize-none overflow-hidden py-2 ${className}`}
            />
        );
    } else if (tipo === 'select') {
        campo = (
            <div className="relative min-w-0">
                <select {...comum} className={`${CONTROLE} pr-10 ${className}`}>
                    {opcoes?.map((opcao) => (
                        <option key={opcao.valor} value={opcao.valor}>
                            {opcao.rotulo}
                        </option>
                    ))}
                    {children}
                </select>
                <svg
                    aria-hidden="true"
                    viewBox="0 0 12 8"
                    className="pointer-events-none absolute top-1/2 right-3 h-2 w-3 -translate-y-1/2 text-tinta"
                >
                    <path d="M1 1l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                </svg>
            </div>
        );
    } else {
        campo = <input type={tipo === 'number' ? 'number' : 'text'} {...comum} className={`${CONTROLE} ${className}`} />;
    }

    return (
        <div className="flex min-w-0 flex-col gap-1">
            <label htmlFor={idCampo} className="text-sm">
                {rotulo}
            </label>
            {campo}
            {ajuda && (
                <p id={idAjuda} className="text-sm">
                    {ajuda}
                </p>
            )}
            {erro && (
                <p id={idErro} className="text-sm font-medium">
                    {erro}
                </p>
            )}
        </div>
    );
}
