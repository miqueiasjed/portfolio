import { describe, expect, it } from 'vitest';
import { agruparPorProcesso, dataDoTopo, linhaDeApoio, nomesDaLista, rotaDaMensagem } from './listaDoDia.js';

function entrada(processo, id, extra = {}) {
    return { item: { id, processo, data: '2026-12-10' }, cliente: { nome: 'Ana' }, processo, etapa: 'd1', atraso_dias: 0, ...extra };
}

describe('agruparPorProcesso', () => {
    it('agrupa na ordem 01, 05, 04 com a contagem no título', () => {
        const lista = [entrada('04', 'a'), entrada('01', 'b'), entrada('05', 'c'), entrada('01', 'd'), entrada('05', 'e'), entrada('01', 'f')];
        const grupos = agruparPorProcesso(lista);
        expect(grupos.map((g) => g.processo)).toEqual(['01', '05', '04']);
        expect(grupos.map((g) => g.titulo)).toEqual(['Confirmar horário (3)', 'Cobrança (2)', 'Orçamento enviado (1)']);
        expect(grupos[0].entradas.map((e) => e.item.id)).toEqual(['b', 'd', 'f']);
    });

    it('deixa de fora grupo vazio e processo desconhecido', () => {
        const grupos = agruparPorProcesso([entrada('04', 'a'), entrada('99', 'b')]);
        expect(grupos).toHaveLength(1);
        expect(grupos[0].titulo).toBe('Orçamento enviado (1)');
    });

    it('lista vazia não tem grupo', () => {
        expect(agruparPorProcesso([])).toEqual([]);
        expect(agruparPorProcesso()).toEqual([]);
    });
});

describe('linhaDeApoio', () => {
    const hoje = '2026-12-14';

    it('véspera mostra a hora, ou só "Amanhã" sem hora', () => {
        expect(linhaDeApoio({ item: { data: '2026-12-15', hora: '14:30' }, etapa: 'vespera', atraso_dias: 0 }, hoje)).toBe('Amanhã, 14:30');
        expect(linhaDeApoio({ item: { data: '2026-12-15', hora: '' }, etapa: 'vespera', atraso_dias: 0 }, hoje)).toBe('Amanhã');
    });

    it('orçamento mostra o dia em que foi enviado', () => {
        expect(linhaDeApoio({ item: { data: '2026-12-07' }, etapa: 'd7', atraso_dias: 0 }, hoje)).toBe('Orçamento de 07/12, sem resposta');
        expect(linhaDeApoio({ item: { data: '2026-12-11' }, etapa: 'd3', atraso_dias: 0 }, hoje)).toBe('Orçamento de 11/12, sem resposta');
    });

    it('cobrança no prazo da etapa mostra só o vencimento', () => {
        expect(linhaDeApoio({ item: { data: '2026-12-13' }, etapa: 'd1', atraso_dias: 0 }, hoje)).toBe('Venceu em 13/12');
    });

    it('cobrança atrasada conta os dias desde o vencimento', () => {
        expect(linhaDeApoio({ item: { data: '2026-12-07' }, etapa: 'd5', atraso_dias: 2 }, hoje)).toBe('Venceu em 07/12, há 7 dias');
        expect(linhaDeApoio({ item: { data: '2026-12-13' }, etapa: 'd1', atraso_dias: 1 }, hoje)).toBe('Venceu em 13/12, há 1 dia');
    });
});

describe('dataDoTopo', () => {
    it('escreve o dia da semana e dd/mm', () => {
        expect(dataDoTopo('2026-12-14')).toBe('segunda, 14/12');
        expect(dataDoTopo('2026-12-19')).toBe('sábado, 19/12');
        expect(dataDoTopo('2026-12-20')).toBe('domingo, 20/12');
    });

    it('dia inválido devolve vazio', () => {
        expect(dataDoTopo('2026-02-30')).toBe('');
    });
});

describe('rotaDaMensagem', () => {
    it('leva ao item e à etapa', () => {
        expect(rotaDaMensagem({ item: { id: 'ab c' }, etapa: 'd3' })).toBe('#/mensagem/ab%20c/d3');
    });
});

describe('nomesDaLista', () => {
    function linha(itemId, clienteId, nome) {
        return { item: { id: itemId }, cliente: { id: clienteId, nome }, processo: '01', etapa: 'vespera', atraso_dias: 0 };
    }

    it('primeiro nome sozinho quando não há outro igual', () => {
        const nomes = nomesDaLista([linha('a', 1, 'Maria Silva'), linha('b', 2, 'Ana Souza')]);
        expect(nomes.get('a')).toBe('Maria');
        expect(nomes.get('b')).toBe('Ana');
    });

    it('dois clientes com o mesmo primeiro nome ganham a inicial do sobrenome', () => {
        const nomes = nomesDaLista([linha('a', 1, 'Maria Silva'), linha('b', 2, 'maria aparecida alves'), linha('c', 3, 'Ana')]);
        expect(nomes.get('a')).toBe('Maria S.');
        expect(nomes.get('b')).toBe('Maria A.');
        expect(nomes.get('c')).toBe('Ana');
    });

    it('compara sem caixa e sem acento, e pula "da", "de", "dos"', () => {
        const nomes = nomesDaLista([linha('a', 1, 'Érica da Costa'), linha('b', 2, 'ERICA Mendes dos santos')]);
        expect(nomes.get('a')).toBe('Érica C.');
        expect(nomes.get('b')).toBe('Erica S.');
    });

    it('sem sobrenome fica só o primeiro nome', () => {
        const nomes = nomesDaLista([linha('a', 1, 'Maria'), linha('b', 2, 'Maria Silva')]);
        expect(nomes.get('a')).toBe('Maria');
        expect(nomes.get('b')).toBe('Maria S.');
    });

    it('o mesmo cliente em duas linhas não conta como repetido', () => {
        const nomes = nomesDaLista([linha('a', 1, 'Maria Silva'), linha('b', 1, 'Maria Silva')]);
        expect(nomes.get('a')).toBe('Maria');
        expect(nomes.get('b')).toBe('Maria');
    });

    it('lista vazia ou sem nome não quebra', () => {
        expect(nomesDaLista().size).toBe(0);
        expect(nomesDaLista([linha('a', 1, '')]).get('a')).toBe('');
    });
});
