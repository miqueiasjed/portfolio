import { Link } from '@inertiajs/react';
import Layout, { Ponto } from '../Layout';

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
                        {produtos.map((p) => (
                            <Link key={p.slug} href={`/produtos/${p.slug}`} className="bg-creme p-7 no-underline text-tinta hover:bg-white transition">
                                <h2 className="text-xl font-medium mb-2">{p.nome}</h2>
                                {p.descricao && <p className="text-[15px] text-apoio">{p.descricao}</p>}
                                <span className="inline-block mt-5 text-sm font-medium">Abrir →</span>
                            </Link>
                        ))}
                    </div>
                )}
            </section>

            <section className="bg-grafite text-papel">
                <div className="max-w-4xl mx-auto px-6 py-16">
                    <p className="rotulo mb-4">Quando o kit já não dá conta</p>
                    <h2 className="text-3xl font-medium leading-tight mb-4 max-w-2xl">
                        Bateu em dois ou mais sinais de limite?
                    </h2>
                    <p className="text-apoio max-w-xl">
                        Existe um gargalo escondido na sua operação. O Raio-X da Operação é uma conversa de 40
                        minutos, gratuita, para encontrar onde ela trava.
                    </p>
                    <a href={raioX} className="btn-claro mt-8">Pedir meu Raio-X</a>
                </div>
            </section>
        </Layout>
    );
}
