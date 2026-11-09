import { usePage } from '@inertiajs/react';
import { useState } from 'react';
import AdminLayout from '../../admin/AdminLayout';
import { BadgeStatus } from '../../admin/Badge';
import { Botao, classesBotao, Entrada, Selecao } from '../../admin/Campos';
import DrawerCompra from '../../admin/DrawerCompra';
import { CampoBusca, useFiltros } from '../../admin/Filtros';
import { IconeBaixar } from '../../admin/icones';
import Paginacao from '../../admin/Paginacao';
import { Celula, Linha, SemDado, Tabela, Vazio } from '../../admin/Tabela';
import { numero, origemCurta, real, semVazios } from '../../admin/util';

export default function Compras({ compras, filtros, resumo, statusOpcoes }) {
    const { adminProdutos = [] } = usePage().props;
    const f = useFiltros('/admin/compras', filtros);
    const [aberta, setAberta] = useState(null);
    const compraAberta = compras.data.find((c) => c.id === aberta) ?? null;
    const exportar = '/admin/compras/exportar' + (() => {
        const q = new URLSearchParams(semVazios(filtros)).toString();
        return q ? `?${q}` : '';
    })();

    return (
        <AdminLayout
            titulo="Compras"
            acoes={
                <a href={exportar} className={classesBotao('secundario', 'md', 'max-sm:!px-2.5')} aria-label="Exportar CSV com os filtros atuais">
                    <IconeBaixar tamanho={16} />
                    <span className="hidden sm:inline">Exportar CSV</span>
                </a>
            }
        >
            <form
                role="search"
                onSubmit={(e) => {
                    e.preventDefault();
                    f.aplicar();
                }}
                className="bg-white border border-filete-claro p-4 mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_10rem_12rem_9.5rem_9.5rem]"
            >
                <div className="sm:col-span-2 lg:col-span-1">
                    <p className="rotulo !text-[11px] mb-1.5" aria-hidden="true">Busca</p>
                    <CampoBusca
                        rotulo="Buscar por e-mail ou referência"
                        placeholder="E-mail ou referência"
                        valor={f.valores.busca}
                        onChange={(v) => f.mudar('busca', v)}
                        onEnter={f.aplicar}
                    />
                </div>
                <Selecao rotulo="Status" value={f.valores.status} onChange={(e) => f.mudar('status', e.target.value)}>
                    <option value="">Todos</option>
                    {statusOpcoes.map((s) => (
                        <option key={s.valor} value={s.valor}>{s.rotulo}</option>
                    ))}
                </Selecao>
                <Selecao rotulo="Produto" value={f.valores.produto} onChange={(e) => f.mudar('produto', e.target.value)}>
                    <option value="">Todos</option>
                    {adminProdutos.map((p) => (
                        <option key={p.slug} value={p.slug}>{p.nome}</option>
                    ))}
                </Selecao>
                <Entrada rotulo="De" type="date" value={f.valores.de} max={f.valores.ate || undefined} onChange={(e) => f.mudar('de', e.target.value)} />
                <Entrada rotulo="Até" type="date" value={f.valores.ate} min={f.valores.de || undefined} onChange={(e) => f.mudar('ate', e.target.value)} />
            </form>

            <div className="flex flex-wrap items-center justify-between gap-3 mb-4 text-sm">
                <p className="text-apoio" aria-live="polite">
                    {resumo.quantidade === 1 ? '1 compra' : `${numero(resumo.quantidade)} compras`}
                    {f.ativos > 0 ? ' com estes filtros' : ''}
                    <span className="mx-2" aria-hidden="true">·</span>
                    <span className="text-tinta">{real(resumo.pagas_centavos)}</span> em compras pagas
                </p>
                {f.ativos > 0 && (
                    <Botao variante="fantasma" tamanho="sm" onClick={f.limpar}>
                        Limpar filtros ({f.ativos})
                    </Botao>
                )}
            </div>

            <Tabela
                rotulo="Compras"
                colunas={[
                    { titulo: 'Criada em' },
                    { titulo: 'E-mail' },
                    { titulo: 'Produto', className: 'hidden md:table-cell' },
                    { titulo: 'Status' },
                    { titulo: 'Valor', className: 'text-right' },
                    { titulo: 'Origem', className: 'hidden lg:table-cell' },
                ]}
                vazio={
                    f.ativos > 0 ? (
                        <Vazio titulo="Nenhuma compra com esses filtros." acao={<Botao variante="secundario" onClick={f.limpar}>Limpar filtros</Botao>}>
                            Tente outro período ou tire algum filtro.
                        </Vazio>
                    ) : (
                        <Vazio titulo="Nenhuma compra ainda.">
                            Quando alguém comprar pelo link de um curso, a compra aparece aqui. Liberações manuais também.
                        </Vazio>
                    )
                }
            >
                {compras.data.map((c) => (
                    <Linha key={c.id} onClick={() => setAberta(c.id)} ativa={c.id === aberta}>
                        <Celula className="whitespace-nowrap text-apoio">
                            {c.criada_em}
                            {c.paga_em && c.paga_em !== c.criada_em && <span className="block text-xs">paga {c.paga_em}</span>}
                        </Celula>
                        <Celula>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setAberta(c.id);
                                }}
                                className="text-left hover:underline underline-offset-4 cursor-pointer break-all"
                                aria-label={`Ver detalhes da compra de ${c.email ?? 'e-mail não informado'}`}
                            >
                                {c.email ?? <SemDado />}
                            </button>
                            {c.aluno?.nome && <span className="block text-xs text-apoio">{c.aluno.nome}</span>}
                        </Celula>
                        <Celula className="hidden md:table-cell">{c.produto?.nome ?? <SemDado />}</Celula>
                        <Celula><BadgeStatus status={c.status} rotulo={c.status_rotulo} /></Celula>
                        <Celula className="text-right tabular-nums whitespace-nowrap">{real(c.valor)}</Celula>
                        <Celula className="hidden lg:table-cell text-apoio max-w-40 truncate" title={c.origem ?? undefined}>
                            {origemCurta(c.origem) ?? <SemDado>direta</SemDado>}
                        </Celula>
                    </Linha>
                ))}
            </Tabela>

            <Paginacao pagina={compras} nome="compras" />

            <DrawerCompra compra={compraAberta} onFechar={() => setAberta(null)} />
        </AdminLayout>
    );
}
