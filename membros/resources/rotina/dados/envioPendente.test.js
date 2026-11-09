import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { NOME_BANCO, fechar, pegar } from './banco.js';
import { PRAZO_PENDENTE_HORAS, guardarPendente, lerPendente, limparPendente } from './envioPendente.js';

function apagarBanco() {
    return new Promise((resolve, reject) => {
        const pedido = indexedDB.deleteDatabase(NOME_BANCO);
        pedido.onsuccess = () => resolve();
        pedido.onerror = () => reject(pedido.error);
        pedido.onblocked = () => reject(new Error('apagar o banco ficou bloqueado'));
    });
}

const ABERTO = new Date('2026-12-10T12:00:00.000Z');
const minutos = (n) => n * 60 * 1000;

beforeEach(async () => {
    await fechar();
    await apagarBanco();
});

describe('envio pendente', () => {
    it('prazo é de 12 horas', () => {
        expect(PRAZO_PENDENTE_HORAS).toBe(12);
    });

    it('guarda com aberto_em em ISO e lê de volta', async () => {
        await guardarPendente({ itemId: 'item-1', etapa: 2, abertoEm: ABERTO });

        const registro = await pegar('meta', 'envio_pendente');
        expect(registro.valor).toEqual({ item_id: 'item-1', etapa: 2, aberto_em: '2026-12-10T12:00:00.000Z' });
        expect(typeof registro.valor.aberto_em).toBe('string');

        const lido = await lerPendente(new Date(ABERTO.getTime() + minutos(5)));
        expect(lido).toEqual({ item_id: 'item-1', etapa: 2, aberto_em: '2026-12-10T12:00:00.000Z' });
    });

    it('aceita aberto_em já em string ISO', async () => {
        await guardarPendente({ itemId: 'item-1', etapa: 1, abertoEm: '2026-12-10T12:00:00.000Z' });
        expect((await lerPendente(ABERTO)).aberto_em).toBe('2026-12-10T12:00:00.000Z');
    });

    it('devolve null quando não há pendente', async () => {
        expect(await lerPendente(ABERTO)).toBeNull();
    });

    it('limpar apaga o pendente', async () => {
        await guardarPendente({ itemId: 'item-1', etapa: 1, abertoEm: ABERTO });
        await limparPendente();
        expect(await lerPendente(ABERTO)).toBeNull();
        expect(await pegar('meta', 'envio_pendente')).toBeUndefined();
    });

    it('segundo pendente substitui o primeiro', async () => {
        await guardarPendente({ itemId: 'item-1', etapa: 1, abertoEm: ABERTO });
        const depois = new Date(ABERTO.getTime() + minutos(10));
        await guardarPendente({ itemId: 'item-2', etapa: 3, abertoEm: depois });

        expect(await lerPendente(depois)).toEqual({ item_id: 'item-2', etapa: 3, aberto_em: depois.toISOString() });
    });

    it('com 11 h 59 min continua', async () => {
        await guardarPendente({ itemId: 'item-1', etapa: 1, abertoEm: ABERTO });
        const agora = new Date(ABERTO.getTime() + minutos(11 * 60 + 59));
        expect((await lerPendente(agora)).item_id).toBe('item-1');
        expect(await pegar('meta', 'envio_pendente')).toBeDefined();
    });

    it('com 12 h 1 min some e é apagado', async () => {
        await guardarPendente({ itemId: 'item-1', etapa: 1, abertoEm: ABERTO });
        const agora = new Date(ABERTO.getTime() + minutos(12 * 60 + 1));
        expect(await lerPendente(agora)).toBeNull();
        expect(await pegar('meta', 'envio_pendente')).toBeUndefined();
    });
});
