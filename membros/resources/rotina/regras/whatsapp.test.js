import { describe, it, expect } from 'vitest';
import { normalizarTelefone, linkWhatsApp, formatarTelefone, ERROS } from './whatsapp.js';

// Mesma lista da `.claude/rules.md`.
const PROIBIDAS = [
    'automação', 'automático', 'integração', 'api', 'agente', 'prompt', 'mcp',
    'webhook', 'token', 'sincronizar', 'banco de dados', 'indexeddb',
];

function numero(entrada) {
    const r = normalizarTelefone(entrada);
    expect(r.ok).toBe(true);
    return r.numero;
}

describe('normalizarTelefone', () => {
    it('aceita as formas comuns de celular', () => {
        for (const entrada of ['(85) 99999-8888', '85999998888', '+55 85 99999-8888', '5585999998888']) {
            expect(numero(entrada)).toBe('5585999998888');
        }
    });

    it('tira o zero do interurbano', () => {
        expect(numero('085 99999-8888')).toBe('5585999998888');
    });

    it('põe o 9 no celular antigo e deixa o fixo com 10 dígitos', () => {
        expect(numero('8599998888')).toBe('5585999998888');
        expect(numero('8532221111')).toBe('558532221111');
        expect(numero('+55 (85) 3222-1111')).toBe('558532221111');
    });

    it('trata 55 com 11 dígitos como DDD do Rio Grande do Sul', () => {
        expect(numero('55999998888')).toBe('5555999998888');
    });

    it('recusa entradas que não formam um telefone', () => {
        for (const entrada of ['', '   ', null, undefined, '123', '859999988881234', '0099998888']) {
            const r = normalizarTelefone(entrada);
            expect(r.ok).toBe(false);
            expect(typeof r.erro).toBe('string');
            expect(r.erro.length).toBeGreaterThan(0);
        }
        expect(normalizarTelefone('').erro).toBe(ERROS.vazio);
        expect(normalizarTelefone('123').erro).toBe(ERROS.incompleto);
    });

    it('recusa DDD impossível e celular sem 9', () => {
        expect(normalizarTelefone('(80) 99999-8888').erro).toBe(ERROS.ddd);
        expect(normalizarTelefone('(85) 89999-8888').erro).toBe(ERROS.celular);
        expect(normalizarTelefone('8519998888').erro).toBe(ERROS.numero);
    });
});

describe('linkWhatsApp', () => {
    it('codifica quebra de linha, símbolos e acentos', () => {
        const r = linkWhatsApp('(85) 99999-8888', 'Oi, Ana!\nAmanhã às 14:00 & #1');
        expect(r.ok).toBe(true);
        expect(r.link.startsWith('https://wa.me/5585999998888?text=')).toBe(true);
        expect(r.link).toContain('%0A');
        expect(r.link).toContain('%26');
        expect(r.link).toContain('%23');
        expect(r.link).toContain('Amanh%C3%A3');
        expect(r.link).toContain('%C3%A0s');
        const texto = decodeURIComponent(r.link.split('?text=')[1]);
        expect(texto).toBe('Oi, Ana!\nAmanhã às 14:00 & #1');
    });

    it('sem texto, sai sem ?text=', () => {
        expect(linkWhatsApp('85999998888', '').link).toBe('https://wa.me/5585999998888');
        expect(linkWhatsApp('85999998888').link).toBe('https://wa.me/5585999998888');
    });

    it('devolve o erro da normalização', () => {
        expect(linkWhatsApp('123', 'Oi')).toEqual({ ok: false, erro: ERROS.incompleto });
    });
});

describe('formatarTelefone', () => {
    it('exibe celular e fixo', () => {
        expect(formatarTelefone('5585999998888')).toBe('(85) 99999-8888');
        expect(formatarTelefone('558532221111')).toBe('(85) 3222-1111');
    });

    it('devolve como veio o que não normaliza', () => {
        expect(formatarTelefone('123')).toBe('123');
        expect(formatarTelefone('')).toBe('');
    });
});

describe('mensagens de erro', () => {
    it('não usam palavra proibida', () => {
        for (const mensagem of Object.values(ERROS)) {
            // Compara por palavra inteira, com acento: `\b` do JS não entende acento.
            const palavras = ` ${mensagem.toLowerCase().split(/[^\p{L}]+/u).join(' ')} `;
            for (const proibida of PROIBIDAS) {
                expect(palavras).not.toContain(` ${proibida} `);
            }
        }
    });
});
