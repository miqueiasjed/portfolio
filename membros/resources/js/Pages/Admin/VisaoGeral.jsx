import { Link } from '@inertiajs/react';
import { useState } from 'react';
import AdminLayout, { Secao } from '../../admin/AdminLayout';
import { BadgeStatus } from '../../admin/Badge';
import DrawerCompra from '../../admin/DrawerCompra';
import GraficoBarras from '../../admin/GraficoBarras';
import { IconeSeta } from '../../admin/icones';
import { Celula, Linha, SemDado, Tabela, Vazio } from '../../admin/Tabela';
import { numero, real } from '../../admin/util';

function Numero({ rotulo, valor, detalhe, href, className = '' }) {
    const conteudo = (
        <>
            <p className="rotulo !text-[11px] mb-3">{rotulo}</p>
            <p className="text-2xl sm:text-3xl font-medium tabular-nums">{valor}</p>
            {detalhe && <p className="text-xs text-apoio mt-1.5">{detalhe}</p>}
        </>
    );
    return href ? (
        <Link href={href} className={`block bg-white p-5 no-underline hover:bg-papel transition-colors ${className}`}>
            {conteudo}
        </Link>
    ) : (
        <div className={`bg-white p-5 ${className}`}>{conteudo}</div>
    );
}

export default function VisaoGeral({ numeros, receita30, porProduto, ultimas }) {
    const [aberta, setAberta] = useState(null);
    const compraAberta = ultimas.find((c) => c.id === aberta) ?? null;
    const total30 = receita30.reduce((s, d) => s + d.centavos, 0);
    const maiorProduto = Math.max(...porProduto.map((p) => p.centavos), 0);

    return (
        <AdminLayout titulo="Visão geral">
            <div className="grid gap-px bg-filete-claro border border-filete-claro grid-cols-2 lg:grid-cols-5 mb-10">
                <Numero rotulo="Vendas pagas" valor={numero(numeros.vendas)} detalhe="sem liberações manuais" />
                <Numero rotulo="Receita total" valor={real(numeros.receita)} />
                <Numero rotulo="Receita do mês" valor={real(numeros.mes)} />
                <Numero rotulo="Alunos com acesso" valor={numero(numeros.alunos_ativos)} href="/admin/alunos" />
                <Numero
                    rotulo="Checkouts abertos"
                    valor={numero(numeros.checkouts_abertos)}
                    detalhe="aguardando pagamento"
                    href="/admin/compras?status=pending"
                    className="col-span-2 lg:col-span-1"
                />
            </div>

            <div className="grid gap-10 lg:grid-cols-[1fr_20rem] mb-10">
                <Secao titulo="Receita nos últimos 30 dias" descricao={`${real(total30)} no período`} className="!mb-0">
                    <div className="bg-white border border-filete-claro p-5 pt-10">
                        {total30 === 0 ? (
                            <Vazio titulo="Nenhuma venda paga nos últimos 30 dias.">Quando entrar uma, a barra do dia aparece aqui.</Vazio>
                        ) : (
                            <GraficoBarras
                                titulo="Receita por dia nos últimos 30 dias"
                                itens={receita30.map((d) => ({ dia: d.dia, rotulo: d.rotulo, valor: d.centavos }))}
                            />
                        )}
                    </div>
                </Secao>

                <Secao titulo="Vendas por produto" className="!mb-0">
                    <ul className="bg-white border border-filete-claro divide-y divide-filete-claro">
                        {porProduto.length === 0 && (
                            <li className="p-5 text-sm text-apoio">Nenhum produto cadastrado.</li>
                        )}
                        {porProduto.map((p) => (
                            <li key={p.slug} className="p-4">
                                <div className="flex items-baseline justify-between gap-3">
                                    <Link href={`/admin/compras?produto=${encodeURIComponent(p.slug)}`} className="text-sm font-medium no-underline hover:underline underline-offset-4 truncate">
                                        {p.nome}
                                    </Link>
                                    <span className="text-sm tabular-nums whitespace-nowrap">{real(p.centavos)}</span>
                                </div>
                                <div className="h-1 bg-creme mt-2" aria-hidden="true">
                                    <div className="h-full bg-grafite" style={{ width: `${maiorProduto ? (p.centavos / maiorProduto) * 100 : 0}%` }} />
                                </div>
                                <p className="text-xs text-apoio mt-1.5">{p.vendas === 1 ? '1 venda paga' : `${numero(p.vendas)} vendas pagas`}</p>
                            </li>
                        ))}
                    </ul>
                </Secao>
            </div>

            <Secao
                titulo="Últimas compras"
                acao={
                    <Link href="/admin/compras" className="inline-flex items-center gap-1.5 text-sm no-underline hover:underline underline-offset-4">
                        Ver todas as compras <IconeSeta tamanho={16} />
                    </Link>
                }
            >
                <Tabela
                    rotulo="Últimas compras"
                    colunas={[{ titulo: 'Data' }, { titulo: 'E-mail' }, { titulo: 'Produto', className: 'hidden md:table-cell' }, { titulo: 'Status' }, { titulo: 'Valor', className: 'text-right' }]}
                    vazio={<Vazio titulo="Nenhuma compra ainda.">Quando alguém comprar pelo link de um curso, aparece aqui.</Vazio>}
                >
                    {ultimas.map((c) => (
                        <Linha key={c.id} onClick={() => setAberta(c.id)}>
                            <Celula className="whitespace-nowrap text-apoio">{c.criada_em}</Celula>
                            <Celula>
                                <button type="button" onClick={(e) => { e.stopPropagation(); setAberta(c.id); }} className="text-left hover:underline underline-offset-4 cursor-pointer break-all">
                                    {c.email ?? <SemDado />}
                                </button>
                            </Celula>
                            <Celula className="hidden md:table-cell">{c.produto?.nome ?? <SemDado />}</Celula>
                            <Celula><BadgeStatus status={c.status} rotulo={c.status_rotulo} /></Celula>
                            <Celula className="text-right tabular-nums whitespace-nowrap">{real(c.valor)}</Celula>
                        </Linha>
                    ))}
                </Tabela>
            </Secao>

            <DrawerCompra compra={compraAberta} onFechar={() => setAberta(null)} />
        </AdminLayout>
    );
}
