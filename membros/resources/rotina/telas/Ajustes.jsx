// Tela Ajustes (`#/ajustes`): o dono define o tipo de negócio, o nome, a
// assinatura, a chave Pix, os prazos de cada lembrete e o texto preferido.
// Cada campo grava ao sair dele (ou ao escolher, no select e no texto
// preferido), sem botão Salvar, e a Mensagem relê os ajustes ao abrir. Embaixo,
// o link da aula e a cópia dos dados. Fundo creme, sem acento vermelho.

import { useCallback, useEffect, useRef, useState } from 'react';
import { lerAjustes, salvarAjustes } from '../dados/ajustes.js';
import { formularioDosAjustes, validarPrazos } from '../regras/ajustes.js';
import Botao from '../ui/Botao.jsx';
import Campo from '../ui/Campo.jsx';
import CopiaDeSeguranca from '../ui/CopiaDeSeguranca.jsx';

const URL_DA_AULA = '/produtos/rotina-do-dia';

const SEGMENTOS = [
    { valor: 'clinica', rotulo: 'Clínica, consultório ou estética' },
    { valor: 'servicos', rotulo: 'Prestador de serviço' },
];

const PRAZOS = [
    {
        grupo: 'orcamento',
        titulo: 'Orçamento',
        ajuda: 'Contando do dia em que o orçamento foi enviado.',
    },
    {
        grupo: 'cobranca',
        titulo: 'Cobrança',
        ajuda: 'Contando do dia do vencimento.',
    },
];

const ERRO_ABRIR = 'Não deu para abrir os ajustes agora.';
const ERRO_GUARDAR = 'Não deu para guardar agora. Tente de novo.';

const TITULO_SECAO = 'text-xl font-medium';

function chaveDoPrazo(grupo, indice) {
    return `${grupo}.${indice}`;
}

// Tira do mapa de erros todos os campos de um grupo de prazos.
function semErrosDoGrupo(erros, grupo) {
    const saida = {};
    for (const [chave, valor] of Object.entries(erros)) {
        if (!chave.startsWith(`${grupo}.`)) saida[chave] = valor;
    }
    return saida;
}

function mesmosTextos(a, b) {
    return a.length === b.length && a.every((valor, i) => valor === b[i]);
}

// Confirmação curta perto do campo. A região fica sempre no lugar para o
// leitor de tela anunciar quando o texto aparece.
function Guardado({ visivel }) {
    return (
        <p role="status" className={visivel ? 'pt-1 text-sm' : 'text-sm'}>
            {visivel ? 'Guardado.' : ''}
        </p>
    );
}

export default function Ajustes() {
    // 'abrindo' | 'pronto' | 'erro'
    const [estado, setEstado] = useState('abrindo');
    const [form, setForm] = useState(null);
    const [erros, setErros] = useState({});
    const [guardado, setGuardado] = useState(null);
    // O que está gravado agora, para não regravar o que não mudou.
    const salvos = useRef(null);
    // Sobe a cada leitura: resposta de leitura ou de gravação antiga não mexe
    // no formulário que veio depois (por exemplo, depois de restaurar a cópia).
    const versao = useRef(0);

    const carregar = useCallback(async () => {
        const vez = ++versao.current;
        try {
            const ajustes = await lerAjustes();
            if (vez !== versao.current) return;
            const valores = formularioDosAjustes(ajustes);
            salvos.current = valores;
            setForm(valores);
            setErros({});
            setGuardado(null);
            setEstado('pronto');
        } catch {
            if (vez === versao.current) setEstado('erro');
        }
    }, []);

    useEffect(() => {
        carregar();
    }, [carregar]);

    // Grava `parcial` e, dando certo, marca `valores` como salvos e mostra a
    // confirmação em `chave`.
    async function guardar(chave, parcial, valores) {
        const vez = versao.current;
        setGuardado(null);
        try {
            await salvarAjustes(parcial);
        } catch {
            if (vez === versao.current) setErros((atual) => ({ ...atual, [chave]: ERRO_GUARDAR }));
            return;
        }
        if (vez !== versao.current) return;
        salvos.current = { ...salvos.current, ...valores };
        setErros((atual) => (atual[chave] ? { ...atual, [chave]: undefined } : atual));
        setGuardado(chave);
    }

    function mudarTexto(nome, valor) {
        setForm((atual) => ({ ...atual, [nome]: valor }));
    }

    function sairDoTexto(nome) {
        const valor = form[nome].trim();
        if (valor !== form[nome]) mudarTexto(nome, valor);
        if (valor === salvos.current[nome] && !erros[nome]) return;
        guardar(nome, { [nome]: valor }, { [nome]: valor });
    }

    function escolherSegmento(valor) {
        if (valor === form.segmento) return;
        setForm((atual) => ({ ...atual, segmento: valor }));
        guardar('segmento', { segmento: valor }, { segmento: valor });
    }

    function escolherVariacao(numero) {
        if (numero === form.variacao) return;
        setForm((atual) => ({ ...atual, variacao: numero }));
        guardar('variacao', { variacao: numero }, { variacao: numero });
    }

    function mudarPrazo(grupo, indice, valor) {
        setForm((atual) => ({
            ...atual,
            [grupo]: atual[grupo].map((texto, i) => (i === indice ? valor : texto)),
        }));
        const chave = chaveDoPrazo(grupo, indice);
        setErros((atual) => (atual[chave] ? { ...atual, [chave]: undefined } : atual));
    }

    // Confere o grupo inteiro: um prazo só faz sentido junto dos outros.
    function sairDoPrazo(grupo, indice) {
        const conferido = validarPrazos(form[grupo]);
        if (!conferido.ok) {
            setErros((atual) => {
                const saida = semErrosDoGrupo(atual, grupo);
                for (const [i, mensagem] of Object.entries(conferido.erros)) {
                    saida[chaveDoPrazo(grupo, Number(i))] = mensagem;
                }
                return saida;
            });
            return;
        }

        const textos = conferido.dias.map(String);
        setForm((atual) => ({ ...atual, [grupo]: textos }));
        setErros((atual) => semErrosDoGrupo(atual, grupo));
        if (mesmosTextos(textos, salvos.current[grupo])) return;
        guardar(chaveDoPrazo(grupo, indice), { prazos: { [grupo]: conferido.dias } }, { [grupo]: textos });
    }

    return (
        <section aria-labelledby="ajustes-titulo" className="flex flex-col gap-8 py-2">
            <h1 id="ajustes-titulo" className="text-2xl font-medium">
                Ajustes
            </h1>

            {estado === 'abrindo' && <p role="status">Abrindo seus ajustes...</p>}

            {estado === 'erro' && (
                <div role="alert" className="flex flex-col gap-3 border-l-2 border-tinta pl-3">
                    <p>{ERRO_ABRIR}</p>
                    <Botao onClick={carregar}>Tentar de novo</Botao>
                </div>
            )}

            {estado === 'pronto' && form && (
                <>
                    <section aria-labelledby="ajustes-negocio" className="flex flex-col gap-4">
                        <h2 id="ajustes-negocio" className={TITULO_SECAO}>
                            Seu negócio
                        </h2>

                        <div>
                            <Campo
                                id="ajustes-segmento"
                                tipo="select"
                                rotulo="Tipo de negócio"
                                ajuda="Os textos mudam conforme o tipo de negócio."
                                opcoes={SEGMENTOS}
                                value={form.segmento}
                                onChange={(e) => escolherSegmento(e.target.value)}
                                erro={erros.segmento}
                            />
                            <Guardado visivel={guardado === 'segmento'} />
                        </div>

                        <div>
                            <Campo
                                id="ajustes-negocio-nome"
                                rotulo="Nome do negócio"
                                autoComplete="off"
                                autoCapitalize="words"
                                value={form.negocio}
                                onChange={(e) => mudarTexto('negocio', e.target.value)}
                                onBlur={() => sairDoTexto('negocio')}
                                erro={erros.negocio}
                            />
                            <Guardado visivel={guardado === 'negocio'} />
                        </div>

                        <div>
                            <Campo
                                id="ajustes-assinatura"
                                rotulo="Assinatura"
                                ajuda="Vai no fim das mensagens. Ex.: Ana, da Clínica Sorriso."
                                autoComplete="off"
                                value={form.assinatura}
                                onChange={(e) => mudarTexto('assinatura', e.target.value)}
                                onBlur={() => sairDoTexto('assinatura')}
                                erro={erros.assinatura}
                            />
                            <Guardado visivel={guardado === 'assinatura'} />
                        </div>

                        <div>
                            <Campo
                                id="ajustes-pix"
                                rotulo="Chave Pix"
                                ajuda="Só aparece nas cobranças. Deixe vazio se não quiser mandar."
                                autoComplete="off"
                                autoCapitalize="none"
                                spellCheck={false}
                                value={form.chave_pix}
                                onChange={(e) => mudarTexto('chave_pix', e.target.value)}
                                onBlur={() => sairDoTexto('chave_pix')}
                                erro={erros.chave_pix}
                            />
                            <Guardado visivel={guardado === 'chave_pix'} />
                        </div>
                    </section>

                    <section aria-labelledby="ajustes-prazos" className="flex flex-col gap-6">
                        <h2 id="ajustes-prazos" className={TITULO_SECAO}>
                            Quando chamar de novo
                        </h2>

                        {PRAZOS.map(({ grupo, titulo, ajuda }) => (
                            <fieldset
                                key={grupo}
                                aria-describedby={`ajustes-${grupo}-ajuda`}
                                className="flex min-w-0 flex-col gap-3"
                            >
                                <legend className="text-base font-medium">{titulo}</legend>
                                <p id={`ajustes-${grupo}-ajuda`} className="-mt-2 text-sm">
                                    {ajuda}
                                </p>
                                {form[grupo].map((texto, indice) => {
                                    const chave = chaveDoPrazo(grupo, indice);
                                    return (
                                        <div key={chave}>
                                            <Campo
                                                id={`ajustes-${grupo}-${indice}`}
                                                rotulo={`${indice + 1}º lembrete após quantos dias`}
                                                inputMode="numeric"
                                                autoComplete="off"
                                                enterKeyHint="done"
                                                maxLength={3}
                                                className="max-w-[7rem]"
                                                value={texto}
                                                onChange={(e) => mudarPrazo(grupo, indice, e.target.value)}
                                                onBlur={() => sairDoPrazo(grupo, indice)}
                                                erro={erros[chave]}
                                            />
                                            <Guardado visivel={guardado === chave} />
                                        </div>
                                    );
                                })}
                            </fieldset>
                        ))}
                    </section>

                    <section aria-labelledby="ajustes-texto" className="flex flex-col gap-3">
                        <h2 id="ajustes-texto" className={TITULO_SECAO}>
                            Texto preferido
                        </h2>
                        <div
                            role="group"
                            aria-labelledby="ajustes-texto"
                            aria-describedby="ajustes-texto-ajuda"
                            className="grid grid-cols-2 gap-2"
                        >
                            {[1, 2].map((numero) => {
                                const ativo = form.variacao === numero;
                                return (
                                    <button
                                        key={numero}
                                        type="button"
                                        aria-pressed={ativo}
                                        onClick={() => escolherVariacao(numero)}
                                        className={`flex min-h-[44px] items-center justify-center px-2 text-base font-medium ${
                                            ativo ? 'bg-grafite text-papel' : 'border border-tinta text-tinta'
                                        }`}
                                    >
                                        Texto {numero}
                                    </button>
                                );
                            })}
                        </div>
                        <p id="ajustes-texto-ajuda" className="text-sm">
                            Na hora de mandar você ainda pode trocar.
                        </p>
                        {erros.variacao && <p className="text-sm font-medium">{erros.variacao}</p>}
                        <Guardado visivel={guardado === 'variacao'} />
                    </section>
                </>
            )}

            <section aria-labelledby="ajustes-aula" className="flex flex-col gap-3">
                <h2 id="ajustes-aula" className={TITULO_SECAO}>
                    Aula
                </h2>
                <p className="font-light">A aula mostra, passo a passo, como usar a Rotina do Dia.</p>
                <Botao href={URL_DA_AULA} largura="total">
                    Assistir à aula
                </Botao>
            </section>

            <CopiaDeSeguranca aoRestaurar={carregar} />
        </section>
    );
}
