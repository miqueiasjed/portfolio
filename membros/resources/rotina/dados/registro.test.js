import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NOME_BANCO, fechar, listar, pegar, salvar } from './banco.js';
import { avisar, definirAoRegistrar, marcarRespondeu, registrarToque } from './registro.js';
import { cancelarPendencia, resolverPendencia } from './pendencias.js';

function apagarBanco() {
    return new Promise((resolve, reject) => {
        const pedido = indexedDB.deleteDatabase(NOME_BANCO);
        pedido.onsuccess = () => resolve();
        pedido.onerror = () => reject(pedido.error);
        pedido.onblocked = () => reject(new Error('apagar o banco ficou bloqueado'));
    });
}

function item(campos = {}) {
    return {
        id: 'i1',
        cliente_id: 'c1',
        processo: '04',
        data: '2026-12-01',
        hora: null,
        servico: 'Pacote',
        valor_centavos: 15000,
        status: 'aberto',
        resultado: null,
        criado_em: '2026-12-01T12:00:00.000Z',
        atualizado_em: '2026-12-01T12:00:00.000Z',
        ...campos,
    };
}

let gancho;

beforeEach(async () => {
    await fechar();
    await apagarBanco();
    gancho = vi.fn();
    definirAoRegistrar(gancho);
});

afterEach(() => {
    definirAoRegistrar(null);
});

describe('avisar', () => {
    it('sem gancho definido não faz nada', () => {
        definirAoRegistrar(null);
        expect(() => avisar('toque', { processo: '04', quando: '2026-12-04T12:00:00.000Z' })).not.toThrow();
    });

    it('engole erro do gancho, síncrono ou em Promise', async () => {
        definirAoRegistrar(() => {
            throw new Error('falhou');
        });
        expect(() => avisar('toque', { processo: '04', quando: '2026-12-04T12:00:00.000Z' })).not.toThrow();

        definirAoRegistrar(() => Promise.reject(new Error('falhou depois')));
        expect(() => avisar('resposta', { processo: '04', quando: '2026-12-04T12:00:00.000Z' })).not.toThrow();
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
});

describe('registrarToque', () => {
    it('grava o toque com enviado_em igual ao recebido e avisa', async () => {
        await salvar('itens', item());

        const toque = await registrarToque({ itemId: 'i1', etapa: 'd3', enviadoEm: '2026-12-04T13:05:00.000Z' });

        expect(toque).toEqual({
            id: expect.stringMatching(/^[0-9a-f-]{36}$/),
            item_id: 'i1',
            etapa: 'd3',
            enviado_em: '2026-12-04T13:05:00.000Z',
            respondeu: false,
        });
        expect(await pegar('toques', toque.id)).toEqual(toque);
        expect(gancho).toHaveBeenCalledTimes(1);
        expect(gancho).toHaveBeenCalledWith('toque', { processo: '04', quando: '2026-12-04T13:05:00.000Z' });
    });

    it('milissegundos viram ISO; texto fora do padrão e Date inválido são recusados', async () => {
        await salvar('itens', item());
        const ms = Date.parse('2026-12-04T13:05:00.000Z');

        const toque = await registrarToque({ itemId: 'i1', etapa: 'd3', enviadoEm: ms });
        expect(toque.enviado_em).toBe('2026-12-04T13:05:00.000Z');

        await expect(registrarToque({ itemId: 'i1', etapa: 'd7', enviadoEm: '04/12/2026' })).rejects.toThrow('Data do envio inválida.');
        await expect(registrarToque({ itemId: 'i1', etapa: 'd7', enviadoEm: new Date('x') })).rejects.toThrow('Data do envio inválida.');
        await expect(registrarToque({ itemId: 'i1', etapa: 'd7' })).rejects.toThrow('Falta a data do envio.');
        expect(await listar('toques')).toHaveLength(1);
    });

    it('Date recebido vira string ISO', async () => {
        await salvar('itens', item());
        const momento = new Date('2026-12-04T13:05:00.000Z');

        const toque = await registrarToque({ itemId: 'i1', etapa: 'd3', enviadoEm: momento });

        expect(toque.enviado_em).toBe('2026-12-04T13:05:00.000Z');
        expect((await pegar('toques', toque.id)).enviado_em).toBe('2026-12-04T13:05:00.000Z');
    });

    it('segunda chamada com mesmo item e etapa devolve o existente, sem gravar nem avisar', async () => {
        await salvar('itens', item());
        const primeiro = await registrarToque({ itemId: 'i1', etapa: 'd3', enviadoEm: '2026-12-04T13:05:00.000Z' });

        const segundo = await registrarToque({ itemId: 'i1', etapa: 'd3', enviadoEm: '2026-12-04T13:09:00.000Z' });

        expect(segundo).toEqual(primeiro);
        expect(await listar('toques')).toHaveLength(1);
        expect(gancho).toHaveBeenCalledTimes(1);
    });

    it('duas chamadas simultâneas gravam um toque só', async () => {
        await salvar('itens', item());

        const [a, b] = await Promise.all([
            registrarToque({ itemId: 'i1', etapa: 'd3', enviadoEm: '2026-12-04T13:05:00.000Z' }),
            registrarToque({ itemId: 'i1', etapa: 'd3', enviadoEm: '2026-12-04T13:05:01.000Z' }),
        ]);

        expect(a).toEqual(b);
        expect(await listar('toques')).toHaveLength(1);
        expect(gancho).toHaveBeenCalledTimes(1);
    });

    it('outra etapa do mesmo item grava outro toque', async () => {
        await salvar('itens', item());
        await registrarToque({ itemId: 'i1', etapa: 'd3', enviadoEm: '2026-12-04T13:05:00.000Z' });
        await registrarToque({ itemId: 'i1', etapa: 'd7', enviadoEm: '2026-12-08T13:05:00.000Z' });

        expect(await listar('toques')).toHaveLength(2);
        expect(gancho).toHaveBeenCalledTimes(2);
    });

    it('item inexistente rejeita sem gravar', async () => {
        await expect(
            registrarToque({ itemId: 'nao-existe', etapa: 'd3', enviadoEm: '2026-12-04T13:05:00.000Z' }),
        ).rejects.toThrow('Pendência não encontrada.');
        expect(await listar('toques')).toEqual([]);
        expect(gancho).not.toHaveBeenCalled();
    });

    it('gancho que lança erro não quebra a gravação', async () => {
        definirAoRegistrar(() => {
            throw new Error('falhou');
        });
        await salvar('itens', item());

        const toque = await registrarToque({ itemId: 'i1', etapa: 'd3', enviadoEm: '2026-12-04T13:05:00.000Z' });

        expect(await pegar('toques', toque.id)).toEqual(toque);
    });
});

describe('marcarRespondeu', () => {
    it('marca uma vez e avisa uma vez só', async () => {
        await salvar('itens', item({ processo: '05' }));
        const toque = await registrarToque({ itemId: 'i1', etapa: 'd1', enviadoEm: '2026-12-04T13:05:00.000Z' });
        gancho.mockClear();

        expect(await marcarRespondeu(toque.id, '2026-12-04T15:00:00.000Z')).toBe(true);
        expect(await marcarRespondeu(toque.id, '2026-12-04T16:00:00.000Z')).toBe(false);

        expect((await pegar('toques', toque.id)).respondeu).toBe(true);
        expect(gancho).toHaveBeenCalledTimes(1);
        expect(gancho).toHaveBeenCalledWith('resposta', { processo: '05', quando: '2026-12-04T15:00:00.000Z' });
    });

    it('gancho que lança erro não quebra a gravação', async () => {
        await salvar('itens', item());
        const toque = await registrarToque({ itemId: 'i1', etapa: 'd3', enviadoEm: '2026-12-04T13:05:00.000Z' });
        definirAoRegistrar(() => {
            throw new Error('falhou');
        });

        expect(await marcarRespondeu(toque.id, '2026-12-04T15:00:00.000Z')).toBe(true);
        expect((await pegar('toques', toque.id)).respondeu).toBe(true);
    });

    it('toque inexistente rejeita', async () => {
        await expect(marcarRespondeu('nao-existe', '2026-12-04T15:00:00.000Z')).rejects.toThrow('Envio não encontrado.');
        expect(gancho).not.toHaveBeenCalled();
    });
});

describe('resolverPendencia avisa o gancho', () => {
    it('avisa resolvido uma vez e continua devolvendo o item', async () => {
        await salvar('itens', item());

        const resolvido = await resolverPendencia('i1', 'fechou');
        expect(resolvido).toMatchObject({ id: 'i1', status: 'resolvido', resultado: 'fechou' });
        expect(await resolverPendencia('i1', 'recusou')).toEqual(resolvido);

        expect(gancho).toHaveBeenCalledTimes(1);
        expect(gancho).toHaveBeenCalledWith('resolvido', { processo: '04', quando: expect.any(String) });
        expect(Number.isNaN(Date.parse(gancho.mock.calls[0][1].quando))).toBe(false);
    });

    it('item cancelado não muda e não avisa', async () => {
        await salvar('itens', item());
        const cancelado = await cancelarPendencia('i1');

        expect(await resolverPendencia('i1', 'fechou')).toEqual(cancelado);
        expect(gancho).not.toHaveBeenCalled();
    });

    it('resultado de outro processo rejeita e não avisa', async () => {
        await salvar('itens', item());
        await expect(resolverPendencia('i1', 'pagou')).rejects.toThrow(/não vale para esta pendência/);
        expect(gancho).not.toHaveBeenCalled();
    });

    it('gancho que lança erro não quebra a resolução', async () => {
        definirAoRegistrar(() => {
            throw new Error('falhou');
        });
        await salvar('itens', item());

        const resolvido = await resolverPendencia('i1', 'fechou');
        expect(await pegar('itens', 'i1')).toEqual(resolvido);
    });
});
