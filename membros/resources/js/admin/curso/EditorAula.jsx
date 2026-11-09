import { useForm } from '@inertiajs/react';
import { useRef, useState } from 'react';
import { AreaTexto, Barra, Botao, Entrada, ErroCampo, Interruptor } from '../Campos';
import Drawer from '../Drawer';
import { IconeArquivo, IconeBaixar, IconeLixo } from '../icones';
import { ConfirmModal } from '../Modal';
import { embedDeVideo, tamanho } from '../util';

function Anexo({ aula, form, limiteUploadMb }) {
    const entrada = useRef(null);
    const [erroLocal, setErroLocal] = useState(null);
    const arquivo = form.data.anexo;
    const atual = aula.anexo && !form.data.remover_anexo ? aula.anexo : null;

    function escolher(e) {
        const f = e.target.files?.[0] ?? null;
        e.target.value = '';
        if (!f) return;
        if (f.size > limiteUploadMb * 1024 * 1024) {
            setErroLocal(`O arquivo pode ter até ${limiteUploadMb} MB. Este tem ${tamanho(f.size)}.`);
            return;
        }
        setErroLocal(null);
        form.setData((d) => ({ ...d, anexo: f, remover_anexo: false }));
    }

    return (
        <div>
            <p className="rotulo !text-[11px] mb-1.5">Material para baixar</p>
            <div className="border border-filete-claro bg-white p-4 space-y-3">
                {arquivo ? (
                    <div className="flex items-center gap-3 text-sm">
                        <IconeArquivo className="text-apoio" />
                        <span className="flex-1 min-w-0 break-all">
                            {arquivo.name} <span className="text-apoio">({tamanho(arquivo.size)}, novo)</span>
                        </span>
                        <Botao variante="fantasma" tamanho="sm" onClick={() => form.setData('anexo', null)}>Tirar</Botao>
                    </div>
                ) : atual ? (
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                        <IconeArquivo className="text-apoio" />
                        <span className="flex-1 min-w-0 break-all">{atual.nome}</span>
                        <a href={atual.url} className="inline-flex items-center gap-1 text-sm underline underline-offset-4 decoration-filete-claro hover:decoration-tinta">
                            <IconeBaixar tamanho={14} /> Baixar
                        </a>
                        <Botao variante="fantasma" tamanho="sm" className="!text-caneta-creme" onClick={() => form.setData('remover_anexo', true)}>
                            Remover
                        </Botao>
                    </div>
                ) : aula.anexo && form.data.remover_anexo ? (
                    <div className="flex flex-wrap items-center gap-3 text-sm" role="status">
                        <span className="flex-1 text-apoio">
                            <s>{aula.anexo.nome}</s> será removido ao salvar.
                        </span>
                        <Botao variante="fantasma" tamanho="sm" onClick={() => form.setData('remover_anexo', false)}>Desfazer</Botao>
                    </div>
                ) : (
                    <p className="text-sm text-apoio">Nenhum material. PDF, planilha ou outro arquivo de até {limiteUploadMb} MB.</p>
                )}
                <input ref={entrada} type="file" className="sr-only" id={`anexo-${aula.id}`} onChange={escolher} tabIndex={-1} />
                <Botao variante="secundario" tamanho="sm" onClick={() => entrada.current?.click()}>
                    {arquivo || atual ? 'Substituir arquivo' : 'Escolher arquivo'}
                </Botao>
                {form.progress && <Barra percentual={form.progress.percentage} rotulo="Envio do anexo" />}
            </div>
            <ErroCampo>{erroLocal ?? form.errors.anexo}</ErroCampo>
        </div>
    );
}

function Formulario({ aula, form, onSalvo, limiteUploadMb, onExcluir }) {
    const urlSalva = aula.video_url ?? '';
    const embed = form.data.video_url.trim() === urlSalva ? aula.video_embed : embedDeVideo(form.data.video_url);

    function salvar(e) {
        e.preventDefault();
        form.transform((d) => ({ ...d, _method: 'put' }));
        form.post(`/admin/aulas/${aula.id}`, {
            forceFormData: true,
            preserveScroll: true,
            preserveState: true,
            onSuccess: onSalvo,
        });
    }

    return (
        <form id={`aula-${aula.id}`} onSubmit={salvar} noValidate className="space-y-5">
            <Entrada rotulo="Título" required maxLength={255} value={form.data.titulo} onChange={(e) => form.setData('titulo', e.target.value)} erro={form.errors.titulo} />

            <div>
                <Entrada
                    rotulo="Link do vídeo"
                    type="url"
                    inputMode="url"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={form.data.video_url}
                    onChange={(e) => form.setData('video_url', e.target.value)}
                    erro={form.errors.video_url}
                    dica="YouTube e Vimeo aparecem embutidos. Outro link vira um botão Abrir vídeo."
                />
                {embed ? (
                    <div className="mt-3 aspect-video bg-grafite">
                        <iframe
                            src={embed}
                            title={`Prévia do vídeo: ${form.data.titulo || 'aula'}`}
                            className="w-full h-full"
                            allow="autoplay; fullscreen; picture-in-picture"
                            allowFullScreen
                            loading="lazy"
                        />
                    </div>
                ) : (
                    form.data.video_url.trim() !== '' && (
                        <p className="text-xs text-apoio mt-2">Sem prévia: esse link não é do YouTube nem do Vimeo. O aluno verá o botão Abrir vídeo.</p>
                    )
                )}
            </div>

            <AreaTexto
                rotulo="Descrição"
                rows={6}
                maximo={20000}
                value={form.data.descricao}
                onChange={(e) => form.setData('descricao', e.target.value)}
                erro={form.errors.descricao}
                dica="Texto simples. As quebras de linha são mantidas."
            />

            <div className="grid gap-5 sm:grid-cols-2 sm:items-start">
                <Entrada
                    rotulo="Duração (minutos)"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={1440}
                    value={form.data.duracao_minutos}
                    onChange={(e) => form.setData('duracao_minutos', e.target.value)}
                    erro={form.errors.duracao_minutos}
                    dica="Opcional."
                />
                <div className="sm:pt-6">
                    <Interruptor
                        rotulo="Publicada"
                        descricao={form.data.publicada ? 'Aparece para os alunos.' : 'Fica escondida dos alunos.'}
                        ligado={form.data.publicada}
                        onChange={(v) => form.setData('publicada', v)}
                    />
                </div>
            </div>

            <Anexo aula={aula} form={form} limiteUploadMb={limiteUploadMb} />

            <div className="pt-4 border-t border-filete-claro">
                <Botao variante="perigoLeve" tamanho="sm" icone={IconeLixo} onClick={onExcluir}>Excluir aula</Botao>
            </div>
        </form>
    );
}

function EditorAberto({ aula, moduloTitulo, onFechar, onExcluir, limiteUploadMb }) {
    const [confirmarSaida, setConfirmarSaida] = useState(false);
    const form = useForm({
        titulo: aula.titulo ?? '',
        descricao: aula.descricao ?? '',
        video_url: aula.video_url ?? '',
        duracao_minutos: aula.duracao_minutos ?? '',
        publicada: !!aula.publicada,
        anexo: null,
        remover_anexo: false,
    });

    function pedirFechar() {
        if (form.processing) return;
        if (form.isDirty) setConfirmarSaida(true);
        else onFechar();
    }

    return (
        <>
            <Drawer
                aberto
                onFechar={pedirFechar}
                subtitulo={moduloTitulo ? `Aula · ${moduloTitulo}` : 'Aula'}
                titulo={aula.titulo}
                largura="max-w-2xl"
                rodape={
                    <div className="flex items-center justify-end gap-2">
                        {form.isDirty && !form.processing && <span className="text-sm text-apoio mr-auto" role="status">Alterações não salvas</span>}
                        <Botao variante="secundario" onClick={pedirFechar} disabled={form.processing}>Cancelar</Botao>
                        <Botao type="submit" form={`aula-${aula.id}`} carregando={form.processing}>Salvar aula</Botao>
                    </div>
                }
            >
                <Formulario aula={aula} form={form} onSalvo={onFechar} onExcluir={() => onExcluir(aula)} limiteUploadMb={limiteUploadMb} />
            </Drawer>
            <ConfirmModal
                aberto={confirmarSaida}
                onFechar={() => setConfirmarSaida(false)}
                onConfirmar={() => {
                    setConfirmarSaida(false);
                    onFechar();
                }}
                titulo="Descartar alterações?"
                rotuloConfirmar="Descartar"
            >
                <p>O que você mudou nesta aula ainda não foi salvo.</p>
            </ConfirmModal>
        </>
    );
}

/** Gaveta de edição de uma aula. Avisa antes de fechar com alteração não salva. */
export default function EditorAula({ aula, ...resto }) {
    return aula ? <EditorAberto key={aula.id} aula={aula} {...resto} /> : null;
}
