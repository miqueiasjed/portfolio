import { router, useForm } from '@inertiajs/react';
import { useRef, useState } from 'react';
import { Barra, Botao, classesBotao, ErroCampo } from '../Campos';
import { IconeArquivo, IconeBaixar, IconeEnviar, IconeLixo } from '../icones';
import { ConfirmModal } from '../Modal';
import { tamanho } from '../util';

/** Aba "Arquivo": o arquivo principal que o aluno baixa na página do produto. */
export default function ArquivoCurso({ produto, limiteUploadMb }) {
    const arquivo = produto.arquivo;
    const entrada = useRef(null);
    const form = useForm({ arquivo: null });
    const [erroLocal, setErroLocal] = useState(null);
    const [sobre, setSobre] = useState(false);
    const [remover, setRemover] = useState(false);
    const [removendo, setRemovendo] = useState(false);

    function escolher(f) {
        if (!f) return;
        if (f.size > limiteUploadMb * 1024 * 1024) {
            setErroLocal(`O arquivo pode ter até ${limiteUploadMb} MB. Este tem ${tamanho(f.size)}.`);
            form.setData('arquivo', null);
            return;
        }
        setErroLocal(null);
        form.clearErrors();
        form.setData('arquivo', f);
    }

    function enviar() {
        form.post(`/admin/cursos/${produto.slug}/arquivo`, {
            forceFormData: true,
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => form.reset(),
        });
    }

    function confirmarRemocao() {
        setRemovendo(true);
        router.delete(`/admin/cursos/${produto.slug}/arquivo`, {
            preserveScroll: true,
            preserveState: true,
            onFinish: () => {
                setRemovendo(false);
                setRemover(false);
            },
        });
    }

    const percentual = form.progress?.percentage ?? 0;

    return (
        <div className="max-w-3xl space-y-6">
            <section className="bg-white border border-filete-claro p-5 sm:p-6">
                <h3 className="rotulo !text-[11px] mb-4">Arquivo atual</h3>
                {arquivo ? (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                            <IconeArquivo className="text-apoio mt-0.5" tamanho={22} />
                            <div className="min-w-0">
                                <p className="font-medium break-all">{arquivo.nome}</p>
                                <p className="text-xs text-apoio mt-0.5">
                                    {arquivo.disco === 'produtos' ? 'Arquivo do kit, guardado junto com o sistema.' : 'Enviado por aqui.'}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <a href={arquivo.url} className={classesBotao('secundario', 'sm')}>
                                <IconeBaixar tamanho={16} /> Baixar
                            </a>
                            <Botao variante="perigoLeve" tamanho="sm" icone={IconeLixo} onClick={() => setRemover(true)}>
                                Remover
                            </Botao>
                        </div>
                    </div>
                ) : (
                    <p className="text-sm text-apoio">Nenhum arquivo. Sem ele, a página do produto não mostra o botão de download.</p>
                )}
            </section>

            <section className="bg-white border border-filete-claro p-5 sm:p-6">
                <h3 className="rotulo !text-[11px] mb-4">{arquivo ? 'Substituir arquivo' : 'Enviar arquivo'}</h3>
                <div
                    onDragOver={(e) => {
                        if (![...e.dataTransfer.types].includes('Files')) return;
                        e.preventDefault();
                        setSobre(true);
                    }}
                    onDragLeave={() => setSobre(false)}
                    onDrop={(e) => {
                        if (!e.dataTransfer.files?.length) return;
                        e.preventDefault();
                        setSobre(false);
                        escolher(e.dataTransfer.files[0]);
                    }}
                    className={`border border-dashed p-6 text-center transition-colors ${sobre ? 'border-tinta bg-creme' : 'border-filete-claro'}`}
                >
                    <IconeEnviar className="mx-auto text-apoio" tamanho={24} />
                    <p className="text-sm mt-2">
                        Arraste o arquivo para cá ou{' '}
                        <button type="button" onClick={() => entrada.current?.click()} className="underline underline-offset-4 cursor-pointer font-medium">
                            escolha no computador
                        </button>
                    </p>
                    <p className="text-xs text-apoio mt-1">PDF ou outro formato, até {limiteUploadMb} MB.</p>
                    <input
                        ref={entrada}
                        type="file"
                        className="sr-only"
                        tabIndex={-1}
                        aria-hidden="true"
                        onChange={(e) => {
                            escolher(e.target.files?.[0]);
                            e.target.value = '';
                        }}
                    />
                </div>

                {form.data.arquivo && (
                    <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
                        <p className="flex-1 text-sm break-all">
                            {form.data.arquivo.name} <span className="text-apoio">({tamanho(form.data.arquivo.size)})</span>
                        </p>
                        <div className="flex gap-2">
                            {form.processing ? (
                                <Botao variante="secundario" tamanho="sm" onClick={() => form.cancel()}>Cancelar envio</Botao>
                            ) : (
                                <Botao variante="fantasma" tamanho="sm" onClick={() => form.reset()}>Tirar</Botao>
                            )}
                            <Botao tamanho="sm" icone={IconeEnviar} carregando={form.processing} onClick={enviar}>
                                {arquivo ? 'Substituir' : 'Enviar'}
                            </Botao>
                        </div>
                    </div>
                )}

                {form.progress && (
                    <div className="mt-4">
                        <div className="flex justify-between text-xs text-apoio mb-1">
                            <span>Enviando...</span>
                            <span className="tabular-nums">{percentual}%</span>
                        </div>
                        <Barra percentual={percentual} rotulo="Envio do arquivo" />
                    </div>
                )}

                <ErroCampo>{erroLocal ?? form.errors.arquivo}</ErroCampo>
                {arquivo && <p className="text-xs text-apoio mt-4">O arquivo novo substitui o atual na hora para todos os alunos.</p>}
            </section>

            <ConfirmModal
                aberto={remover}
                onFechar={() => setRemover(false)}
                onConfirmar={confirmarRemocao}
                processando={removendo}
                titulo="Remover o arquivo?"
                rotuloConfirmar="Remover arquivo"
            >
                <p>Os alunos deixam de ver o botão de download de {arquivo?.nome ?? 'arquivo'}.</p>
                {arquivo?.disco === 'produtos' ? (
                    <p>O PDF do kit continua guardado no sistema, só deixa de ser oferecido.</p>
                ) : (
                    <p>O arquivo enviado é apagado do servidor.</p>
                )}
            </ConfirmModal>
        </div>
    );
}
