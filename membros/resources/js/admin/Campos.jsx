import { Link } from '@inertiajs/react';
import { useId } from 'react';

const VARIANTES = {
    primario: 'bg-grafite text-papel border border-grafite hover:bg-tinta',
    secundario: 'bg-transparent text-tinta border border-filete-claro hover:border-tinta',
    perigo: 'bg-caneta-creme text-papel border border-caneta-creme hover:bg-caneta',
    perigoLeve: 'bg-transparent text-caneta-creme border border-filete-claro hover:border-caneta-creme',
    fantasma: 'bg-transparent text-tinta border border-transparent hover:bg-tinta/5',
    claro: 'bg-papel text-grafite border border-papel hover:bg-creme',
};

const TAMANHOS = {
    md: 'px-4 py-2.5 text-sm gap-2',
    sm: 'px-3 py-1.5 text-sm gap-1.5',
    icone: 'p-2 text-sm',
};

export function classesBotao(variante = 'primario', tamanho = 'md', extra = '') {
    return `inline-flex items-center justify-center font-medium no-underline transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap ${VARIANTES[variante]} ${TAMANHOS[tamanho]} ${extra}`;
}

function Girando() {
    return <span aria-hidden="true" className="inline-block w-3.5 h-3.5 border-2 border-current border-r-transparent rounded-full animate-spin" />;
}

export function Botao({ variante = 'primario', tamanho = 'md', carregando = false, icone: Icone, children, className = '', type = 'button', disabled, ...resto }) {
    return (
        <button
            type={type}
            disabled={disabled || carregando}
            aria-busy={carregando || undefined}
            className={classesBotao(variante, tamanho, className)}
            {...resto}
        >
            {carregando ? <Girando /> : Icone && <Icone tamanho={16} />}
            {children}
        </button>
    );
}

export function BotaoLink({ variante = 'primario', tamanho = 'md', icone: Icone, children, className = '', ...resto }) {
    return (
        <Link className={classesBotao(variante, tamanho, className)} {...resto}>
            {Icone && <Icone tamanho={16} />}
            {children}
        </Link>
    );
}

export function ErroCampo({ id, children }) {
    if (!children) return null;
    return (
        <p id={id} className="text-caneta-creme text-sm mt-1.5" role="alert">
            {children}
        </p>
    );
}

const BASE_CAMPO = 'w-full bg-white border px-3.5 py-2.5 text-sm text-tinta outline-none transition-colors placeholder:text-apoio focus:border-tinta disabled:bg-creme disabled:text-apoio read-only:bg-creme read-only:text-apoio';

function bordaCampo(erro) {
    return erro ? 'border-caneta-creme' : 'border-filete-claro';
}

/** Rótulo, campo, dica e erro ligados por id e aria. */
function useCampo(id, erro, dica) {
    const gerado = useId();
    const campoId = id ?? gerado;
    const descritos = [dica && `${campoId}-dica`, erro && `${campoId}-erro`].filter(Boolean).join(' ') || undefined;
    return { campoId, descritos };
}

function Rotulo({ htmlFor, children, extra }) {
    return (
        <div className="flex items-baseline justify-between gap-3 mb-1.5">
            <label htmlFor={htmlFor} className="rotulo !text-[11px]">{children}</label>
            {extra}
        </div>
    );
}

export function Entrada({ rotulo, erro, dica, id, className = '', classeCampo = '', extraRotulo, ...resto }) {
    const { campoId, descritos } = useCampo(id, erro, dica);
    return (
        <div className={className}>
            {rotulo && <Rotulo htmlFor={campoId} extra={extraRotulo}>{rotulo}</Rotulo>}
            <input id={campoId} aria-invalid={erro ? true : undefined} aria-describedby={descritos} className={`${BASE_CAMPO} ${bordaCampo(erro)} ${classeCampo}`} {...resto} />
            {dica && <p id={`${campoId}-dica`} className="text-xs text-apoio mt-1.5">{dica}</p>}
            <ErroCampo id={`${campoId}-erro`}>{erro}</ErroCampo>
        </div>
    );
}

export function AreaTexto({ rotulo, erro, dica, id, className = '', maximo, value, rows = 4, ...resto }) {
    const { campoId, descritos } = useCampo(id, erro, dica);
    const usados = (value ?? '').length;
    const contador = maximo ? (
        <span className={`text-xs ${usados > maximo ? 'text-caneta-creme' : 'text-apoio'}`} aria-live="polite">
            {usados}/{maximo}
        </span>
    ) : null;
    return (
        <div className={className}>
            {rotulo && <Rotulo htmlFor={campoId} extra={contador}>{rotulo}</Rotulo>}
            <textarea
                id={campoId}
                rows={rows}
                value={value ?? ''}
                aria-invalid={erro ? true : undefined}
                aria-describedby={descritos}
                className={`${BASE_CAMPO} ${bordaCampo(erro)} resize-y leading-relaxed`}
                {...resto}
            />
            {dica && <p id={`${campoId}-dica`} className="text-xs text-apoio mt-1.5">{dica}</p>}
            <ErroCampo id={`${campoId}-erro`}>{erro}</ErroCampo>
        </div>
    );
}

export function Selecao({ rotulo, erro, dica, id, className = '', children, ...resto }) {
    const { campoId, descritos } = useCampo(id, erro, dica);
    return (
        <div className={className}>
            {rotulo && <Rotulo htmlFor={campoId}>{rotulo}</Rotulo>}
            <select id={campoId} aria-invalid={erro ? true : undefined} aria-describedby={descritos} className={`${BASE_CAMPO} ${bordaCampo(erro)} pr-8 cursor-pointer`} {...resto}>
                {children}
            </select>
            {dica && <p id={`${campoId}-dica`} className="text-xs text-apoio mt-1.5">{dica}</p>}
            <ErroCampo id={`${campoId}-erro`}>{erro}</ErroCampo>
        </div>
    );
}

/** Liga e desliga. É um botão com role="switch" para leitor de tela. */
export function Interruptor({ rotulo, descricao, ligado, onChange, id, disabled }) {
    const gerado = useId();
    const campoId = id ?? gerado;
    return (
        <div className="flex items-start gap-3">
            <button
                id={campoId}
                type="button"
                role="switch"
                aria-checked={ligado}
                aria-describedby={descricao ? `${campoId}-desc` : undefined}
                disabled={disabled}
                onClick={() => onChange(!ligado)}
                className={`relative mt-0.5 h-6 w-11 shrink-0 border transition-colors cursor-pointer disabled:opacity-50 ${ligado ? 'bg-grafite border-grafite' : 'bg-white border-filete-claro'}`}
            >
                <span className="sr-only">{rotulo}</span>
                <span aria-hidden="true" className={`absolute top-0.5 h-[18px] w-[18px] transition-all ${ligado ? 'left-[22px] bg-papel' : 'left-0.5 bg-apoio'}`} />
            </button>
            <label htmlFor={campoId} className="cursor-pointer select-none">
                <span className="block text-sm font-medium">{rotulo}</span>
                {descricao && <span id={`${campoId}-desc`} className="block text-xs text-apoio mt-0.5">{descricao}</span>}
            </label>
        </div>
    );
}

const formatarCentavos = (c) => ((c ?? 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Digita em reais (como caixa eletrônico: 9700 vira 97,00) e devolve centavos inteiros. */
export function CampoDinheiro({ rotulo, erro, dica, id, className = '', centavos, onChange, maximo = 100000000, ...resto }) {
    const { campoId, descritos } = useCampo(id, erro, dica);
    return (
        <div className={className}>
            {rotulo && <Rotulo htmlFor={campoId}>{rotulo}</Rotulo>}
            <div className={`flex items-stretch bg-white border ${bordaCampo(erro)} focus-within:border-tinta`}>
                <span className="px-3 flex items-center text-sm text-apoio border-r border-filete-claro" aria-hidden="true">R$</span>
                <input
                    id={campoId}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={formatarCentavos(centavos)}
                    onChange={(e) => {
                        const digitos = e.target.value.replace(/\D/g, '').replace(/^0+/, '');
                        onChange(Math.min(parseInt(digitos || '0', 10), maximo));
                    }}
                    onFocus={(e) => {
                        const el = e.target;
                        requestAnimationFrame(() => el.setSelectionRange(el.value.length, el.value.length));
                    }}
                    aria-invalid={erro ? true : undefined}
                    aria-describedby={descritos}
                    className="flex-1 min-w-0 px-3.5 py-2.5 text-sm outline-none bg-transparent tabular-nums"
                    {...resto}
                />
            </div>
            {dica && <p id={`${campoId}-dica`} className="text-xs text-apoio mt-1.5">{dica}</p>}
            <ErroCampo id={`${campoId}-erro`}>{erro}</ErroCampo>
        </div>
    );
}

/** Barra de progresso fina. */
export function Barra({ percentual, rotulo, className = '' }) {
    const p = Math.max(0, Math.min(100, Math.round(percentual ?? 0)));
    return (
        <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={p}
            aria-label={rotulo}
            className={`h-1.5 bg-filete-claro/60 overflow-hidden ${className}`}
        >
            <div className="h-full bg-caneta transition-[width] duration-300" style={{ width: `${p}%` }} />
        </div>
    );
}
