import { describe, expect, it } from 'vitest';
import { lerRota } from './rotas.js';

describe('lerRota', () => {
    it('lê as seis rotas do contrato', () => {
        expect(lerRota('#/hoje')).toEqual({ tela: 'hoje', params: {} });
        expect(lerRota('#/mensagem/abc/d3')).toEqual({
            tela: 'mensagem',
            params: { itemId: 'abc', etapa: 'd3' },
        });
        expect(lerRota('#/clientes')).toEqual({ tela: 'clientes', params: {} });
        expect(lerRota('#/clientes/c-1')).toEqual({ tela: 'cliente', params: { id: 'c-1' } });
        expect(lerRota('#/novo')).toEqual({ tela: 'novo', params: {} });
        expect(lerRota('#/ajustes')).toEqual({ tela: 'ajustes', params: {} });
    });

    it('hash vazio cai em hoje', () => {
        for (const h of ['', '#', '#/', undefined, null]) {
            expect(lerRota(h)).toEqual({ tela: 'hoje', params: {} });
        }
    });

    it('hash desconhecido cai em hoje', () => {
        expect(lerRota('#/nada')).toEqual({ tela: 'hoje', params: {} });
        expect(lerRota('#/clientes/a/b')).toEqual({ tela: 'hoje', params: {} });
        expect(lerRota('#/mensagem/so-um')).toEqual({ tela: 'hoje', params: {} });
        expect(lerRota('#/novo/extra')).toEqual({ tela: 'hoje', params: {} });
    });

    it('decodifica parâmetros com caractere codificado', () => {
        expect(lerRota('#/clientes/Jos%C3%A9%20Silva')).toEqual({
            tela: 'cliente',
            params: { id: 'José Silva' },
        });
        expect(lerRota('#/mensagem/a%2Fb/d7')).toEqual({
            tela: 'mensagem',
            params: { itemId: 'a/b', etapa: 'd7' },
        });
    });

    it('codificação inválida cai em hoje', () => {
        expect(lerRota('#/clientes/%E0%A4%A')).toEqual({ tela: 'hoje', params: {} });
    });

    it('aceita barra no fim', () => {
        expect(lerRota('#/clientes/')).toEqual({ tela: 'clientes', params: {} });
    });
});
