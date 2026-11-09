// Nomes que o dono lê na tela para processos, etapas, resultados e situações.
// Só dados: as chaves seguem o PRD (seção "Dados no aparelho" e tabela de etapas).

export const PROCESSOS = Object.freeze({
    '01': 'Confirmar horário',
    '04': 'Orçamento enviado',
    '05': 'Cobrança',
});

export const ETAPAS = Object.freeze({
    vespera: 'Véspera',
    d3: '1º retorno',
    d7: '2º retorno',
    d1: '1º lembrete',
    d5: '2º lembrete',
    d15: '3º lembrete',
});

// Etapas de cada grupo de prazos dos Ajustes, na ordem dos campos.
const ETAPAS_DOS_PRAZOS = Object.freeze({
    orcamento: Object.freeze(['d3', 'd7']),
    cobranca: Object.freeze(['d1', 'd5', 'd15']),
});

// Rótulo do campo de prazo nos Ajustes, com o mesmo nome de etapa da
// Mensagem e do Cliente: "1º retorno após quantos dias" no orçamento,
// "1º lembrete após quantos dias" na cobrança.
export function rotuloDoPrazo(grupo, indice) {
    const etapa = ETAPAS_DOS_PRAZOS[grupo]?.[indice];
    const nome = etapa ? ETAPAS[etapa] : `${indice + 1}º lembrete`;
    return `${nome} após quantos dias`;
}

export const RESULTADOS = Object.freeze({
    confirmou: 'Confirmou',
    remarcou: 'Remarcou',
    cancelou: 'Cancelou',
    fechou: 'Fechou',
    recusou: 'Recusou',
    pagou: 'Pagou',
});

// "sem retorno" não é status gravado: é o item 04 aberto que já passou do 2º retorno.
export const SITUACOES = Object.freeze({
    aberto: 'Em aberto',
    'sem retorno': 'Sem retorno',
    resolvido: 'Resolvido',
    cancelado: 'Cancelado',
});
