// Tela Cliente (`#/clientes/:id`): dados do cliente com edição, pendências em
// aberto e resolvidas com as mensagens já enviadas, e exclusão do cliente com
// confirmação própria. Fundo creme. O acento vermelho aparece uma vez só, no
// botão de confirmar a exclusão, dentro da confirmação.

import { useCallback, useEffect, useRef, useState } from 'react';
import { detalheCliente, excluirCliente, salvarCliente } from '../dados/clientes.js';
import { formatarTelefone, normalizarTelefone } from '../regras/whatsapp.js';
import { MENSAGENS } from '../regras/campos.js';
import { irPara } from '../rotas.js';
import PendenciaCartao from '../ui/PendenciaCartao.jsx';
import Confirmar from '../ui/Confirmar.jsx';

const CAMPO =
    'min-h-[44px] w-full min-w-0 appearance-none border border-filete-claro bg-transparent px-3 text-base text-tinta placeholder:text-apoio';
const BOTAO_CHEIO =
    'flex min-h-[44px] items-center justify-center bg-grafite px-4 text-base font-medium text-papel disabled:opacity-60';
const BOTAO_CONTORNO =
    'flex min-h-[44px] items-center justify-center border border-tinta px-4 text-center text-base font-medium text-tinta';
const LINK = 'flex min-h-[44px] items-center text-base underline underline-offset-4';

// Com mais que isso, as resolvidas começam recolhidas.
const LIMITE_FECHADAS = 3;

const ERRO_ABRIR = 'Não deu para abrir esse cliente agora. Tente de novo.';
const ERRO_GRAVAR = 'Não deu para registrar agora. Tente de novo.';
const ERRO_EXCLUIR = 'Não deu para excluir agora. Tente de novo.';

function limparEspacos(valor) {
    return String(valor ?? '').replace(/\s+/g, ' ').trim();
}

function Campo({ id, rotulo, erro, campoRef, ...resto }) {
    return (
        <div className="flex min-w-0 flex-col gap-1">
            <label htmlFor={id} className="text-sm">
                {rotulo}
            </label>
            <input
                id={id}
                ref={campoRef}
                aria-invalid={erro ? true : undefined}
                aria-describedby={erro ? `${id}-erro` : undefined}
                className={CAMPO}
                {...resto}
            />
            {erro && (
                <p id={`${id}-erro`} className="text-sm font-medium">
                    {erro}
                </p>
            )}
        </div>
    );
}

// Formulário que troca o topo: nome, WhatsApp e observação.
function EditarDados({ cliente, aoSalvar, aoVoltar }) {
    const [rascunho, setRascunho] = useState(() => ({
        nome: cliente.nome ?? '',
        whatsapp: formatarTelefone(cliente.whatsapp ?? ''),
        obs: cliente.obs ?? '',
    }));
    const [erros, setErros] = useState({});
    const [erroGeral, setErroGeral] = useState('');
    const [salvando, setSalvando] = useState(false);
    const nomeRef = useRef(null);
    const whatsappRef = useRef(null);

    useEffect(() => {
        nomeRef.current?.focus();
    }, []);

    function mudar(campo, valor) {
        setRascunho((atual) => ({ ...atual, [campo]: valor }));
        setErros((atual) => (atual[campo] ? { ...atual, [campo]: undefined } : atual));
        setErroGeral('');
    }

    async function salvar(evento) {
        evento.preventDefault();
        if (salvando) return;

        const nome = limparEspacos(rascunho.nome);
        const telefone = normalizarTelefone(rascunho.whatsapp);
        const novosErros = {};
        if (nome === '') novosErros.nome = MENSAGENS.nome;
        if (!telefone.ok) novosErros.whatsapp = telefone.erro;
        setErros(novosErros);
        if (novosErros.nome) {
            nomeRef.current?.focus();
            return;
        }
        if (novosErros.whatsapp) {
            whatsappRef.current?.focus();
            return;
        }

        setSalvando(true);
        setErroGeral('');
        try {
            await salvarCliente({
                id: cliente.id,
                nome,
                whatsapp: telefone.numero,
                obs: String(rascunho.obs ?? '').trim(),
            });
        } catch {
            setSalvando(false);
            setErroGeral(ERRO_GRAVAR);
            return;
        }
        aoSalvar();
    }

    return (
        <form onSubmit={salvar} noValidate className="mt-2 flex flex-col gap-4" aria-label="Editar dados">
            <Campo
                id="cliente-nome"
                rotulo="Nome"
                campoRef={nomeRef}
                type="text"
                autoComplete="off"
                autoCapitalize="words"
                spellCheck={false}
                value={rascunho.nome}
                onChange={(e) => mudar('nome', e.target.value)}
                erro={erros.nome}
            />
            <Campo
                id="cliente-whatsapp"
                rotulo="WhatsApp com DDD"
                campoRef={whatsappRef}
                type="tel"
                inputMode="tel"
                autoComplete="off"
                placeholder="(85) 99999-8888"
                value={rascunho.whatsapp}
                onChange={(e) => mudar('whatsapp', e.target.value)}
                erro={erros.whatsapp}
            />
            <div className="flex min-w-0 flex-col gap-1">
                <label htmlFor="cliente-obs" className="text-sm">
                    Observação (opcional)
                </label>
                <textarea
                    id="cliente-obs"
                    rows={3}
                    value={rascunho.obs}
                    onChange={(e) => mudar('obs', e.target.value)}
                    className="min-h-[88px] w-full min-w-0 appearance-none border border-filete-claro bg-transparent px-3 py-2 text-base text-tinta"
                />
            </div>

            {erroGeral && (
                <p role="alert" className="text-sm font-medium">
                    {erroGeral}
                </p>
            )}

            <div className="grid grid-cols-2 gap-2">
                <button type="submit" disabled={salvando} className={BOTAO_CHEIO}>
                    {salvando ? 'Salvando...' : 'Salvar'}
                </button>
                <button type="button" onClick={aoVoltar} className={BOTAO_CONTORNO}>
                    Voltar
                </button>
            </div>
        </form>
    );
}

// Props: `id`, o id do cliente vindo da rota.
export default function Cliente({ id }) {
    // undefined enquanto abre; null quando o cliente não existe mais.
    const [dados, setDados] = useState(undefined);
    const [erro, setErro] = useState(false);
    const [editando, setEditando] = useState(false);
    // null segue o padrão (recolhida com mais de 3); true/false é escolha de quem usa.
    const [verFechadas, setVerFechadas] = useState(null);
    const [confirmando, setConfirmando] = useState(false);
    const [excluindo, setExcluindo] = useState(false);
    const [erroExcluir, setErroExcluir] = useState('');

    // Só a leitura mais recente pode trocar os dados.
    const leitura = useRef(0);
    const editarRef = useRef(null);
    const voltouDaEdicao = useRef(false);

    const carregar = useCallback(() => {
        const vez = ++leitura.current;
        return detalheCliente(id)
            .then((achado) => {
                if (vez !== leitura.current) return;
                setDados(achado);
                setErro(false);
            })
            .catch(() => {
                if (vez === leitura.current) setErro(true);
            });
    }, [id]);

    useEffect(() => {
        setDados(undefined);
        setErro(false);
        setEditando(false);
        setVerFechadas(null);
        setConfirmando(false);
        setErroExcluir('');
        carregar();
    }, [carregar]);

    // Na volta da edição, o foco retorna ao botão que a abriu.
    useEffect(() => {
        if (!editando && voltouDaEdicao.current) {
            voltouDaEdicao.current = false;
            editarRef.current?.focus();
        }
    }, [editando, dados]);

    function fecharEdicao() {
        voltouDaEdicao.current = true;
        setEditando(false);
    }

    async function terminarEdicao() {
        await carregar();
        fecharEdicao();
    }

    async function excluir() {
        if (excluindo) return;
        setExcluindo(true);
        setErroExcluir('');
        try {
            await excluirCliente(id);
        } catch {
            setExcluindo(false);
            setConfirmando(false);
            setErroExcluir(ERRO_EXCLUIR);
            return;
        }
        setConfirmando(false);
        irPara('#/clientes');
    }

    const voltarParaClientes = (
        <a href="#/clientes" className={`${LINK} self-start`}>
            Clientes
        </a>
    );

    if (erro) {
        return (
            <section className="flex flex-col gap-3 py-2">
                {voltarParaClientes}
                <p role="alert">{ERRO_ABRIR}</p>
                <button type="button" onClick={() => carregar()} className={`${BOTAO_CONTORNO} w-full`}>
                    Tentar de novo
                </button>
            </section>
        );
    }

    if (dados === undefined) {
        return (
            <section className="flex flex-col gap-3 py-2">
                {voltarParaClientes}
                <p role="status">Abrindo...</p>
            </section>
        );
    }

    if (dados === null) {
        return (
            <section className="flex flex-col gap-3 py-2">
                <p className="text-lg font-medium">Esse cliente não está mais aqui.</p>
                <a href="#/clientes" className={`${LINK} self-start`}>
                    Ver clientes
                </a>
            </section>
        );
    }

    const { cliente, abertas, fechadas, toques } = dados;
    const fechadasAbertas = verFechadas ?? fechadas.length <= LIMITE_FECHADAS;
    const nome = cliente.nome || 'este cliente';

    return (
        <section aria-labelledby="cliente-titulo" className="flex min-w-0 flex-col py-2">
            {voltarParaClientes}

            {editando ? (
                <>
                    <h1 id="cliente-titulo" className="mt-2 text-2xl font-medium wrap-anywhere">
                        Editar dados
                    </h1>
                    <EditarDados cliente={cliente} aoSalvar={terminarEdicao} aoVoltar={fecharEdicao} />
                </>
            ) : (
                <div className="mt-2 flex min-w-0 flex-col gap-1">
                    <h1 id="cliente-titulo" className="text-2xl font-medium wrap-anywhere">
                        {cliente.nome}
                    </h1>
                    <p className="text-base">{formatarTelefone(cliente.whatsapp ?? '')}</p>
                    {cliente.obs && <p className="text-base font-light whitespace-pre-line wrap-anywhere">{cliente.obs}</p>}
                    <button
                        type="button"
                        ref={editarRef}
                        onClick={() => setEditando(true)}
                        className={`${BOTAO_CONTORNO} mt-3 w-full`}
                    >
                        Editar dados
                    </button>
                </div>
            )}

            <a href="#/novo" className={`${BOTAO_CHEIO} mt-3 w-full`}>
                Nova pendência
            </a>

            <section aria-labelledby="cliente-abertas" className="mt-8">
                <h2 id="cliente-abertas" className="text-lg font-medium">
                    Em aberto
                </h2>
                {abertas.length === 0 ? (
                    <p className="mt-2 text-base">Nada em aberto com esse cliente.</p>
                ) : (
                    <ul className="mt-3 flex flex-col gap-3">
                        {abertas.map((item) => (
                            <li key={item.id}>
                                <PendenciaCartao item={item} toques={toques[item.id] ?? []} aoMudar={carregar} />
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {fechadas.length > 0 && (
                <section aria-labelledby="cliente-fechadas" className="mt-8 flex flex-col">
                    <h2 id="cliente-fechadas" className="text-lg font-medium">
                        Resolvidas
                    </h2>
                    <button
                        type="button"
                        aria-expanded={fechadasAbertas}
                        aria-controls="cliente-fechadas-lista"
                        onClick={() => setVerFechadas(!fechadasAbertas)}
                        className={`${LINK} self-start`}
                    >
                        {fechadasAbertas
                            ? 'Esconder resolvidas'
                            : `Mostrar as resolvidas (${fechadas.length.toLocaleString('pt-BR')})`}
                    </button>
                    {fechadasAbertas && (
                        <ul id="cliente-fechadas-lista" className="mt-1 flex flex-col gap-3">
                            {fechadas.map((item) => (
                                <li key={item.id}>
                                    <PendenciaCartao item={item} toques={toques[item.id] ?? []} aoMudar={carregar} />
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            )}

            <div className="mt-10 border-t border-filete-claro pt-4">
                {erroExcluir && (
                    <p role="alert" className="mb-3 text-sm font-medium">
                        {erroExcluir}
                    </p>
                )}
                <button
                    type="button"
                    onClick={() => {
                        setErroExcluir('');
                        setConfirmando(true);
                    }}
                    className="flex min-h-[44px] w-full items-center justify-center border border-filete-claro px-4 text-base text-tinta"
                >
                    Excluir cliente
                </button>
            </div>

            <Confirmar
                aberto={confirmando}
                titulo={`Excluir ${nome}?`}
                texto="Some tudo o que está registrado com ele neste aparelho. Não tem como desfazer."
                rotuloConfirmar={excluindo ? 'Excluindo...' : 'Excluir'}
                rotuloVoltar="Voltar"
                destrutivo
                aoConfirmar={excluir}
                aoVoltar={() => {
                    if (!excluindo) setConfirmando(false);
                }}
            />
        </section>
    );
}
