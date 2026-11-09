import { describe, it, expect } from 'vitest';
import { listaDeHoje } from './hoje.js';
import { somarDias } from './datas.js';

const HOJE = '2026-12-10';

const CLIENTES = [
    { id: 'c-ana', nome: 'Ana Souza' },
    { id: 'c-bruno', nome: 'Bruno Lima' },
    { id: 'c-carla', nome: 'Carla Dias' },
    { id: 'c-edu', nome: 'Édson Rocha' },
];

let sequencia = 0;
function item(campos) {
    sequencia += 1;
    return {
        id: `i-${sequencia}`,
        cliente_id: 'c-ana',
        hora: '',
        servico: 'Serviço',
        valor_centavos: 10000,
        status: 'aberto',
        resultado: null,
        ...campos,
    };
}

function toque(itemId, etapa, enviadoEm = '2026-12-01T12:00:00Z') {
    return { id: `t-${itemId}-${etapa}-${enviadoEm}`, item_id: itemId, etapa, enviado_em: enviadoEm, respondeu: false };
}

function lista({ itens, toques = [], clientes = CLIENTES, hoje = HOJE, ajustes }) {
    return listaDeHoje({ itens, toques, clientes, hoje, ajustes });
}

function resumo(entradas) {
    return entradas.map((e) => ({ id: e.item.id, processo: e.processo, etapa: e.etapa, atraso_dias: e.atraso_dias }));
}

// Orçamento enviado `dias` antes de HOJE.
function orcamento(dias, campos = {}) {
    return item({ processo: '04', data: somarDias(HOJE, -dias), ...campos });
}

describe('listaDeHoje: 01 Confirmação', () => {
    it('compromisso amanhã sem toque entra como vespera com atraso 0', () => {
        const a = item({ processo: '01', data: '2026-12-11', hora: '09:00' });
        const saida = lista({ itens: [a] });
        expect(resumo(saida)).toEqual([{ id: a.id, processo: '01', etapa: 'vespera', atraso_dias: 0 }]);
        expect(saida[0].item).toBe(a);
        expect(saida[0].cliente).toBe(CLIENTES[0]);
    });

    it('compromisso amanhã com toque vespera feito fica fora', () => {
        const a = item({ processo: '01', data: '2026-12-11' });
        expect(lista({ itens: [a], toques: [toque(a.id, 'vespera')] })).toEqual([]);
    });

    it('vale no fim de semana: hoje sexta, compromisso sábado entra', () => {
        const a = item({ processo: '01', data: '2026-12-12', hora: '10:00' });
        expect(resumo(lista({ itens: [a], hoje: '2026-12-11' }))).toEqual([
            { id: a.id, processo: '01', etapa: 'vespera', atraso_dias: 0 },
        ]);
    });

    it('compromisso ontem, hoje ou daqui a 2 dias fica fora', () => {
        const ontem = item({ processo: '01', data: '2026-12-09' });
        const hoje = item({ processo: '01', data: '2026-12-10' });
        const depois = item({ processo: '01', data: '2026-12-12' });
        const longe = item({ processo: '01', data: '2027-01-10' });
        expect(lista({ itens: [ontem, hoje, depois, longe] })).toEqual([]);
    });

    it('véspera atravessa a virada de mês e de ano', () => {
        const ano = item({ processo: '01', data: '2027-01-01' });
        expect(resumo(lista({ itens: [ano], hoje: '2026-12-31' }))).toEqual([
            { id: ano.id, processo: '01', etapa: 'vespera', atraso_dias: 0 },
        ]);
        const mes = item({ processo: '01', data: '2026-12-01' });
        expect(resumo(lista({ itens: [mes], hoje: '2026-11-30' }))).toEqual([
            { id: mes.id, processo: '01', etapa: 'vespera', atraso_dias: 0 },
        ]);
    });
});

describe('listaDeHoje: filtros comuns', () => {
    it('item resolvido ou cancelado fica fora, no 01 e no 04', () => {
        const itens = [
            item({ processo: '01', data: '2026-12-11', status: 'resolvido', resultado: 'confirmou' }),
            item({ processo: '01', data: '2026-12-11', status: 'cancelado' }),
            orcamento(5, { status: 'resolvido', resultado: 'fechou' }),
            orcamento(5, { status: 'cancelado' }),
        ];
        expect(lista({ itens })).toEqual([]);
    });

    it('item de cliente inexistente fica fora', () => {
        const a = item({ processo: '01', data: '2026-12-11', cliente_id: 'c-sumiu' });
        const b = orcamento(5, { cliente_id: 'c-sumiu' });
        expect(lista({ itens: [a, b] })).toEqual([]);
    });

    it('item com data quebrada fica fora sem derrubar os outros', () => {
        const quebrado = orcamento(0, { data: '2026-02-30' });
        const vazio = item({ processo: '01', data: '' });
        const bom = orcamento(3);
        expect(resumo(lista({ itens: [quebrado, vazio, bom] }))).toEqual([
            { id: bom.id, processo: '04', etapa: 'd3', atraso_dias: 0 },
        ]);
    });

    it('hoje inválido lança erro', () => {
        expect(() => listaDeHoje({ itens: [], toques: [], clientes: [], hoje: '10/12/2026' })).toThrow();
    });

    it('os arrays de entrada continuam iguais depois da chamada', () => {
        const a = item({ processo: '01', data: '2026-12-11', hora: '14:00' });
        const b = orcamento(8);
        const c = orcamento(4, { cliente_id: 'c-bruno' });
        const entrada = {
            itens: [b, a, c],
            toques: [toque(b.id, 'd3')],
            clientes: CLIENTES.map((x) => ({ ...x })),
            hoje: HOJE,
            ajustes: { prazos: { orcamento: [3, 7], cobranca: [1, 5, 15] } },
        };
        const copia = structuredClone(entrada);
        listaDeHoje(entrada);
        expect(entrada).toEqual(copia);
        expect(entrada.itens.map((x) => x.id)).toEqual([b.id, a.id, c.id]);
    });
});

describe('listaDeHoje: 04 Orçamento', () => {
    it('D+3: data + 2 fora, data + 3 entra d3 atraso 0, data + 5 entra d3 atraso 2', () => {
        expect(lista({ itens: [orcamento(2)] })).toEqual([]);
        const tres = orcamento(3);
        expect(resumo(lista({ itens: [tres] }))).toEqual([{ id: tres.id, processo: '04', etapa: 'd3', atraso_dias: 0 }]);
        const cinco = orcamento(5);
        expect(resumo(lista({ itens: [cinco] }))).toEqual([{ id: cinco.id, processo: '04', etapa: 'd3', atraso_dias: 2 }]);
    });

    it('D+7 só depois do D+3', () => {
        const semD3 = orcamento(7);
        expect(resumo(lista({ itens: [semD3] }))).toEqual([{ id: semD3.id, processo: '04', etapa: 'd3', atraso_dias: 4 }]);

        const comD3 = orcamento(7);
        expect(resumo(lista({ itens: [comD3], toques: [toque(comD3.id, 'd3')] }))).toEqual([
            { id: comD3.id, processo: '04', etapa: 'd7', atraso_dias: 0 },
        ]);

        const seis = orcamento(6);
        expect(lista({ itens: [seis], toques: [toque(seis.id, 'd3')] })).toEqual([]);
    });

    it('depois do D+7 feito, o item fica fora', () => {
        const a = orcamento(7);
        const b = orcamento(30);
        const toques = [toque(a.id, 'd3'), toque(a.id, 'd7'), toque(b.id, 'd3'), toque(b.id, 'd7')];
        expect(lista({ itens: [a, b], toques })).toEqual([]);
    });

    it('respeita ajustes.prazos.orcamento e usa [3, 7] sem ajustes', () => {
        const dois = orcamento(2, { cliente_id: 'c-bruno' });
        const cinco = orcamento(5);
        const toques = [toque(cinco.id, 'd3')];
        const ajustes = { prazos: { orcamento: [2, 5], cobranca: [1, 5, 15] } };
        expect(resumo(lista({ itens: [dois, cinco], toques, ajustes }))).toEqual([
            { id: cinco.id, processo: '04', etapa: 'd7', atraso_dias: 0 },
            { id: dois.id, processo: '04', etapa: 'd3', atraso_dias: 0 },
        ]);

        // Sem ajustes, sem prazos ou com prazos quebrados valem [3, 7].
        for (const semPrazo of [undefined, {}, { prazos: { orcamento: [3] } }]) {
            expect(resumo(lista({ itens: [dois, cinco], toques, ajustes: semPrazo }))).toEqual([]);
        }
        const tres = orcamento(3);
        expect(resumo(lista({ itens: [tres], ajustes: undefined }))).toEqual([
            { id: tres.id, processo: '04', etapa: 'd3', atraso_dias: 0 },
        ]);
    });

    it('atravessa a virada de mês e de ano', () => {
        const ano = item({ processo: '04', data: '2026-12-29' });
        expect(resumo(lista({ itens: [ano], hoje: '2027-01-01' }))).toEqual([
            { id: ano.id, processo: '04', etapa: 'd3', atraso_dias: 0 },
        ]);
        const mes = item({ processo: '04', data: '2026-11-28' });
        expect(resumo(lista({ itens: [mes], hoje: '2026-12-05' }))).toEqual([
            { id: mes.id, processo: '04', etapa: 'd3', atraso_dias: 4 },
        ]);
        expect(resumo(lista({ itens: [mes], hoje: '2026-12-05', toques: [toque(mes.id, 'd3')] }))).toEqual([
            { id: mes.id, processo: '04', etapa: 'd7', atraso_dias: 0 },
        ]);
    });
});

describe('listaDeHoje: ordem com 01 e 04', () => {
    it('01 antes do 04; no 01 por hora; no 04 maior atraso primeiro', () => {
        const tarde = item({ processo: '01', data: '2026-12-11', hora: '15:30', cliente_id: 'c-ana' });
        const cedo = item({ processo: '01', data: '2026-12-11', hora: '08:00', cliente_id: 'c-carla' });
        const pouco = orcamento(3, { cliente_id: 'c-bruno' });
        const muito = orcamento(9, { cliente_id: 'c-carla' });
        const medio = orcamento(5, { cliente_id: 'c-ana' });
        const saida = lista({ itens: [pouco, tarde, muito, cedo, medio] });
        expect(saida.map((e) => e.item.id)).toEqual([cedo.id, tarde.id, muito.id, medio.id, pouco.id]);
    });

    it('empate de atraso e hora vai por nome do cliente em pt-BR', () => {
        const edu = orcamento(4, { cliente_id: 'c-edu' });
        const bruno = orcamento(4, { cliente_id: 'c-bruno' });
        const carla = orcamento(4, { cliente_id: 'c-carla' });
        const ana = item({ processo: '01', data: '2026-12-11', hora: '09:00', cliente_id: 'c-carla' });
        const anaSemHora = item({ processo: '01', data: '2026-12-11', hora: '', cliente_id: 'c-ana' });
        const bruno01 = item({ processo: '01', data: '2026-12-11', hora: '09:00', cliente_id: 'c-bruno' });
        const saida = lista({ itens: [edu, anaSemHora, carla, ana, bruno, bruno01] });
        expect(saida.map((e) => e.item.id)).toEqual([bruno01.id, ana.id, anaSemHora.id, bruno.id, carla.id, edu.id]);
    });
});

// Cobrança com vencimento `dias` antes de HOJE (negativo: ainda vai vencer).
function cobranca(dias, campos = {}) {
    return item({ processo: '05', data: somarDias(HOJE, -dias), ...campos });
}

describe('listaDeHoje: 05 Cobrança', () => {
    it('vencimento hoje e vencimento futuro ficam fora', () => {
        expect(lista({ itens: [cobranca(0), cobranca(-1), cobranca(-30)] })).toEqual([]);
    });

    it('D+1: entra d1 atraso 0; com toque d1 fica fora; venc + 4 com d1 feito fica fora', () => {
        const um = cobranca(1);
        expect(resumo(lista({ itens: [um] }))).toEqual([{ id: um.id, processo: '05', etapa: 'd1', atraso_dias: 0 }]);
        expect(lista({ itens: [um], toques: [toque(um.id, 'd1')] })).toEqual([]);
        const quatro = cobranca(4);
        expect(lista({ itens: [quatro], toques: [toque(quatro.id, 'd1')] })).toEqual([]);
    });

    it('D+5: venc + 5 com d1 feito entra d5 atraso 0', () => {
        const a = cobranca(5);
        expect(resumo(lista({ itens: [a], toques: [toque(a.id, 'd1')] }))).toEqual([
            { id: a.id, processo: '05', etapa: 'd5', atraso_dias: 0 },
        ]);
    });

    it('D+15: venc + 15 com d5 feito entra d15 atraso 0; venc + 16 com d15 feito fica fora', () => {
        const quinze = cobranca(15);
        // d1 e d5 enviados no dia em que venceram (venc + 1 e venc + 5).
        const toquesEmDia = [toque(quinze.id, 'd1', '2026-11-26T12:00:00Z'), toque(quinze.id, 'd5', '2026-11-30T12:00:00Z')];
        expect(resumo(lista({ itens: [quinze], toques: toquesEmDia }))).toEqual([
            { id: quinze.id, processo: '05', etapa: 'd15', atraso_dias: 0 },
        ]);
        const dezesseis = cobranca(16);
        expect(lista({ itens: [dezesseis], toques: [toque(dezesseis.id, 'd15')] })).toEqual([]);
    });

    it('atraso que pula etapa gera uma única entrada, só da etapa mais adiantada', () => {
        const seis = cobranca(6);
        expect(resumo(lista({ itens: [seis] }))).toEqual([{ id: seis.id, processo: '05', etapa: 'd5', atraso_dias: 1 }]);
        const vinte = cobranca(20);
        expect(resumo(lista({ itens: [vinte] }))).toEqual([{ id: vinte.id, processo: '05', etapa: 'd15', atraso_dias: 5 }]);
    });

    it('venc + 6 com d5 feito e sem d1 fica fora', () => {
        const a = cobranca(6);
        expect(lista({ itens: [a], toques: [toque(a.id, 'd5')] })).toEqual([]);
    });

    it('item 05 resolvido (pagou) ou cancelado fica fora', () => {
        const itens = [
            cobranca(1, { status: 'resolvido', resultado: 'pagou' }),
            cobranca(20, { status: 'resolvido', resultado: 'pagou' }),
            cobranca(5, { status: 'cancelado' }),
        ];
        expect(lista({ itens })).toEqual([]);
    });

    it('respeita ajustes.prazos.cobranca = [2, 4, 10]', () => {
        const ajustes = { prazos: { orcamento: [3, 7], cobranca: [2, 4, 10] } };
        expect(lista({ itens: [cobranca(1)], ajustes })).toEqual([]);
        const dois = cobranca(2);
        expect(resumo(lista({ itens: [dois], ajustes }))).toEqual([{ id: dois.id, processo: '05', etapa: 'd1', atraso_dias: 0 }]);
        const cinco = cobranca(5);
        expect(resumo(lista({ itens: [cinco], ajustes }))).toEqual([{ id: cinco.id, processo: '05', etapa: 'd5', atraso_dias: 1 }]);
        const dez = cobranca(10);
        expect(resumo(lista({ itens: [dez], ajustes, toques: [toque(dez.id, 'd5')] }))).toEqual([
            { id: dez.id, processo: '05', etapa: 'd15', atraso_dias: 0 },
        ]);
        // Com o padrão [1, 5, 15], o mesmo venc + 10 seria d5 atraso 5.
        expect(resumo(lista({ itens: [dez] }))).toEqual([{ id: dez.id, processo: '05', etapa: 'd5', atraso_dias: 5 }]);
    });

    it('atravessa a virada de mês e de ano', () => {
        const ano = item({ processo: '05', data: '2026-12-31' });
        expect(resumo(lista({ itens: [ano], hoje: '2027-01-01' }))).toEqual([
            { id: ano.id, processo: '05', etapa: 'd1', atraso_dias: 0 },
        ]);
        expect(resumo(lista({ itens: [ano], hoje: '2027-01-16', toques: [toque(ano.id, 'd5')] }))).toEqual([
            { id: ano.id, processo: '05', etapa: 'd15', atraso_dias: 1 },
        ]);
        const mes = item({ processo: '05', data: '2026-11-28' });
        expect(resumo(lista({ itens: [mes], hoje: '2026-12-03' }))).toEqual([
            { id: mes.id, processo: '05', etapa: 'd5', atraso_dias: 0 },
        ]);
    });
});

describe('listaDeHoje: ordem completa', () => {
    it('sai na ordem 01, 05, 04, e no 05 com maior atraso primeiro', () => {
        const orcPouco = orcamento(3, { cliente_id: 'c-ana' });
        const orcMuito = orcamento(6, { cliente_id: 'c-bruno' });
        const cobPouco = cobranca(1, { cliente_id: 'c-carla' });
        const cobMuito = cobranca(20, { cliente_id: 'c-ana' });
        const cobMedio = cobranca(7, { cliente_id: 'c-edu' });
        const conf = item({ processo: '01', data: '2026-12-11', hora: '11:00', cliente_id: 'c-edu' });
        const saida = lista({ itens: [orcPouco, cobPouco, orcMuito, conf, cobMedio, cobMuito] });
        expect(resumo(saida)).toEqual([
            { id: conf.id, processo: '01', etapa: 'vespera', atraso_dias: 0 },
            { id: cobMuito.id, processo: '05', etapa: 'd15', atraso_dias: 5 },
            { id: cobMedio.id, processo: '05', etapa: 'd5', atraso_dias: 2 },
            { id: cobPouco.id, processo: '05', etapa: 'd1', atraso_dias: 0 },
            { id: orcMuito.id, processo: '04', etapa: 'd3', atraso_dias: 3 },
            { id: orcPouco.id, processo: '04', etapa: 'd3', atraso_dias: 0 },
        ]);
    });

    it('processo desconhecido fica fora', () => {
        expect(lista({ itens: [item({ processo: '02', data: '2026-12-11' })] })).toEqual([]);
    });
});

describe('listaDeHoje: intervalo entre etapas', () => {
    it('04: d3 registrado com atraso empurra o d7 para dia do d3 + (prazo[1] - prazo[0])', () => {
        // Enviado em 30/11: d3 vencia em 03/12 e d7 em 07/12.
        const a = item({ processo: '04', data: '2026-11-30' });
        const toques = [toque(a.id, 'd3', '2026-12-10T13:00:00Z')];
        expect(lista({ itens: [a], toques, hoje: '2026-12-10' })).toEqual([]);
        expect(lista({ itens: [a], toques, hoje: '2026-12-13' })).toEqual([]);
        expect(resumo(lista({ itens: [a], toques, hoje: '2026-12-14' }))).toEqual([
            { id: a.id, processo: '04', etapa: 'd7', atraso_dias: 0 },
        ]);
        expect(resumo(lista({ itens: [a], toques, hoje: '2026-12-16' }))).toEqual([
            { id: a.id, processo: '04', etapa: 'd7', atraso_dias: 2 },
        ]);
    });

    it('04: o dia do toque d3 é contado no fuso de Fortaleza', () => {
        const a = item({ processo: '04', data: '2026-11-30' });
        // 02:00 UTC de 11/12 ainda é 10/12 em Fortaleza.
        const toques = [toque(a.id, 'd3', '2026-12-11T02:00:00Z')];
        expect(resumo(lista({ itens: [a], toques, hoje: '2026-12-14' }))).toEqual([
            { id: a.id, processo: '04', etapa: 'd7', atraso_dias: 0 },
        ]);
    });

    it('04: com vários toques d3, conta o mais recente', () => {
        const a = item({ processo: '04', data: '2026-11-30' });
        const toques = [toque(a.id, 'd3', '2026-12-10T13:00:00Z'), toque(a.id, 'd3', '2026-12-03T13:00:00Z')];
        expect(lista({ itens: [a], toques, hoje: '2026-12-13' })).toEqual([]);
    });

    it('04: toque d3 sem data de envio válida não trava o d7', () => {
        const a = item({ processo: '04', data: '2026-11-30' });
        for (const enviadoEm of ['', 'ontem', null, undefined, '2026-13-45T00:00:00Z']) {
            const t = { id: 't-x', item_id: a.id, etapa: 'd3', enviado_em: enviadoEm, respondeu: false };
            expect(resumo(lista({ itens: [a], toques: [t], hoje: '2026-12-10' }))).toEqual([
                { id: a.id, processo: '04', etapa: 'd7', atraso_dias: 3 },
            ]);
        }
    });

    it('05: d1 registrado com atraso empurra o d5 para dia do d1 + (prazo[1] - prazo[0])', () => {
        // Venceu em 01/12: d1 em 02/12, d5 em 06/12. d1 enviado só em 08/12.
        const a = item({ processo: '05', data: '2026-12-01' });
        const toques = [toque(a.id, 'd1', '2026-12-08T13:00:00Z')];
        expect(lista({ itens: [a], toques, hoje: '2026-12-10' })).toEqual([]);
        expect(resumo(lista({ itens: [a], toques, hoje: '2026-12-12' }))).toEqual([
            { id: a.id, processo: '05', etapa: 'd5', atraso_dias: 0 },
        ]);
    });

    it('05: d5 registrado com atraso empurra o d15 para dia do d5 + (prazo[2] - prazo[1])', () => {
        // Venceu em 25/11: d15 em 10/12. d5 enviado só hoje.
        const a = item({ processo: '05', data: '2026-11-25' });
        const toques = [toque(a.id, 'd1', '2026-11-26T13:00:00Z'), toque(a.id, 'd5', '2026-12-10T13:00:00Z')];
        expect(lista({ itens: [a], toques, hoje: '2026-12-10' })).toEqual([]);
        expect(lista({ itens: [a], toques, hoje: '2026-12-19' })).toEqual([]);
        expect(resumo(lista({ itens: [a], toques, hoje: '2026-12-20' }))).toEqual([
            { id: a.id, processo: '05', etapa: 'd15', atraso_dias: 0 },
        ]);
        expect(resumo(lista({ itens: [a], toques, hoje: '2026-12-22' }))).toEqual([
            { id: a.id, processo: '05', etapa: 'd15', atraso_dias: 2 },
        ]);
    });

    it('05: atraso que pula etapa continua valendo sem toque nenhum', () => {
        const a = item({ processo: '05', data: '2026-12-04' });
        expect(resumo(lista({ itens: [a], hoje: '2026-12-10' }))).toEqual([
            { id: a.id, processo: '05', etapa: 'd5', atraso_dias: 1 },
        ]);
    });

    it('05: toque sem data de envio válida não trava a etapa seguinte', () => {
        const a = item({ processo: '05', data: '2026-11-25' });
        const t = { id: 't-x', item_id: a.id, etapa: 'd5', enviado_em: 'quebrado', respondeu: false };
        expect(resumo(lista({ itens: [a], toques: [t], hoje: '2026-12-10' }))).toEqual([
            { id: a.id, processo: '05', etapa: 'd15', atraso_dias: 0 },
        ]);
    });
});

describe('listaDeHoje: prazos fora de ordem', () => {
    it('prazos de orçamento repetidos ou decrescentes caem no padrão [3, 7]', () => {
        const a = orcamento(5);
        const padrao = [{ id: a.id, processo: '04', etapa: 'd3', atraso_dias: 2 }];
        expect(resumo(lista({ itens: [a], ajustes: { prazos: { orcamento: [5, 5] } } }))).toEqual(padrao);
        expect(resumo(lista({ itens: [a], ajustes: { prazos: { orcamento: [7, 3] } } }))).toEqual(padrao);
    });

    it('prazos de cobrança repetidos ou fora de ordem caem no padrão [1, 5, 15]', () => {
        const um = cobranca(1);
        expect(resumo(lista({ itens: [um], ajustes: { prazos: { cobranca: [5, 1, 15] } } }))).toEqual([
            { id: um.id, processo: '05', etapa: 'd1', atraso_dias: 0 },
        ]);
        const cinco = cobranca(5);
        expect(resumo(lista({ itens: [cinco], ajustes: { prazos: { cobranca: [1, 5, 5] } } }))).toEqual([
            { id: cinco.id, processo: '05', etapa: 'd5', atraso_dias: 0 },
        ]);
    });
});

describe('listaDeHoje: ajustes finos', () => {
    it('01: hora sem zero à esquerda entra na ordem certa (9:00 antes de 14:00)', () => {
        const tarde = item({ processo: '01', data: '2026-12-11', hora: '14:00', cliente_id: 'c-ana' });
        const cedo = item({ processo: '01', data: '2026-12-11', hora: '9:00', cliente_id: 'c-bruno' });
        const saida = lista({ itens: [tarde, cedo] });
        expect(saida.map((e) => e.item.id)).toEqual([cedo.id, tarde.id]);
        expect(saida[0].item.hora).toBe('9:00');
    });

    it('04: toque d7 registrado sem d3 encerra o item', () => {
        const a = orcamento(5);
        const b = orcamento(10);
        const toques = [toque(a.id, 'd7'), toque(b.id, 'd7')];
        expect(lista({ itens: [a, b], toques })).toEqual([]);
    });
});
