// Regras do primeiro uso: quando mostrar os três passos de boas-vindas e como
// andar entre eles. Sem acesso ao aparelho, para dar para testar sem navegador.

import { SEGMENTOS } from './ajustes.js';

export const TOTAL_DE_PASSOS = 3;

// Primeiro uso: nenhum registro de ajustes gravado (o que vem de
// `pegar('ajustes', 'geral')`, nunca de `lerAjustes`, que sempre devolve o
// padrão) e nenhum cliente anotado. Depois do passo 2 o registro existe, então
// a Hoje não volta a mostrar o primeiro uso.
export function ehPrimeiroUso(ajustesSalvos, clientes) {
    const semAjustes = ajustesSalvos === undefined || ajustesSalvos === null;
    const semClientes = !Array.isArray(clientes) || clientes.length === 0;
    return semAjustes && semClientes;
}

function passoValido(passo) {
    const n = Number(passo);
    if (!Number.isInteger(n)) return 1;
    return Math.min(Math.max(n, 1), TOTAL_DE_PASSOS);
}

// "1 de 3", "2 de 3", "3 de 3".
export function contagemDoPasso(passo) {
    return `${passoValido(passo)} de ${TOTAL_DE_PASSOS}`;
}

export function passoSeguinte(passo) {
    return Math.min(passoValido(passo) + 1, TOTAL_DE_PASSOS);
}

export function passoAnterior(passo) {
    return Math.max(passoValido(passo) - 1, 1);
}

function texto(valor) {
    return typeof valor === 'string' ? valor.trim() : '';
}

// O que o passo 2 grava com `salvarAjustes`. Nome e assinatura podem ficar
// vazios (os textos funcionam sem eles e dá para preencher depois em Ajustes);
// segmento desconhecido cai no primeiro da lista.
export function ajustesDoPrimeiroUso({ segmento, negocio, assinatura } = {}) {
    const conhecido = SEGMENTOS.some((s) => s.valor === segmento);
    return {
        segmento: conhecido ? segmento : SEGMENTOS[0].valor,
        negocio: texto(negocio),
        assinatura: texto(assinatura),
    };
}
