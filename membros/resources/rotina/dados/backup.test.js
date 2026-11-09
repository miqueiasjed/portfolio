import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { NOME_BANCO, fechar, salvar, listar, pegar, gravarMeta, lerMeta } from './banco.js';
import { AJUSTES_PADRAO, lerAjustes, salvarAjustes } from './ajustes.js';
import { exportarBackup, importarBackup } from './backup.js';

function apagarBanco() {
    return new Promise((resolve, reject) => {
        const pedido = indexedDB.deleteDatabase(NOME_BANCO);
        pedido.onsuccess = () => resolve();
        pedido.onerror = () => reject(pedido.error);
        pedido.onblocked = () => reject(new Error('apagar o banco ficou bloqueado'));
    });
}

const AGORA = new Date('2026-12-08T12:30:00.000Z');

const ordenar = (lista, campo) => [...lista].sort((a, b) => String(a[campo]).localeCompare(String(b[campo])));

// Exportação com as listas em ordem fixa, para comparar conteúdo.
function normalizar(backup) {
    return {
        ...backup,
        clientes: ordenar(backup.clientes, 'id'),
        itens: ordenar(backup.itens, 'id'),
        toques: ordenar(backup.toques, 'id'),
        ajustes: ordenar(backup.ajustes, 'chave'),
    };
}

async function popular() {
    await salvar('clientes', { id: 'c1', nome: 'Ana', whatsapp: '5585999998888', obs: '' });
    await salvar('clientes', { id: 'c2', nome: 'Bruno', whatsapp: '5585988887777', obs: 'prefere manhã' });
    await salvar('itens', {
        id: 'i1',
        cliente_id: 'c1',
        processo: '05',
        data: '2026-12-01',
        servico: 'Limpeza',
        valor_centavos: 125000,
        status: 'aberto',
    });
    await salvar('toques', { id: 't1', item_id: 'i1', etapa: 'd1', enviado_em: '2026-12-02T13:00:00.000Z', respondeu: false });
    await salvarAjustes({ negocio: 'Clínica Sol', chave_pix: 'pix@sol.com' });
    await gravarMeta('token', 'token-do-aparelho');
}

async function conteudoAtual() {
    return {
        clientes: ordenar(await listar('clientes'), 'id'),
        itens: ordenar(await listar('itens'), 'id'),
        toques: ordenar(await listar('toques'), 'id'),
        ajustes: ordenar(await listar('ajustes'), 'chave'),
        meta: ordenar(await listar('meta'), 'chave'),
    };
}

function backupValido() {
    return {
        versao: 1,
        exportado_em: AGORA.toISOString(),
        clientes: [{ id: 'c9', nome: 'Carla', whatsapp: '5585977776666', obs: '' }],
        itens: [{ id: 'i9', cliente_id: 'c9', processo: '01', data: '2026-12-10', hora: '09:00', servico: 'Consulta', status: 'aberto' }],
        toques: [],
        ajustes: [{ ...structuredClone(AJUSTES_PADRAO), negocio: 'Estúdio Carla', segmento: 'servicos' }],
    };
}

beforeEach(async () => {
    await fechar();
    await apagarBanco();
});

describe('ajustes', () => {
    it('lerAjustes sem registro devolve o padrão', async () => {
        expect(await lerAjustes()).toEqual({
            chave: 'geral',
            segmento: 'clinica',
            negocio: '',
            assinatura: '',
            chave_pix: '',
            prazos: { orcamento: [3, 7], cobranca: [1, 5, 15] },
            variacao: 1,
        });
    });

    it('salvarAjustes({ negocio }) mantém os prazos e grava com chave geral', async () => {
        const gravado = await salvarAjustes({ negocio: 'X' });

        expect(gravado.negocio).toBe('X');
        expect(gravado.prazos).toEqual({ orcamento: [3, 7], cobranca: [1, 5, 15] });
        expect(await lerAjustes()).toEqual(gravado);
        expect((await pegar('ajustes', 'geral')).chave).toBe('geral');
        expect(await listar('ajustes')).toHaveLength(1);
    });

    it('mescla dentro de prazos e mantém o que já estava salvo', async () => {
        await salvarAjustes({ negocio: 'X', variacao: 2 });
        await salvarAjustes({ prazos: { orcamento: [2, 5] }, chave: 'outra' });

        const ajustes = await lerAjustes();
        expect(ajustes.negocio).toBe('X');
        expect(ajustes.variacao).toBe(2);
        expect(ajustes.chave).toBe('geral');
        expect(ajustes.prazos).toEqual({ orcamento: [2, 5], cobranca: [1, 5, 15] });
    });

    it('registro antigo sem alguns campos é completado pelo padrão', async () => {
        await salvar('ajustes', { chave: 'geral', negocio: 'Antigo', prazos: { cobranca: [2, 6, 20] } });

        const ajustes = await lerAjustes();
        expect(ajustes.negocio).toBe('Antigo');
        expect(ajustes.segmento).toBe('clinica');
        expect(ajustes.prazos).toEqual({ orcamento: [3, 7], cobranca: [2, 6, 20] });
    });

    it('mexer no objeto devolvido não altera o padrão', async () => {
        const ajustes = await lerAjustes();
        ajustes.prazos.orcamento.push(99);
        expect(AJUSTES_PADRAO.prazos.orcamento).toEqual([3, 7]);
        expect((await lerAjustes()).prazos.orcamento).toEqual([3, 7]);
    });
});

describe('exportarBackup', () => {
    it('segue o formato do contrato e não leva a store meta', async () => {
        await popular();

        const backup = await exportarBackup(AGORA);

        expect(Object.keys(backup).sort()).toEqual(['ajustes', 'clientes', 'exportado_em', 'itens', 'toques', 'versao']);
        expect(backup.versao).toBe(1);
        expect(backup.exportado_em).toBe('2026-12-08T12:30:00.000Z');
        expect(backup.clientes).toHaveLength(2);
        expect(backup.itens).toHaveLength(1);
        expect(backup.toques).toHaveLength(1);
        expect(backup.ajustes).toEqual([await lerAjustes()]);
        expect(JSON.stringify(backup)).not.toContain('token-do-aparelho');
    });

    it('banco vazio exporta listas vazias', async () => {
        expect(await exportarBackup(AGORA)).toEqual({
            versao: 1,
            exportado_em: AGORA.toISOString(),
            clientes: [],
            itens: [],
            toques: [],
            ajustes: [],
        });
    });
});

describe('importarBackup', () => {
    it('ida e volta: exportar, apagar tudo, importar e exportar de novo dá o mesmo conteúdo', async () => {
        await popular();
        const antes = await exportarBackup(AGORA);
        // Passa pelo texto, como num arquivo de verdade.
        const arquivo = JSON.stringify(antes);

        await fechar();
        await apagarBanco();
        expect(await listar('clientes')).toEqual([]);

        await importarBackup(JSON.parse(arquivo));
        const depois = await exportarBackup(AGORA);

        expect(normalizar(depois)).toEqual(normalizar(antes));
    });

    it('aceita o texto JSON cru do arquivo', async () => {
        await importarBackup(JSON.stringify(backupValido()));
        expect((await listar('clientes')).map((c) => c.id)).toEqual(['c9']);
    });

    it('substitui o que havia e mantém meta.token intacto', async () => {
        await popular();

        await importarBackup(backupValido());

        expect(await listar('clientes')).toEqual(backupValido().clientes);
        expect(await listar('itens')).toEqual(backupValido().itens);
        expect(await listar('toques')).toEqual([]);
        expect((await lerAjustes()).negocio).toBe('Estúdio Carla');
        expect(await lerMeta('token')).toBe('token-do-aparelho');

        const exportado = await exportarBackup(AGORA);
        expect(JSON.stringify(exportado)).not.toContain('token-do-aparelho');
    });

    it('ignora um meta vindo no arquivo', async () => {
        await gravarMeta('token', 'token-do-aparelho');
        const dados = { ...backupValido(), meta: [{ chave: 'token', valor: 'intruso' }] };

        await importarBackup(dados);

        expect(await lerMeta('token')).toBe('token-do-aparelho');
    });

    const invalidos = {
        'sem versao': () => {
            const d = backupValido();
            delete d.versao;
            return d;
        },
        'versao desconhecida': () => ({ ...backupValido(), versao: 2 }),
        'versao como texto': () => ({ ...backupValido(), versao: '1' }),
        'sem a lista de toques': () => {
            const d = backupValido();
            delete d.toques;
            return d;
        },
        'clientes que não é lista': () => ({ ...backupValido(), clientes: { c9: { id: 'c9' } } }),
        'ajustes que não é lista': () => ({ ...backupValido(), ajustes: { chave: 'geral' } }),
        'cliente sem id': () => ({ ...backupValido(), clientes: [{ nome: 'Sem id' }] }),
        'ajuste sem chave': () => ({ ...backupValido(), ajustes: [{ negocio: 'Sem chave' }] }),
        'registro nulo': () => ({ ...backupValido(), itens: [null] }),
        nulo: () => null,
        lista: () => [],
        'texto que não é JSON': () => '{ isso não é json',
    };

    for (const [caso, montar] of Object.entries(invalidos)) {
        it(`recusa backup inválido (${caso}) sem apagar nada`, async () => {
            await popular();
            const antes = await conteudoAtual();

            await expect(importarBackup(montar())).rejects.toThrow('Arquivo de backup inválido.');

            expect(await conteudoAtual()).toEqual(antes);
        });
    }

    it('falha ao gravar no meio desfaz tudo', async () => {
        await popular();
        const antes = await conteudoAtual();
        // Função não pode ser gravada no IndexedDB: o put falha depois dos clear.
        const dados = { ...backupValido(), toques: [{ id: 't9', item_id: 'i9', estranho: () => 1 }] };

        await expect(importarBackup(dados)).rejects.toThrow('Arquivo de backup inválido.');

        expect(await conteudoAtual()).toEqual(antes);
    });
});
