// Passo 2 da folha "Enviou?": resultado da conversa e "Remarcou".
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NOME_BANCO, fechar, listar, pegar, salvar } from '../dados/banco.js';
import { definirAoRegistrar, registrarToque } from '../dados/registro.js';
import { listaDeHoje } from '../regras/hoje.js';
import { somarDias } from '../regras/datas.js';
import { MENSAGENS } from '../regras/campos.js';
import {
    conferirRemarcacao,
    desfazerRemarcacao,
    opcoesDeResultado,
    responderRemarcou,
    responderResultado,
    responderSoRespondeu,
} from './useVoltaDoWhatsApp.js';

function apagarBanco() {
    return new Promise((resolve, reject) => {
        const pedido = indexedDB.deleteDatabase(NOME_BANCO);
        pedido.onsuccess = () => resolve();
        pedido.onerror = () => reject(pedido.error);
        pedido.onblocked = () => reject(new Error('apagar o banco ficou bloqueado'));
    });
}

const CLIENTE = { id: 'c1', nome: 'Ana', whatsapp: '5585999998888', obs: '' };

function item(campos = {}) {
    return {
        id: 'i1',
        cliente_id: 'c1',
        processo: '01',
        data: '2026-12-11',
        hora: '14:00',
        servico: 'Corte',
        valor_centavos: null,
        status: 'aberto',
        resultado: null,
        criado_em: '2026-12-01T12:00:00.000Z',
        atualizado_em: '2026-12-01T12:00:00.000Z',
        ...campos,
    };
}

describe('opcoesDeResultado', () => {
    it('muda conforme o processo, com os nomes da tela', () => {
        expect(opcoesDeResultado('01')).toEqual([
            { resultado: 'confirmou', rotulo: 'Confirmou' },
            { resultado: 'remarcou', rotulo: 'Remarcou' },
            { resultado: 'cancelou', rotulo: 'Cancelou' },
        ]);
        expect(opcoesDeResultado('04').map((o) => o.rotulo)).toEqual(['Fechou', 'Recusou']);
        expect(opcoesDeResultado('05').map((o) => o.rotulo)).toEqual(['Pagou']);
        expect(opcoesDeResultado('99')).toEqual([]);
    });
});

describe('conferirRemarcacao', () => {
    it('aceita o que sai dos campos de data e hora', () => {
        expect(conferirRemarcacao({ data: '2026-12-20', hora: '09:30' })).toEqual({
            ok: true,
            erros: {},
            data: '2026-12-20',
            hora: '09:30',
        });
    });

    it('usa as mesmas frases da tela Novo', () => {
        expect(conferirRemarcacao({ data: '', hora: '' }).erros).toEqual({
            data: MENSAGENS.dataVazia['01'],
            hora: MENSAGENS.horaVazia,
        });
        const ruim = conferirRemarcacao({ data: '2026-02-30', hora: '25:00' });
        expect(ruim.ok).toBe(false);
        expect(ruim.data).toBeNull();
        expect(ruim.erros).toEqual({ data: MENSAGENS.dataInvalida, hora: MENSAGENS.horaInvalida });
    });
});

describe('com injeção', () => {
    it('"Remarcou" cria o novo antes de resolver o antigo', async () => {
        const ordem = [];
        const marcar = vi.fn(async () => ordem.push('marcar'));
        const registrar = vi.fn(async () => {
            ordem.push('registrar');
            return { item: { id: 'novo' } };
        });
        const resolver = vi.fn(async () => ordem.push('resolver'));
        await responderRemarcou({ toque: { id: 't1' }, item: item(), data: '2026-12-20', hora: '09:30', marcar, registrar, resolver });
        expect(ordem).toEqual(['marcar', 'registrar', 'resolver']);
        expect(registrar).toHaveBeenCalledWith({
            cliente_id: 'c1',
            item: { processo: '01', data: '2026-12-20', hora: '09:30', servico: 'Corte', valor_centavos: null },
        });
    });

    it('falha ao resolver o antigo: a nova tentativa não cria outro item', async () => {
        const memoria = {};
        const registrar = vi.fn(async ({ item: campos }) => ({ item: { id: 'novo', ...campos } }));
        const resolver = vi
            .fn()
            .mockRejectedValueOnce(new Error('falhou'))
            .mockResolvedValueOnce({ id: 'i1', status: 'resolvido' });
        const marcar = vi.fn(async () => true);
        const args = { toque: { id: 't1' }, item: item(), data: '2026-12-20', hora: '09:30', memoria, marcar, registrar, resolver };

        await expect(responderRemarcou(args)).rejects.toThrow('falhou');
        expect(memoria.novo).toMatchObject({ id: 'novo', data: '2026-12-20', hora: '09:30' });
        const { novo } = await responderRemarcou(args);
        expect(novo).toMatchObject({ id: 'novo' });
        expect(registrar).toHaveBeenCalledTimes(1);
        expect(resolver).toHaveBeenCalledTimes(2);
    });

    it('nova tentativa com outra data corrige o item novo antes de resolver o antigo', async () => {
        const ordem = [];
        const memoria = {};
        const registrar = vi.fn(async ({ item: campos }) => ({ item: { id: 'novo', ...campos } }));
        const atualizar = vi.fn(async (id, campos) => {
            ordem.push('atualizar');
            return { ...memoria.novo, ...campos };
        });
        const resolver = vi
            .fn()
            .mockRejectedValueOnce(new Error('falhou'))
            .mockImplementationOnce(async () => ordem.push('resolver'));
        const base = { toque: { id: 't1' }, item: item(), memoria, marcar: vi.fn(async () => true), registrar, atualizar, resolver };

        await expect(responderRemarcou({ ...base, data: '2026-12-20', hora: '09:30' })).rejects.toThrow('falhou');
        const { novo } = await responderRemarcou({ ...base, data: '2026-12-22', hora: '10:00' });

        expect(registrar).toHaveBeenCalledTimes(1);
        expect(atualizar).toHaveBeenCalledWith('novo', { data: '2026-12-22', hora: '10:00' });
        expect(ordem).toEqual(['atualizar', 'resolver']);
        expect(novo).toMatchObject({ id: 'novo', data: '2026-12-22', hora: '10:00' });
    });

    it('mesma data e hora na nova tentativa não regrava o item novo', async () => {
        const memoria = { novo: { id: 'novo', data: '2026-12-20', hora: '09:30' } };
        const atualizar = vi.fn();
        const registrar = vi.fn();
        await responderRemarcou({
            toque: { id: 't1' },
            item: item(),
            data: '2026-12-20',
            hora: '09:30',
            memoria,
            marcar: vi.fn(async () => true),
            registrar,
            atualizar,
            resolver: vi.fn(async () => ({})),
        });
        expect(atualizar).not.toHaveBeenCalled();
        expect(registrar).not.toHaveBeenCalled();
    });

    it('desfazerRemarcacao sem item novo não grava nada', async () => {
        const cancelar = vi.fn();
        await desfazerRemarcacao({ memoria: {}, cancelar });
        expect(cancelar).not.toHaveBeenCalled();
    });

    it('desfazerRemarcacao que falha mantém o item novo para tentar de novo', async () => {
        const memoria = { novo: { id: 'novo' } };
        const cancelar = vi.fn().mockRejectedValueOnce(new Error('falhou')).mockResolvedValueOnce({});
        await expect(desfazerRemarcacao({ memoria, cancelar })).rejects.toThrow('falhou');
        expect(memoria.novo).toEqual({ id: 'novo' });
        await desfazerRemarcacao({ memoria, cancelar });
        expect(cancelar).toHaveBeenCalledWith('novo');
        expect(memoria.novo).toBeUndefined();
    });
});

describe('com o aparelho de verdade (fake-indexeddb)', () => {
    let eventos;
    let toque;

    beforeEach(async () => {
        await fechar();
        await apagarBanco();
        await salvar('clientes', CLIENTE);
        await salvar('itens', item());
        eventos = [];
        definirAoRegistrar((evento) => eventos.push(evento));
        toque = await registrarToque({ itemId: 'i1', etapa: 'vespera', enviadoEm: '2026-12-10T12:00:00.000Z' });
        eventos = [];
    });

    it('um resultado resolve o item e marca a resposta uma vez só', async () => {
        await responderResultado({ toque, item: item(), resultado: 'confirmou' });
        await responderResultado({ toque, item: item(), resultado: 'confirmou' });

        const gravado = await pegar('itens', 'i1');
        expect(gravado.status).toBe('resolvido');
        expect(gravado.resultado).toBe('confirmou');
        expect((await pegar('toques', toque.id)).respondeu).toBe(true);
        expect(eventos).toEqual(['resposta', 'resolvido']);
        expect(await listar('toques')).toHaveLength(1);
    });

    it('resultado de outro processo não resolve', async () => {
        await expect(responderResultado({ toque, item: item(), resultado: 'pagou' })).rejects.toThrow();
        expect((await pegar('itens', 'i1')).status).toBe('aberto');
    });

    it('"Respondeu, mas ainda não resolveu" deixa o item aberto e o toque respondido', async () => {
        await responderSoRespondeu({ toque });
        expect((await pegar('itens', 'i1')).status).toBe('aberto');
        expect((await pegar('toques', toque.id)).respondeu).toBe(true);
        expect(eventos).toEqual(['resposta']);
    });

    it('"Remarcou" com data nova cria o item 01 que aparece na véspera da data nova', async () => {
        const dataNova = '2026-12-20';
        const { antigo, novo } = await responderRemarcou({ toque, item: item(), data: dataNova, hora: '09:30' });

        expect(antigo.status).toBe('resolvido');
        expect(antigo.resultado).toBe('remarcou');
        expect(novo).toMatchObject({ cliente_id: 'c1', processo: '01', data: dataNova, hora: '09:30', servico: 'Corte', status: 'aberto' });
        expect(await listar('itens')).toHaveLength(2);
        expect(await listar('clientes')).toHaveLength(1);
        expect(await listar('toques')).toHaveLength(1);

        const dados = { itens: await listar('itens'), toques: await listar('toques'), clientes: await listar('clientes') };
        const vespera = listaDeHoje({ ...dados, hoje: somarDias(dataNova, -1) });
        expect(vespera.map((e) => e.item.id)).toEqual([novo.id]);
        expect(vespera[0].etapa).toBe('vespera');
        expect(listaDeHoje({ ...dados, hoje: somarDias(dataNova, -2) })).toEqual([]);
    });

    it('falha ao resolver o antigo e nova data: o item novo vai para a data corrigida', async () => {
        const memoria = {};
        const resolver = vi.fn().mockRejectedValueOnce(new Error('falhou'));
        await expect(
            responderRemarcou({ toque, item: item(), data: '2026-12-20', hora: '09:30', memoria, resolver }),
        ).rejects.toThrow('falhou');
        const { antigo, novo } = await responderRemarcou({ toque, item: item(), data: '2026-12-22', hora: '10:00', memoria });

        expect(antigo.resultado).toBe('remarcou');
        expect(await listar('itens')).toHaveLength(2);
        expect(await pegar('itens', novo.id)).toMatchObject({ data: '2026-12-22', hora: '10:00', status: 'aberto' });
    });

    it('item novo gravado e o antigo aberto: sair sem concluir cancela o novo', async () => {
        const memoria = {};
        const resolver = vi.fn().mockRejectedValueOnce(new Error('falhou'));
        await expect(
            responderRemarcou({ toque, item: item(), data: '2026-12-20', hora: '09:30', memoria, resolver }),
        ).rejects.toThrow('falhou');
        const idNovo = memoria.novo.id;

        await desfazerRemarcacao({ memoria });
        expect((await pegar('itens', idNovo)).status).toBe('cancelado');
        expect((await pegar('itens', 'i1')).status).toBe('aberto');
        expect(memoria.novo).toBeUndefined();
    });

    it('"Pular" depois de uma falha cancela o item novo e resolve o antigo', async () => {
        const memoria = {};
        const resolver = vi.fn().mockRejectedValueOnce(new Error('falhou'));
        await expect(
            responderRemarcou({ toque, item: item(), data: '2026-12-20', hora: '09:30', memoria, resolver }),
        ).rejects.toThrow('falhou');
        const idNovo = memoria.novo.id;

        const { antigo, novo } = await responderRemarcou({ toque, item: item(), memoria });
        expect(novo).toBeNull();
        expect(antigo.resultado).toBe('remarcou');
        expect((await pegar('itens', idNovo)).status).toBe('cancelado');
    });

    it('"Pular" só resolve, sem criar outro item', async () => {
        const { antigo, novo } = await responderRemarcou({ toque, item: item() });
        expect(novo).toBeNull();
        expect(antigo.resultado).toBe('remarcou');
        expect(await listar('itens')).toHaveLength(1);
        expect((await pegar('toques', toque.id)).respondeu).toBe(true);
    });
});
