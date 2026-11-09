import { describe, it, expect } from 'vitest';
import {
    TOTAL_DE_PASSOS,
    ajustesDoPrimeiroUso,
    contagemDoPasso,
    ehPrimeiroUso,
    passoAnterior,
    passoSeguinte,
} from './primeiroUso.js';

describe('ehPrimeiroUso', () => {
    it('aparelho limpo: sem ajustes gravados e sem clientes', () => {
        expect(ehPrimeiroUso(undefined, [])).toBe(true);
        expect(ehPrimeiroUso(null, [])).toBe(true);
        expect(ehPrimeiroUso(undefined, undefined)).toBe(true);
    });

    it('com ajustes gravados abre a Hoje normal, mesmo sem cliente', () => {
        expect(ehPrimeiroUso({ chave: 'geral', segmento: 'clinica', negocio: '', assinatura: '' }, [])).toBe(false);
    });

    it('com cliente abre a Hoje normal, mesmo sem ajustes', () => {
        expect(ehPrimeiroUso(undefined, [{ id: 'c1', nome: 'Ana' }])).toBe(false);
    });
});

describe('passos', () => {
    it('conta "n de 3"', () => {
        expect(TOTAL_DE_PASSOS).toBe(3);
        expect(contagemDoPasso(1)).toBe('1 de 3');
        expect(contagemDoPasso(3)).toBe('3 de 3');
    });

    it('anda para frente e para trás sem sair de 1 a 3', () => {
        expect(passoSeguinte(1)).toBe(2);
        expect(passoSeguinte(2)).toBe(3);
        expect(passoSeguinte(3)).toBe(3);
        expect(passoAnterior(3)).toBe(2);
        expect(passoAnterior(1)).toBe(1);
    });

    it('passo inválido vira o primeiro', () => {
        expect(contagemDoPasso('x')).toBe('1 de 3');
        expect(passoSeguinte(undefined)).toBe(2);
        expect(contagemDoPasso(9)).toBe('3 de 3');
    });
});

describe('ajustesDoPrimeiroUso', () => {
    it('grava segmento, negócio e assinatura sem espaços nas pontas', () => {
        expect(
            ajustesDoPrimeiroUso({ segmento: 'servicos', negocio: '  Oficina do Zé ', assinatura: ' Zé ' }),
        ).toEqual({ segmento: 'servicos', negocio: 'Oficina do Zé', assinatura: 'Zé' });
    });

    it('aceita nome e assinatura vazios', () => {
        expect(ajustesDoPrimeiroUso({ segmento: 'clinica' })).toEqual({
            segmento: 'clinica',
            negocio: '',
            assinatura: '',
        });
    });

    it('segmento desconhecido cai em clínica', () => {
        expect(ajustesDoPrimeiroUso({ segmento: 'outro' }).segmento).toBe('clinica');
        expect(ajustesDoPrimeiroUso().segmento).toBe('clinica');
    });

    it('grava só os três campos do passo 2', () => {
        expect(Object.keys(ajustesDoPrimeiroUso({ segmento: 'clinica', chave_pix: 'x' }))).toEqual([
            'segmento',
            'negocio',
            'assinatura',
        ]);
    });
});
