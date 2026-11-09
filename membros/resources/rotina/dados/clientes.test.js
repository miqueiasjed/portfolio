import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { NOME_BANCO, fechar, listar, pegar, salvar } from './banco.js';
import {
    acharClienteParecido,
    buscarClientes,
    detalheCliente,
    excluirCliente,
    normalizarTexto,
    salvarCliente,
} from './clientes.js';

function apagarBanco() {
    return new Promise((resolve, reject) => {
        const pedido = indexedDB.deleteDatabase(NOME_BANCO);
        pedido.onsuccess = () => resolve();
        pedido.onerror = () => reject(pedido.error);
        pedido.onblocked = () => reject(new Error('apagar o banco ficou bloqueado'));
    });
}

function cliente(id, nome, whatsapp, extra = {}) {
    return {
        id,
        nome,
        whatsapp,
        obs: '',
        criado_em: '2026-11-01T12:00:00.000Z',
        atualizado_em: '2026-11-01T12:00:00.000Z',
        ...extra,
    };
}

function item(id, cliente_id, status, extra = {}) {
    return {
        id,
        cliente_id,
        processo: '01',
        data: '2026-11-10',
        hora: '09:00',
        servico: 'Limpeza',
        valor_centavos: 0,
        status,
        resultado: '',
        criado_em: '2026-11-01T12:00:00.000Z',
        atualizado_em: '2026-11-01T12:00:00.000Z',
        ...extra,
    };
}

function toque(id, item_id, enviado_em, extra = {}) {
    return { id, item_id, etapa: 'vespera', enviado_em, respondeu: false, ...extra };
}

async function gravarTodos(store, registros) {
    for (const registro of registros) {
        await salvar(store, registro);
    }
}

beforeEach(async () => {
    await fechar();
    await apagarBanco();
});

describe('normalizarTexto', () => {
    it('tira acento, caixa e espaço sobrando', () => {
        expect(normalizarTexto('  Ana   LÚCIA ')).toBe('ana lucia');
        expect(normalizarTexto(undefined)).toBe('');
    });
});

describe('acharClienteParecido', () => {
    beforeEach(async () => {
        await gravarTodos('clientes', [
            cliente('c1', 'Ana Lúcia', '5585999981111'),
            cliente('c2', 'Bruno Ana', '5585999982222'),
            cliente('c3', 'Mariana', '5585999983333'),
            cliente('c4', 'Anabela', '5585999984444'),
            cliente('c5', 'Carlos', '5511912345678'),
        ]);
    });

    it('acha Ana Lúcia digitando "ana luc", sem diferença de caixa e acento', async () => {
        const achados = await acharClienteParecido({ nome: 'ana luc', whatsapp: '' });
        expect(achados.map((c) => c.id)).toEqual(['c1']);

        const comAcento = await acharClienteParecido({ nome: 'ANA LÚC' });
        expect(comAcento.map((c) => c.id)).toEqual(['c1']);
    });

    it('acha pelo trecho 99998 e devolve no máximo 3', async () => {
        const achados = await acharClienteParecido({ nome: '', whatsapp: '99998' });
        expect(achados).toHaveLength(3);
        for (const c of achados) {
            expect(c.whatsapp).toContain('99998');
        }
    });

    it('nome que casa com vários também para em 3', async () => {
        const achados = await acharClienteParecido({ nome: 'an' });
        expect(achados).toHaveLength(3);
    });

    it('telefone igual vem primeiro, mesmo sem o 55 na frente', async () => {
        const achados = await acharClienteParecido({ nome: 'ana', whatsapp: '(85) 99998-4444' });
        expect(achados[0].id).toBe('c4');

        const comDdi = await acharClienteParecido({ nome: 'ana', whatsapp: '5585999984444' });
        expect(comDdi[0].id).toBe('c4');
    });

    it('menos de 4 dígitos e menos de 2 letras não procuram nada', async () => {
        expect(await acharClienteParecido({ nome: 'a', whatsapp: '999' })).toEqual([]);
        expect(await acharClienteParecido({})).toEqual([]);
        expect(await acharClienteParecido()).toEqual([]);
    });

    it('sem nenhum parecido devolve lista vazia', async () => {
        expect(await acharClienteParecido({ nome: 'Zuleide', whatsapp: '7777' })).toEqual([]);
    });
});

describe('buscarClientes', () => {
    beforeEach(async () => {
        await gravarTodos('clientes', [
            cliente('c1', 'Érica', '5585911110000'),
            cliente('c2', 'bruno', '5585922220000'),
            cliente('c3', 'Ana', '5585933330000'),
            cliente('c4', 'Álvaro', '5585944440000'),
        ]);
        await gravarTodos('itens', [
            item('i1', 'c3', 'aberto'),
            item('i2', 'c3', 'aberto'),
            item('i3', 'c3', 'resolvido'),
            item('i4', 'c2', 'cancelado'),
            item('i5', 'c1', 'aberto'),
        ]);
    });

    it('termo vazio traz todos em ordem alfabética com abertas certo', async () => {
        const todos = await buscarClientes('');
        expect(todos.map((c) => c.nome)).toEqual(['Álvaro', 'Ana', 'bruno', 'Érica']);
        expect(Object.fromEntries(todos.map((c) => [c.id, c.abertas]))).toEqual({
            c1: 1,
            c2: 0,
            c3: 2,
            c4: 0,
        });
        expect(await buscarClientes()).toHaveLength(4);
    });

    it('filtra pelo nome sem diferença de caixa e acento', async () => {
        const achados = await buscarClientes('ERI');
        expect(achados.map((c) => c.id)).toEqual(['c1']);
    });

    it('filtra pelo trecho do telefone', async () => {
        const achados = await buscarClientes('9333');
        expect(achados.map((c) => c.id)).toEqual(['c3']);
        expect(achados[0].abertas).toBe(2);
    });

    it('termo sem nenhum cliente devolve lista vazia', async () => {
        expect(await buscarClientes('Zuleide')).toEqual([]);
    });
});

describe('detalheCliente', () => {
    beforeEach(async () => {
        await gravarTodos('clientes', [cliente('c1', 'Ana', '5585911110000'), cliente('c2', 'Bia', '5585922220000')]);
        await gravarTodos('itens', [
            item('i1', 'c1', 'aberto', { data: '2026-11-20', hora: '10:00' }),
            item('i2', 'c1', 'aberto', { data: '2026-11-12', hora: '15:00' }),
            item('i3', 'c1', 'aberto', { data: '2026-11-12', hora: '08:00' }),
            item('i4', 'c1', 'resolvido', { atualizado_em: '2026-11-05T10:00:00.000Z' }),
            item('i5', 'c1', 'cancelado', { atualizado_em: '2026-11-07T10:00:00.000Z' }),
            item('i6', 'c2', 'aberto'),
        ]);
        await gravarTodos('toques', [
            toque('t1', 'i1', '2026-11-08T12:00:00.000Z'),
            toque('t2', 'i1', '2026-11-06T12:00:00.000Z'),
            toque('t3', 'i4', '2026-11-04T12:00:00.000Z', { respondeu: true }),
            toque('t4', 'i6', '2026-11-04T12:00:00.000Z'),
        ]);
    });

    it('separa abertas e fechadas na ordem certa', async () => {
        const detalhe = await detalheCliente('c1');
        expect(detalhe.cliente.nome).toBe('Ana');
        expect(detalhe.abertas.map((i) => i.id)).toEqual(['i3', 'i2', 'i1']);
        expect(detalhe.fechadas.map((i) => i.id)).toEqual(['i5', 'i4']);
    });

    it('agrupa os toques por item, do mais antigo para o mais novo', async () => {
        const { toques } = await detalheCliente('c1');
        expect(Object.keys(toques).sort()).toEqual(['i1', 'i2', 'i3', 'i4', 'i5']);
        expect(toques.i1.map((t) => t.id)).toEqual(['t2', 't1']);
        expect(toques.i4.map((t) => t.id)).toEqual(['t3']);
        expect(toques.i2).toEqual([]);
        expect(toques.i6).toBeUndefined();
    });

    it('cliente inexistente devolve null', async () => {
        expect(await detalheCliente('nao-existe')).toBeNull();
    });
});

describe('salvarCliente', () => {
    it('atualiza os campos e preenche atualizado_em em ISO', async () => {
        await salvar('clientes', cliente('c1', 'Ana', '5585911110000'));

        const gravado = await salvarCliente({ id: 'c1', nome: 'Ana Lúcia', whatsapp: '5585999998888', obs: 'Prefere de manhã' });

        const guardado = await pegar('clientes', 'c1');
        expect(guardado).toEqual(gravado);
        expect(guardado.nome).toBe('Ana Lúcia');
        expect(guardado.whatsapp).toBe('5585999998888');
        expect(guardado.obs).toBe('Prefere de manhã');
        expect(guardado.criado_em).toBe('2026-11-01T12:00:00.000Z');
        expect(guardado.atualizado_em).not.toBe('2026-11-01T12:00:00.000Z');
        expect(new Date(guardado.atualizado_em).toISOString()).toBe(guardado.atualizado_em);
    });

    it('campo não informado mantém o valor guardado', async () => {
        await salvar('clientes', cliente('c1', 'Ana', '5585911110000', { obs: 'antiga' }));
        await salvarCliente({ id: 'c1', nome: 'Ana Maria' });

        const guardado = await pegar('clientes', 'c1');
        expect(guardado.whatsapp).toBe('5585911110000');
        expect(guardado.obs).toBe('antiga');
    });

    it('cliente inexistente rejeita e não grava nada', async () => {
        await expect(salvarCliente({ id: 'nao-existe', nome: 'X' })).rejects.toThrow('Cliente não encontrado.');
        expect(await listar('clientes')).toEqual([]);
    });
});

describe('excluirCliente', () => {
    it('apaga o cliente, os itens e os toques dele sem deixar órfão', async () => {
        await gravarTodos('clientes', [cliente('c1', 'Ana', '5585911110000'), cliente('c2', 'Bia', '5585922220000')]);
        await gravarTodos('itens', [
            item('i1', 'c1', 'aberto'),
            item('i2', 'c1', 'resolvido'),
            item('i3', 'c2', 'aberto'),
        ]);
        await gravarTodos('toques', [
            toque('t1', 'i1', '2026-11-04T12:00:00.000Z'),
            toque('t2', 'i1', '2026-11-05T12:00:00.000Z'),
            toque('t3', 'i2', '2026-11-04T12:00:00.000Z'),
            toque('t4', 'i3', '2026-11-04T12:00:00.000Z'),
        ]);

        const apagados = await excluirCliente('c1');
        expect(apagados).toEqual({ itens: 2, toques: 3 });

        const clientes = await listar('clientes');
        const itens = await listar('itens');
        const toques = await listar('toques');
        expect(clientes.map((c) => c.id)).toEqual(['c2']);
        expect(itens.map((i) => i.id)).toEqual(['i3']);
        expect(toques.map((t) => t.id)).toEqual(['t4']);

        const idsClientes = new Set(clientes.map((c) => c.id));
        const idsItens = new Set(itens.map((i) => i.id));
        expect(itens.every((i) => idsClientes.has(i.cliente_id))).toBe(true);
        expect(toques.every((t) => idsItens.has(t.item_id))).toBe(true);
    });

    it('cliente sem itens ou inexistente não quebra', async () => {
        await salvar('clientes', cliente('c1', 'Ana', '5585911110000'));
        expect(await excluirCliente('c1')).toEqual({ itens: 0, toques: 0 });
        expect(await excluirCliente('nao-existe')).toEqual({ itens: 0, toques: 0 });
        expect(await listar('clientes')).toEqual([]);
    });
});
