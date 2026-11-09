import { Link, router } from '@inertiajs/react';
import AdminLayout from '../../admin/AdminLayout';
import { Chip } from '../../admin/Badge';
import { Botao } from '../../admin/Campos';
import { CampoBusca, useFiltros } from '../../admin/Filtros';
import Paginacao from '../../admin/Paginacao';
import { Celula, DataRelativa, Linha, SemDado, Tabela, Vazio } from '../../admin/Tabela';
import { real } from '../../admin/util';

export default function Alunos({ alunos, filtros }) {
    const f = useFiltros('/admin/alunos', filtros);

    return (
        <AdminLayout titulo="Alunos">
            <form
                role="search"
                onSubmit={(e) => {
                    e.preventDefault();
                    f.aplicar();
                }}
                className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4"
            >
                <CampoBusca
                    className="flex-1 max-w-xl"
                    rotulo="Buscar aluno por nome ou e-mail"
                    placeholder="Buscar por nome ou e-mail"
                    valor={f.valores.busca}
                    onChange={(v) => f.mudar('busca', v)}
                    onEnter={f.aplicar}
                />
                <p className="text-sm text-apoio sm:ml-auto" aria-live="polite">
                    {alunos.total === 1 ? '1 aluno' : `${alunos.total.toLocaleString('pt-BR')} alunos`}
                    {f.ativos > 0 ? ' encontrados' : ''}
                </p>
            </form>

            <Tabela
                rotulo="Alunos"
                colunas={[
                    { titulo: 'Aluno' },
                    { titulo: 'Acesso ativo', className: 'hidden md:table-cell' },
                    { titulo: 'Total pago', className: 'text-right hidden sm:table-cell' },
                    { titulo: 'Último acesso' },
                    { titulo: 'Cadastrado em', className: 'hidden lg:table-cell' },
                ]}
                vazio={
                    f.ativos > 0 ? (
                        <Vazio titulo={`Ninguém encontrado para "${filtros.busca}".`} acao={<Botao variante="secundario" onClick={f.limpar}>Limpar busca</Botao>}>
                            A busca olha o nome e o e-mail. Confira a grafia ou procure só por parte do e-mail.
                        </Vazio>
                    ) : (
                        <Vazio titulo="Nenhum aluno ainda.">
                            O cadastro é criado sozinho na primeira compra paga ou quando você libera um acesso.
                        </Vazio>
                    )
                }
            >
                {alunos.data.map((a) => (
                    <Linha key={a.id} onClick={() => router.visit(`/admin/alunos/${a.id}`)}>
                        <Celula>
                            <Link href={`/admin/alunos/${a.id}`} onClick={(e) => e.stopPropagation()} className="font-medium no-underline hover:underline underline-offset-4">
                                {a.nome || <span className="text-apoio font-light">Sem nome</span>}
                            </Link>
                            <span className="block text-xs text-apoio break-all">{a.email}</span>
                        </Celula>
                        <Celula className="hidden md:table-cell">
                            {a.produtos.length ? (
                                <span className="flex flex-wrap gap-1">
                                    {a.produtos.map((p) => (
                                        <Chip key={p}>{p}</Chip>
                                    ))}
                                </span>
                            ) : (
                                <SemDado>nenhum</SemDado>
                            )}
                        </Celula>
                        <Celula className="text-right tabular-nums whitespace-nowrap hidden sm:table-cell">{real(a.total_pago)}</Celula>
                        <Celula>
                            <DataRelativa data={a.ultimo_acesso} vazio="nunca entrou" />
                        </Celula>
                        <Celula className="hidden lg:table-cell whitespace-nowrap text-apoio">{a.cadastrado_em}</Celula>
                    </Linha>
                ))}
            </Tabela>

            <Paginacao pagina={alunos} nome="alunos" />
        </AdminLayout>
    );
}
