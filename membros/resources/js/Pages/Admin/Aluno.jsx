import { router, useForm } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import AdminLayout, { Secao } from '../../admin/AdminLayout';
import { BadgeStatus, Chip } from '../../admin/Badge';
import { Barra, Botao } from '../../admin/Campos';
import Copiar from '../../admin/Copiar';
import DrawerCompra, { reenviarLink, useRevogar } from '../../admin/DrawerCompra';
import { IconeEmail, IconeLapis, IconeMais } from '../../admin/icones';
import { useLiberar } from '../../admin/LiberarAcesso';
import { Celula, DataRelativa, Linha, SemDado, Tabela, Vazio } from '../../admin/Tabela';
import { origemCurta, real } from '../../admin/util';

function NomeEditavel({ aluno }) {
    const [editando, setEditando] = useState(false);
    const form = useForm({ nome: aluno.nome ?? '' });
    const campo = useRef(null);
    const botao = useRef(null);
    const voltarFoco = useRef(false);

    // nome salvo vira o novo ponto de partida do campo
    useEffect(() => {
        if (!editando) form.setData('nome', aluno.nome ?? '');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [aluno.nome]);

    useEffect(() => {
        if (editando) campo.current?.select();
        else if (voltarFoco.current) {
            voltarFoco.current = false;
            botao.current?.focus();
        }
    }, [editando]);

    function cancelar() {
        form.setData('nome', aluno.nome ?? '');
        form.clearErrors();
        voltarFoco.current = true;
        setEditando(false);
    }

    function salvar(e) {
        e.preventDefault();
        if ((form.data.nome ?? '') === (aluno.nome ?? '')) return cancelar();
        form.patch(`/admin/alunos/${aluno.id}`, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => {
                voltarFoco.current = true;
                setEditando(false);
            },
        });
    }

    if (editando) {
        return (
            <form onSubmit={salvar} className="w-full max-w-lg">
                <label htmlFor="nome-aluno" className="sr-only">Nome do aluno</label>
                <div className="flex flex-col sm:flex-row gap-2">
                    <input
                        id="nome-aluno"
                        ref={campo}
                        value={form.data.nome}
                        maxLength={255}
                        placeholder="Nome do aluno"
                        onChange={(e) => form.setData('nome', e.target.value)}
                        onKeyDown={(e) => e.key === 'Escape' && (e.preventDefault(), cancelar())}
                        aria-invalid={form.errors.nome ? true : undefined}
                        aria-describedby={form.errors.nome ? 'nome-aluno-erro' : 'nome-aluno-dica'}
                        className="flex-1 bg-white border border-tinta px-3 py-2 text-xl font-medium outline-none"
                    />
                    <div className="flex gap-2">
                        <Botao type="submit" carregando={form.processing}>Salvar</Botao>
                        <Botao variante="secundario" onClick={cancelar} disabled={form.processing}>Cancelar</Botao>
                    </div>
                </div>
                {form.errors.nome ? (
                    <p id="nome-aluno-erro" role="alert" className="text-caneta-creme text-sm mt-1.5">{form.errors.nome}</p>
                ) : (
                    <p id="nome-aluno-dica" className="text-xs text-apoio mt-1.5">Deixe em branco para apagar o nome. Esc cancela.</p>
                )}
            </form>
        );
    }

    return (
        <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-2xl font-medium truncate">{aluno.nome || <span className="text-apoio font-light">Sem nome</span>}</h2>
            <button
                ref={botao}
                type="button"
                onClick={() => setEditando(true)}
                aria-label="Editar nome"
                title="Editar nome"
                className="p-1.5 text-apoio hover:text-tinta cursor-pointer"
            >
                <IconeLapis tamanho={16} />
            </button>
        </div>
    );
}

function Meta({ rotulo, children }) {
    return (
        <div>
            <dt className="rotulo !text-[11px]">{rotulo}</dt>
            <dd className="text-sm mt-1">{children}</dd>
        </div>
    );
}

function Cabecalho({ aluno }) {
    const { abrir } = useLiberar();
    const [enviando, setEnviando] = useState(false);

    function enviarLink() {
        setEnviando(true);
        router.post(`/admin/alunos/${aluno.id}/link`, {}, { preserveScroll: true, preserveState: true, onFinish: () => setEnviando(false) });
    }

    return (
        <div className="bg-white border border-filete-claro p-5 sm:p-6 mb-10">
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
                <div className="min-w-0 flex-1">
                    <NomeEditavel aluno={aluno} />
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="text-sm break-all">{aluno.email}</span>
                        <Copiar texto={aluno.email} soIcone rotuloAcessivel="Copiar e-mail" variante="fantasma" />
                        {aluno.email_verificado ? <Chip tom="ok">Já entrou pelo link</Chip> : <Chip tom="alerta">Ainda não entrou</Chip>}
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Botao variante="secundario" icone={IconeEmail} carregando={enviando} onClick={enviarLink}>
                        Enviar link de entrada
                    </Botao>
                    <Botao icone={IconeMais} onClick={() => abrir({ email: aluno.email })}>
                        Liberar produto
                    </Botao>
                </div>
            </div>
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6 pt-5 border-t border-filete-claro">
                <Meta rotulo="Último acesso">
                    <DataRelativa data={aluno.ultimo_acesso} vazio="nunca entrou" />
                </Meta>
                <Meta rotulo="Cadastrado em">{aluno.cadastrado_em}</Meta>
                <Meta rotulo="Total pago"><span className="tabular-nums">{real(aluno.total_pago)}</span></Meta>
            </dl>
            <p className="text-xs text-apoio mt-4">O link de entrada vale 30 minutos e leva direto para a área do aluno.</p>
        </div>
    );
}

function Acessos({ aluno, acessos }) {
    const revogar = useRevogar();
    const { abrir } = useLiberar();
    const [reenviando, setReenviando] = useState(null);

    return (
        <Secao titulo="Acessos ativos" descricao="Uma linha por compra paga.">
            <Tabela
                rotulo="Acessos ativos"
                colunas={[
                    { titulo: 'Produto' },
                    { titulo: 'Desde', className: 'hidden sm:table-cell' },
                    { titulo: 'Origem', className: 'hidden md:table-cell' },
                    { titulo: 'Valor', className: 'text-right hidden sm:table-cell' },
                    { titulo: 'Ações', sr: true, className: 'text-right' },
                ]}
                vazio={
                    <Vazio titulo="Nenhum acesso ativo." acao={<Botao variante="secundario" icone={IconeMais} onClick={() => abrir({ email: aluno.email })}>Liberar produto</Botao>}>
                        Libere um produto para dar acesso sem pagamento.
                    </Vazio>
                }
            >
                {acessos.map((a) => (
                    <Linha key={a.compra_id}>
                        <Celula className="font-medium">
                            {a.produto.nome}
                            <span className="block sm:hidden text-xs text-apoio font-light">desde {a.desde}</span>
                        </Celula>
                        <Celula className="hidden sm:table-cell whitespace-nowrap text-apoio">{a.desde}</Celula>
                        <Celula className="hidden md:table-cell text-apoio">{origemCurta(a.origem) ?? <SemDado>direta</SemDado>}</Celula>
                        <Celula className="hidden sm:table-cell text-right tabular-nums">{real(a.valor)}</Celula>
                        <Celula className="text-right">
                            <span className="inline-flex flex-wrap justify-end gap-2">
                                {a.pode_reenviar && (
                                    <Botao
                                        variante="secundario"
                                        tamanho="sm"
                                        carregando={reenviando === a.compra_id}
                                        onClick={() => {
                                            setReenviando(a.compra_id);
                                            reenviarLink(a.compra_id, () => setReenviando(null));
                                        }}
                                        aria-label={`Reenviar link de acesso de ${a.produto.nome}`}
                                    >
                                        Reenviar link
                                    </Botao>
                                )}
                                <Botao
                                    variante="perigoLeve"
                                    tamanho="sm"
                                    onClick={() => revogar.pedir({ id: a.compra_id, email: aluno.email, produto: a.produto.nome })}
                                    aria-label={`Revogar acesso a ${a.produto.nome}`}
                                >
                                    Revogar
                                </Botao>
                            </span>
                        </Celula>
                    </Linha>
                ))}
            </Tabela>
            {revogar.modal}
        </Secao>
    );
}

function Progresso({ progresso }) {
    if (progresso.length === 0) return null;
    return (
        <Secao titulo="Progresso nos cursos">
            <ul className="grid gap-px bg-filete-claro border border-filete-claro sm:grid-cols-2">
                {progresso.map((p) => (
                    <li key={p.produto.slug} className="bg-white p-5">
                        <div className="flex items-baseline justify-between gap-3">
                            <p className="font-medium">{p.produto.nome}</p>
                            {p.total > 0 && <span className="text-sm tabular-nums">{p.percentual}%</span>}
                        </div>
                        {p.total > 0 ? (
                            <>
                                <Barra percentual={p.percentual} rotulo={`Progresso em ${p.produto.nome}`} className="mt-3" />
                                <p className="text-sm text-apoio mt-2">
                                    {p.concluidas} de {p.total} {p.total === 1 ? 'aula concluída' : 'aulas concluídas'}
                                </p>
                                <p className="text-xs text-apoio mt-1">
                                    {p.ultima_concluida ? (
                                        <>Última: <span className="text-tinta">{p.ultima_concluida.titulo}</span>, em {p.ultima_concluida.em}</>
                                    ) : (
                                        'Ainda não concluiu nenhuma aula.'
                                    )}
                                </p>
                            </>
                        ) : (
                            <p className="text-sm text-apoio mt-2">Sem aulas. Este produto não tem curso montado.</p>
                        )}
                    </li>
                ))}
            </ul>
        </Secao>
    );
}

function Historico({ compras }) {
    const [aberta, setAberta] = useState(null);
    const compraAberta = compras.find((c) => c.id === aberta) ?? null;

    return (
        <Secao titulo="Compras" descricao="Todas as situações, das mais recentes para as mais antigas.">
            <Tabela
                rotulo="Histórico de compras"
                colunas={[{ titulo: 'Criada em' }, { titulo: 'Produto' }, { titulo: 'Status' }, { titulo: 'Valor', className: 'text-right' }]}
                vazio={<Vazio titulo="Nenhuma compra registrada." />}
            >
                {compras.map((c) => (
                    <Linha key={c.id} onClick={() => setAberta(c.id)} ativa={c.id === aberta}>
                        <Celula className="whitespace-nowrap text-apoio">{c.criada_em}</Celula>
                        <Celula>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setAberta(c.id);
                                }}
                                className="text-left hover:underline underline-offset-4 cursor-pointer"
                            >
                                {c.produto?.nome ?? 'Produto removido'}
                            </button>
                        </Celula>
                        <Celula><BadgeStatus status={c.status} rotulo={c.status_rotulo} /></Celula>
                        <Celula className="text-right tabular-nums whitespace-nowrap">{real(c.valor)}</Celula>
                    </Linha>
                ))}
            </Tabela>
            <DrawerCompra compra={compraAberta} onFechar={() => setAberta(null)} mostrarLinkAluno={false} />
        </Secao>
    );
}

export default function Aluno({ aluno, acessos, progresso, compras }) {
    const nome = aluno.nome || aluno.email;
    return (
        <AdminLayout titulo={nome} migalhas={[{ rotulo: 'Alunos', href: '/admin/alunos' }, { rotulo: nome }]}>
            <Cabecalho aluno={aluno} />
            <Acessos aluno={aluno} acessos={acessos} />
            <Progresso progresso={progresso} />
            <Historico compras={compras} />
        </AdminLayout>
    );
}
