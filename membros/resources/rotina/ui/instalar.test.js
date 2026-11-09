import { describe, expect, it } from 'vitest';
import { deveAvisar, ehAparelhoApple, estaInstalado } from './instalar.js';

const UA_IPHONE =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const UA_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/124.0 Mobile Safari/537.36';
const UA_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.4 Safari/605.1.15';

describe('ehAparelhoApple', () => {
    it('reconhece iPhone, iPad e iPod pelo user agent', () => {
        expect(ehAparelhoApple({ userAgent: UA_IPHONE })).toBe(true);
        expect(ehAparelhoApple({ userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X)' })).toBe(true);
        expect(ehAparelhoApple({ userAgent: 'Mozilla/5.0 (iPod touch; iPhone OS 15_0)' })).toBe(true);
    });

    it('reconhece iPad que se anuncia como Mac, pelo toque', () => {
        expect(ehAparelhoApple({ userAgent: UA_MAC, platform: 'MacIntel', maxTouchPoints: 5 })).toBe(true);
    });

    it('não reconhece Mac de verdade, Android nem entrada vazia', () => {
        expect(ehAparelhoApple({ userAgent: UA_MAC, platform: 'MacIntel', maxTouchPoints: 0 })).toBe(false);
        expect(ehAparelhoApple({ userAgent: UA_ANDROID, platform: 'Linux armv8l', maxTouchPoints: 5 })).toBe(false);
        expect(ehAparelhoApple()).toBe(false);
    });
});

describe('estaInstalado', () => {
    it('vale com qualquer um dos dois sinais', () => {
        expect(estaInstalado({ standalone: true })).toBe(true);
        expect(estaInstalado({ displayModeStandalone: true })).toBe(true);
        expect(estaInstalado({})).toBe(false);
        expect(estaInstalado({ standalone: undefined, displayModeStandalone: false })).toBe(false);
    });
});

describe('deveAvisar', () => {
    it('avisa só em Apple, fora do app instalado e sem dispensa', () => {
        expect(deveAvisar({ apple: true, instalado: false, dispensado: false })).toBe(true);
        expect(deveAvisar({ apple: true, instalado: true, dispensado: false })).toBe(false);
        expect(deveAvisar({ apple: true, instalado: false, dispensado: true })).toBe(false);
        expect(deveAvisar({ apple: false, instalado: false, dispensado: false })).toBe(false);
    });
});
