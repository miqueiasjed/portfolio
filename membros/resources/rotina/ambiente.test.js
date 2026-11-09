import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';

// Teste de fumaça: confere que o ambiente de teste tem o que a ferramenta usa.
describe('ambiente de teste', () => {
    it('expõe indexedDB, IDBKeyRange e crypto.randomUUID', () => {
        expect(indexedDB).toBeDefined();
        expect(IDBKeyRange).toBeDefined();
        expect(typeof crypto.randomUUID).toBe('function');
    });
});
