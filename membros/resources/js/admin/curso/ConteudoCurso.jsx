import { router, useForm } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { Chip } from '../Badge';
import { Botao } from '../Campos';
import {
    IconeArrastar,
    IconeClipe,
    IconeDescer,
    IconeLapis,
    IconeLixo,
    IconeMais,
    IconeOlhoFechado,
    IconeRelogio,
    IconeSubir,
    IconeVideo,
} from '../icones';
import { ConfirmModal } from '../Modal';
import { useToast } from '../Toast';
import { plural } from '../util';
import EditorAula from './EditorAula';

// ---------- ordem ----------

const copiar = (estrutura) => estrutura.map((m) => ({ ...m, aulas: [...m.aulas] }));

const assinatura = (estrutura) => JSON.stringify(estrutura.map((m) => [m.id, m.aulas.map((a) => a.id)]));

/** Move a aula para a posição `indice` do módulo de destino (índice contado antes de tirar a aula). */
function moverAula(estrutura, aulaId, destinoId, indice) {
    const nova = copiar(estrutura);
    let origem = null;
    let posicao = -1;
    let aula = null;
    for (const m of nova) {
        const i = m.aulas.findIndex((a) => a.id === aulaId);
        if (i >= 0) {
            origem = m;
            posicao = i;
            [aula] = m.aulas.splice(i, 1);
            break;
        }
    }
    const destino = nova.find((m) => m.id === destinoId);
    if (!aula || !destino) return estrutura;
    let alvo = indice;
    if (origem.id === destino.id && posicao < indice) alvo -= 1;
    destino.aulas.splice(Math.max(0, Math.min(alvo, destino.aulas.length)), 0, aula);
    return nova;
}

function moverModulo(estrutura, moduloId, indice) {
    const nova = copiar(estrutura);
    const posicao = nova.findIndex((m) => m.id === moduloId);
    if (posicao < 0) return estrutura;
    const [modulo] = nova.splice(posicao, 1);
    let alvo = indice;
    if (posicao < indice) alvo -= 1;
    nova.splice(Math.max(0, Math.min(alvo, nova.length)), 0, modulo);
    return nova;
}

// ---------- pedaços ----------

function BotaoIcone({ rotulo, icone: Icone, onClick, disabled, perigo = false }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={rotulo}
            title={rotulo}
            className={`p-1.5 text-apoio cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${perigo ? 'hover:text-caneta-creme' : 'hover:text-tinta'}`}
        >
            <Icone tamanho={16} />
        </button>
    );
}

function Alca({ rotulo, onDragStart, onDragEnd }) {
    return (
        <span
            draggable
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            title={rotulo}
            aria-hidden="true"
            className="hidden sm:inline-flex p-1 -ml-1 text-apoio hover:text-tinta cursor-grab active:cursor-grabbing"
        >
            <IconeArrastar tamanho={16} />
        </span>
    );
}

function TituloModulo({ modulo, numero }) {
    const [editando, setEditando] = useState(false);
    const form = useForm({ titulo: modulo.titulo });

    useEffect(() => {
        if (!editando) form.setData('titulo', modulo.titulo);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [modulo.titulo]);

    function salvar(e) {
        e.preventDefault();
        if (form.data.titulo.trim() === modulo.titulo) return setEditando(false);
        form.put(`/admin/modulos/${modulo.id}`, { preserveScroll: true, preserveState: true, onSuccess: () => setEditando(false) });
    }

    if (editando) {
        return (
            <form onSubmit={salvar} className="flex-1 min-w-0">
                <label htmlFor={`modulo-${modulo.id}-titulo`} className="sr-only">Título do módulo</label>
                <div className="flex flex-wrap gap-2">
                    <input
                        id={`modulo-${modulo.id}-titulo`}
                        autoFocus
                        value={form.data.titulo}
                        maxLength={255}
                        onChange={(e) => form.setData('titulo', e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                                e.preventDefault();
                                form.setData('titulo', modulo.titulo);
                                form.clearErrors();
                                setEditando(false);
                            }
                        }}
                        aria-invalid={form.errors.titulo ? true : undefined}
                        className="flex-1 min-w-40 bg-white border border-tinta px-3 py-1.5 text-sm font-medium outline-none"
                    />
                    <Botao type="submit" tamanho="sm" carregando={form.processing}>Salvar</Botao>
                    <Botao
                        variante="secundario"
                        tamanho="sm"
                        onClick={() => {
                            form.setData('titulo', modulo.titulo);
                            form.clearErrors();
                            setEditando(false);
                        }}
                    >
                        Cancelar
                    </Botao>
                </div>
                {form.errors.titulo && <p role="alert" className="text-caneta-creme text-sm mt-1">{form.errors.titulo}</p>}
            </form>
        );
    }

    return (
        <div className="flex-1 min-w-0 flex items-center gap-1">
            <h3 className="font-medium truncate">
                <span className="rotulo !text-[10px] mr-2">Módulo {numero}</span>
                {modulo.titulo}
            </h3>
            <BotaoIcone rotulo={`Renomear módulo ${modulo.titulo}`} icone={IconeLapis} onClick={() => setEditando(true)} />
        </div>
    );
}

function NovaAula({ modulo }) {
    const [aberto, setAberto] = useState(false);
    const form = useForm({ titulo: '', publicada: true });

    function salvar(e) {
        e.preventDefault();
        form.post(`/admin/modulos/${modulo.id}/aulas`, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => form.reset('titulo'),
        });
    }

    if (!aberto) {
        return (
            <button
                type="button"
                onClick={() => setAberto(true)}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-apoio hover:text-tinta hover:bg-creme cursor-pointer"
            >
                <IconeMais tamanho={16} /> Adicionar aula
            </button>
        );
    }

    return (
        <form onSubmit={salvar} className="px-4 py-3 bg-creme/60">
            <label htmlFor={`nova-aula-${modulo.id}`} className="sr-only">Título da nova aula em {modulo.titulo}</label>
            <div className="flex flex-wrap gap-2">
                <input
                    id={`nova-aula-${modulo.id}`}
                    autoFocus
                    value={form.data.titulo}
                    maxLength={255}
                    placeholder="Título da aula"
                    onChange={(e) => form.setData('titulo', e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                            e.preventDefault();
                            form.reset();
                            form.clearErrors();
                            setAberto(false);
                        }
                    }}
                    aria-invalid={form.errors.titulo ? true : undefined}
                    className="flex-1 min-w-40 bg-white border border-filete-claro focus:border-tinta px-3 py-1.5 text-sm outline-none"
                />
                <Botao type="submit" tamanho="sm" carregando={form.processing} disabled={!form.data.titulo.trim()}>Adicionar</Botao>
                <Botao
                    variante="secundario"
                    tamanho="sm"
                    onClick={() => {
                        form.reset();
                        form.clearErrors();
                        setAberto(false);
                    }}
                >
                    Fechar
                </Botao>
            </div>
            {form.errors.titulo ? (
                <p role="alert" className="text-caneta-creme text-sm mt-1">{form.errors.titulo}</p>
            ) : (
                <p className="text-xs text-apoio mt-1.5">Enter adiciona e deixa o campo pronto para a próxima. Depois clique na aula para pôr vídeo e descrição.</p>
            )}
        </form>
    );
}

function NovoModulo({ slug, primeiro }) {
    const form = useForm({ titulo: '' });

    function salvar(e) {
        e.preventDefault();
        form.post(`/admin/cursos/${slug}/modulos`, { preserveScroll: true, preserveState: true, onSuccess: () => form.reset() });
    }

    return (
        <form onSubmit={salvar} className="border border-dashed border-filete-claro bg-white/60 p-4">
            <label htmlFor="novo-modulo" className="rotulo !text-[11px] block mb-1.5">{primeiro ? 'Primeiro módulo' : 'Novo módulo'}</label>
            <div className="flex flex-col sm:flex-row gap-2">
                <input
                    id="novo-modulo"
                    value={form.data.titulo}
                    maxLength={255}
                    placeholder="Ex.: Fundamentos"
                    onChange={(e) => form.setData('titulo', e.target.value)}
                    aria-invalid={form.errors.titulo ? true : undefined}
                    aria-describedby={form.errors.titulo ? 'novo-modulo-erro' : undefined}
                    className="flex-1 bg-white border border-filete-claro focus:border-tinta px-3.5 py-2.5 text-sm outline-none"
                />
                <Botao type="submit" icone={IconeMais} carregando={form.processing} disabled={!form.data.titulo.trim()}>
                    Adicionar módulo
                </Botao>
            </div>
            {form.errors.titulo && <p id="novo-modulo-erro" role="alert" className="text-caneta-creme text-sm mt-1.5">{form.errors.titulo}</p>}
        </form>
    );
}

// ---------- aba ----------

const LINHA_ALVO_TOPO = 'shadow-[inset_0_2px_0_0_var(--color-caneta)]';
const LINHA_ALVO_BASE = 'shadow-[inset_0_-2px_0_0_var(--color-caneta)]';

/** Aba "Conteúdo": módulos com aulas, arrastar para ordenar (ou botões subir e descer). */
export default function ConteudoCurso({ produto, modulos, limiteUploadMb }) {
    const { mostrar } = useToast();
    const [estrutura, setEstrutura] = useState(modulos);
    const [salvando, setSalvando] = useState(false);
    const [editandoId, setEditandoId] = useState(null);
    const [excluir, setExcluir] = useState(null); // {tipo: 'modulo'|'aula', item}
    const [excluindo, setExcluindo] = useState(false);
    const arrasto = useRef(null); // {tipo, id}
    const alvoRef = useRef(null);
    const [alvo, setAlvoEstado] = useState(null); // {tipo: 'aula', moduloId, indice} | {tipo: 'modulo', indice}
    const [arrastando, setArrastando] = useState(null);

    useEffect(() => setEstrutura(modulos), [modulos]);

    const setAlvo = (novo) => {
        const igual = JSON.stringify(novo) === JSON.stringify(alvoRef.current);
        alvoRef.current = novo;
        if (!igual) setAlvoEstado(novo);
    };

    const totalAulas = estrutura.reduce((s, m) => s + m.aulas.length, 0);
    const naoPublicadas = estrutura.reduce((s, m) => s + m.aulas.filter((a) => !a.publicada).length, 0);
    const aulaEditando = editandoId ? estrutura.flatMap((m) => m.aulas.map((a) => ({ ...a, moduloTitulo: m.titulo }))).find((a) => a.id === editandoId) : null;

    function salvarOrdem(nova) {
        if (assinatura(nova) === assinatura(estrutura)) return;
        const anterior = estrutura;
        setEstrutura(nova);
        setSalvando(true);
        router.post(
            `/admin/cursos/${produto.slug}/ordem`,
            { modulos: nova.map((m) => ({ id: m.id, aulas: m.aulas.map((a) => a.id) })) },
            {
                preserveScroll: true,
                preserveState: true,
                onError: (erros) => {
                    setEstrutura(anterior);
                    mostrar(erros.ordem ?? 'Não deu para salvar a nova ordem. Recarregue a página e tente de novo.', 'erro');
                },
                onFinish: () => setSalvando(false),
            },
        );
    }

    function subirAula(mi, ai) {
        const m = estrutura[mi];
        const id = m.aulas[ai].id;
        if (ai > 0) salvarOrdem(moverAula(estrutura, id, m.id, ai - 1));
        else if (mi > 0) salvarOrdem(moverAula(estrutura, id, estrutura[mi - 1].id, estrutura[mi - 1].aulas.length));
    }

    function descerAula(mi, ai) {
        const m = estrutura[mi];
        const id = m.aulas[ai].id;
        if (ai < m.aulas.length - 1) salvarOrdem(moverAula(estrutura, id, m.id, ai + 2));
        else if (mi < estrutura.length - 1) salvarOrdem(moverAula(estrutura, id, estrutura[mi + 1].id, 0));
    }

    // arrastar e soltar (HTML5)
    function comecar(e, tipo, id, linha) {
        arrasto.current = { tipo, id };
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', `${tipo}:${id}`);
        if (linha) e.dataTransfer.setDragImage(linha, 24, 20);
        // mudar o DOM no mesmo tick do dragstart cancela o arrasto no Chrome
        requestAnimationFrame(() => arrasto.current && setArrastando({ tipo, id }));
    }

    function terminar() {
        arrasto.current = null;
        setAlvo(null);
        setArrastando(null);
    }

    function soltar(e) {
        e.preventDefault();
        const a = arrasto.current;
        const destino = alvoRef.current;
        terminar();
        if (!a || !destino) return;
        if (a.tipo === 'aula' && destino.tipo === 'aula') salvarOrdem(moverAula(estrutura, a.id, destino.moduloId, destino.indice));
        if (a.tipo === 'modulo' && destino.tipo === 'modulo') salvarOrdem(moverModulo(estrutura, a.id, destino.indice));
    }

    const metade = (e) => {
        const r = e.currentTarget.getBoundingClientRect();
        return e.clientY < r.top + r.height / 2;
    };

    function sobreModulo(e, mi, modulo) {
        const a = arrasto.current;
        if (!a) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (a.tipo === 'modulo') setAlvo({ tipo: 'modulo', indice: metade(e) ? mi : mi + 1 });
        else setAlvo({ tipo: 'aula', moduloId: modulo.id, indice: metade(e) ? 0 : modulo.aulas.length });
    }

    function sobreLista(e, modulo) {
        const a = arrasto.current;
        if (!a || a.tipo !== 'aula') return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        setAlvo({ tipo: 'aula', moduloId: modulo.id, indice: modulo.aulas.length });
    }

    function sobreAula(e, modulo, ai) {
        const a = arrasto.current;
        if (!a || a.tipo !== 'aula') return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        setAlvo({ tipo: 'aula', moduloId: modulo.id, indice: metade(e) ? ai : ai + 1 });
    }

    function confirmarExclusao() {
        const { tipo, item } = excluir;
        setExcluindo(true);
        router.delete(tipo === 'modulo' ? `/admin/modulos/${item.id}` : `/admin/aulas/${item.id}`, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => {
                if (tipo === 'aula' && editandoId === item.id) setEditandoId(null);
                if (tipo === 'modulo' && item.aulas.some((a) => a.id === editandoId)) setEditandoId(null);
            },
            onFinish: () => {
                setExcluindo(false);
                setExcluir(null);
            },
        });
    }

    return (
        <div className="max-w-4xl">
            {produto.tem_conteudo_blocos && (
                <p className="text-sm border-l-2 border-filete-claro pl-3 mb-6 text-tinta/80">
                    Este produto também tem uma página em blocos (o conteúdo do kit). Ela continua aparecendo para o aluno e não é editada por aqui.
                </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <p className="text-sm text-apoio">
                    {plural(estrutura.length, 'módulo', 'módulos')}, {plural(totalAulas, 'aula', 'aulas')}
                    {naoPublicadas > 0 && `, ${naoPublicadas} não ${naoPublicadas === 1 ? 'publicada' : 'publicadas'}`}
                </p>
                <p className="text-xs text-apoio" role="status" aria-live="polite">
                    {salvando ? 'Salvando a ordem...' : estrutura.length > 0 ? 'Arraste pela alça ou use as setas para reordenar.' : ''}
                </p>
            </div>

            {estrutura.length === 0 && (
                <div className="bg-white border border-filete-claro p-8 text-center mb-4">
                    <p className="font-medium">O curso ainda não tem módulos.</p>
                    <p className="text-sm text-apoio mt-1">Crie o primeiro módulo abaixo e depois adicione as aulas dentro dele.</p>
                </div>
            )}

            <ol className="space-y-4 mb-4" onDragOver={(e) => arrasto.current && e.preventDefault()} onDrop={soltar}>
                {estrutura.map((m, mi) => {
                    const alvoAntes = alvo?.tipo === 'modulo' && alvo.indice === mi;
                    const alvoDepois = alvo?.tipo === 'modulo' && alvo.indice === estrutura.length && mi === estrutura.length - 1;
                    const sendoArrastado = arrastando?.tipo === 'modulo' && arrastando.id === m.id;
                    return (
                        <li
                            key={m.id}
                            id={`modulo-${m.id}`}
                            onDragOver={(e) => sobreModulo(e, mi, m)}
                            className={`bg-white border border-filete-claro transition-opacity ${sendoArrastado ? 'opacity-40' : ''} ${alvoAntes ? 'shadow-[0_-3px_0_0_var(--color-caneta)]' : ''} ${alvoDepois ? 'shadow-[0_3px_0_0_var(--color-caneta)]' : ''}`}
                        >
                            <div className="flex items-center gap-2 px-4 py-3 border-b border-filete-claro bg-papel/60">
                                <Alca
                                    rotulo="Arraste para mover o módulo"
                                    onDragStart={(e) => comecar(e, 'modulo', m.id, e.currentTarget.closest('li'))}
                                    onDragEnd={terminar}
                                />
                                <TituloModulo modulo={m} numero={mi + 1} />
                                <span className="text-xs text-apoio whitespace-nowrap hidden sm:inline">{plural(m.aulas.length, 'aula', 'aulas')}</span>
                                <div className="flex items-center shrink-0">
                                    <BotaoIcone rotulo={`Subir módulo ${m.titulo}`} icone={IconeSubir} disabled={mi === 0 || salvando} onClick={() => salvarOrdem(moverModulo(estrutura, m.id, mi - 1))} />
                                    <BotaoIcone
                                        rotulo={`Descer módulo ${m.titulo}`}
                                        icone={IconeDescer}
                                        disabled={mi === estrutura.length - 1 || salvando}
                                        onClick={() => salvarOrdem(moverModulo(estrutura, m.id, mi + 2))}
                                    />
                                    <BotaoIcone rotulo={`Excluir módulo ${m.titulo}`} icone={IconeLixo} perigo onClick={() => setExcluir({ tipo: 'modulo', item: m })} />
                                </div>
                            </div>

                            <ul onDragOver={(e) => sobreLista(e, m)} className="divide-y divide-filete-claro">
                                {m.aulas.length === 0 && (
                                    <li className={`px-4 py-4 text-sm text-apoio ${alvo?.tipo === 'aula' && alvo.moduloId === m.id ? 'bg-creme ' + LINHA_ALVO_TOPO : ''}`}>
                                        Nenhuma aula neste módulo{arrastando?.tipo === 'aula' ? '. Solte aqui para mover.' : '.'}
                                    </li>
                                )}
                                {m.aulas.map((a, ai) => {
                                    const noAlvo = alvo?.tipo === 'aula' && alvo.moduloId === m.id;
                                    const topo = noAlvo && alvo.indice === ai;
                                    const base = noAlvo && alvo.indice === m.aulas.length && ai === m.aulas.length - 1;
                                    const primeiraDoCurso = mi === 0 && ai === 0;
                                    const ultimaDoCurso = mi === estrutura.length - 1 && ai === m.aulas.length - 1;
                                    const arrastada = arrastando?.tipo === 'aula' && arrastando.id === a.id;
                                    return (
                                        <li
                                            key={a.id}
                                            onDragOver={(e) => sobreAula(e, m, ai)}
                                            className={`flex items-center gap-2 px-4 py-2.5 transition-opacity ${a.publicada ? '' : 'bg-creme/70'} ${arrastada ? 'opacity-40' : ''} ${topo ? LINHA_ALVO_TOPO : ''} ${base ? LINHA_ALVO_BASE : ''}`}
                                        >
                                            <Alca
                                                rotulo="Arraste para mover a aula"
                                                onDragStart={(e) => comecar(e, 'aula', a.id, e.currentTarget.closest('li'))}
                                                onDragEnd={terminar}
                                            />
                                            <span className="text-xs text-apoio tabular-nums w-8 shrink-0">{mi + 1}.{ai + 1}</span>
                                            <button
                                                type="button"
                                                onClick={() => setEditandoId(a.id)}
                                                className={`flex-1 min-w-0 text-left text-sm truncate hover:underline underline-offset-4 cursor-pointer ${a.publicada ? '' : 'text-apoio'}`}
                                                aria-label={`Editar aula ${a.titulo}${a.publicada ? '' : ', não publicada'}`}
                                            >
                                                {a.titulo}
                                            </button>
                                            <span className="hidden sm:flex items-center gap-2 text-apoio">
                                                {!a.publicada && (
                                                    <Chip tom="alerta">
                                                        <IconeOlhoFechado tamanho={12} /> Não publicada
                                                    </Chip>
                                                )}
                                                {a.video_url && (
                                                    <span title="Tem vídeo">
                                                        <IconeVideo tamanho={15} />
                                                        <span className="sr-only">Tem vídeo</span>
                                                    </span>
                                                )}
                                                {a.anexo && (
                                                    <span title="Tem material para baixar">
                                                        <IconeClipe tamanho={15} />
                                                        <span className="sr-only">Tem material para baixar</span>
                                                    </span>
                                                )}
                                                {a.duracao_minutos && (
                                                    <span className="inline-flex items-center gap-1 text-xs">
                                                        <IconeRelogio tamanho={13} /> {a.duracao_minutos} min
                                                    </span>
                                                )}
                                            </span>
                                            {!a.publicada && <span className="sm:hidden text-xs text-[#7A5A12]">rascunho</span>}
                                            <div className="flex items-center shrink-0">
                                                <BotaoIcone rotulo={`Subir aula ${a.titulo}`} icone={IconeSubir} disabled={primeiraDoCurso || salvando} onClick={() => subirAula(mi, ai)} />
                                                <BotaoIcone rotulo={`Descer aula ${a.titulo}`} icone={IconeDescer} disabled={ultimaDoCurso || salvando} onClick={() => descerAula(mi, ai)} />
                                                <BotaoIcone rotulo={`Excluir aula ${a.titulo}`} icone={IconeLixo} perigo onClick={() => setExcluir({ tipo: 'aula', item: a })} />
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                            <div className="border-t border-filete-claro">
                                <NovaAula modulo={m} />
                            </div>
                        </li>
                    );
                })}
            </ol>

            <NovoModulo slug={produto.slug} primeiro={estrutura.length === 0} />

            <EditorAula
                aula={aulaEditando}
                moduloTitulo={aulaEditando?.moduloTitulo}
                onFechar={() => setEditandoId(null)}
                onExcluir={(a) => setExcluir({ tipo: 'aula', item: a })}
                limiteUploadMb={limiteUploadMb}
            />

            <ConfirmModal
                aberto={!!excluir}
                onFechar={() => setExcluir(null)}
                onConfirmar={confirmarExclusao}
                processando={excluindo}
                titulo={excluir?.tipo === 'modulo' ? `Excluir o módulo "${excluir.item.titulo}"?` : `Excluir a aula "${excluir?.item.titulo ?? ''}"?`}
                rotuloConfirmar={excluir?.tipo === 'modulo' ? 'Excluir módulo' : 'Excluir aula'}
            >
                {excluir?.tipo === 'modulo' ? (
                    <p>
                        {excluir.item.aulas.length === 0
                            ? 'O módulo está vazio.'
                            : excluir.item.aulas.length === 1
                              ? 'A aula dele também será apagada, com o material e o progresso dos alunos nela.'
                              : `As ${excluir.item.aulas.length} aulas dele também serão apagadas, com os materiais e o progresso dos alunos nelas.`}
                    </p>
                ) : (
                    <p>O material para baixar e o progresso dos alunos nesta aula também serão apagados.</p>
                )}
            </ConfirmModal>
        </div>
    );
}
