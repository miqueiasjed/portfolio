// Preenchimento das mensagens da Rotina do Dia.
// Monta os valores a partir do cliente, do item e dos ajustes, escolhe o
// texto da combinação certa e troca as variáveis, tudo no aparelho.

import { formatarDiaMes } from './datas.js';

const VARIAVEL = /\{(\w+)\}/g;

// Variáveis que ficam no meio da frase. Vazias, só somem: nunca derrubam a
// linha (senão `Oi, {nome}, tudo bem?` sumiria inteira sem o nome).
// As demais (`servico`, `valor`, `negocio`, `assinatura`, `pix`) podem faltar
// e ficam em linha própria; linha só com elas, todas vazias, sai inteira.
const DE_MEIO_DE_FRASE = new Set(['nome', 'data', 'hora']);

const formatadorBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

// String sem espaços nas pontas; qualquer outra coisa vira ''.
function comoTexto(valor) {
    if (valor === null || valor === undefined) return '';
    if (typeof valor === 'string') return valor.trim();
    if (typeof valor === 'number' && Number.isFinite(valor)) return String(valor);
    return '';
}

function capitalizar(palavra) {
    const minusculas = palavra.toLocaleLowerCase('pt-BR');
    return minusculas.charAt(0).toLocaleUpperCase('pt-BR') + minusculas.slice(1);
}

// Primeira palavra do nome. Nome todo em maiúsculas ou todo em minúsculas
// sai capitalizado; caixa mista fica como veio.
export function primeiroNome(nome) {
    const limpo = comoTexto(nome);
    if (!limpo) return '';
    const primeira = limpo.split(/\s+/)[0];
    const todoMaiusculo = limpo === limpo.toLocaleUpperCase('pt-BR');
    const todoMinusculo = limpo === limpo.toLocaleLowerCase('pt-BR');
    if (todoMaiusculo || todoMinusculo) return capitalizar(primeira);
    return primeira;
}

// Centavos para `R$ 1.250,00`, com espaço comum depois do símbolo.
export function formatarBRL(centavos) {
    if (typeof centavos !== 'number' || !Number.isFinite(centavos)) return '';
    return formatadorBRL.format(centavos / 100).replace(/[  ]/g, ' ');
}

// Valores de todas as variáveis, sempre string ('' quando faltar).
export function valoresDaMensagem({ cliente, item, ajustes } = {}) {
    return {
        nome: primeiroNome(cliente?.nome),
        data: formatarDiaMes(item?.data),
        hora: comoTexto(item?.hora),
        servico: comoTexto(item?.servico),
        valor: formatarBRL(item?.valor_centavos),
        negocio: comoTexto(ajustes?.negocio),
        assinatura: comoTexto(ajustes?.assinatura),
        pix: comoTexto(ajustes?.chave_pix),
    };
}

// Limpa uma linha que recebeu variáveis: sem espaço duplo, sem espaço antes
// de pontuação e sem vírgula sobrando no começo, no meio ou no fim.
function limparLinha(linha) {
    return linha
        .replace(/\s+/g, ' ')
        .replace(/ +([,.!?;:])/g, '$1')
        .replace(/,(\s*,)+/g, ',')
        .replace(/,\s*([.!?;:])/g, '$1')
        .replace(/^[\s,.!?;:]+/, '')
        .replace(/,\s*$/, '')
        .trim();
}

// Troca `{variavel}` pelo valor, linha a linha. Linha em que todas as
// variáveis estão vazias sai inteira, desde que ao menos uma delas seja de
// linha própria; nas demais, a variável vazia some e a pontuação em volta é
// limpa. Variável desconhecida fica como está.
export function preencher(texto, valores = {}) {
    if (typeof texto !== 'string') return '';
    const conhecida = (nome) => Object.prototype.hasOwnProperty.call(valores, nome);
    const valorDe = (nome) => comoTexto(valores[nome]);

    const linhas = [];
    for (const linha of texto.split(/\r?\n/)) {
        const nomes = [...linha.matchAll(VARIAVEL)].map((achado) => achado[1]);

        if (nomes.length === 0) {
            linhas.push(linha);
            continue;
        }

        const todasVazias = nomes.every((nome) => conhecida(nome) && valorDe(nome) === '');
        const temDeLinha = nomes.some((nome) => !DE_MEIO_DE_FRASE.has(nome));
        if (todasVazias && temDeLinha) continue;

        const trocada = linha.replace(VARIAVEL, (original, nome) => (conhecida(nome) ? valorDe(nome) : original));
        const tinhaConhecida = nomes.some(conhecida);
        linhas.push(tinhaConhecida ? limparLinha(trocada) : trocada);
    }

    // Linhas em branco repetidas viram uma; nada em branco nas pontas.
    const resultado = [];
    for (const linha of linhas) {
        const emBranco = linha.trim() === '';
        if (emBranco && (resultado.length === 0 || resultado[resultado.length - 1] === '')) continue;
        resultado.push(emBranco ? '' : linha);
    }
    while (resultado.length && resultado[resultado.length - 1] === '') resultado.pop();

    return resultado.join('\n');
}

// Texto da combinação pedida. Sem a variação pedida, usa a 1; sem nada, null.
export function escolherTexto(textos, { processo, etapa, segmento, variacao } = {}) {
    if (!Array.isArray(textos)) return null;
    const daCombinacao = (v) =>
        textos.find(
            (t) => t && t.processo === processo && t.etapa === etapa && t.segmento === segmento && Number(t.variacao) === v,
        );
    const achado = daCombinacao(Number(variacao) || 1) ?? daCombinacao(1);
    return typeof achado?.texto === 'string' ? achado.texto : null;
}

// Mensagem pronta para o item na etapa, ou null se não houver texto.
export function mensagemPronta({ textos, item, cliente, ajustes, etapa } = {}) {
    const texto = escolherTexto(textos, {
        processo: item?.processo,
        etapa,
        segmento: ajustes?.segmento,
        variacao: ajustes?.variacao,
    });
    if (texto === null) return null;
    return preencher(texto, valoresDaMensagem({ cliente, item, ajustes }));
}
