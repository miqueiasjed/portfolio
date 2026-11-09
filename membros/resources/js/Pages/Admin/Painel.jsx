import { Head, router, useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { Ponto } from '../../Layout';

const real = (c) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const STATUS = {
    paid: ['Paga', 'text-tinta'],
    pending: ['Pendente', 'text-apoio'],
    canceled: ['Cancelada', 'text-apoio'],
    refunded: ['Reembolsada', 'text-caneta-creme'],
};

function Numero({ rotulo, valor }) {
    return (
        <div className="bg-creme p-6">
            <p className="rotulo mb-2">{rotulo}</p>
            <p className="text-3xl font-medium">{valor}</p>
        </div>
    );
}

export default function Painel({ resumo, compras, produtos, busca }) {
    const { aviso, usuario } = usePage().props;
    const [termo, setTermo] = useState(busca);
    const form = useForm({ email: '', produto: produtos[0]?.slug ?? '' });

    function liberar(e) {
        e.preventDefault();
        form.post('/admin/liberar', { preserveScroll: true, onSuccess: () => form.reset('email') });
    }

    function revogar(c) {
        if (confirm(`Remover o acesso de ${c.email} a "${c.produto}"?`)) {
            router.post(`/admin/compras/${c.id}/revogar`, {}, { preserveScroll: true });
        }
    }

    return (
        <div className="min-h-screen">
            <Head title="Administração" />
            <header className="bg-grafite text-papel">
                <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
                    <span className="rotulo !text-papel">Administração · Área de membros</span>
                    <div className="flex items-center gap-4 text-sm">
                        <span className="text-apoio hidden sm:inline">{usuario?.email}</span>
                        <button onClick={() => router.post('/admin/sair')} className="underline underline-offset-4 decoration-filete cursor-pointer">Sair</button>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-6 py-12">
                <h1 className="text-4xl font-medium mb-8">Vendas<Ponto /></h1>

                {aviso && <p className="mb-6 border-l-2 border-tinta pl-4">{aviso}</p>}

                <div className="grid gap-px bg-filete-claro border border-filete-claro grid-cols-2 lg:grid-cols-4 mb-12">
                    <Numero rotulo="Vendas pagas" valor={resumo.vendas} />
                    <Numero rotulo="Receita total" valor={real(resumo.receita)} />
                    <Numero rotulo="Receita do mês" valor={real(resumo.mes)} />
                    <Numero rotulo="Checkouts abertos" valor={resumo.pendentes} />
                </div>

                <section className="mb-12">
                    <h2 className="text-xl font-medium mb-4">Liberar acesso na mão</h2>
                    <form onSubmit={liberar} className="flex flex-col sm:flex-row gap-3">
                        <input type="email" required placeholder="e-mail do cliente" value={form.data.email}
                            onChange={(e) => form.setData('email', e.target.value)}
                            className="flex-1 border border-filete-claro bg-white px-4 py-3 outline-none focus:border-tinta" />
                        <select value={form.data.produto} onChange={(e) => form.setData('produto', e.target.value)}
                            className="border border-filete-claro bg-white px-4 py-3">
                            {produtos.map((p) => <option key={p.slug} value={p.slug}>{p.nome}</option>)}
                        </select>
                        <button type="submit" disabled={form.processing} className="btn cursor-pointer disabled:opacity-60">Liberar e enviar link</button>
                    </form>
                    {form.errors.email && <p className="text-caneta-creme text-sm mt-2">{form.errors.email}</p>}
                </section>

                <section>
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4">
                        <h2 className="text-xl font-medium">Compras</h2>
                        <form onSubmit={(e) => { e.preventDefault(); router.get('/admin', termo ? { busca: termo } : {}, { preserveState: true }); }}>
                            <input type="search" placeholder="buscar por e-mail" value={termo} onChange={(e) => setTermo(e.target.value)}
                                className="border border-filete-claro bg-white px-4 py-2 text-sm outline-none focus:border-tinta" />
                        </form>
                    </div>
                    <div className="overflow-x-auto border border-filete-claro bg-white">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left border-b border-filete-claro">
                                    {['Data', 'E-mail', 'Produto', 'Status', 'Valor', 'Origem', ''].map((h) => (
                                        <th key={h} className="rotulo font-light px-4 py-3 whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {compras.length === 0 && (
                                    <tr><td colSpan={7} className="px-4 py-8 text-apoio">Nenhuma compra ainda.</td></tr>
                                )}
                                {compras.map((c) => {
                                    const [rotulo, cor] = STATUS[c.status] ?? [c.status, ''];
                                    return (
                                        <tr key={c.id} className="border-b border-filete-claro last:border-0">
                                            <td className="px-4 py-3 whitespace-nowrap">{c.data}</td>
                                            <td className="px-4 py-3">{c.email ?? '—'}</td>
                                            <td className="px-4 py-3">{c.produto}</td>
                                            <td className={`px-4 py-3 ${cor}`}>{rotulo}</td>
                                            <td className="px-4 py-3 whitespace-nowrap">{real(c.valor)}</td>
                                            <td className="px-4 py-3 text-apoio">{c.origem ?? '—'}</td>
                                            <td className="px-4 py-3 text-right">
                                                {c.status === 'paid' && (
                                                    <span className="inline-flex gap-4 whitespace-nowrap">
                                                        <button onClick={() => router.post(`/admin/compras/${c.id}/reenviar`, {}, { preserveScroll: true })} className="underline underline-offset-4 decoration-filete-claro cursor-pointer">Reenviar link</button>
                                                        <button onClick={() => revogar(c)} className="text-caneta-creme underline underline-offset-4 cursor-pointer">Revogar</button>
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </section>
            </main>
        </div>
    );
}
