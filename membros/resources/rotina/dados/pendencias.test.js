import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { NOME_BANCO, fechar, listar, pegar, salvar } from './banco.js';
import {
    RESULTADOS,
    atualizarPendencia,
    cancelarPendencia,
    importarPendencias,
    registrarPendencia,
    resolverPendencia,
    situacao,
} from './pendencias.js';
import { lerPlanilha } from '../regras/planilha.js';
import { validarPendencia } from '../regras/campos.js';
import { RESULTADOS as ROTULOS_RESULTADOS } from '../ui/rotulos.js';

function apagarBanco() {
    return new Promise((resolve, reject) => {
        const pedido = indexedDB.deleteDatabase(NOME_BANCO);
        pedido.onsuccess = () => resolve();
        pedido.onerror = () => reject(pedido.error);
        pedido.onblocked = () => reject(new Error('apagar o banco ficou bloqueado'));
    });
}

function pendencia(campos) {
    const resultado = validarPendencia(campos);
    if (!resultado.ok) throw new Error(`campos inválidos no teste: ${JSON.stringify(resultado.erros)}`);
    return { cliente: resultado.cliente, item: resultado.item };
}

const ANA_01 = { nome: 'Ana Souza', whatsapp: '(85) 99999-1234', processo: '01', data: '10/12/2026', hora: '14:30', servico: 'Corte' };
const ANA_04 = { nome: 'Ana Souza', whatsapp: '85 99999 1234', processo: '04', data: '08/12/2026', valor: '150,00', servico: 'Pacote' };
const BRUNO_05 = { nome: 'Bruno Lima', whatsapp: '(85) 98888-5678', processo: '05', data: '15/12/2026', valor: '200', servico: 'Mensalidade' };

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

beforeEach(async () => {
    await fechar();
    await apagarBanco();
});

describe('RESULTADOS', () => {
    it('segue o contrato e todo resultado tem nome na tela', () => {
        expect(RESULTADOS).toEqual({
            '01': ['confirmou', 'remarcou', 'cancelou'],
            '04': ['fechou', 'recusou'],
            '05': ['pagou'],
        });
        for (const lista of Object.values(RESULTADOS)) {
            for (const resultado of lista) {
                expect(ROTULOS_RESULTADOS[resultado]).toBeTruthy();
            }
        }
    });
});

describe('registrarPendencia', () => {
    it('cria cliente e item aberto quando o telefone é novo', async () => {
        const { cliente, item, clienteNovo } = await registrarPendencia(pendencia(ANA_01));

        expect(clienteNovo).toBe(true);
        expect(cliente).toMatchObject({ nome: 'Ana Souza', whatsapp: '5585999991234', obs: '' });
        expect(cliente.id).toMatch(/^[0-9a-f-]{36}$/);
        expect(item).toMatchObject({
            cliente_id: cliente.id,
            processo: '01',
            data: '2026-12-10',
            hora: '14:30',
            servico: 'Corte',
            valor_centavos: null,
            status: 'aberto',
            resultado: null,
        });
        expect(item.criado_em).toBe(item.atualizado_em);
        expect(await pegar('itens', item.id)).toEqual(item);
        expect(await pegar('clientes', cliente.id)).toEqual(cliente);
    });

    it('duas pendências com o mesmo telefone geram um cliente e dois itens', async () => {
        const primeira = await registrarPendencia(pendencia(ANA_01));
        const segunda = await registrarPendencia(pendencia({ ...ANA_04, nome: 'Ana S.' }));

        expect(segunda.clienteNovo).toBe(false);
        expect(segunda.cliente).toEqual(primeira.cliente);
        expect(await listar('clientes')).toHaveLength(1);
        const itens = await listar('itens');
        expect(itens).toHaveLength(2);
        expect(itens.every((i) => i.cliente_id === primeira.cliente.id)).toBe(true);
    });

    it('com cliente_id usa esse cliente, mesmo com outro telefone', async () => {
        const { cliente } = await registrarPendencia(pendencia(ANA_01));
        const outra = await registrarPendencia({ ...pendencia(BRUNO_05), cliente_id: cliente.id });

        expect(outra.clienteNovo).toBe(false);
        expect(outra.cliente.id).toBe(cliente.id);
        expect(outra.item.cliente_id).toBe(cliente.id);
        expect(await listar('clientes')).toHaveLength(1);
    });

    it('cliente_id inexistente rejeita sem gravar nada', async () => {
        await expect(registrarPendencia({ ...pendencia(ANA_01), cliente_id: 'nao-existe' })).rejects.toThrow(
            'Cliente não encontrado.',
        );
        expect(await listar('itens')).toEqual([]);
        expect(await listar('clientes')).toEqual([]);
    });
});

describe('atualizarPendencia', () => {
    it('altera só data, hora, serviço e valor', async () => {
        const { item } = await registrarPendencia(pendencia(ANA_04));
        await esperar(5);

        const novo = await atualizarPendencia(item.id, {
            data: '2026-12-09',
            valor_centavos: 18000,
            status: 'resolvido',
            processo: '05',
            cliente_id: 'outro',
        });

        expect(novo).toEqual({ ...item, data: '2026-12-09', valor_centavos: 18000, atualizado_em: novo.atualizado_em });
        expect(novo.atualizado_em > item.atualizado_em).toBe(true);
        expect(await pegar('itens', item.id)).toEqual(novo);
    });

    it('pendência inexistente rejeita', async () => {
        await expect(atualizarPendencia('nao-existe', { data: '2026-12-09' })).rejects.toThrow('Pendência não encontrada.');
    });
});

describe('resolverPendencia e cancelarPendencia', () => {
    it('resultado de outro processo rejeita; o do processo grava', async () => {
        const { item } = await registrarPendencia(pendencia(BRUNO_05));

        await expect(resolverPendencia(item.id, 'fechou')).rejects.toThrow(/não vale para esta pendência/);
        expect((await pegar('itens', item.id)).status).toBe('aberto');

        const resolvido = await resolverPendencia(item.id, 'pagou');
        expect(resolvido).toMatchObject({ status: 'resolvido', resultado: 'pagou' });
        expect(await pegar('itens', item.id)).toEqual(resolvido);
    });

    it('item já resolvido não muda ao resolver ou cancelar de novo', async () => {
        const { item } = await registrarPendencia(pendencia(ANA_01));
        const resolvido = await resolverPendencia(item.id, 'confirmou');
        await esperar(5);

        expect(await resolverPendencia(item.id, 'remarcou')).toEqual(resolvido);
        expect(await cancelarPendencia(item.id)).toEqual(resolvido);

        const guardado = await pegar('itens', item.id);
        expect(guardado.resultado).toBe('confirmou');
        expect(guardado.status).toBe('resolvido');
        expect(guardado.atualizado_em).toBe(resolvido.atualizado_em);
    });

    it('cancelar grava cancelado; item cancelado não é resolvido depois', async () => {
        const { item } = await registrarPendencia(pendencia(ANA_04));
        const cancelado = await cancelarPendencia(item.id);
        expect(cancelado).toMatchObject({ status: 'cancelado', resultado: null });

        expect(await resolverPendencia(item.id, 'fechou')).toEqual(cancelado);
        expect(await pegar('itens', item.id)).toEqual(cancelado);
    });

    it('pendência inexistente rejeita', async () => {
        await expect(resolverPendencia('nao-existe', 'pagou')).rejects.toThrow('Pendência não encontrada.');
        await expect(cancelarPendencia('nao-existe')).rejects.toThrow('Pendência não encontrada.');
    });
});

function planilhaDe50ComTresInvalidas() {
    const linhas = ['nome;whatsapp;processo;data;hora;valor;servico'];
    for (let i = 1; i <= 50; i += 1) {
        const numero = `(85) 9${String(8000000 + i).padStart(8, '0')}`;
        if (i === 7) linhas.push(`;${numero};Cobrança;15/12/2026;;100,00;Sem nome`);
        else if (i === 21) linhas.push(`Cliente ${i};123;Cobrança;15/12/2026;;100,00;Telefone curto`);
        else if (i === 40) linhas.push(`Cliente ${i};${numero};Cobrança;31/02/2026;;100,00;Data que não existe`);
        else linhas.push(`Cliente ${i};${numero};Cobrança;15/12/2026;;${i},00;Mensalidade`);
    }
    return linhas.join('\r\n');
}

describe('importarPendencias', () => {
    it('planilha de 50 linhas com 3 inválidas deixa 47 itens no banco', async () => {
        const lida = lerPlanilha(planilhaDe50ComTresInvalidas());
        expect(lida.ok).toBe(true);
        expect(lida.invalidas).toBe(3);

        const contagem = await importarPendencias(lida.linhas.filter((linha) => linha.valida));

        expect(contagem).toEqual({ clientesNovos: 47, itens: 47, repetidos: 0 });
        expect(await listar('itens')).toHaveLength(47);
        expect(await listar('clientes')).toHaveLength(47);
    });

    it('importar as mesmas linhas duas vezes não duplica pendência', async () => {
        const linhas = lerPlanilha(planilhaDe50ComTresInvalidas()).linhas.filter((linha) => linha.valida);
        await importarPendencias(linhas);
        const antes = await listar('itens');

        const segunda = await importarPendencias(linhas);

        expect(segunda).toEqual({ clientesNovos: 0, itens: 0, repetidos: 47 });
        expect(await listar('itens')).toEqual(antes);
        expect(await listar('clientes')).toHaveLength(47);
    });

    it('duas linhas com o mesmo número viram um cliente com dois itens', async () => {
        const contagem = await importarPendencias([pendencia(ANA_01), pendencia(ANA_04), pendencia(BRUNO_05)]);

        expect(contagem).toEqual({ clientesNovos: 2, itens: 3, repetidos: 0 });
        const clientes = await listar('clientes');
        expect(clientes).toHaveLength(2);
        const ana = clientes.find((c) => c.whatsapp === '5585999991234');
        const itens = await listar('itens');
        expect(itens.filter((i) => i.cliente_id === ana.id)).toHaveLength(2);
        expect(itens.every((i) => i.status === 'aberto' && i.resultado === null)).toBe(true);
    });

    it('reaproveita cliente já cadastrado e só considera repetido o item aberto', async () => {
        const { item } = await registrarPendencia(pendencia(ANA_01));
        await resolverPendencia(item.id, 'confirmou');
        const { item: aberto } = await registrarPendencia(pendencia(ANA_04));

        const contagem = await importarPendencias([
            pendencia(ANA_01),
            pendencia({ ...ANA_04, servico: '  pacote ' }),
            pendencia({ ...ANA_04, valor: '160,00' }),
        ]);

        expect(contagem).toEqual({ clientesNovos: 0, itens: 2, repetidos: 1 });
        expect(await listar('clientes')).toHaveLength(1);
        const itens = await listar('itens');
        expect(itens).toHaveLength(4);
        expect(itens.filter((i) => i.processo === '04' && i.valor_centavos === 15000)).toEqual([aberto]);
    });

    it('linha repetida no mesmo arquivo conta em repetidos', async () => {
        const contagem = await importarPendencias([pendencia(BRUNO_05), pendencia(BRUNO_05)]);
        expect(contagem).toEqual({ clientesNovos: 1, itens: 1, repetidos: 1 });
    });

    it('lista vazia e linhas inválidas não gravam nada', async () => {
        expect(await importarPendencias([])).toEqual({ clientesNovos: 0, itens: 0, repetidos: 0 });
        const invalida = lerPlanilha('nome;whatsapp;processo;data\n;123;x;\n').linhas;
        expect(await importarPendencias(invalida)).toEqual({ clientesNovos: 0, itens: 0, repetidos: 0 });
        expect(await listar('itens')).toEqual([]);
        expect(await listar('clientes')).toEqual([]);
    });

    it('cliente já guardado com o telefone é reaproveitado', async () => {
        await salvar('clientes', {
            id: 'c1',
            nome: 'Bruno',
            whatsapp: '5585988885678',
            obs: 'antigo',
            criado_em: '2026-11-01T12:00:00.000Z',
            atualizado_em: '2026-11-01T12:00:00.000Z',
        });

        const contagem = await importarPendencias([pendencia(BRUNO_05)]);

        expect(contagem).toEqual({ clientesNovos: 0, itens: 1, repetidos: 0 });
        expect((await listar('itens'))[0].cliente_id).toBe('c1');
        expect((await pegar('clientes', 'c1')).obs).toBe('antigo');
    });
});

describe('situacao', () => {
    const base = { id: 'i1', processo: '04', status: 'aberto' };
    const toque = (etapa) => ({ id: `t-${etapa}`, item_id: 'i1', etapa, enviado_em: '2026-12-01T12:00:00.000Z', respondeu: false });

    it('04 aberto com toque d7 fica sem retorno', () => {
        expect(situacao(base, [toque('d3'), toque('d7')])).toBe('sem retorno');
    });

    it('04 aberto só com d3 continua aberto', () => {
        expect(situacao(base, [toque('d3')])).toBe('aberto');
        expect(situacao(base)).toBe('aberto');
    });

    it('resolvido e cancelado valem mesmo com d7', () => {
        expect(situacao({ ...base, status: 'resolvido' }, [toque('d7')])).toBe('resolvido');
        expect(situacao({ ...base, status: 'cancelado' }, [toque('d7')])).toBe('cancelado');
    });

    it('só o 04 fica sem retorno', () => {
        expect(situacao({ ...base, processo: '05' }, [toque('d7')])).toBe('aberto');
    });
});
