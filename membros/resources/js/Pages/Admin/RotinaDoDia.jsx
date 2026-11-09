import { Link, router } from '@inertiajs/react';
import { useState } from 'react';
import AdminLayout, { Secao } from '../../admin/AdminLayout';
import { Chip } from '../../admin/Badge';
import { Botao } from '../../admin/Campos';
import { IconeEmail } from '../../admin/icones';
import Paginacao from '../../admin/Paginacao';
import { Celula, DataRelativa, Linha, SemDado, Tabela, Vazio } from '../../admin/Tabela';
import { numero, plural } from '../../admin/util';

/** Número grande com a referência embaixo. "de" fica menor para o número principal saltar. */
function Numero({ rotulo, valor, de, referencia, alerta = false }) {
    return (
        <div className={`bg-white p-5 ${alerta ? 'border-l-2 border-caneta-creme' : ''}`}>
            <p className="rotulo !text-[11px] mb-3">{rotulo}</p>
            <p className={`text-2xl sm:text-3xl font-medium tabular-nums ${alerta ? 'text-caneta-creme' : ''}`}>
                {numero(valor)}
                {de !== undefined && <span className="text-base font-light"> de {numero(de)}</span>}
            </p>
            {referencia && <p className="text-xs text-tinta mt-1.5">{referencia}</p>}
        </div>
    );
}

function Resumo({ resumo, metas }) {
    const semEnvio = resumo.sem_primeiro_envio_7_dias;
    return (
        <Secao titulo="Seguir ou parar">
            <div className="grid gap-px bg-filete-claro border border-filete-claro grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                <Numero rotulo="Vendas" valor={resumo.vendas} referencia={`meta ${metas.vendas}, mínimo ${metas.minimo_vendas}`} />
                <Numero
                    rotulo={`Usaram ${metas.usos_semana1} dias ou mais na semana 1`}
                    valor={resumo.com_3_dias_de_uso_semana1}
                    de={resumo.semana1_completa}
                    referencia={resumo.semana1_completa === 0 ? `meta ${metas.vendas_com_uso}; nenhuma semana 1 fechou ainda` : `meta ${metas.vendas_com_uso}`}
                />
                <Numero rotulo="Primeiro envio em 24 h" valor={resumo.com_primeiro_envio_24h} de={resumo.vendas} />
                <Numero rotulo="Sem primeiro envio há 7 dias" valor={semEnvio} alerta={semEnvio > 0} />
            </div>
            <p className="text-sm mt-4">Média de envios na semana 1: {numero(resumo.media_envios_semana1)}</p>
            <p className="text-xs text-tinta mt-1">24 h conta o dia da compra e o dia seguinte. O aparelho manda só o dia do envio, sem a hora.</p>
        </Secao>
    );
}

function SemPrimeiroEnvio({ pessoas }) {
    const [enviando, setEnviando] = useState({});

    function enviarLink(id) {
        setEnviando((e) => ({ ...e, [id]: true }));
        router.post(`/admin/alunos/${id}/link`, {}, {
            preserveScroll: true,
            preserveState: true,
            onFinish: () => setEnviando((e) => ({ ...e, [id]: false })),
        });
    }

    if (!pessoas.length) return null;

    return (
        <Secao titulo="Sem primeiro envio há 7 dias">
            <ul className="border border-filete-claro bg-white">
                {pessoas.map((p) => (
                    <li key={p.user_id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 border-b border-filete-claro last:border-0">
                        <div className="min-w-0 flex-1">
                            <Link href={`/admin/alunos/${p.user_id}`} className="font-medium no-underline hover:underline underline-offset-4">
                                {p.nome || <span className="font-light">Sem nome</span>}
                            </Link>
                            <span className="block text-xs break-all">{p.email}</span>
                            <span className="block text-xs mt-0.5">comprou há {plural(p.dias_desde_a_compra, 'dia', 'dias')}</span>
                        </div>
                        <Botao
                            variante="secundario"
                            icone={IconeEmail}
                            carregando={!!enviando[p.user_id]}
                            onClick={() => enviarLink(p.user_id)}
                            aria-label={`Enviar link de entrada para ${p.nome || p.email}`}
                            className="self-start sm:self-center"
                        >
                            Enviar link de entrada
                        </Botao>
                    </li>
                ))}
            </ul>
        </Secao>
    );
}

function PrimeiroEnvio({ c }) {
    if (!c.primeiro_envio) return <SemDado>nenhum</SemDado>;
    return (
        <span className="flex flex-col items-start gap-1">
            <span className="whitespace-nowrap">{c.primeiro_envio}</span>
            {c.primeiro_envio_24h ? <Chip tom="ok">em 24 h</Chip> : <Chip tom="apagado">depois de 24 h</Chip>}
        </span>
    );
}

function Semana1({ c }) {
    return (
        <span className="flex flex-col items-start gap-1">
            <span className="whitespace-nowrap">{plural(c.envios_semana1, 'envio', 'envios')}</span>
            <span className="whitespace-nowrap text-xs">{plural(c.dias_de_uso_semana1, 'dia de uso', 'dias de uso')}</span>
            {!c.semana1_completa && <Chip tom="apagado">em andamento</Chip>}
        </span>
    );
}

function Compradores({ compradores }) {
    return (
        <Secao titulo="Compradores">
            <Tabela
                rotulo="Compradores do Rotina do Dia"
                colunas={[
                    { titulo: 'Comprador' },
                    { titulo: 'Compra', className: 'hidden lg:table-cell' },
                    { titulo: 'Primeiro envio', className: 'hidden sm:table-cell' },
                    { titulo: 'Semana 1' },
                    { titulo: 'Último uso', className: 'hidden md:table-cell' },
                    { titulo: 'Aparelhos', className: 'text-right hidden lg:table-cell' },
                ]}
                vazio={<Vazio titulo="Nenhuma venda do Rotina do Dia ainda." />}
            >
                {compradores.data.map((c) => (
                    <Linha key={c.user_id} onClick={() => router.visit(`/admin/alunos/${c.user_id}`)}>
                        <Celula>
                            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <Link href={`/admin/alunos/${c.user_id}`} onClick={(e) => e.stopPropagation()} className="font-medium no-underline hover:underline underline-offset-4">
                                    {c.nome || <span className="font-light">Sem nome</span>}
                                </Link>
                                {c.cortesia && <Chip tom="apagado">cortesia</Chip>}
                            </span>
                            <span className="block text-xs break-all">{c.email}</span>
                        </Celula>
                        <Celula className="hidden lg:table-cell whitespace-nowrap">{c.comprado_em}</Celula>
                        <Celula className="hidden sm:table-cell">
                            <PrimeiroEnvio c={c} />
                        </Celula>
                        <Celula>
                            <Semana1 c={c} />
                        </Celula>
                        <Celula className="hidden md:table-cell">
                            <DataRelativa data={c.ultimo_uso} vazio="nunca abriu" />
                        </Celula>
                        <Celula className="hidden lg:table-cell text-right tabular-nums">{numero(c.aparelhos_ativos)}</Celula>
                    </Linha>
                ))}
            </Tabela>

            <Paginacao pagina={compradores} nome="compradores" />
        </Secao>
    );
}

export default function RotinaDoDia({ resumo, compradores, semPrimeiroEnvio, metas }) {
    return (
        <AdminLayout titulo="Rotina do Dia">
            <Resumo resumo={resumo} metas={metas} />
            <SemPrimeiroEnvio pessoas={semPrimeiroEnvio} />
            <Compradores compradores={compradores} />
        </AdminLayout>
    );
}
