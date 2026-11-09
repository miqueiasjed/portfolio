import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
    NOME_BANCO,
    VERSAO,
    abrir,
    fechar,
    pegar,
    salvar,
    listar,
    listarPorIndice,
    apagar,
    limpar,
    transacao,
    lerMeta,
    gravarMeta,
} from './banco.js';

function apagarBanco() {
    return new Promise((resolve, reject) => {
        const pedido = indexedDB.deleteDatabase(NOME_BANCO);
        pedido.onsuccess = () => resolve();
        pedido.onerror = () => reject(pedido.error);
        pedido.onblocked = () => reject(new Error('apagar o banco ficou bloqueado'));
    });
}

const ordenarPorId = (lista) => [...lista].sort((a, b) => a.id.localeCompare(b.id));

beforeEach(async () => {
    await fechar();
    await apagarBanco();
});

describe('abrir', () => {
    it('cria o banco com as stores, keyPaths e índices do contrato', async () => {
        const db = await abrir();

        expect(db.name).toBe('rotina-do-dia');
        expect(db.version).toBe(1);
        expect(VERSAO).toBe(1);
        expect([...db.objectStoreNames].sort()).toEqual(['ajustes', 'clientes', 'itens', 'meta', 'toques']);

        const tx = db.transaction(['clientes', 'itens', 'toques', 'ajustes', 'meta'], 'readonly');
        expect(tx.objectStore('clientes').keyPath).toBe('id');
        expect(tx.objectStore('itens').keyPath).toBe('id');
        expect(tx.objectStore('toques').keyPath).toBe('id');
        expect(tx.objectStore('ajustes').keyPath).toBe('chave');
        expect(tx.objectStore('meta').keyPath).toBe('chave');

        expect([...tx.objectStore('itens').indexNames].sort()).toEqual(['cliente_id', 'status']);
        expect(tx.objectStore('itens').index('cliente_id').keyPath).toBe('cliente_id');
        expect(tx.objectStore('itens').index('status').keyPath).toBe('status');
        expect([...tx.objectStore('toques').indexNames]).toEqual(['item_id']);
        expect(tx.objectStore('toques').index('item_id').keyPath).toBe('item_id');
        expect(tx.objectStore('clientes').indexNames.length).toBe(0);
    });

    it('reaproveita a mesma conexão', async () => {
        const a = await abrir();
        const b = await abrir();
        expect(a).toBe(b);
    });

    it('fecha sozinho quando outra conexão pede para apagar o banco e reabre depois', async () => {
        await salvar('clientes', { id: 'c1', nome: 'Ana' });

        // Sem fechar(): o onversionchange precisa liberar o apagar.
        await apagarBanco();

        expect(await listar('clientes')).toEqual([]);
    });

    it('fechar descarta a conexão e a próxima chamada abre outra', async () => {
        const a = await abrir();
        await fechar();
        const b = await abrir();
        expect(b).not.toBe(a);
        await fechar();
        await fechar();
    });
});

describe('operações básicas', () => {
    it('salva e pega pelo id', async () => {
        const chave = await salvar('clientes', { id: 'c1', nome: 'Ana', whatsapp: '5585999998888' });
        expect(chave).toBe('c1');
        expect(await pegar('clientes', 'c1')).toEqual({ id: 'c1', nome: 'Ana', whatsapp: '5585999998888' });
    });

    it('pegar de chave inexistente devolve undefined', async () => {
        expect(await pegar('clientes', 'nao-existe')).toBeUndefined();
    });

    it('salvar com o mesmo id substitui o registro', async () => {
        await salvar('clientes', { id: 'c1', nome: 'Ana' });
        await salvar('clientes', { id: 'c1', nome: 'Ana Paula' });
        expect(await listar('clientes')).toEqual([{ id: 'c1', nome: 'Ana Paula' }]);
    });

    it('lista todos os registros da store', async () => {
        await salvar('clientes', { id: 'c1', nome: 'Ana' });
        await salvar('clientes', { id: 'c2', nome: 'Bruno' });
        expect(ordenarPorId(await listar('clientes'))).toEqual([
            { id: 'c1', nome: 'Ana' },
            { id: 'c2', nome: 'Bruno' },
        ]);
    });

    it('lista por índice só os itens do cliente pedido', async () => {
        await salvar('itens', { id: 'i1', cliente_id: 'c1', status: 'aberto' });
        await salvar('itens', { id: 'i2', cliente_id: 'c2', status: 'aberto' });
        await salvar('itens', { id: 'i3', cliente_id: 'c1', status: 'resolvido' });

        const doC1 = await listarPorIndice('itens', 'cliente_id', 'c1');
        expect(ordenarPorId(doC1).map((i) => i.id)).toEqual(['i1', 'i3']);

        const abertos = await listarPorIndice('itens', 'status', 'aberto');
        expect(ordenarPorId(abertos).map((i) => i.id)).toEqual(['i1', 'i2']);

        expect(await listarPorIndice('itens', 'cliente_id', 'c9')).toEqual([]);
    });

    it('apaga um registro e limpa a store', async () => {
        await salvar('toques', { id: 't1', item_id: 'i1' });
        await salvar('toques', { id: 't2', item_id: 'i1' });

        await apagar('toques', 't1');
        expect((await listar('toques')).map((t) => t.id)).toEqual(['t2']);

        await limpar('toques');
        expect(await listar('toques')).toEqual([]);
    });

    it('rejeita store que não existe', async () => {
        await expect(pegar('nao-existe', 'x')).rejects.toThrow();
    });
});

describe('transacao', () => {
    it('grava em várias stores e devolve os resultados dos pedidos', async () => {
        await transacao(['clientes', 'itens'], 'readwrite', (l) => {
            l.clientes.put({ id: 'c1', nome: 'Ana' });
            l.itens.put({ id: 'i1', cliente_id: 'c1', status: 'aberto' });
        });

        const lido = await transacao(['clientes', 'itens'], 'readonly', (l) => ({
            clientes: l.clientes.getAll(),
            itens: l.itens.getAll(),
            fixo: 7,
        }));
        expect(lido).toEqual({
            clientes: [{ id: 'c1', nome: 'Ana' }],
            itens: [{ id: 'i1', cliente_id: 'c1', status: 'aberto' }],
            fixo: 7,
        });

        const lista = await transacao('clientes', 'readonly', (l) => [l.clientes.count(), 'x']);
        expect(lista).toEqual([1, 'x']);
    });

    it('desfaz tudo quando fn lança erro', async () => {
        await salvar('clientes', { id: 'c1', nome: 'Ana' });

        await expect(
            transacao(['clientes', 'itens'], 'readwrite', (l) => {
                l.clientes.clear();
                l.itens.put({ id: 'i1', cliente_id: 'c1' });
                throw new Error('falhou no meio');
            }),
        ).rejects.toThrow('falhou no meio');

        expect(await listar('clientes')).toEqual([{ id: 'c1', nome: 'Ana' }]);
        expect(await listar('itens')).toEqual([]);
    });

    it('desfaz tudo e rejeita quando um pedido falha', async () => {
        await salvar('clientes', { id: 'c1', nome: 'Ana' });

        await expect(
            transacao(['clientes', 'itens'], 'readwrite', (l) => {
                l.itens.put({ id: 'i1', cliente_id: 'c1' });
                l.clientes.add({ id: 'c1', nome: 'Repetida' });
            }),
        ).rejects.toMatchObject({ name: 'ConstraintError' });

        expect(await listar('itens')).toEqual([]);
        expect(await pegar('clientes', 'c1')).toEqual({ id: 'c1', nome: 'Ana' });
    });
});

describe('meta', () => {
    it('lerMeta de chave inexistente devolve undefined', async () => {
        expect(await lerMeta('token')).toBeUndefined();
    });

    it('gravarMeta e lerMeta vão e voltam no formato { chave, valor }', async () => {
        await gravarMeta('token', 'abc123');
        await gravarMeta('fila_uso', [{ dia: '2026-12-08', enviados: 3 }]);

        expect(await lerMeta('token')).toBe('abc123');
        expect(await lerMeta('fila_uso')).toEqual([{ dia: '2026-12-08', enviados: 3 }]);
        expect(await pegar('meta', 'token')).toEqual({ chave: 'token', valor: 'abc123' });
    });
});
