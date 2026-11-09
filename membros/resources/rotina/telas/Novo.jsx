// Tela Novo (`#/novo`): cadastro rápido de um cliente e do que está em aberto
// com ele, em 4 campos (nome, WhatsApp, o que está em aberto e quando), para
// caber em menos de 20 segundos no celular. Tudo fica gravado no aparelho.
// Fundo creme. O acento vermelho aparece uma vez só, no botão Salvar.

import { useEffect, useRef, useState } from 'react';
import { validarPendencia } from '../regras/campos.js';
import { hojeEmFortaleza, somarDias } from '../regras/datas.js';
import { formatarTelefone } from '../regras/whatsapp.js';
import { registrarPendencia } from '../dados/pendencias.js';
import { acharClienteParecido } from '../dados/clientes.js';
import { PROCESSOS } from '../ui/rotulos.js';

const CAMPO =
    'min-h-[44px] w-full min-w-0 appearance-none border border-filete-claro bg-transparent px-3 text-base text-tinta placeholder:text-apoio';
const BOTAO_ACENTO =
    'flex min-h-[48px] w-full items-center justify-center bg-caneta-creme px-4 text-base font-medium text-papel disabled:opacity-60';

const ORDEM = ['01', '04', '05'];

// Nomes dos campos de "quando" em cada processo.
const QUANDO = {
    '01': { data: 'Dia', segundo: 'Hora' },
    '04': { data: 'Enviado em', segundo: 'Valor (opcional)' },
    '05': { data: 'Vencimento', segundo: 'Valor' },
};

const ERRO_GRAVAR = 'Não deu para registrar agora. Tente de novo.';

// Ordem dos campos na tela, para levar o foco ao primeiro com erro.
const ORDEM_ERROS = ['nome', 'whatsapp', 'processo', 'data', 'hora', 'valor'];

// Confirmar horário começa amanhã; orçamento e cobrança, hoje.
function dataPadrao(processo) {
    const hoje = hojeEmFortaleza();
    return processo === '01' ? somarDias(hoje, 1) : hoje;
}

function formularioVazio(processo) {
    return {
        nome: '',
        whatsapp: '',
        processo,
        data: dataPadrao(processo),
        hora: '',
        valor: '',
        servico: '',
    };
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

export default function Novo() {
    const [campos, setCampos] = useState(() => formularioVazio('01'));
    const [clienteId, setClienteId] = useState(null);
    const [sugestoes, setSugestoes] = useState([]);
    const [erros, setErros] = useState({});
    const [erroGeral, setErroGeral] = useState('');
    const [salvo, setSalvo] = useState(false);
    const [salvando, setSalvando] = useState(false);

    const nomeRef = useRef(null);
    const refs = {
        nome: nomeRef,
        whatsapp: useRef(null),
        processo: useRef(null),
        data: useRef(null),
        hora: useRef(null),
        valor: useRef(null),
    };
    // Só a busca mais recente pode trocar as sugestões.
    const busca = useRef(0);

    useEffect(() => {
        nomeRef.current?.focus();
    }, []);

    // Sugestões de cliente já cadastrado, enquanto nenhum foi escolhido.
    useEffect(() => {
        const vez = ++busca.current;
        if (clienteId) {
            setSugestoes([]);
            return;
        }
        acharClienteParecido({ nome: campos.nome, whatsapp: campos.whatsapp })
            .then((achados) => {
                if (vez === busca.current) setSugestoes(achados);
            })
            .catch(() => {
                if (vez === busca.current) setSugestoes([]);
            });
    }, [campos.nome, campos.whatsapp, clienteId]);

    function mudar(campo, valor) {
        setCampos((atual) => ({ ...atual, [campo]: valor }));
        setErros((atual) => (atual[campo] ? { ...atual, [campo]: undefined } : atual));
        setSalvo(false);
        setErroGeral('');
        // Mexer no nome ou no telefone desfaz a escolha do cliente existente.
        if (campo === 'nome' || campo === 'whatsapp') setClienteId(null);
    }

    function escolherProcesso(processo) {
        setCampos((atual) =>
            atual.processo === processo ? atual : { ...atual, processo, data: dataPadrao(processo) },
        );
        setErros((atual) => ({ ...atual, processo: undefined, data: undefined, hora: undefined, valor: undefined }));
        setSalvo(false);
        setErroGeral('');
    }

    function escolherCliente(cliente) {
        setCampos((atual) => ({ ...atual, nome: cliente.nome, whatsapp: formatarTelefone(cliente.whatsapp) }));
        setClienteId(cliente.id);
        setErros((atual) => ({ ...atual, nome: undefined, whatsapp: undefined }));
        setSalvo(false);
    }

    // Enter no nome e no WhatsApp leva ao campo seguinte em vez de salvar.
    const irPara = (proximo) => (evento) => {
        if (evento.key !== 'Enter') return;
        evento.preventDefault();
        refs[proximo].current?.focus();
    };

    async function salvar(evento) {
        evento.preventDefault();
        if (salvando) return;

        const conferido = validarPendencia(campos);
        if (!conferido.ok) {
            setErros(conferido.erros);
            setSalvo(false);
            const primeiro = ORDEM_ERROS.find((campo) => conferido.erros[campo]);
            if (primeiro) refs[primeiro].current?.focus();
            return;
        }

        setSalvando(true);
        setErroGeral('');
        try {
            await registrarPendencia({
                cliente: conferido.cliente,
                item: conferido.item,
                ...(clienteId ? { cliente_id: clienteId } : {}),
            });
        } catch {
            setSalvando(false);
            setErroGeral(ERRO_GRAVAR);
            return;
        }

        // Limpa para o próximo, mantendo o tipo escolhido e a data padrão dele.
        setCampos(formularioVazio(campos.processo));
        setClienteId(null);
        setSugestoes([]);
        setErros({});
        setSalvando(false);
        setSalvo(true);
        refs.nome.current?.focus();
    }

    const quando = QUANDO[campos.processo];
    const escolhido = clienteId !== null;

    return (
        <section aria-labelledby="novo-titulo" className="py-2">
            <div className="flex items-center justify-between gap-3">
                <h1 id="novo-titulo" className="text-2xl font-medium">
                    Novo cliente
                </h1>
                <a
                    href="#/clientes"
                    className="flex min-h-[44px] items-center px-2 text-base underline underline-offset-4"
                >
                    Ver clientes
                </a>
            </div>

            <form onSubmit={salvar} noValidate className="mt-4 flex flex-col gap-4">
                <Campo
                    id="novo-nome"
                    rotulo="Nome"
                    campoRef={refs.nome}
                    type="text"
                    autoComplete="off"
                    autoCapitalize="words"
                    spellCheck={false}
                    enterKeyHint="next"
                    value={campos.nome}
                    onChange={(e) => mudar('nome', e.target.value)}
                    onKeyDown={irPara('whatsapp')}
                    erro={erros.nome}
                />

                <Campo
                    id="novo-whatsapp"
                    rotulo="WhatsApp com DDD"
                    campoRef={refs.whatsapp}
                    type="tel"
                    inputMode="tel"
                    autoComplete="off"
                    enterKeyHint="next"
                    placeholder="(85) 99999-8888"
                    value={campos.whatsapp}
                    onChange={(e) => mudar('whatsapp', e.target.value)}
                    onKeyDown={irPara('processo')}
                    erro={erros.whatsapp}
                />

                {escolhido && (
                    <p role="status" className="text-sm">
                        Cliente já cadastrado. A pendência entra no cadastro dele.
                    </p>
                )}

                {!escolhido && sugestoes.length > 0 && (
                    <div className="flex flex-col gap-2">
                        <p id="novo-sugestoes" className="text-sm">
                            Já cadastrado? Toque para usar.
                        </p>
                        <ul aria-labelledby="novo-sugestoes" className="flex flex-col gap-2">
                            {sugestoes.map((cliente) => (
                                <li key={cliente.id}>
                                    <button
                                        type="button"
                                        onClick={() => escolherCliente(cliente)}
                                        className="flex min-h-[44px] w-full items-center justify-between gap-3 border border-filete-claro px-3 text-left text-base"
                                    >
                                        <span className="min-w-0 truncate font-medium">{cliente.nome}</span>
                                        <span className="shrink-0 text-sm">{formatarTelefone(cliente.whatsapp)}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <fieldset
                    className="flex min-w-0 flex-col gap-1"
                    aria-describedby={erros.processo ? 'novo-processo-erro' : undefined}
                >
                    <legend className="mb-1 text-sm">O que está em aberto</legend>
                    <div className="grid grid-cols-3 gap-2">
                        {ORDEM.map((processo) => {
                            const ativo = campos.processo === processo;
                            return (
                                <button
                                    key={processo}
                                    type="button"
                                    ref={ativo ? refs.processo : undefined}
                                    aria-pressed={ativo}
                                    onClick={() => escolherProcesso(processo)}
                                    className={`flex min-h-[52px] items-center justify-center px-1 text-center text-sm leading-tight font-medium ${
                                        ativo ? 'bg-grafite text-papel' : 'border border-tinta text-tinta'
                                    }`}
                                >
                                    {PROCESSOS[processo]}
                                </button>
                            );
                        })}
                    </div>
                    {erros.processo && (
                        <p id="novo-processo-erro" className="text-sm font-medium">
                            {erros.processo}
                        </p>
                    )}
                </fieldset>

                <div className="grid grid-cols-2 gap-3">
                    <Campo
                        id="novo-data"
                        rotulo={quando.data}
                        campoRef={refs.data}
                        type="date"
                        value={campos.data}
                        onChange={(e) => mudar('data', e.target.value)}
                        erro={erros.data}
                    />
                    {campos.processo === '01' ? (
                        <Campo
                            key="hora"
                            id="novo-hora"
                            rotulo={quando.segundo}
                            campoRef={refs.hora}
                            type="time"
                            value={campos.hora}
                            onChange={(e) => mudar('hora', e.target.value)}
                            erro={erros.hora}
                        />
                    ) : (
                        <Campo
                            key="valor"
                            id="novo-valor"
                            rotulo={quando.segundo}
                            campoRef={refs.valor}
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            placeholder="R$ 0,00"
                            value={campos.valor}
                            onChange={(e) => mudar('valor', e.target.value)}
                            erro={erros.valor}
                        />
                    )}
                </div>

                <Campo
                    id="novo-servico"
                    rotulo="O que é (opcional)"
                    type="text"
                    autoComplete="off"
                    placeholder="Ex.: corte, revisão, consulta"
                    value={campos.servico}
                    onChange={(e) => mudar('servico', e.target.value)}
                />

                {erroGeral && (
                    <p role="alert" className="text-sm font-medium">
                        {erroGeral}
                    </p>
                )}

                <button type="submit" disabled={salvando} className={BOTAO_ACENTO}>
                    {salvando ? 'Salvando...' : 'Salvar'}
                </button>

                <p role="status" aria-live="polite" className="min-h-[1.5rem] text-base font-medium">
                    {salvo ? 'Salvo.' : ''}
                </p>
            </form>
        </section>
    );
}
