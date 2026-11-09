import { Link } from '@inertiajs/react';
import { useState } from 'react';
import Layout, { Ponto } from '../Layout';
import { BarraProgresso, ListaCurso, concluidasTexto, duracao, foco, urlAula } from '../aluno/curso';

function Copiar({ texto }) {
    const [ok, setOk] = useState(false);

    async function copiar() {
        try {
            await navigator.clipboard.writeText(texto);
        } catch {
            const a = document.createElement('textarea');
            a.value = texto;
            document.body.appendChild(a);
            a.select();
            try { document.execCommand('copy'); } catch {}
            a.remove();
        }
        setOk(true);
        setTimeout(() => setOk(false), 1800);
    }

    return (
        <button type="button" onClick={copiar} className={`absolute top-3 right-3 border border-filete text-papel text-xs font-medium px-3 py-1.5 cursor-pointer ${foco}`}>
            <span aria-live="polite">{ok ? 'Copiado!' : 'Copiar'}</span>
        </button>
    );
}

function Bloco({ b }) {
    if (b.tipo === 'instrucao') {
        return (
            <div className="border-t border-filete-claro py-10">
                {b.numero && <p className="rotulo mb-2">{b.numero}</p>}
                <h3 className="text-2xl font-medium mb-2">{b.titulo}</h3>
                {b.texto && <p className="text-[#55575d] mb-4">{b.texto}</p>}
                <div className="relative bg-grafite text-papel px-6 pt-14 pb-6 text-sm leading-relaxed whitespace-pre-wrap">
                    <Copiar texto={b.instrucao} />
                    {b.instrucao}
                </div>
            </div>
        );
    }

    if (b.tipo === 'passos') {
        return (
            <div className="py-10">
                <h3 className="text-2xl font-medium mb-6">{b.titulo}</h3>
                <div className="grid gap-px bg-filete-claro border border-filete-claro sm:grid-cols-3">
                    {b.itens.map((i) => (
                        <div key={i.titulo} className="bg-creme p-6">
                            <p className="font-medium mb-2">{i.titulo}</p>
                            <p className="text-sm text-apoio">{i.texto}</p>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return null;
}

function ResumoCurso({ slug, curso }) {
    const terminou = !curso.proxima;
    const comecou = curso.concluidas > 0;
    const primeira = curso.modulos[0]?.aulas[0];
    const minutos = curso.modulos.reduce((t, m) => t + m.aulas.reduce((s, a) => s + (a.duracao_minutos || 0), 0), 0);

    return (
        <div className="mt-10 max-w-xl">
            <div className="flex items-baseline justify-between gap-4 mb-2 text-sm">
                <span>
                    {concluidasTexto(curso.concluidas, curso.total)}
                    {minutos > 0 && <span className="text-apoio"> · {duracao(minutos)} no total</span>}
                </span>
                <span className="text-apoio">{curso.percentual}%</span>
            </div>
            <BarraProgresso percentual={curso.percentual} escuro />

            {terminou ? (
                <>
                    <p className="text-papel mt-6">Você concluiu o curso<Ponto /></p>
                    {primeira && (
                        <Link href={urlAula(slug, primeira.id)} className={`btn-claro mt-6 ${foco}`}>Rever do início</Link>
                    )}
                </>
            ) : (
                <>
                    {comecou && <p className="text-apoio text-sm mt-6">Próxima aula: <span className="text-papel">{curso.proxima.titulo}</span></p>}
                    <Link href={urlAula(slug, curso.proxima.id)} className={`btn-claro mt-6 ${foco}`}>
                        {comecou ? 'Continuar' : 'Começar'}
                    </Link>
                </>
            )}

            {curso.ultima_concluida && (
                <p className="text-xs text-apoio mt-6">
                    Última concluída: {curso.ultima_concluida.titulo}, em {curso.ultima_concluida.em}
                </p>
            )}
        </div>
    );
}

export default function Produto({ produto, temArquivo, curso = null, raioX }) {
    const blocos = produto.conteudo?.blocos ?? [];
    const ehKit = blocos.length > 0;

    return (
        <Layout titulo={produto.nome}>
            <section className="bg-grafite text-papel">
                <div className="max-w-4xl mx-auto px-6 py-16">
                    <Link href="/" className={`rotulo !text-apoio no-underline ${foco}`}>← Minhas compras</Link>
                    <h1 className="text-4xl sm:text-5xl font-medium leading-tight mt-6 mb-4">
                        {produto.nome}<Ponto />
                    </h1>
                    {produto.descricao && <p className="text-lg text-apoio max-w-xl">{produto.descricao}</p>}
                    {curso && <ResumoCurso slug={produto.slug} curso={curso} />}
                    {temArquivo && (
                        <a
                            href={`/produtos/${produto.slug}/download`}
                            className={curso ? `inline-block mt-8 text-sm font-medium text-papel underline underline-offset-4 decoration-filete ${foco}` : `btn-claro mt-8 ${foco}`}
                        >
                            {ehKit ? 'Baixar o PDF' : 'Baixar o material'}
                        </a>
                    )}
                </div>
            </section>

            {curso && (
                <section className="max-w-4xl mx-auto px-6 py-16" aria-labelledby="conteudo-curso">
                    <p className="rotulo mb-4">Conteúdo do curso</p>
                    <h2 id="conteudo-curso" className="text-3xl font-medium leading-tight mb-8">
                        {curso.modulos.length === 1 ? '1 módulo' : `${curso.modulos.length} módulos`}, {curso.total === 1 ? '1 aula' : `${curso.total} aulas`}<Ponto />
                    </h2>
                    <ListaCurso slug={produto.slug} modulos={curso.modulos} proximaId={curso.proxima?.id ?? null} />
                </section>
            )}

            {ehKit && (
                <section className="max-w-4xl mx-auto px-6 py-8">
                    {blocos.map((b, i) => <Bloco key={i} b={b} />)}
                </section>
            )}

            <section className="bg-grafite text-papel">
                <div className="max-w-4xl mx-auto px-6 py-16">
                    <p className="rotulo mb-4">{ehKit ? 'Quando o kit já não dá conta' : 'Próximo passo'}</p>
                    <h2 className="text-3xl font-medium leading-tight mb-4">
                        {ehKit ? 'Bateu em dois ou mais sinais de limite?' : 'Sua operação ainda trava em algum ponto?'}
                    </h2>
                    <p className="text-apoio max-w-xl">
                        O Raio-X da Operação é uma conversa de 40 minutos, gratuita, para encontrar onde a sua operação
                        trava e se você precisa mesmo de um sistema.
                    </p>
                    <a href={raioX} className={`btn-claro mt-8 ${foco}`}>Pedir meu Raio-X</a>
                </div>
            </section>
        </Layout>
    );
}
