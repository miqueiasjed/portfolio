// Regras do formulário da tela Ajustes: conferir os prazos digitados antes de
// gravar e converter os ajustes salvos nos textos dos campos. Sem acesso ao
// aparelho, para dar para testar sem navegador.

import { PRAZOS_PADRAO } from './hoje.js';

export const PRAZO_MINIMO = 1;
export const PRAZO_MAXIMO = 60;

export const MENSAGENS_PRAZO = Object.freeze({
    faixa: `Use um número de dias de ${PRAZO_MINIMO} a ${PRAZO_MAXIMO}.`,
    ordem: [
        null,
        'Use dias em ordem: o segundo maior que o primeiro.',
        'Use dias em ordem: o terceiro maior que o segundo.',
    ],
});

// Texto do campo -> inteiro, ou null quando não é um número inteiro de dias.
function lerDias(texto) {
    const limpo = String(texto ?? '').trim();
    if (!/^\d{1,3}$/.test(limpo)) return null;
    return Number(limpo);
}

// Recebe os textos dos campos de um processo (2 no orçamento, 3 na cobrança).
// Certo: `{ ok: true, dias: [n, ...] }`. Errado: `{ ok: false, erros }`, com a
// mensagem no índice de cada campo que precisa mudar. A regra é mais estreita
// que a da lista de hoje (`regras/hoje.js`), então o que passa aqui ela aceita.
export function validarPrazos(textos) {
    const lista = Array.isArray(textos) ? textos : [];
    const dias = lista.map(lerDias);
    const erros = {};

    dias.forEach((n, i) => {
        if (n === null || n < PRAZO_MINIMO || n > PRAZO_MAXIMO) {
            erros[i] = MENSAGENS_PRAZO.faixa;
            return;
        }
        // Só compara com o anterior quando ele está na faixa; senão o erro
        // fica só nele.
        const anterior = i > 0 && erros[i - 1] !== MENSAGENS_PRAZO.faixa ? dias[i - 1] : null;
        if (anterior !== null && n <= anterior) {
            erros[i] = MENSAGENS_PRAZO.ordem[i] ?? MENSAGENS_PRAZO.ordem[1];
        }
    });

    if (lista.length === 0 || Object.keys(erros).length > 0) {
        return { ok: false, erros };
    }
    return { ok: true, dias };
}

function texto(valor) {
    return typeof valor === 'string' ? valor : '';
}

// Lista salva com o tamanho errado cai no padrão, como faz a lista de hoje.
function textosDosDias(lista, padrao) {
    const usada = Array.isArray(lista) && lista.length === padrao.length ? lista : padrao;
    return usada.map((n) => String(n));
}

// Ajustes completos (de `lerAjustes`) -> valores dos campos da tela.
export function formularioDosAjustes(ajustes) {
    const a = ajustes ?? {};
    const prazos = a.prazos ?? {};
    return {
        segmento: a.segmento === 'servicos' ? 'servicos' : 'clinica',
        negocio: texto(a.negocio),
        assinatura: texto(a.assinatura),
        chave_pix: texto(a.chave_pix),
        orcamento: textosDosDias(prazos.orcamento, PRAZOS_PADRAO.orcamento),
        cobranca: textosDosDias(prazos.cobranca, PRAZOS_PADRAO.cobranca),
        variacao: a.variacao === 2 ? 2 : 1,
    };
}
