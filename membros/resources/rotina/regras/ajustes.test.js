import { describe, it, expect } from 'vitest';
import { validarPrazos, formularioDosAjustes, MENSAGENS_PRAZO } from './ajustes.js';
import { listaDeHoje } from './hoje.js';

// Mesma lista da `.claude/rules.md`.
const PROIBIDAS = [
    'automação', 'automático', 'integração', 'api', 'agente', 'prompt', 'mcp',
    'webhook', 'token', 'sincronizar', 'banco de dados', 'indexeddb',
];

describe('validarPrazos', () => {
    it('aceita inteiros de 1 a 60 em ordem crescente', () => {
        expect(validarPrazos(['3', '7'])).toEqual({ ok: true, dias: [3, 7] });
        expect(validarPrazos([' 1', '5 ', '15'])).toEqual({ ok: true, dias: [1, 5, 15] });
        expect(validarPrazos(['1', '60'])).toEqual({ ok: true, dias: [1, 60] });
    });

    it('recusa fora da faixa, vazio, decimal e texto, no campo errado', () => {
        expect(validarPrazos(['0', '7'])).toEqual({ ok: false, erros: { 0: MENSAGENS_PRAZO.faixa } });
        expect(validarPrazos(['3', '61'])).toEqual({ ok: false, erros: { 1: MENSAGENS_PRAZO.faixa } });
        expect(validarPrazos(['', '7']).erros[0]).toBe(MENSAGENS_PRAZO.faixa);
        expect(validarPrazos(['3,5', '7']).erros[0]).toBe(MENSAGENS_PRAZO.faixa);
        expect(validarPrazos(['-3', '7']).erros[0]).toBe(MENSAGENS_PRAZO.faixa);
        expect(validarPrazos(['três', '7']).erros[0]).toBe(MENSAGENS_PRAZO.faixa);
    });

    it('recusa fora de ordem com a mensagem do campo de depois', () => {
        expect(validarPrazos(['7', '3'])).toEqual({ ok: false, erros: { 1: MENSAGENS_PRAZO.ordem[1] } });
        expect(validarPrazos(['5', '5']).erros).toEqual({ 1: MENSAGENS_PRAZO.ordem[1] });
        expect(validarPrazos(['1', '15', '5']).erros).toEqual({ 2: MENSAGENS_PRAZO.ordem[2] });
        expect(MENSAGENS_PRAZO.ordem[1]).toBe('Use dias em ordem: o segundo maior que o primeiro.');
    });

    it('não acusa ordem contra um campo que já está fora da faixa', () => {
        expect(validarPrazos(['70', '10']).erros).toEqual({ 0: MENSAGENS_PRAZO.faixa });
    });

    it('recusa lista vazia ou ausente', () => {
        expect(validarPrazos([]).ok).toBe(false);
        expect(validarPrazos(undefined).ok).toBe(false);
    });

    it('o que passa aqui a lista de hoje usa sem cair no padrão', () => {
        const cliente = { id: 1, nome: 'Ana' };
        const item = { id: 10, cliente_id: 1, processo: '04', status: 'aberto', data: '2026-12-01' };
        const { dias } = validarPrazos(['2', '9']);
        const lista = listaDeHoje({
            itens: [item],
            toques: [],
            clientes: [cliente],
            hoje: '2026-12-03',
            ajustes: { prazos: { orcamento: dias, cobranca: [1, 5, 15] } },
        });
        // Com o padrão (3 dias), o d3 só venceria em 04/12.
        expect(lista).toHaveLength(1);
        expect(lista[0].etapa).toBe('d3');
    });

    it('mensagens sem palavra proibida e sem travessão', () => {
        const textos = [MENSAGENS_PRAZO.faixa, ...MENSAGENS_PRAZO.ordem.filter(Boolean)];
        for (const texto of textos) {
            const minusculo = texto.toLowerCase();
            for (const palavra of PROIBIDAS) {
                expect(minusculo.includes(palavra), `${palavra} em "${texto}"`).toBe(false);
            }
            expect(texto).not.toMatch(/[\u2013\u2014]/);
        }
    });
});

describe('formularioDosAjustes', () => {
    it('converte os ajustes salvos nos textos dos campos', () => {
        expect(
            formularioDosAjustes({
                chave: 'geral',
                segmento: 'servicos',
                negocio: 'Oficina do Zé',
                assinatura: 'Zé',
                chave_pix: 'ze@exemplo.com',
                prazos: { orcamento: [3, 7], cobranca: [1, 5, 15] },
                variacao: 2,
            }),
        ).toEqual({
            segmento: 'servicos',
            negocio: 'Oficina do Zé',
            assinatura: 'Zé',
            chave_pix: 'ze@exemplo.com',
            orcamento: ['3', '7'],
            cobranca: ['1', '5', '15'],
            variacao: 2,
        });
    });

    it('cai em valores seguros quando algo vem quebrado', () => {
        expect(formularioDosAjustes({ segmento: 'outro', negocio: null, variacao: 3, prazos: { orcamento: [4] } })).toEqual({
            segmento: 'clinica',
            negocio: '',
            assinatura: '',
            chave_pix: '',
            orcamento: ['3', '7'],
            cobranca: ['1', '5', '15'],
            variacao: 1,
        });
        expect(formularioDosAjustes(undefined).segmento).toBe('clinica');
    });
});
