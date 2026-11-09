import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { hojeEmFortaleza, somarDias, diasEntre, formatarDiaMes, ehDiaValido } from './datas.js';

describe('hojeEmFortaleza', () => {
    it('usa o fuso de Fortaleza, não o do aparelho', () => {
        expect(hojeEmFortaleza(new Date('2026-12-10T02:30:00Z'))).toBe('2026-12-09');
        expect(hojeEmFortaleza(new Date('2026-12-10T03:00:00Z'))).toBe('2026-12-10');
    });

    it('vira o ano à meia-noite de Fortaleza', () => {
        expect(hojeEmFortaleza(new Date('2027-01-01T02:59:59Z'))).toBe('2026-12-31');
        expect(hojeEmFortaleza(new Date('2027-01-01T03:00:00Z'))).toBe('2027-01-01');
    });

    it('sem argumento devolve um dia válido', () => {
        expect(ehDiaValido(hojeEmFortaleza())).toBe(true);
    });
});

describe('somarDias', () => {
    it('atravessa virada de ano, ano bissexto e mês para trás', () => {
        expect(somarDias('2026-12-31', 1)).toBe('2027-01-01');
        expect(somarDias('2028-02-28', 1)).toBe('2028-02-29');
        expect(somarDias('2026-03-01', -1)).toBe('2026-02-28');
    });

    it('soma zero e intervalos longos', () => {
        expect(somarDias('2026-12-08', 0)).toBe('2026-12-08');
        expect(somarDias('2026-12-08', 30)).toBe('2027-01-07');
        expect(somarDias('2026-12-08', -365)).toBe('2025-12-08');
    });

    it('recusa dia inválido', () => {
        expect(() => somarDias('2026-02-30', 1)).toThrow();
    });

    it('recusa quantidade de dias que não é número finito', () => {
        for (const n of [NaN, Infinity, -Infinity, '3', undefined, null, {}]) {
            expect(() => somarDias('2026-12-08', n)).toThrow(/Quantidade de dias inválida/);
        }
    });
});

describe('diasEntre', () => {
    it('conta para frente e para trás', () => {
        expect(diasEntre('2026-12-08', '2026-12-15')).toBe(7);
        expect(diasEntre('2026-12-15', '2026-12-08')).toBe(-7);
        expect(diasEntre('2026-12-08', '2026-12-08')).toBe(0);
        expect(diasEntre('2028-02-28', '2028-03-01')).toBe(2);
    });
});

describe('formatarDiaMes', () => {
    it('exibe dd/mm', () => {
        expect(formatarDiaMes('2026-01-05')).toBe('05/01');
        expect(formatarDiaMes('2026-12-08')).toBe('08/12');
    });
});

describe('ehDiaValido', () => {
    it('aceita dias que existem', () => {
        expect(ehDiaValido('2026-12-08')).toBe(true);
        expect(ehDiaValido('2028-02-29')).toBe(true);
    });

    it('recusa dias que não existem ou fora do formato', () => {
        expect(ehDiaValido('2026-02-30')).toBe(false);
        expect(ehDiaValido('2027-02-29')).toBe(false);
        expect(ehDiaValido('2026-13-01')).toBe(false);
        expect(ehDiaValido('2026-00-10')).toBe(false);
        expect(ehDiaValido('2026-12-00')).toBe(false);
        expect(ehDiaValido('08/12/2026')).toBe(false);
        expect(ehDiaValido('')).toBe(false);
        expect(ehDiaValido(undefined)).toBe(false);
        expect(ehDiaValido('2026-12-08T00:00')).toBe(false);
    });
});

describe('relógio', () => {
    it('nenhuma função lê Date.now()', () => {
        const codigo = readFileSync(new URL('./datas.js', import.meta.url), 'utf8');
        expect(codigo).not.toMatch(/Date\.now\(/);
    });
});
