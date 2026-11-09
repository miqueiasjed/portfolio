// Cartão de uma pendência do cliente: processo, situação, data, valor,
// serviço e as mensagens já enviadas. Com o item aberto (inclusive "sem
// retorno"), deixa resolver, editar e cancelar com confirmação própria.
// Sem acento vermelho: a tela do cliente decide onde fica o único da tela.

import { useState } from 'react';
import Confirmar from './Confirmar.jsx';
import { ETAPAS, PROCESSOS, RESULTADOS as NOMES_RESULTADOS, SITUACOES } from './rotulos.js';
import {
    RESULTADOS,
    atualizarPendencia,
    cancelarPendencia,
    resolverPendencia,
    situacao,
} from '../dados/pendencias.js';
import { MENSAGENS, lerData, lerHora, lerValor } from '../regras/campos.js';
import { formatarBRL } from '../regras/preencher.js';
import { formatarDiaMes, hojeEmFortaleza } from '../regras/datas.js';

const BOTAO = 'flex min-h-[44px] items-center justify-center border border-tinta px-4 text-base font-medium';
const BOTAO_CHEIO = 'flex min-h-[44px] items-center justify-center bg-grafite px-4 text-base font-medium text-papel';
const CAMPO = 'min-h-[44px] w-full border border-filete-claro bg-transparent px-3 text-base text-tinta placeholder:text-apoio';

// Nome da data em cada processo, igual às mensagens do cadastro.
const NOME_DATA = { '01': 'Horário', '04': 'Enviado em', '05': 'Vencimento' };

const ERRO_GRAVAR = 'Não deu para registrar agora. Tente de novo.';

function texto(valor) {
    return valor === null || valor === undefined ? '' : String(valor);
}

function limparEspacos(valor) {
    return texto(valor).replace(/\s+/g, ' ').trim();
}

// `2026-12-08` vira `08/12/2026`, o formato que a pessoa digita.
function dataParaCampo(dia) {
    const achado = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto(dia));
    return achado ? `${achado[3]}/${achado[2]}/${achado[1]}` : '';
}

function valorParaCampo(centavos) {
    return formatarBRL(centavos).replace(/^R\$\s*/, '');
}

// Dia do envio em Fortaleza, como `dd/mm`. Toque sem data válida fica sem dia.
function diaDoToque(enviadoEm) {
    const momento = new Date(texto(enviadoEm));
    if (!enviadoEm || Number.isNaN(momento.getTime())) return '';
    return formatarDiaMes(hojeEmFortaleza(momento));
}

function linhaDoToque(toque) {
    const etapa = ETAPAS[toque.etapa] ?? texto(toque.etapa);
    const dia = diaDoToque(toque.enviado_em);
    const base = dia ? `${etapa} em ${dia}` : etapa;
    return toque.respondeu === true ? `${base}, respondeu` : base;
}

// Confere a edição com as mesmas regras do cadastro: hora obrigatória no 01,
// valor obrigatório no 05 e opcional no 04. Devolve `{ erros, campos }`.
function conferirEdicao(processo, rascunho) {
    const erros = {};
    const campos = { servico: limparEspacos(rascunho.servico) };

    const dataTexto = rascunho.data.trim();
    const data = lerData(dataTexto);
    if (dataTexto === '') erros.data = MENSAGENS.dataVazia[processo] ?? MENSAGENS.dataVazia.geral;
    else if (data === null) erros.data = MENSAGENS.dataInvalida;
    else campos.data = data;

    if (processo === '01') {
        const horaTexto = rascunho.hora.trim();
        const hora = lerHora(horaTexto);
        if (horaTexto === '') erros.hora = MENSAGENS.horaVazia;
        else if (hora === null) erros.hora = MENSAGENS.horaInvalida;
        else campos.hora = hora;
    }

    if (processo === '04' || processo === '05') {
        const valorTexto = rascunho.valor.trim();
        const valor = lerValor(valorTexto);
        if (valorTexto === '') {
            if (processo === '05') erros.valor = MENSAGENS.valorVazio;
            else campos.valor_centavos = null;
        } else if (valor === null) {
            erros.valor = MENSAGENS.valorInvalido;
        } else {
            campos.valor_centavos = valor;
        }
    }

    return { erros, campos };
}

function Campo({ id, rotulo, erro, ...resto }) {
    return (
        <div className="flex flex-col gap-1">
            <label htmlFor={id} className="text-sm text-tinta">
                {rotulo}
            </label>
            <input
                id={id}
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

// Props: `item` (registro do store `itens`), `toques` (só os deste item) e
// `aoMudar()`, chamado depois de cada gravação para a tela recarregar.
export default function PendenciaCartao({ item, toques = [], aoMudar }) {
    const [modo, setModo] = useState('ver');
    const [rascunho, setRascunho] = useState(null);
    const [erros, setErros] = useState({});
    const [erroGeral, setErroGeral] = useState('');
    const [ocupado, setOcupado] = useState(false);
    const [confirmando, setConfirmando] = useState(false);

    const processo = item.processo;
    const estado = situacao(item, toques);
    const aberto = item.status === 'aberto';
    const listaToques = [...(toques ?? [])].sort((a, b) =>
        texto(a.enviado_em).localeCompare(texto(b.enviado_em)),
    );
    const prefixo = `pendencia-${item.id}`;

    const gravar = async (acao) => {
        if (ocupado) return;
        setOcupado(true);
        setErroGeral('');
        try {
            await acao();
            setModo('ver');
            setConfirmando(false);
            aoMudar?.();
        } catch {
            setConfirmando(false);
            setErroGeral(ERRO_GRAVAR);
        } finally {
            setOcupado(false);
        }
    };

    const abrirEdicao = () => {
        setRascunho({
            data: dataParaCampo(item.data),
            hora: texto(item.hora),
            valor: valorParaCampo(item.valor_centavos),
            servico: texto(item.servico),
        });
        setErros({});
        setErroGeral('');
        setModo('editar');
    };

    const mudarCampo = (campo) => (evento) => {
        const valor = evento.target.value;
        setRascunho((atual) => ({ ...atual, [campo]: valor }));
    };

    const salvar = (evento) => {
        evento.preventDefault();
        const conferido = conferirEdicao(processo, rascunho);
        setErros(conferido.erros);
        if (Object.keys(conferido.erros).length > 0) return;
        gravar(() => atualizarPendencia(item.id, conferido.campos));
    };

    const voltar = () => {
        setModo('ver');
        setErros({});
        setErroGeral('');
    };

    const dataTexto = formatarDiaMes(item.data);
    const horaTexto = processo === '01' && item.hora ? ` às ${item.hora}` : '';
    const valorTexto = formatarBRL(item.valor_centavos);

    return (
        <article className="border border-filete-claro p-4" aria-labelledby={`${prefixo}-titulo`}>
            <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 id={`${prefixo}-titulo`} className="text-base font-medium">
                    {PROCESSOS[processo] ?? processo}
                </h3>
                <span className="text-sm text-tinta">{SITUACOES[estado] ?? estado}</span>
            </header>

            {modo === 'editar' ? (
                <form onSubmit={salvar} noValidate className="mt-4 flex flex-col gap-4">
                    <Campo
                        id={`${prefixo}-data`}
                        rotulo={NOME_DATA[processo] ?? 'Data'}
                        erro={erros.data}
                        value={rascunho.data}
                        onChange={mudarCampo('data')}
                        inputMode="numeric"
                        placeholder="08/12/2026"
                        autoComplete="off"
                    />
                    {processo === '01' && (
                        <Campo
                            id={`${prefixo}-hora`}
                            rotulo="Hora"
                            erro={erros.hora}
                            value={rascunho.hora}
                            onChange={mudarCampo('hora')}
                            inputMode="numeric"
                            placeholder="14:30"
                            autoComplete="off"
                        />
                    )}
                    {(processo === '04' || processo === '05') && (
                        <Campo
                            id={`${prefixo}-valor`}
                            rotulo={processo === '05' ? 'Valor' : 'Valor (se quiser)'}
                            erro={erros.valor}
                            value={rascunho.valor}
                            onChange={mudarCampo('valor')}
                            inputMode="decimal"
                            placeholder="1.250,00"
                            autoComplete="off"
                        />
                    )}
                    <Campo
                        id={`${prefixo}-servico`}
                        rotulo="Serviço (se quiser)"
                        value={rascunho.servico}
                        onChange={mudarCampo('servico')}
                        autoComplete="off"
                    />
                    {erroGeral && (
                        <p role="alert" className="text-sm font-medium">
                            {erroGeral}
                        </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                        <button type="submit" disabled={ocupado} className={`${BOTAO_CHEIO} flex-1 disabled:opacity-60`}>
                            Salvar
                        </button>
                        <button type="button" onClick={voltar} className={`${BOTAO} flex-1`}>
                            Voltar
                        </button>
                    </div>
                </form>
            ) : (
                <>
                    <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-base">
                        <dt className="text-tinta">{NOME_DATA[processo] ?? 'Data'}</dt>
                        <dd>{`${dataTexto}${horaTexto}`}</dd>
                        {valorTexto && (
                            <>
                                <dt className="text-tinta">Valor</dt>
                                <dd>{valorTexto}</dd>
                            </>
                        )}
                        {item.servico && (
                            <>
                                <dt className="text-tinta">Serviço</dt>
                                <dd className="wrap-anywhere">{item.servico}</dd>
                            </>
                        )}
                        {item.status === 'resolvido' && item.resultado && (
                            <>
                                <dt className="text-tinta">Resultado</dt>
                                <dd className="font-medium">{NOMES_RESULTADOS[item.resultado] ?? item.resultado}</dd>
                            </>
                        )}
                    </dl>

                    <div className="mt-4 border-t border-filete-claro pt-3">
                        <h4 className="text-sm text-tinta">Mensagens</h4>
                        {listaToques.length === 0 ? (
                            <p className="mt-1 text-base">Nenhuma mensagem enviada ainda.</p>
                        ) : (
                            <ul className="mt-1 flex flex-col gap-1 text-base">
                                {listaToques.map((toque, posicao) => (
                                    <li key={toque.id ?? posicao}>{linhaDoToque(toque)}</li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {aberto && erroGeral && (
                        <p role="alert" className="mt-4 text-sm font-medium">
                            {erroGeral}
                        </p>
                    )}

                    {aberto && modo === 'resolver' && (
                        <div className="mt-4 flex flex-col gap-2">
                            <p className="text-sm text-tinta">Como ficou?</p>
                            <div className="flex flex-wrap gap-2">
                                {(RESULTADOS[processo] ?? []).map((resultado) => (
                                    <button
                                        key={resultado}
                                        type="button"
                                        disabled={ocupado}
                                        onClick={() => gravar(() => resolverPendencia(item.id, resultado))}
                                        className={`${BOTAO_CHEIO} flex-1 disabled:opacity-60`}
                                    >
                                        {NOMES_RESULTADOS[resultado] ?? resultado}
                                    </button>
                                ))}
                            </div>
                            <button type="button" onClick={voltar} className={BOTAO}>
                                Voltar
                            </button>
                        </div>
                    )}

                    {aberto && modo === 'ver' && (
                        <div className="mt-4 flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setErroGeral('');
                                    setModo('resolver');
                                }}
                                className={`${BOTAO_CHEIO} flex-1`}
                            >
                                Resolver
                            </button>
                            <button type="button" onClick={abrirEdicao} className={`${BOTAO} flex-1`}>
                                Editar
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setErroGeral('');
                                    setConfirmando(true);
                                }}
                                className={`${BOTAO} w-full`}
                            >
                                Cancelar pendência
                            </button>
                        </div>
                    )}
                </>
            )}

            {aberto && (
                <Confirmar
                    aberto={confirmando}
                    titulo="Cancelar esta pendência?"
                    texto="Ela sai da lista de hoje."
                    rotuloConfirmar="Cancelar pendência"
                    rotuloVoltar="Voltar"
                    aoConfirmar={() => gravar(() => cancelarPendencia(item.id))}
                    aoVoltar={() => setConfirmando(false)}
                />
            )}
        </article>
    );
}
