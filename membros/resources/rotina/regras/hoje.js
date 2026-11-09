// Lista de hoje: quem o dono precisa chamar no WhatsApp hoje.
// Função pura: não altera o que recebe e não lê o relógio. `hoje` chega
// como `YYYY-MM-DD` no fuso de Fortaleza (ver `hojeEmFortaleza`).

import { somarDias, diasEntre, ehDiaValido, hojeEmFortaleza } from './datas.js';

export const PRAZOS_PADRAO = Object.freeze({
    orcamento: Object.freeze([3, 7]),
    cobranca: Object.freeze([1, 5, 15]),
});

// Ordem em que os processos aparecem na tela.
const ORDEM_PROCESSO = { '01': 0, '05': 1, '04': 2 };

// Prazos inteiros, sem negativo e estritamente crescentes. Repetido ou fora
// de ordem quebraria a sequência das etapas e cai no padrão.
function prazoValido(lista, tamanho) {
    return Array.isArray(lista)
        && lista.length === tamanho
        && lista.every((n, i) => Number.isInteger(n) && n >= 0 && (i === 0 || n > lista[i - 1]));
}

// Prazos dos ajustes, caindo no padrão quando faltam ou vêm quebrados.
function lerPrazos(ajustes) {
    const prazos = ajustes && ajustes.prazos ? ajustes.prazos : {};
    return {
        orcamento: prazoValido(prazos.orcamento, 2) ? prazos.orcamento : PRAZOS_PADRAO.orcamento,
        cobranca: prazoValido(prazos.cobranca, 3) ? prazos.cobranca : PRAZOS_PADRAO.cobranca,
    };
}

// Dia em Fortaleza em que o toque foi enviado, ou null sem data válida.
function diaDoEnvio(enviadoEm) {
    if (typeof enviadoEm !== 'string' && typeof enviadoEm !== 'number') return null;
    if (enviadoEm === '') return null;
    const instante = new Date(enviadoEm);
    if (Number.isNaN(instante.getTime())) return null;
    return hojeEmFortaleza(instante);
}

// Mapa item_id -> (etapa -> dia do envio mais recente, ou null quando
// nenhum toque daquela etapa tem data válida).
function etapasFeitasPorItem(toques) {
    const mapa = new Map();
    for (const toque of toques || []) {
        if (!toque || toque.item_id === undefined || toque.item_id === null) continue;
        if (!mapa.has(toque.item_id)) mapa.set(toque.item_id, new Map());
        const etapas = mapa.get(toque.item_id);
        const dia = diaDoEnvio(toque.enviado_em);
        const anterior = etapas.has(toque.etapa) ? etapas.get(toque.etapa) : null;
        etapas.set(toque.etapa, anterior === null || (dia !== null && dia > anterior) ? dia : anterior);
    }
    return mapa;
}

// Dia em que a etapa vence: `data + prazo`, mas nunca antes de
// `intervalo` dias depois do toque da etapa anterior. Assim, se o dono
// registrou a etapa anterior com atraso, a seguinte não cai no mesmo dia.
// Toque sem data válida não trava nada.
function vencimentoDaEtapa(data, prazo, diaToqueAnterior, intervalo) {
    const pelaData = somarDias(data, prazo);
    if (!diaToqueAnterior) return pelaData;
    const pelaEtapaAnterior = somarDias(diaToqueAnterior, intervalo);
    return pelaEtapaAnterior > pelaData ? pelaEtapaAnterior : pelaData;
}

// 01 Confirmação: só na véspera do compromisso, todo dia da semana.
// Compromisso hoje ou já passado não volta para a lista.
function etapaDaConfirmacao(item, feitas, hoje) {
    if (item.data !== somarDias(hoje, 1)) return null;
    if (feitas.has('vespera')) return null;
    return { etapa: 'vespera', atraso_dias: 0 };
}

// 04 Orçamento: d3 primeiro; d7 só depois do d3 feito. A última etapa feita
// encerra: com toque d7, sai, mesmo sem d3. O d7 vence no maior dia entre
// `data + prazo[1]` e o dia do toque d3 + (prazo[1] - prazo[0]).
function etapaDoOrcamento(item, feitas, hoje, prazos) {
    const [prazoD3, prazoD7] = prazos.orcamento;
    if (feitas.has('d7')) return null;
    const diaD3 = somarDias(item.data, prazoD3);
    if (hoje < diaD3) return null;
    if (!feitas.has('d3')) {
        return { etapa: 'd3', atraso_dias: diasEntre(diaD3, hoje) };
    }
    const diaD7 = vencimentoDaEtapa(item.data, prazoD7, feitas.get('d3'), prazoD7 - prazoD3);
    if (hoje < diaD7) return null;
    return { etapa: 'd7', atraso_dias: diasEntre(diaD7, hoje) };
}

const ETAPAS_COBRANCA = ['d1', 'd5', 'd15'];

// 05 Cobrança: `item.data` é o vencimento. Mostra só a etapa mais adiantada
// já vencida. Se ela já tem toque, o item fica fora mesmo com etapas
// anteriores sem toque: foram puladas de propósito, para o dono nunca
// mandar duas ou três cobranças do mesmo item no mesmo dia.
// Quando a etapa anterior tem toque, a etapa só vence depois de
// `prazo[i] - prazo[i-1]` dias contados do dia desse toque.
function etapaDaCobranca(item, feitas, hoje, prazos) {
    for (let i = ETAPAS_COBRANCA.length - 1; i >= 0; i -= 1) {
        const anterior = i > 0 ? feitas.get(ETAPAS_COBRANCA[i - 1]) : null;
        const intervalo = i > 0 ? prazos.cobranca[i] - prazos.cobranca[i - 1] : 0;
        const dia = vencimentoDaEtapa(item.data, prazos.cobranca[i], anterior, intervalo);
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

// `9:00` vira `09:00` para a comparação de texto bater com a do relógio.
// Sem hora vai para o fim do dia.
function horaParaOrdem(hora) {
    const texto = typeof hora === 'string' ? hora.trim() : '';
    if (texto === '') return '99:99';
    const achado = /^(\d{1,2}):(\d{2})$/.exec(texto);
    return achado ? `${achado[1].padStart(2, '0')}:${achado[2]}` : texto;
}

function compararEntradas(a, b) {
    const porProcesso = ORDEM_PROCESSO[a.processo] - ORDEM_PROCESSO[b.processo];
    if (porProcesso !== 0) return porProcesso;
    const porAtraso = b.atraso_dias - a.atraso_dias;
    if (porAtraso !== 0) return porAtraso;
    if (a.processo === '01') {
        const horaA = horaParaOrdem(a.item.hora);
        const horaB = horaParaOrdem(b.item.hora);
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

    const semToques = new Map();
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
