import { describe, expect, it } from 'vitest';
import { ETAPAS, rotuloDoPrazo } from './rotulos.js';

describe('rotuloDoPrazo', () => {
    it('orçamento usa o nome das etapas d3 e d7, igual à Mensagem e ao Cliente', () => {
        expect(rotuloDoPrazo('orcamento', 0)).toBe(`${ETAPAS.d3} após quantos dias`);
        expect(rotuloDoPrazo('orcamento', 1)).toBe(`${ETAPAS.d7} após quantos dias`);
        expect(rotuloDoPrazo('orcamento', 0)).toBe('1º retorno após quantos dias');
        expect(rotuloDoPrazo('orcamento', 1)).toBe('2º retorno após quantos dias');
    });

    it('cobrança continua com 1º, 2º e 3º lembrete', () => {
        expect(rotuloDoPrazo('cobranca', 0)).toBe('1º lembrete após quantos dias');
        expect(rotuloDoPrazo('cobranca', 1)).toBe('2º lembrete após quantos dias');
        expect(rotuloDoPrazo('cobranca', 2)).toBe('3º lembrete após quantos dias');
    });
});
