import Layout, { Ponto } from '../Layout';

export default function Erro({ titulo, texto }) {
    return (
        <Layout titulo="Algo deu errado" escuro>
            <section className="max-w-2xl mx-auto px-6 py-24">
                <h1 className="text-4xl font-medium leading-tight mb-6">
                    {titulo}
                    <Ponto />
                </h1>
                <p className="text-lg text-apoio">{texto}</p>
            </section>
        </Layout>
    );
}
