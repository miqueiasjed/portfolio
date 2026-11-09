import { router, useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { AreaTexto, Botao, CampoDinheiro, Entrada, Interruptor } from '../Campos';
import Copiar from '../Copiar';
import { IconeLixo } from '../icones';
import { ConfirmModal } from '../Modal';
import { useToast } from '../Toast';
import { slugify } from '../util';

const MAX_DESCRICAO = 255;

function Bloco({ titulo, children, perigo = false }) {
    return (
        <section className={`bg-white border p-5 sm:p-6 ${perigo ? 'border-[#EBC5BE]' : 'border-filete-claro'}`}>
            {titulo && <h3 className="rotulo !text-[11px] mb-5">{titulo}</h3>}
            {children}
        </section>
    );
}

function ExcluirCurso({ produto }) {
    const { errors } = usePage().props;
    const { mostrar } = useToast();
    const [aberto, setAberto] = useState(false);
    const [processando, setProcessando] = useState(false);

    function excluir() {
        setProcessando(true);
        router.delete(`/admin/cursos/${produto.slug}`, {
            preserveScroll: true,
            onError: (e) => e.curso && mostrar(e.curso, 'erro'),
            onFinish: () => {
                setProcessando(false);
                setAberto(false);
            },
        });
    }

    return (
        <Bloco titulo="Excluir curso" perigo>
            {produto.pode_excluir ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <p className="text-sm text-tinta/80">Apaga o curso, os módulos, as aulas e os arquivos enviados. Não tem volta.</p>
                    <Botao variante="perigoLeve" icone={IconeLixo} onClick={() => setAberto(true)}>Excluir curso</Botao>
                </div>
            ) : (
                <p className="text-sm text-tinta/80">
                    Este curso tem {produto.compras === 1 ? '1 compra registrada' : `${produto.compras} compras registradas`} e não pode ser excluído.
                    Para tirar da venda, desligue <b className="font-medium">Ativo para venda</b> acima.
                </p>
            )}
            {errors.curso && <p role="alert" className="text-caneta-creme text-sm mt-3">{errors.curso}</p>}
            <ConfirmModal
                aberto={aberto}
                onFechar={() => setAberto(false)}
                onConfirmar={excluir}
                processando={processando}
                titulo={`Excluir "${produto.nome}"?`}
                rotuloConfirmar="Excluir curso"
            >
                <p>O curso, os módulos, as aulas e os arquivos enviados serão apagados.</p>
            </ConfirmModal>
        </Bloco>
    );
}

/** Aba "Dados": nome, endereço, descrição, preço e se está à venda. */
export default function DadosCurso({ produto, onCriado }) {
    const novo = !produto;
    const slugTravado = (produto?.compras ?? 0) > 0;
    const [slugManual, setSlugManual] = useState(!novo);
    const form = useForm({
        nome: produto?.nome ?? '',
        slug: produto?.slug ?? '',
        descricao: produto?.descricao ?? '',
        preco_centavos: produto?.preco_centavos ?? 0,
        // curso novo nasce fora da venda: liga quando o conteúdo estiver pronto
        ativo: produto?.ativo ?? false,
    });

    const origem = typeof window !== 'undefined' ? window.location.origin : '';
    const linkPrevia = `${origem}/comprar/${form.data.slug || 'endereco-do-curso'}`;

    function mudarNome(nome) {
        form.setData((d) => ({ ...d, nome, slug: slugManual ? d.slug : slugify(nome) }));
    }

    function mudarSlug(valor) {
        setSlugManual(true);
        form.setData('slug', valor.toLowerCase().replace(/\s+/g, '-'));
    }

    function normalizarSlug() {
        const limpo = slugify(form.data.slug);
        if (!limpo && novo) {
            setSlugManual(false);
            form.setData('slug', slugify(form.data.nome));
        } else {
            form.setData('slug', limpo);
        }
    }

    function salvar(e) {
        e.preventDefault();
        if (novo) {
            form.post('/admin/cursos', { preserveScroll: true, preserveState: true, onSuccess: () => onCriado?.() });
        } else {
            form.put(`/admin/cursos/${produto.slug}`, { preserveScroll: true, preserveState: true, onSuccess: () => form.setDefaults() });
        }
    }

    return (
        <div className="space-y-6 max-w-3xl">
            <form onSubmit={salvar} noValidate className="space-y-6">
                <Bloco titulo="Identificação">
                    <div className="space-y-5">
                        <Entrada
                            rotulo="Nome do curso"
                            required
                            maxLength={255}
                            autoFocus={novo}
                            value={form.data.nome}
                            onChange={(e) => mudarNome(e.target.value)}
                            erro={form.errors.nome}
                        />
                        <div>
                            <Entrada
                                rotulo="Endereço (slug)"
                                value={form.data.slug}
                                maxLength={100}
                                readOnly={slugTravado}
                                onChange={(e) => mudarSlug(e.target.value)}
                                onBlur={normalizarSlug}
                                erro={form.errors.slug}
                                spellCheck={false}
                                autoCapitalize="none"
                                classeCampo="font-mono"
                                dica={
                                    slugTravado
                                        ? 'Este curso já tem compras. O endereço não muda para o link divulgado continuar funcionando.'
                                        : novo && !slugManual
                                          ? 'Gerado a partir do nome. Edite se quiser outro.'
                                          : 'Só letras minúsculas, números e hífen.'
                                }
                            />
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-apoio">
                                <span>Link de compra:</span>
                                <span className="font-mono text-tinta break-all">{produto && !form.isDirty ? produto.link_compra : linkPrevia}</span>
                                {produto && <Copiar texto={produto.link_compra} rotulo="Copiar" rotuloAcessivel="Copiar link de compra" variante="fantasma" />}
                            </div>
                        </div>
                        <AreaTexto
                            rotulo="Descrição curta"
                            rows={3}
                            maximo={MAX_DESCRICAO}
                            value={form.data.descricao}
                            onChange={(e) => form.setData('descricao', e.target.value)}
                            erro={form.errors.descricao}
                            dica="Aparece no card do produto na área do aluno."
                        />
                    </div>
                </Bloco>

                <Bloco titulo="Venda">
                    <div className="grid gap-6 sm:grid-cols-2 sm:items-start">
                        <CampoDinheiro
                            rotulo="Preço"
                            centavos={form.data.preco_centavos}
                            onChange={(c) => form.setData('preco_centavos', c)}
                            erro={form.errors.preco_centavos}
                            dica="Digite só os números: 9700 vira R$ 97,00."
                        />
                        <div className="sm:pt-6">
                            <Interruptor
                                rotulo="Ativo para venda"
                                descricao={form.data.ativo ? 'O link de compra abre o checkout.' : 'O link de compra não abre o checkout. Quem já comprou continua com acesso.'}
                                ligado={form.data.ativo}
                                onChange={(v) => form.setData('ativo', v)}
                            />
                        </div>
                    </div>
                </Bloco>

                <div className="flex flex-wrap items-center gap-3">
                    <Botao type="submit" carregando={form.processing} disabled={form.data.descricao.length > MAX_DESCRICAO}>
                        {novo ? 'Criar curso' : 'Salvar alterações'}
                    </Botao>
                    {!novo && form.isDirty && !form.processing && (
                        <>
                            <span className="text-sm text-apoio" role="status">Alterações não salvas</span>
                            <Botao variante="fantasma" tamanho="sm" onClick={() => form.reset()}>Desfazer</Botao>
                        </>
                    )}
                    {novo && <span className="text-sm text-apoio">Depois de criar, você monta os módulos e as aulas.</span>}
                </div>
            </form>

            {produto && <ExcluirCurso produto={produto} />}
        </div>
    );
}
