// Lista de hoje: quem o dono precisa chamar no WhatsApp hoje.
// Função pura: não altera o que recebe e não lê o relógio. `hoje` chega
// como `YYYY-MM-DD` no fuso de Fortaleza (ver `hojeEmFortaleza`).

import { somarDias, diasEntre, ehDiaValido } from './datas.js';

export const PRAZOS_PADRAO = Object.freeze({
    orcamento: Object.freeze([3, 7]),
    cobranca: Object.freeze([1, 5, 15]),
});

// Ordem em que os processos aparecem na tela.
const ORDEM_PROCESSO = { '01': 0, '05': 1, '04': 2 };

function prazoValido(lista, tamanho) {
    return Array.isArray(lista)
        && lista.length === tamanho
        && lista.every((n) => Number.isInteger(n) && n >= 0);
}

// Prazos dos ajustes, caindo no padrão quando faltam ou vêm quebrados.
function lerPrazos(ajustes) {
    const prazos = ajustes && ajustes.prazos ? ajustes.prazos : {};
    return {
        orcamento: prazoValido(prazos.orcamento, 2) ? prazos.orcamento : PRAZOS_PADRAO.orcamento,
        cobranca: prazoValido(prazos.cobranca, 3) ? prazos.cobranca : PRAZOS_PADRAO.cobranca,
    };
}

// Mapa item_id -> conjunto das etapas que já têm toque.
function etapasFeitasPorItem(toques) {
    const mapa = new Map();
    for (const toque of toques || []) {
        if (!toque || toque.item_id === undefined || toque.item_id === null) continue;
        if (!mapa.has(toque.item_id)) mapa.set(toque.item_id, new Set());
        mapa.get(toque.item_id).add(toque.etapa);
    }
    return mapa;
}

// 01 Confirmação: só na véspera do compromisso, todo dia da semana.
// Compromisso hoje ou já passado não volta para a lista.
function etapaDaConfirmacao(item, feitas, hoje) {
    if (item.data !== somarDias(hoje, 1)) return null;
    if (feitas.has('vespera')) return null;
    return { etapa: 'vespera', atraso_dias: 0 };
}

// 04 Orçamento: d3 primeiro; d7 só depois do d3 feito. Depois do d7, sai.
function etapaDoOrcamento(item, feitas, hoje, prazos) {
    const [prazoD3, prazoD7] = prazos.orcamento;
    const diaD3 = somarDias(item.data, prazoD3);
    if (hoje < diaD3) return null;
    if (!feitas.has('d3')) {
        return { etapa: 'd3', atraso_dias: diasEntre(diaD3, hoje) };
    }
    const diaD7 = somarDias(item.data, prazoD7);
    if (hoje < diaD7 || feitas.has('d7')) return null;
    return { etapa: 'd7', atraso_dias: diasEntre(diaD7, hoje) };
}

const ETAPAS_COBRANCA = ['d1', 'd5', 'd15'];

// 05 Cobrança: `item.data` é o vencimento. Mostra só a etapa mais adiantada
// já vencida. Se ela já tem toque, o item fica fora mesmo com etapas
// anteriores sem toque: foram puladas de propósito, para o dono nunca
// mandar duas ou três cobranças do mesmo item no mesmo dia.
function etapaDaCobranca(item, feitas, hoje, prazos) {
    for (let i = ETAPAS_COBRANCA.length - 1; i >= 0; i -= 1) {
        const dia = somarDias(item.data, prazos.cobranca[i]);
        if (hoje < dia) continue;
        const etapa = ETAPAS_COBRANCA[i];
        if (feitas.has(etapa)) return null;
        return { etapa, atraso_dias: diasEntre(dia, hoje) };
    }
    return null;
}

const REGRA_POR_PROCESSO = {
    '01': etapaDaConfirmacao,
    '04': etapaDoOrcamento,
    '05': etapaDaCobranca,
};

function compararEntradas(a, b) {
    const porProcesso = ORDEM_PROCESSO[a.processo] - ORDEM_PROCESSO[b.processo];
    if (porProcesso !== 0) return porProcesso;
    const porAtraso = b.atraso_dias - a.atraso_dias;
    if (porAtraso !== 0) return porAtraso;
    if (a.processo === '01') {
        // Sem hora vai para o fim do dia.
        const horaA = a.item.hora || '99:99';
        const horaB = b.item.hora || '99:99';
        if (horaA !== horaB) return horaA < horaB ? -1 : 1;
    }
    const nomeA = (a.cliente && a.cliente.nome) || '';
    const nomeB = (b.cliente && b.cliente.nome) || '';
    const porNome = nomeA.localeCompare(nomeB, 'pt-BR');
    if (porNome !== 0) return porNome;
    // Desempate final pelo id, para a lista não trocar de ordem entre aberturas.
    return String(a.item.id).localeCompare(String(b.item.id));
}

// Devolve `[{ item, cliente, etapa, processo, atraso_dias }]`, no máximo
// uma entrada por item, na ordem 01, 05, 04 e depois por atraso.
export function listaDeHoje({ itens, toques, clientes, hoje, ajustes } = {}) {
    if (!ehDiaValido(hoje)) {
        throw new Error(`Dia inválido: ${hoje}`);
    }
    const prazos = lerPrazos(ajustes);
    const feitasPorItem = etapasFeitasPorItem(toques);
    const clientePorId = new Map();
    for (const cliente of clientes || []) {
        if (cliente) clientePorId.set(cliente.id, cliente);
    }

    const semToques = new Set();
    const lista = [];
    for (const item of itens || []) {
        if (!item || item.status !== 'aberto') continue;
        const regra = REGRA_POR_PROCESSO[item.processo];
        if (!regra) continue;
        const cliente = clientePorId.get(item.cliente_id);
        if (!cliente) continue;
        // Data quebrada não derruba a lista inteira: o item só fica de fora.
        if (!ehDiaValido(item.data)) continue;

        const feitas = feitasPorItem.get(item.id) || semToques;
        const achado = regra(item, feitas, hoje, prazos);
        if (!achado) continue;
        lista.push({
            item,
            cliente,
            etapa: achado.etapa,
            processo: item.processo,
            atraso_dias: achado.atraso_dias,
        });
    }

    return lista.sort(compararEntradas);
}
