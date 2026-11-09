// Importar planilha CSV com prévia: o dono escolhe o arquivo, vê quantas
// linhas estão certas e quais têm erro (linha e motivo) e importa só as
// válidas. O arquivo é lido aqui no aparelho e gravado nele; nada vai para
// o servidor. Fundo creme. O acento vermelho aparece uma vez só, no botão
// de importar.

import { useRef, useState } from 'react';
import { lerPlanilha, modeloPlanilha } from '../regras/planilha.js';
import { importarPendencias } from '../dados/pendencias.js';
import { baixarArquivo } from './baixarArquivo.js';

const NOME_MODELO = 'modelo-rotina-do-dia.csv';

// Acima disso a lista de linhas com erro ganha rolagem própria.
const LIMITE_LISTA = 10;

const BOTAO_CHEIO =
    'flex min-h-[44px] w-full items-center justify-center bg-grafite px-4 text-base font-medium text-papel disabled:opacity-60';
const BOTAO_CONTORNO =
    'flex min-h-[44px] w-full items-center justify-center border border-tinta px-4 text-base font-medium disabled:opacity-60';
const BOTAO_ACENTO =
    'flex min-h-[44px] w-full items-center justify-center bg-caneta-creme px-4 text-base font-medium text-papel disabled:opacity-60';

function contar(numero, singular, plural) {
    return `${numero.toLocaleString('pt-BR')} ${numero === 1 ? singular : plural}`;
}

// Texto de fim da importação, a partir do que `importarPendencias` devolve.
function textoDoFim({ itens, clientesNovos, repetidos }) {
    const importadas =
        itens === 0 ? 'Nenhuma pendência importada' : contar(itens, 'pendência importada', 'pendências importadas');
    const novos = clientesNovos === 0 ? 'nenhum cliente novo' : contar(clientesNovos, 'cliente novo', 'clientes novos');
    const frases = [`${importadas}, ${novos}.`];
    if (repetidos > 0) {
        frases.push(
            repetidos === 1
                ? '1 já estava aqui e não foi repetida.'
                : `${repetidos.toLocaleString('pt-BR')} já estavam aqui e não foram repetidas.`,
        );
    }
    return frases.join(' ');
}

// Nome e WhatsApp crus da linha, para o dono achar de quem é a linha com erro.
function deQuemE(campos = {}) {
    return [campos.nome, campos.whatsapp]
        .map((valor) => String(valor ?? '').trim())
        .filter(Boolean)
        .join(', ');
}

// Baixa o modelo de planilha, gerado aqui no aparelho.
function baixarModelo() {
    baixarArquivo(NOME_MODELO, modeloPlanilha(), 'text/csv;charset=utf-8');
}

// Props:
// - `aoTerminar(resumo)`: chamado pelo botão "Ver clientes" no fim, com
//   `{ clientesNovos, itens, repetidos }`.
// - `aoFechar()`: volta sem importar.
export default function ImportarPlanilha({ aoTerminar, aoFechar }) {
    // 'inicio' | 'lendo' | 'previa' | 'importando' | 'fim'
    const [etapa, setEtapa] = useState('inicio');
    const [erro, setErro] = useState('');
    const [planilha, setPlanilha] = useState(null);
    const [resumo, setResumo] = useState(null);
    const entrada = useRef(null);

    function escolherArquivo() {
        entrada.current?.click();
    }

    async function aoEscolher(evento) {
        const arquivo = evento.target.files?.[0];
        // Limpa o campo para escolher de novo o mesmo arquivo depois de corrigir.
        evento.target.value = '';
        if (!arquivo) return;

        setEtapa('lendo');
        setErro('');
        setPlanilha(null);

        let resultado;
        try {
            resultado = lerPlanilha(await arquivo.text());
        } catch {
            resultado = { ok: false, erro: 'Não consegui ler esse arquivo. Salve a planilha como CSV e tente de novo.' };
        }

        if (!resultado.ok) {
            setErro(resultado.erro);
            setEtapa('inicio');
            return;
        }
        setPlanilha(resultado);
        setEtapa('previa');
    }

    async function importar() {
        if (etapa !== 'previa' || !planilha || planilha.validas === 0) return;
        setEtapa('importando');
        setErro('');
        try {
            const contagem = await importarPendencias(planilha.linhas.filter((linha) => linha.valida));
            setResumo(contagem);
            setEtapa('fim');
        } catch {
            setErro('Não consegui gravar a planilha neste aparelho. Nada foi importado. Tente de novo.');
            setEtapa('previa');
        }
    }

    const ocupado = etapa === 'lendo' || etapa === 'importando';
    const invalidas = planilha ? planilha.linhas.filter((linha) => !linha.valida) : [];

    return (
        <section aria-labelledby="importar-titulo" className="flex flex-col gap-5">
            <div className="flex items-center justify-between gap-3">
                <h2 id="importar-titulo" className="text-xl font-medium">
                    Importar planilha
                </h2>
                {etapa !== 'fim' && (
                    <button
                        type="button"
                        onClick={() => aoFechar?.()}
                        disabled={ocupado}
                        className="flex min-h-[44px] items-center px-2 text-base text-tinta underline underline-offset-4 disabled:opacity-60"
                    >
                        Voltar
                    </button>
                )}
            </div>

            <input
                ref={entrada}
                type="file"
                accept=".csv,text/csv"
                onChange={aoEscolher}
                tabIndex={-1}
                aria-hidden="true"
                className="hidden"
            />

            {(etapa === 'inicio' || etapa === 'lendo') && (
                <>
                    <div className="flex flex-col gap-2">
                        <p>
                            Um cliente por linha, com o cabeçalho na primeira: nome, whatsapp, processo, data, hora,
                            valor e servico.
                        </p>
                        <p className="text-sm text-tinta">
                            Hora vale para confirmar horário e valor para cobrança. No Excel ou no Google Planilhas,
                            salve como CSV. O arquivo é lido aqui e os dados ficam só neste aparelho.
                        </p>
                    </div>

                    {erro && (
                        <p role="alert" className="border-l-2 border-tinta pl-3">
                            {erro}
                        </p>
                    )}

                    <div className="flex flex-col gap-2">
                        <button type="button" onClick={escolherArquivo} disabled={ocupado} className={BOTAO_CHEIO}>
                            {etapa === 'lendo' ? 'Lendo a planilha...' : 'Escolher arquivo'}
                        </button>
                        <button type="button" onClick={baixarModelo} className={BOTAO_CONTORNO}>
                            Baixar modelo
                        </button>
                    </div>
                </>
            )}

            {(etapa === 'previa' || etapa === 'importando') && planilha && (
                <>
                    <div role="status" className="flex flex-col gap-1">
                        <p className="text-lg font-medium">
                            {planilha.validas === 0
                                ? 'Nenhuma linha pronta para importar'
                                : contar(planilha.validas, 'linha pronta para importar', 'linhas prontas para importar')}
                        </p>
                        {invalidas.length > 0 && (
                            <p className="text-tinta">
                                {invalidas.length === 1
                                    ? '1 linha com erro fica de fora:'
                                    : `${invalidas.length.toLocaleString('pt-BR')} linhas com erro ficam de fora:`}
                            </p>
                        )}
                    </div>

                    {invalidas.length > 0 && (
                        <ul
                            aria-label="Linhas com erro"
                            tabIndex={invalidas.length > LIMITE_LISTA ? 0 : undefined}
                            className={`flex flex-col border-y border-filete-claro ${
                                invalidas.length > LIMITE_LISTA ? 'max-h-[22rem] overflow-y-auto' : ''
                            }`}
                        >
                            {invalidas.map((linha) => {
                                const quem = deQuemE(linha.campos);
                                return (
                                    <li key={linha.numero} className="border-b border-filete-claro py-2 last:border-b-0">
                                        <p>
                                            <span className="font-medium">Linha {linha.numero}:</span>{' '}
                                            {linha.erros.join(' ')}
                                        </p>
                                        {quem && <p className="text-sm text-tinta wrap-anywhere">{quem}</p>}
                                    </li>
                                );
                            })}
                        </ul>
                    )}

                    {erro && (
                        <p role="alert" className="border-l-2 border-tinta pl-3">
                            {erro}
                        </p>
                    )}

                    <div className="flex flex-col gap-2">
                        <button
                            type="button"
                            onClick={importar}
                            disabled={etapa === 'importando' || planilha.validas === 0}
                            className={BOTAO_ACENTO}
                        >
                            {etapa === 'importando'
                                ? 'Importando...'
                                : `${invalidas.length > 0 ? 'Importar só as válidas' : 'Importar'} (${planilha.validas.toLocaleString('pt-BR')})`}
                        </button>
                        <button
                            type="button"
                            onClick={escolherArquivo}
                            disabled={etapa === 'importando'}
                            className={BOTAO_CONTORNO}
                        >
                            Escolher outro arquivo
                        </button>
                    </div>
                </>
            )}

            {etapa === 'fim' && resumo && (
                <>
                    <p role="status" className="text-lg font-medium">
                        {textoDoFim(resumo)}
                    </p>
                    <button type="button" onClick={() => aoTerminar?.(resumo)} className={BOTAO_CHEIO}>
                        Ver clientes
                    </button>
                </>
            )}
        </section>
    );
}
