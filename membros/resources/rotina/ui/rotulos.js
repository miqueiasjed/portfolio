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
