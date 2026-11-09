import { Link } from '@inertiajs/react';
import Layout, { Ponto } from '../Layout';
import { BarraProgresso, contagem, foco, focoDentro, urlAula } from '../aluno/curso';

function CardCurso({ p }) {
    const { curso } = p;
    const terminou = !curso.proxima;
    const comecou = curso.concluidas > 0;

    return (
        <div className="bg-creme p-7 flex flex-col">
            <h2 className="text-xl font-medium mb-2">
                <Link href={`/produtos/${p.slug}`} className={`no-underline text-tinta hover:underline underline-offset-4 decoration-filete-claro ${foco}`}>
                    {p.nome}
                </Link>
            </h2>
            {p.descricao && <p className="text-[15px] text-apoio">{p.descricao}</p>}

            <div className="mt-6">
                <div className="flex items-baseline justify-between gap-4 mb-2 text-sm">
                    <span>{contagem(curso.concluidas, curso.total)}</span>
                    <span className="text-apoio">{curso.percentual}%</span>
                </div>
                <BarraProgresso percentual={curso.percentual} rotulo={`Progresso em ${p.nome}`} />
                {!terminou && comecou && (
                    <p className="text-sm text-apoio mt-3 truncate">Próxima: {curso.proxima.titulo}</p>
                )}
                {terminou && <p className="text-sm text-caneta mt-3">Curso concluído.</p>}
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mt-auto pt-6">
                {terminou ? (
                    <Link href={`/produtos/${p.slug}`} className={`btn !px-5 !py-3 text-sm ${foco}`}>Rever o curso</Link>
                ) : (
                    <Link href={urlAula(p.slug, curso.proxima.id)} className={`btn !px-5 !py-3 text-sm ${foco}`}>
                        {comecou ? 'Continuar' : 'Começar'}
                    </Link>
                )}
                {!terminou && (
                    <Link href={`/produtos/${p.slug}`} className={`text-sm font-medium text-tinta underline underline-offset-4 decoration-filete-claro ${foco}`}>
                        Ver todas as aulas
                    </Link>
                )}
            </div>
        </div>
    );
}

export default function Area({ produtos, raioX }) {
    return (
        <Layout titulo="Minhas compras">
            <section className="max-w-4xl mx-auto px-6 py-16">
                <p className="rotulo mb-4">Área de membros</p>
                <h1 className="text-4xl sm:text-5xl font-medium leading-tight mb-10">
                    Minhas compras<Ponto />
                </h1>

                {produtos.length === 0 ? (
                    <p className="text-[#55575d]">
                        Nenhuma compra confirmada neste e-mail ainda. Se você acabou de pagar, aguarde alguns minutos.
                    </p>
                ) : (
                    <div className={`grid gap-px bg-filete-claro border border-filete-claro ${produtos.length > 1 ? 'sm:grid-cols-2' : 'max-w-xl'}`}>
                        {produtos.map((p) =>
                            p.curso ? (
                                <CardCurso key={p.slug} p={p} />
                            ) : (
                                <Link key={p.slug} href={`/produtos/${p.slug}`} className={`bg-creme p-7 no-underline text-tinta hover:bg-white transition ${focoDentro}`}>
                                    <h2 className="text-xl font-medium mb-2">{p.nome}</h2>
                                    {p.descricao && <p className="text-[15px] text-apoio">{p.descricao}</p>}
                                    <span className="inline-block mt-5 text-sm font-medium">Abrir →</span>
                                </Link>
                            ),
                        )}
                    </div>
                )}
            </section>

            <section className="bg-grafite text-papel">
                <div className="max-w-4xl mx-auto px-6 py-16">
                    <p className="rotulo mb-4">Próximo passo</p>
                    <h2 className="text-3xl font-medium leading-tight mb-4 max-w-2xl">
                        Sua operação ainda trava em algum ponto?
                    </h2>
                    <p className="text-apoio max-w-xl">
                        Pode haver um gargalo escondido nela. O Raio-X da Operação é uma conversa de 40 minutos,
                        gratuita, para encontrar onde ela trava.
                    </p>
                    <a href={raioX} className={`btn-claro mt-8 ${foco}`}>Pedir meu Raio-X</a>
                </div>
            </section>
        </Layout>
    );
}
