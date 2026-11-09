import { Link } from '@inertiajs/react';
import AdminLayout from '../../admin/AdminLayout';
import { Chip } from '../../admin/Badge';
import { BotaoLink } from '../../admin/Campos';
import Copiar from '../../admin/Copiar';
import { IconeAlunos, IconeCursos, IconeLapis, IconeMais } from '../../admin/icones';
import { Vazio } from '../../admin/Tabela';
import { plural, real } from '../../admin/util';

function Cartao({ curso }) {
    const href = `/admin/cursos/${curso.slug}`;
    return (
        <li className="bg-white flex flex-col">
            <div className="p-5 flex-1">
                <div className="flex items-start justify-between gap-3">
                    <h2 className="font-medium leading-snug">
                        <Link href={href} className="no-underline hover:underline underline-offset-4">{curso.nome}</Link>
                    </h2>
                    {curso.ativo ? <Chip tom="ok">Ativo</Chip> : <Chip tom="apagado" title="Não abre checkout">Inativo</Chip>}
                </div>
                <p className="text-xs text-apoio mt-1 font-mono break-all">/{curso.slug}</p>
                {curso.descricao && <p className="text-sm text-tinta/80 mt-3 line-clamp-2">{curso.descricao}</p>}
                <p className="text-2xl font-medium mt-4 tabular-nums">{real(curso.preco_centavos)}</p>
                <ul className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-sm text-apoio">
                    <li className="inline-flex items-center gap-1.5">
                        <IconeAlunos tamanho={15} /> {plural(curso.alunos, 'aluno', 'alunos')}
                    </li>
                    <li className="inline-flex items-center gap-1.5">
                        <IconeCursos tamanho={15} /> {plural(curso.modulos, 'módulo', 'módulos')}, {plural(curso.aulas, 'aula', 'aulas')}
                    </li>
                </ul>
            </div>
            <div className="border-t border-filete-claro px-5 py-3 flex flex-wrap items-center gap-2">
                <BotaoLink href={href} variante="secundario" tamanho="sm" icone={IconeLapis}>
                    Editar
                </BotaoLink>
                <Copiar texto={curso.link_compra} rotulo="Copiar link de compra" rotuloAcessivel={`Copiar link de compra de ${curso.nome}`} variante="fantasma" />
            </div>
        </li>
    );
}

export default function Cursos({ cursos }) {
    return (
        <AdminLayout
            titulo="Cursos"
            acoes={
                <BotaoLink href="/admin/cursos/novo" variante="secundario" icone={IconeMais} className="max-sm:!px-2.5" aria-label="Novo curso">
                    <span className="hidden sm:inline">Novo curso</span>
                </BotaoLink>
            }
        >
            {cursos.length === 0 ? (
                <div className="bg-white border border-filete-claro">
                    <Vazio titulo="Nenhum curso cadastrado." acao={<BotaoLink href="/admin/cursos/novo" icone={IconeMais}>Criar o primeiro curso</BotaoLink>}>
                        Crie o curso, monte os módulos e as aulas e copie o link de compra para divulgar.
                    </Vazio>
                </div>
            ) : (
                <ul className="grid gap-px bg-filete-claro border border-filete-claro sm:grid-cols-2 xl:grid-cols-3">
                    {cursos.map((c) => (
                        <Cartao key={c.id} curso={c} />
                    ))}
                    {cursos.length % 3 !== 0 && <li className="hidden xl:block bg-creme" aria-hidden="true" style={{ gridColumn: `span ${3 - (cursos.length % 3)}` }} />}
                    {cursos.length % 2 !== 0 && <li className="hidden sm:block xl:hidden bg-creme" aria-hidden="true" />}
                </ul>
            )}
        </AdminLayout>
    );
}
