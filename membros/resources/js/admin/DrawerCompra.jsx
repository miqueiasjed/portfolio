import { Link, router } from '@inertiajs/react';
import { useState } from 'react';
import { BadgeStatus } from './Badge';
import { Botao, BotaoLink } from './Campos';
import Copiar from './Copiar';
import Drawer from './Drawer';
import { IconeEmail, IconeSeta } from './icones';
import { ConfirmModal } from './Modal';
import { SemDado } from './Tabela';
import { lerOrigem, real } from './util';

function Item({ rotulo, children, copiar }) {
    return (
        <div className="py-3 border-b border-filete-claro last:border-0 grid grid-cols-[8.5rem_1fr] gap-3 items-start">
            <dt className="rotulo !text-[11px] pt-0.5">{rotulo}</dt>
            <dd className="text-sm min-w-0 flex items-start gap-2">
                <span className="break-all min-w-0 flex-1">{children ?? <SemDado />}</span>
                {copiar && <Copiar texto={copiar} soIcone rotuloAcessivel={`Copiar ${rotulo.toLowerCase()}`} variante="fantasma" className="-my-1.5" />}
            </dd>
        </div>
    );
}

/** Revogar com confirmação. Usado no detalhe da compra e na lista de acessos do aluno. */
export function useRevogar() {
    const [alvo, setAlvo] = useState(null);
    const [processando, setProcessando] = useState(false);

    function confirmar() {
        setProcessando(true);
        router.post(`/admin/compras/${alvo.id}/revogar`, {}, {
            preserveScroll: true,
            preserveState: true,
            onFinish: () => {
                setProcessando(false);
                setAlvo(null);
            },
        });
    }

    const modal = (
        <ConfirmModal
            aberto={!!alvo}
            onFechar={() => setAlvo(null)}
            onConfirmar={confirmar}
            processando={processando}
            titulo="Revogar acesso?"
            rotuloConfirmar="Revogar acesso"
        >
            <p>
                {alvo?.email ?? 'O aluno'} perde o acesso a <b className="font-medium">{alvo?.produto ?? 'este produto'}</b>.
            </p>
            <p>A compra fica marcada como reembolsada. O estorno no PagBank, se houver, é feito lá.</p>
        </ConfirmModal>
    );

    return { pedir: (compra) => setAlvo(compra), modal };
}

export function reenviarLink(compraId, aoTerminar) {
    router.post(`/admin/compras/${compraId}/reenviar`, {}, { preserveScroll: true, preserveState: true, onFinish: aoTerminar });
}

/** Painel lateral com todos os dados de uma compra e as ações. */
export default function DrawerCompra({ compra, onFechar, mostrarLinkAluno = true }) {
    const [reenviando, setReenviando] = useState(false);
    const revogar = useRevogar();
    const origem = lerOrigem(compra?.origem);

    return (
        <>
            <Drawer
                aberto={!!compra}
                onFechar={onFechar}
                subtitulo="Compra"
                titulo={compra?.produto?.nome ?? 'Produto removido'}
                rodape={
                    compra && (compra.pode_reenviar || compra.pode_revogar || (mostrarLinkAluno && compra.aluno)) ? (
                        <div className="flex flex-wrap gap-2">
                            {compra.pode_reenviar && (
                                <Botao
                                    variante="secundario"
                                    icone={IconeEmail}
                                    carregando={reenviando}
                                    onClick={() => {
                                        setReenviando(true);
                                        reenviarLink(compra.id, () => setReenviando(false));
                                    }}
                                >
                                    Reenviar link de acesso
                                </Botao>
                            )}
                            {mostrarLinkAluno && compra.aluno && (
                                <BotaoLink variante="secundario" href={`/admin/alunos/${compra.aluno.id}`} icone={IconeSeta}>
                                    Ver aluno
                                </BotaoLink>
                            )}
                            {compra.pode_revogar && (
                                <Botao
                                    variante="perigoLeve"
                                    className="sm:ml-auto"
                                    onClick={() => revogar.pedir({ id: compra.id, email: compra.email, produto: compra.produto?.nome })}
                                >
                                    Revogar acesso
                                </Botao>
                            )}
                        </div>
                    ) : null
                }
            >
                {compra && (
                    <>
                        <div className="flex items-center justify-between gap-4 mb-6">
                            <BadgeStatus status={compra.status} rotulo={compra.status_rotulo} />
                            <p className="text-2xl font-medium tabular-nums">{real(compra.valor)}</p>
                        </div>
                        <dl>
                            <Item rotulo="E-mail" copiar={compra.email}>{compra.email}</Item>
                            <Item rotulo="Aluno">
                                {compra.aluno ? (
                                    mostrarLinkAluno ? (
                                        <Link href={`/admin/alunos/${compra.aluno.id}`} className="underline underline-offset-4 decoration-filete-claro hover:decoration-tinta">
                                            {compra.aluno.nome || compra.aluno.email}
                                        </Link>
                                    ) : (
                                        compra.aluno.nome || compra.aluno.email
                                    )
                                ) : (
                                    <SemDado>sem aluno vinculado</SemDado>
                                )}
                            </Item>
                            <Item rotulo="Criada em">{compra.criada_em}</Item>
                            <Item rotulo="Paga em">{compra.paga_em ?? <SemDado>não paga</SemDado>}</Item>
                            {origem.length === 0 ? (
                                <Item rotulo="Origem"><SemDado>direta</SemDado></Item>
                            ) : (
                                origem.map(([k, v]) => (
                                    <Item key={k} rotulo={k}>{v}</Item>
                                ))
                            )}
                            <Item rotulo="Referência" copiar={compra.reference}>
                                <span className="font-mono text-xs">{compra.reference}</span>
                            </Item>
                            <Item rotulo="Checkout PagBank" copiar={compra.pagbank_checkout_id}>
                                {compra.pagbank_checkout_id && <span className="font-mono text-xs">{compra.pagbank_checkout_id}</span>}
                            </Item>
                            <Item rotulo="Pedido PagBank" copiar={compra.pagbank_order_id}>
                                {compra.pagbank_order_id && <span className="font-mono text-xs">{compra.pagbank_order_id}</span>}
                            </Item>
                        </dl>
                    </>
                )}
            </Drawer>
            {revogar.modal}
        </>
    );
}
