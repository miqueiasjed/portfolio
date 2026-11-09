import { Link, router } from '@inertiajs/react';
import { useEffect, useId, useState } from 'react';
import Layout, { Ponto } from '../Layout';
import { BarraProgresso, IconeArquivo, IconeCheck, IconeSeta, ListaCurso, concluidasTexto, contagem, duracao, foco, focoDentro, urlAula } from '../aluno/curso';

// Props como ficam depois de alternar a aula atual: a tela responde na hora e o Inertia desfaz se o POST falhar.
function comAulaAlternada(props) {
    const id = props.aula.id;
    const feita = !props.aula.concluida;
    const modulos = props.curso.modulos.map((m) => ({
        ...m,
        aulas: m.aulas.map((a) => (a.id === id ? { ...a, concluida: feita } : a)),
    }));
    const todas = modulos.flatMap((m) => m.aulas);
    const concluidas = todas.filter((a) => a.concluida).length;
    const proxima = todas.find((a) => !a.concluida);

    return {
        aula: { ...props.aula, concluida: feita, concluida_em: feita ? props.aula.concluida_em : null },
        curso: {
            ...props.curso,
            modulos,
            concluidas,
            percentual: Math.floor((concluidas * 100) / todas.length),
            proxima: proxima ? { id: proxima.id, titulo: proxima.titulo } : null,
        },
    };
}

function Video({ aula }) {
    if (aula.video_embed) {
        return (
            <div className="relative w-full aspect-video bg-black">
                <iframe
                    key={aula.id}
                    src={aula.video_embed}
                    title={`Vídeo da aula: ${aula.titulo}`}
                    className="absolute inset-0 w-full h-full"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="strict-origin-when-cross-origin"
                />
            </div>
        );
    }

    if (aula.video_url) {
        return (
            <div className="w-full aspect-video bg-black border border-filete flex flex-col items-center justify-center gap-6 px-6 text-center">
                <p className="text-apoio max-w-sm">O vídeo desta aula abre no site onde ele está hospedado.</p>
                <a href={aula.video_url} target="_blank" rel="noopener noreferrer" className={`btn-claro ${foco}`}>
                    Abrir vídeo<span className="sr-only"> (abre em nova aba)</span>
                </a>
            </div>
        );
    }

    return null;
}

function Vizinha({ slug, aula, tipo }) {
    const anterior = tipo === 'anterior';

    if (!aula) return <div className="hidden sm:block" />;

    return (
        <Link
            href={urlAula(slug, aula.id)}
            rel={anterior ? 'prev' : 'next'}
            className={`block p-5 no-underline text-papel hover:bg-white/5 ${focoDentro} ${anterior ? '' : 'sm:text-right'}`}
        >
            <span className="rotulo block mb-2">{anterior ? '← Anterior' : 'Próxima →'}</span>
            <span className="block leading-snug">{aula.titulo}</span>
        </Link>
    );
}

export default function Aula({ produto, aula, anterior, proxima, curso }) {
    const slug = produto.slug;
    const listaId = useId();
    const [listaAberta, setListaAberta] = useState(false);
    const [oferta, setOferta] = useState(false);

    // nova aula: some a oferta de seguir e a lista recolhe no celular
    useEffect(() => {
        setOferta(false);
        setListaAberta(false);
    }, [aula.id]);

    const indiceModulo = curso.modulos.findIndex((m) => m.id === aula.modulo.id);
    const numero = curso.modulos.flatMap((m) => m.aulas).findIndex((a) => a.id === aula.id) + 1;
    const tempo = duracao(aula.duracao_minutos);

    function alternar() {
        setOferta(!aula.concluida);
        router.post(`/produtos/${slug}/aulas/${aula.id}/concluir`, { concluida: !aula.concluida }, {
            preserveScroll: true,
            optimistic: comAulaAlternada,
        });
    }

    return (
        <Layout titulo={`${aula.titulo} · ${produto.nome}`} escuro largo>
            <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-16">
                <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 mb-6">
                    <Link href={`/produtos/${slug}`} className={`rotulo !text-apoio no-underline hover:!text-papel ${foco}`}>
                        ← Voltar ao curso
                    </Link>
                    <span className="text-xs text-apoio">
                        {contagem(curso.concluidas, curso.total)} · {curso.percentual}%
                    </span>
                </div>

                <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10 lg:items-start">
                    <div className="min-w-0">
                        <Video aula={aula} />

                        <article className="pt-8">
                            <p className="rotulo mb-3">
                                Módulo {indiceModulo + 1} · {aula.modulo.titulo}
                            </p>
                            <h1 className="text-3xl sm:text-4xl font-medium leading-tight">
                                {aula.titulo}<Ponto />
                            </h1>
                            <p className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-sm text-apoio">
                                <span>Aula {numero} de {curso.total}</span>
                                {tempo && <span>{tempo}</span>}
                                {aula.concluida && aula.concluida_em && <span>Concluída em {aula.concluida_em}</span>}
                            </p>

                            <div className="flex flex-wrap items-center gap-4 mt-8">
                                <button
                                    type="button"
                                    onClick={alternar}
                                    aria-label={aula.concluida ? 'Concluída. Clique para desmarcar.' : undefined}
                                    className={`inline-flex items-center gap-2 px-6 py-3.5 font-medium cursor-pointer transition ${foco} ${
                                        aula.concluida
                                            ? 'border border-caneta text-papel hover:bg-white/5'
                                            : 'bg-papel text-grafite hover:-translate-y-0.5'
                                    }`}
                                >
                                    {aula.concluida && <IconeCheck className="w-4 h-4 text-caneta" />}
                                    {aula.concluida ? 'Concluída' : 'Marcar como concluída'}
                                </button>

                                {aula.tem_anexo && (
                                    <a
                                        href={`/produtos/${slug}/aulas/${aula.id}/anexo`}
                                        className={`inline-flex items-center gap-2 px-6 py-3.5 border border-filete text-papel no-underline font-medium hover:bg-white/5 ${foco}`}
                                    >
                                        <IconeArquivo className="w-4 h-4" />
                                        Baixar material
                                        {aula.anexo_nome && <span className="sr-only">: {aula.anexo_nome}</span>}
                                    </a>
                                )}
                            </div>

                            <div aria-live="polite">
                                {oferta && aula.concluida && (
                                    <div className="mt-6 border-l-2 border-caneta bg-white/5 px-5 py-4 flex flex-wrap items-center justify-between gap-4">
                                        {proxima ? (
                                            <>
                                                <p>Aula concluída. A próxima é <span className="font-medium">{proxima.titulo}</span>.</p>
                                                <Link href={urlAula(slug, proxima.id)} className={`btn-claro !px-5 !py-3 text-sm ${foco}`}>
                                                    Ir para a próxima
                                                </Link>
                                            </>
                                        ) : curso.proxima ? (
                                            <>
                                                <p>Esta é a última aula. Ainda falta <span className="font-medium">{curso.proxima.titulo}</span>.</p>
                                                <Link href={urlAula(slug, curso.proxima.id)} className={`btn-claro !px-5 !py-3 text-sm ${foco}`}>
                                                    Ver a aula que falta
                                                </Link>
                                            </>
                                        ) : (
                                            <>
                                                <p>Você concluiu o curso<Ponto /></p>
                                                <Link href={`/produtos/${slug}`} className={`btn-claro !px-5 !py-3 text-sm ${foco}`}>
                                                    Voltar ao curso
                                                </Link>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            {aula.tem_anexo && aula.anexo_nome && (
                                <p className="text-xs text-apoio mt-4">Material: {aula.anexo_nome}</p>
                            )}

                            {aula.descricao && (
                                <div className="mt-10 pt-8 border-t border-filete">
                                    <p className="rotulo mb-4">Sobre a aula</p>
                                    <p className="whitespace-pre-line leading-relaxed text-papel/90 max-w-prose break-words">{aula.descricao}</p>
                                </div>
                            )}

                            {(anterior || proxima) && (
                                <nav aria-label="Navegação entre aulas" className="mt-12 grid sm:grid-cols-2 gap-px bg-filete border border-filete">
                                    <div className="bg-grafite"><Vizinha slug={slug} aula={anterior} tipo="anterior" /></div>
                                    <div className="bg-grafite"><Vizinha slug={slug} aula={proxima} tipo="proxima" /></div>
                                </nav>
                            )}
                        </article>
                    </div>

                    <aside aria-label="Aulas do curso" className="mt-12 lg:mt-0 lg:sticky lg:top-6 border border-filete">
                        <div className="px-4 pt-5 pb-4">
                            <p className="rotulo mb-2">Curso</p>
                            <p className="font-medium leading-snug mb-4">{produto.nome}</p>
                            <BarraProgresso percentual={curso.percentual} escuro />
                            <p className="text-xs text-apoio mt-2">{concluidasTexto(curso.concluidas, curso.total)}</p>
                        </div>

                        <button
                            type="button"
                            onClick={() => setListaAberta((v) => !v)}
                            aria-expanded={listaAberta}
                            aria-controls={listaId}
                            className={`lg:hidden w-full flex items-center justify-between gap-4 px-4 py-3 border-t border-filete text-sm font-medium cursor-pointer ${focoDentro}`}
                        >
                            {listaAberta ? 'Esconder as aulas' : 'Ver todas as aulas'}
                            <IconeSeta aberto={listaAberta} className="w-4 h-4 text-apoio" />
                        </button>

                        <div id={listaId} className={`${listaAberta ? 'block' : 'hidden'} lg:block lg:max-h-[calc(100vh-14rem)] lg:overflow-y-auto`}>
                            <ListaCurso
                                slug={slug}
                                modulos={curso.modulos}
                                atualId={aula.id}
                                proximaId={curso.proxima?.id ?? null}
                                escuro
                            />
                        </div>
                    </aside>
                </div>
            </div>
        </Layout>
    );
}
