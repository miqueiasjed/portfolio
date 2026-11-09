import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { NOME_BANCO, fechar, salvar, listar } from '../dados/banco.js';
import { salvarAjustes } from '../dados/ajustes.js';
import { exportarBackup, importarBackup } from '../dados/backup.js';
import { ERRO_NAO_E_COPIA, ERRO_VERSAO_NOVA, lerCopia, nomeDoArquivoDeCopia, textoDaCopia } from './copia.js';

function apagarBanco() {
    return new Promise((resolve, reject) => {
        const pedido = indexedDB.deleteDatabase(NOME_BANCO);
        pedido.onsuccess = () => resolve();
        pedido.onerror = () => reject(pedido.error);
        pedido.onblocked = () => reject(new Error('apagar o banco ficou bloqueado'));
    });
}

const ordenar = (lista, campo) => [...lista].sort((a, b) => String(a[campo]).localeCompare(String(b[campo])));

// Listas em ordem fixa e sem `exportado_em`, para comparar só o conteúdo.
function conteudo(backup) {
    const { exportado_em: _ignorado, ...resto } = backup;
    return {
        ...resto,
        clientes: ordenar(backup.clientes, 'id'),
        itens: ordenar(backup.itens, 'id'),
        toques: ordenar(backup.toques, 'id'),
        ajustes: ordenar(backup.ajustes, 'chave'),
    };
}

function copiaValida() {
    return {
        versao: 1,
        exportado_em: '2026-12-08T12:30:00.000Z',
        clientes: [
            { id: 'c1', nome: 'Ana', whatsapp: '5585999998888', obs: '' },
            { id: 'c2', nome: 'Bruno', whatsapp: '5585988887777', obs: '' },
        ],
        itens: [
            { id: 'i1', cliente_id: 'c1', processo: '01', status: 'aberto' },
            { id: 'i2', cliente_id: 'c1', processo: '05', status: 'resolvido' },
            { id: 'i3', cliente_id: 'c2', processo: '04', status: 'aberto' },
            { id: 'i4', cliente_id: 'c2', processo: '05', status: 'cancelado' },
        ],
        toques: [{ id: 't1', item_id: 'i1', etapa: 'vespera', enviado_em: '2026-12-07T13:00:00.000Z', respondeu: false }],
        ajustes: [{ chave: 'geral', negocio: 'Clínica Sol' }],
    };
}

async function popular() {
    await salvar('clientes', { id: 'c1', nome: 'Ana Souza', whatsapp: '5585999998888', obs: '' });
    await salvar('clientes', { id: 'c2', nome: 'Bruno Lima', whatsapp: '5585988887777', obs: 'prefere manhã' });
    await salvar('clientes', { id: 'c3', nome: 'Carla Dias', whatsapp: '5585977776666', obs: '' });

    const base = { data: '2026-12-01', hora: '', resultado: '', criado_em: '2026-11-30T12:00:00.000Z', atualizado_em: '2026-11-30T12:00:00.000Z' };
    await salvar('itens', { ...base, id: 'i1', cliente_id: 'c1', processo: '01', data: '2026-12-09', hora: '09:00', servico: 'Consulta', valor_centavos: 0, status: 'aberto' });
    await salvar('itens', { ...base, id: 'i2', cliente_id: 'c1', processo: '05', servico: 'Limpeza', valor_centavos: 125000, status: 'aberto' });
    await salvar('itens', { ...base, id: 'i3', cliente_id: 'c2', processo: '04', servico: 'Clareamento', valor_centavos: 89000, status: 'aberto' });
    await salvar('itens', { ...base, id: 'i4', cliente_id: 'c2', processo: '05', servico: 'Revisão', valor_centavos: 30000, status: 'resolvido', resultado: 'pago' });
    await salvar('itens', { ...base, id: 'i5', cliente_id: 'c3', processo: '04', servico: 'Faceta', valor_centavos: 450000, status: 'cancelado' });

    await salvar('toques', { id: 't1', item_id: 'i2', etapa: 'd1', enviado_em: '2026-12-02T13:00:00.000Z', respondeu: false });
    await salvar('toques', { id: 't2', item_id: 'i2', etapa: 'd5', enviado_em: '2026-12-06T13:00:00.000Z', respondeu: true });
    await salvar('toques', { id: 't3', item_id: 'i3', etapa: 'd3', enviado_em: '2026-12-04T13:00:00.000Z', respondeu: false });
    await salvar('toques', { id: 't4', item_id: 'i4', etapa: 'd1', enviado_em: '2026-12-02T14:00:00.000Z', respondeu: true });

    await salvarAjustes({ negocio: 'Clínica Sol', assinatura: 'Equipe Sol', chave_pix: 'pix@sol.com', segmento: 'clinica' });
}

describe('textoDaCopia', () => {
    it('gera JSON indentado com dois espaços', () => {
        const dados = { versao: 1, clientes: [] };
        expect(textoDaCopia(dados)).toBe(JSON.stringify(dados, null, 2));
        expect(textoDaCopia(dados)).toContain('\n  "versao": 1');
    });
});

describe('nomeDoArquivoDeCopia', () => {
    it('leva a data do dia no nome', () => {
        expect(nomeDoArquivoDeCopia('2026-12-08')).toBe('rotina-do-dia-copia-2026-12-08.json');
    });
});

describe('lerCopia', () => {
    it('cópia válida devolve os dados e o resumo', () => {
        const copia = copiaValida();
        const lido = lerCopia(textoDaCopia(copia));

        expect(lido.ok).toBe(true);
        expect(lido.dados).toEqual(copia);
        expect(lido.resumo).toEqual({ clientes: 2, pendencias: 2 });
    });

    it('resumo conta só as pendências abertas', () => {
        const copia = copiaValida();
        copia.itens = copia.itens.map((item) => ({ ...item, status: 'resolvido' }));

        expect(lerCopia(textoDaCopia(copia)).resumo).toEqual({ clientes: 2, pendencias: 0 });
    });

    it('cópia com listas vazias é válida', () => {
        const vazia = { versao: 1, exportado_em: '2026-12-08T12:30:00.000Z', clientes: [], itens: [], toques: [], ajustes: [] };
        expect(lerCopia(textoDaCopia(vazia))).toEqual({ ok: true, dados: vazia, resumo: { clientes: 0, pendencias: 0 } });
    });

    it('versão mais nova pede para atualizar a página', () => {
        expect(lerCopia(textoDaCopia({ ...copiaValida(), versao: 2 }))).toEqual({ ok: false, erro: ERRO_VERSAO_NOVA });
        // Mesmo que o formato da versão nova seja outro.
        expect(lerCopia('{"versao":3,"pessoas":[]}')).toEqual({ ok: false, erro: ERRO_VERSAO_NOVA });
        expect(ERRO_VERSAO_NOVA).toBe('Essa cópia veio de uma versão mais nova da ferramenta. Atualize a página e tente de novo.');
    });

    const semLista = (nome) => () => {
        const c = copiaValida();
        delete c[nome];
        return textoDaCopia(c);
    };
    const comCliente = (cliente) => () => textoDaCopia({ ...copiaValida(), clientes: [cliente] });
    const comItem = (item) => () => textoDaCopia({ ...copiaValida(), itens: [item] });

    const naoSaoCopia = {
        'JSON quebrado': () => '{ isso não é json',
        'texto vazio': () => '',
        'JSON de outra coisa': () => '{"a":1}',
        'lista em vez de objeto': () => '[]',
        nulo: () => 'null',
        'número solto': () => '1',
        'conteúdo que não é texto': () => copiaValida(),
        'sem versao': () => {
            const c = copiaValida();
            delete c.versao;
            return textoDaCopia(c);
        },
        'versao como texto': () => textoDaCopia({ ...copiaValida(), versao: '1' }),
        'versao zero': () => textoDaCopia({ ...copiaValida(), versao: 0 }),
        'versao quebrada': () => textoDaCopia({ ...copiaValida(), versao: 1.5 }),
        'sem clientes': semLista('clientes'),
        'sem itens': semLista('itens'),
        'sem toques': semLista('toques'),
        'sem ajustes': semLista('ajustes'),
        'ajustes como objeto': () => textoDaCopia({ ...copiaValida(), ajustes: { chave: 'geral' } }),
        'cliente sem id': comCliente({ nome: 'Ana', whatsapp: '5585999998888' }),
        'cliente sem nome': comCliente({ id: 'c1', whatsapp: '5585999998888' }),
        'cliente com nome em branco': comCliente({ id: 'c1', nome: '  ', whatsapp: '5585999998888' }),
        'cliente sem whatsapp': comCliente({ id: 'c1', nome: 'Ana' }),
        'cliente nulo': comCliente(null),
        'item sem id': comItem({ cliente_id: 'c1', processo: '01', status: 'aberto' }),
        'item sem cliente_id': comItem({ id: 'i1', processo: '01', status: 'aberto' }),
        'item sem processo': comItem({ id: 'i1', cliente_id: 'c1', status: 'aberto' }),
        'item com processo fora da lista': comItem({ id: 'i1', cliente_id: 'c1', processo: '02', status: 'aberto' }),
        'item com processo numérico': comItem({ id: 'i1', cliente_id: 'c1', processo: 1, status: 'aberto' }),
        'toque sem id': () => textoDaCopia({ ...copiaValida(), toques: [{ item_id: 'i1' }] }),
        'ajuste sem chave': () => textoDaCopia({ ...copiaValida(), ajustes: [{ negocio: 'Sem chave' }] }),
    };

    for (const [caso, montar] of Object.entries(naoSaoCopia)) {
        it(`recusa como arquivo que não é cópia (${caso})`, () => {
            expect(lerCopia(montar())).toEqual({ ok: false, erro: ERRO_NAO_E_COPIA });
        });
    }

    it('mensagem de arquivo que não é cópia', () => {
        expect(ERRO_NAO_E_COPIA).toBe('Esse arquivo não é uma cópia da Rotina do Dia.');
    });
});

describe('ida e volta pelo arquivo', () => {
    beforeEach(async () => {
        await fechar();
        await apagarBanco();
    });

    it('baixar e restaurar num aparelho limpo devolve os mesmos dados', async () => {
        await popular();
        const antes = await exportarBackup(new Date('2026-12-08T12:30:00.000Z'));
        expect(antes.clientes).toHaveLength(3);
        expect(antes.itens).toHaveLength(5);
        expect(antes.toques).toHaveLength(4);
        expect(antes.ajustes).toHaveLength(1);

        const arquivo = textoDaCopia(antes);

        await fechar();
        await apagarBanco();
        expect(await listar('clientes')).toEqual([]);

        const lido = lerCopia(arquivo);
        expect(lido.ok).toBe(true);
        expect(lido.resumo).toEqual({ clientes: 3, pendencias: 3 });

        await importarBackup(lido.dados);
        const depois = await exportarBackup(new Date('2026-12-09T08:00:00.000Z'));

        expect(conteudo(depois)).toEqual(conteudo(antes));
    });
});
