import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NOME_BANCO, fechar, listar, pegar } from './dados/banco.js';
import { registrarPendencia, resolverPendencia } from './dados/pendencias.js';
import { definirAoRegistrar, registrarToque } from './dados/registro.js';
import { lerAjustes, salvarAjustes } from './dados/ajustes.js';
import { listaDeHoje } from './regras/hoje.js';
import { escolherTexto, mensagemPronta, preencher, valoresDaMensagem } from './regras/preencher.js';
import { textos } from './textos/textos.js';

// Fluxo inteiro no aparelho: pendência gravada, lista do dia, "Enviei" e a
// etapa seguinte. Datas sempre fixas; nada lê o relógio para decidir o dia.

function apagarBanco() {
    return new Promise((resolve, reject) => {
        const pedido = indexedDB.deleteDatabase(NOME_BANCO);
        pedido.onsuccess = () => resolve();
        pedido.onerror = () => reject(pedido.error);
        pedido.onblocked = () => reject(new Error('apagar o banco ficou bloqueado'));
    });
}

// 09:00 em Fortaleza (UTC-3) do dia `YYYY-MM-DD`.
const manha = (dia) => `${dia}T12:00:00.000Z`;

async function nova(processo, data, extra = {}) {
    const { item } = await registrarPendencia({
        cliente: { nome: 'Ana Souza', whatsapp: '5585999991234' },
        item: { processo, data, hora: processo === '01' ? '14:30' : null, servico: 'Pacote', valor_centavos: 15000, ...extra },
    });
    return item;
}

// Lista do dia lida do banco, como a tela Hoje faz: `[[item_id, etapa]]`.
async function listaDo(hoje) {
    const [itens, toques, clientes, ajustes] = await Promise.all([
        listar('itens'),
        listar('toques'),
        listar('clientes'),
        lerAjustes(),
    ]);
    return listaDeHoje({ itens, toques, clientes, hoje, ajustes }).map((e) => [e.item.id, e.etapa]);
}

const tocar = (item, etapa, enviadoEm) => registrarToque({ itemId: item.id, etapa, enviadoEm });

beforeEach(async () => {
    await fechar();
    await apagarBanco();
    definirAoRegistrar(null);
});

afterEach(async () => {
    await fechar();
});

describe('cobrança vencida em 01/12, prazos padrão', () => {
    it('d1 em 02/12, sai depois do toque, d5 só em 06/12', async () => {
        const item = await nova('05', '2026-12-01');

        expect(await listaDo('2026-12-01')).toEqual([]);
        expect(await listaDo('2026-12-02')).toEqual([[item.id, 'd1']]);

        await tocar(item, 'd1', manha('2026-12-02'));

        expect(await listaDo('2026-12-02')).toEqual([]);
        expect(await listaDo('2026-12-05')).toEqual([]);
        expect(await listaDo('2026-12-06')).toEqual([[item.id, 'd5']]);
    });
});

describe('orçamento de 01/12', () => {
    it('d3 em 04/12; depois do toque, d7 só em 08/12', async () => {
        const item = await nova('04', '2026-12-01');

        expect(await listaDo('2026-12-03')).toEqual([]);
        expect(await listaDo('2026-12-04')).toEqual([[item.id, 'd3']]);

        await tocar(item, 'd3', manha('2026-12-04'));

        expect(await listaDo('2026-12-04')).toEqual([]);
        expect(await listaDo('2026-12-07')).toEqual([]);
        expect(await listaDo('2026-12-08')).toEqual([[item.id, 'd7']]);
    });

    it('com prazos [2, 5] nos ajustes, d3 aparece em 03/12', async () => {
        await salvarAjustes({ prazos: { orcamento: [2, 5] } });
        const item = await nova('04', '2026-12-01');

        expect(await listaDo('2026-12-02')).toEqual([]);
        expect(await listaDo('2026-12-03')).toEqual([[item.id, 'd3']]);
    });
});

describe('confirmação de 15/12', () => {
    it('aparece na véspera, some depois do toque e, confirmada, fica fora em qualquer dia', async () => {
        const item = await nova('01', '2026-12-15');

        expect(await listaDo('2026-12-13')).toEqual([]);
        expect(await listaDo('2026-12-14')).toEqual([[item.id, 'vespera']]);

        await tocar(item, 'vespera', manha('2026-12-14'));
        expect(await listaDo('2026-12-14')).toEqual([]);

        await resolverPendencia(item.id, 'confirmou');
        expect((await pegar('itens', item.id)).status).toBe('resolvido');
        for (const dia of ['2026-12-13', '2026-12-14', '2026-12-15', '2026-12-16']) {
            expect(await listaDo(dia), dia).toEqual([]);
        }
    });

    it('confirmada sem toque também fica fora da véspera', async () => {
        const item = await nova('01', '2026-12-15');
        await resolverPendencia(item.id, 'confirmou');
        expect(await listaDo('2026-12-14')).toEqual([]);
    });
});

describe('"Ainda não"', () => {
    it('sem toque, o item continua na lista do mesmo dia', async () => {
        const item = await nova('05', '2026-12-01');

        expect(await listaDo('2026-12-02')).toEqual([[item.id, 'd1']]);
        // O dono voltou do WhatsApp e respondeu "Ainda não": nada é gravado.
        expect(await listar('toques')).toEqual([]);
        expect(await listaDo('2026-12-02')).toEqual([[item.id, 'd1']]);
    });
});

describe('toque atrasado', () => {
    it.each([
        ['texto ISO', '2026-12-04T12:00:00.000Z'],
        ['Date', new Date('2026-12-04T12:00:00.000Z')],
    ])('d1 tocado só em 04/12 (%s): d5 em 08/12 e não antes', async (_forma, enviadoEm) => {
        const item = await nova('05', '2026-12-01');

        const toque = await tocar(item, 'd1', enviadoEm);
        expect(toque.enviado_em).toBe('2026-12-04T12:00:00.000Z');
        expect((await pegar('toques', toque.id)).enviado_em).toBe('2026-12-04T12:00:00.000Z');

        for (const dia of ['2026-12-04', '2026-12-05', '2026-12-06', '2026-12-07']) {
            expect(await listaDo(dia), dia).toEqual([]);
        }
        expect(await listaDo('2026-12-08')).toEqual([[item.id, 'd5']]);
    });
});

describe('ajustes mudam o texto da cobrança', () => {
    const cliente = { nome: 'ana souza' };
    const item = { processo: '05', data: '2026-12-01', servico: 'Limpeza', valor_centavos: 125000 };
    const base = { segmento: 'clinica', variacao: 1, negocio: 'Clínica Sol', assinatura: 'Paula', chave_pix: 'pix@sol.com.br' };
    const texto = escolherTexto(textos, { processo: '05', etapa: 'd1', segmento: 'clinica', variacao: 1 });
    const montar = (ajustes) => preencher(texto, valoresDaMensagem({ cliente, item, ajustes }));

    it('o texto de cobrança existe e sai com assinatura e Pix', () => {
        expect(texto).toEqual(expect.any(String));
        const pronto = montar(base);
        expect(pronto).toContain('Paula');
        expect(pronto).toContain('pix@sol.com.br');
        expect(pronto).toContain('R$ 1.250,00');
    });

    it('trocar a assinatura muda o resultado', () => {
        const outra = montar({ ...base, assinatura: 'Rita' });
        expect(outra).not.toBe(montar(base));
        expect(outra).toContain('Rita');
        expect(outra).not.toContain('Paula');
    });

    it('trocar a chave Pix muda o resultado', () => {
        const outra = montar({ ...base, chave_pix: '85999991234' });
        expect(outra).not.toBe(montar(base));
        expect(outra).toContain('85999991234');
    });

    it('chave Pix vazia tira o Pix da mensagem', () => {
        const sem = montar({ ...base, chave_pix: '' });
        expect(sem).not.toMatch(/pix/i);
        expect(sem).toContain('Paula');
    });

    it('trocar o segmento escolhe outro texto', () => {
        const outroTexto = escolherTexto(textos, { processo: '05', etapa: 'd1', segmento: 'servicos', variacao: 1 });
        expect(outroTexto).toEqual(expect.any(String));
        expect(outroTexto).not.toBe(texto);

        const clinica = mensagemPronta({ textos, item, cliente, ajustes: base, etapa: 'd1' });
        const servicos = mensagemPronta({ textos, item, cliente, ajustes: { ...base, segmento: 'servicos' }, etapa: 'd1' });
        expect(servicos).not.toBe(clinica);
        expect(servicos).toBe(preencher(outroTexto, valoresDaMensagem({ cliente, item, ajustes: base })));
    });
});
