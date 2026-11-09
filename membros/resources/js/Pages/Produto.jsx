import { Link } from '@inertiajs/react';
import { useState } from 'react';
import Layout, { Ponto } from '../Layout';

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
        <button onClick={copiar} className="absolute top-3 right-3 border border-filete text-papel text-xs font-medium px-3 py-1.5 cursor-pointer">
            {ok ? 'Copiado!' : 'Copiar'}
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

export default function Produto({ produto, temArquivo, raioX }) {
    const blocos = produto.conteudo?.blocos ?? [];

    return (
        <Layout titulo={produto.nome}>
            <section className="bg-grafite text-papel">
                <div className="max-w-4xl mx-auto px-6 py-16">
                    <Link href="/" className="rotulo !text-apoio no-underline">← Minhas compras</Link>
                    <h1 className="text-4xl sm:text-5xl font-medium leading-tight mt-6 mb-4">
                        {produto.nome}<Ponto />
                    </h1>
                    {produto.descricao && <p className="text-lg text-apoio max-w-xl">{produto.descricao}</p>}
                    {temArquivo && (
                        <a href={`/produtos/${produto.slug}/download`} className="btn-claro mt-8">Baixar o PDF</a>
                    )}
                </div>
            </section>

            {blocos.length > 0 && (
                <section className="max-w-4xl mx-auto px-6 py-8">
                    {blocos.map((b, i) => <Bloco key={i} b={b} />)}
                </section>
            )}

            <section className="bg-grafite text-papel">
                <div className="max-w-4xl mx-auto px-6 py-16">
                    <p className="rotulo mb-4">Quando o kit já não dá conta</p>
                    <h2 className="text-3xl font-medium leading-tight mb-4">Bateu em dois ou mais sinais de limite?</h2>
                    <p className="text-apoio max-w-xl">
                        O Raio-X da Operação é uma conversa de 40 minutos, gratuita, para encontrar onde a sua operação
                        trava e se você precisa mesmo de um sistema.
                    </p>
                    <a href={raioX} className="btn-claro mt-8">Pedir meu Raio-X</a>
                </div>
            </section>
        </Layout>
    );
}
