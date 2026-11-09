import { useRemember } from '@inertiajs/react';
import { useRef } from 'react';
import AdminLayout from '../../admin/AdminLayout';
import { Chip } from '../../admin/Badge';
import Copiar from '../../admin/Copiar';
import ArquivoCurso from '../../admin/curso/ArquivoCurso';
import ConteudoCurso from '../../admin/curso/ConteudoCurso';
import DadosCurso from '../../admin/curso/DadosCurso';

const ABAS = [
    { id: 'dados', rotulo: 'Dados' },
    { id: 'conteudo', rotulo: 'Conteúdo' },
    { id: 'arquivo', rotulo: 'Arquivo' },
];

/** Abas no padrão WAI: setas trocam de aba, Home e End vão para as pontas. */
function Abas({ ativa, onTrocar, bloqueadas, contagens }) {
    const refs = useRef({});
    const liberadas = ABAS.filter((a) => !bloqueadas.includes(a.id));

    function teclado(e) {
        const i = liberadas.findIndex((a) => a.id === ativa);
        let proxima = null;
        if (e.key === 'ArrowRight') proxima = liberadas[(i + 1) % liberadas.length];
        if (e.key === 'ArrowLeft') proxima = liberadas[(i - 1 + liberadas.length) % liberadas.length];
        if (e.key === 'Home') proxima = liberadas[0];
        if (e.key === 'End') proxima = liberadas[liberadas.length - 1];
        if (!proxima) return;
        e.preventDefault();
        onTrocar(proxima.id);
        refs.current[proxima.id]?.focus();
    }

    return (
        <div role="tablist" aria-label="Seções do curso" className="flex gap-6 border-b border-filete-claro mb-8 overflow-x-auto" onKeyDown={teclado}>
            {ABAS.map((a) => {
                const selecionada = a.id === ativa;
                const bloqueada = bloqueadas.includes(a.id);
                return (
                    <button
                        key={a.id}
                        ref={(el) => (refs.current[a.id] = el)}
                        type="button"
                        role="tab"
                        id={`aba-${a.id}`}
                        aria-selected={selecionada}
                        aria-controls={`painel-${a.id}`}
                        aria-disabled={bloqueada || undefined}
                        tabIndex={selecionada ? 0 : -1}
                        title={bloqueada ? 'Crie o curso primeiro' : undefined}
                        onClick={() => !bloqueada && onTrocar(a.id)}
                        className={`relative -mb-px pb-3 pt-1 text-sm whitespace-nowrap border-b-2 transition-colors ${
                            selecionada ? 'border-caneta text-tinta font-medium' : 'border-transparent text-apoio hover:text-tinta'
                        } ${bloqueada ? 'opacity-40 cursor-not-allowed hover:text-apoio' : 'cursor-pointer'}`}
                    >
                        {a.rotulo}
                        {contagens[a.id] !== undefined && <span className="ml-1.5 text-xs text-apoio font-light">{contagens[a.id]}</span>}
                    </button>
                );
            })}
        </div>
    );
}

export default function Curso({ produto, modulos, limiteUploadMb }) {
    const novo = !produto;
    const [aba, setAba] = useRemember('dados', `admin-curso-aba:${produto?.slug ?? 'novo'}`);
    const abaAtiva = novo ? 'dados' : aba;
    const titulo = produto?.nome ?? 'Novo curso';
    const totalAulas = modulos.reduce((s, m) => s + m.aulas.length, 0);

    return (
        <AdminLayout
            titulo={titulo}
            migalhas={[{ rotulo: 'Cursos', href: '/admin/cursos' }, { rotulo: novo ? 'Novo curso' : produto.nome }]}
            acoes={
                produto && (
                    <span className="hidden md:inline-flex items-center gap-2">
                        {produto.ativo ? <Chip tom="ok">Ativo</Chip> : <Chip tom="apagado">Inativo</Chip>}
                        <Copiar texto={produto.link_compra} rotulo="Link de compra" rotuloAcessivel="Copiar link de compra" variante="fantasma" tamanho="md" />
                    </span>
                )
            }
        >
            <Abas
                ativa={abaAtiva}
                onTrocar={setAba}
                bloqueadas={novo ? ['conteudo', 'arquivo'] : []}
                contagens={novo ? {} : { conteudo: totalAulas }}
            />
            {novo && <p className="text-sm text-apoio -mt-4 mb-6">Comece pelos dados. Conteúdo e arquivo ficam disponíveis depois de criar o curso.</p>}

            <div role="tabpanel" id={`painel-${abaAtiva}`} aria-labelledby={`aba-${abaAtiva}`} tabIndex={-1} className="outline-none">
                {abaAtiva === 'dados' && <DadosCurso key={produto?.slug ?? 'novo'} produto={produto} onCriado={() => setAba('conteudo')} />}
                {abaAtiva === 'conteudo' && produto && <ConteudoCurso produto={produto} modulos={modulos} limiteUploadMb={limiteUploadMb} />}
                {abaAtiva === 'arquivo' && produto && <ArquivoCurso produto={produto} limiteUploadMb={limiteUploadMb} />}
            </div>
        </AdminLayout>
    );
}
