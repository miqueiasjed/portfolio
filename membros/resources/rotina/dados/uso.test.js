import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NOME_BANCO, fechar, gravarMeta, lerMeta, salvar } from './banco.js';
import { avisar, definirAoRegistrar, marcarRespondeu, registrarToque } from './registro.js';
import { resolverPendencia } from './pendencias.js';
import { contar, ligarContagem, lotesParaEnviar, marcarEnviados } from './uso.js';
import { hojeEmFortaleza, somarDias } from '../regras/datas.js';

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

// Meio-dia de Fortaleza (15h UTC) do dia informado.
function meioDia(dia) {
    return `${dia}T15:00:00.000Z`;
}

beforeEach(async () => {
    await fechar();
    await apagarBanco();
    definirAoRegistrar(null);
});

afterEach(() => {
    definirAoRegistrar(null);
});

describe('ligarContagem com o registro de verdade', () => {
    it('registrarToque, marcarRespondeu e resolverPendencia mudam a fila_uso', async () => {
        // Datas de agora: resolverPendencia usa o relógio, e a poda de 40 dias
        // apagaria um dia fixo quando o teste rodasse muito depois.
        ligarContagem();
        await salvar('itens', item());
        const agora = new Date().toISOString();
        const hoje = hojeEmFortaleza(new Date(agora));
        const lerHoje = async () => (await lerMeta('fila_uso'))?.dias[hoje];

        const toque = await registrarToque({ itemId: 'i1', etapa: 'd3', enviadoEm: agora });
        await vi.waitFor(async () => expect((await lerHoje())?.enviados).toBe(1));

        await marcarRespondeu(toque.id, agora);
        await vi.waitFor(async () => expect((await lerHoje()).respostas).toBe(1));

        await resolverPendencia('i1', 'fechou');
        await vi.waitFor(async () => expect((await lerHoje()).resolvidos).toBe(1));

        const fila = await lerMeta('fila_uso');
        expect(fila.dias[hoje]).toEqual({ enviados: 1, respostas: 1, resolvidos: 1, por_processo: { '04': 1 } });
        expect(fila.alterados).toEqual([hoje]);
    });

    it('toque repetido na mesma etapa não conta duas vezes', async () => {
        ligarContagem();
        await salvar('itens', item());

        await registrarToque({ itemId: 'i1', etapa: 'd3', enviadoEm: '2026-12-04T13:05:00.000Z' });
        await vi.waitFor(async () => {
            expect((await lerMeta('fila_uso'))?.dias['2026-12-04']?.enviados).toBe(1);
        });
        await registrarToque({ itemId: 'i1', etapa: 'd3', enviadoEm: '2026-12-04T14:00:00.000Z' });
        await new Promise((resolve) => setTimeout(resolve, 20));

        expect((await lerMeta('fila_uso')).dias['2026-12-04'].enviados).toBe(1);
    });

    it('erro na contagem não atrapalha o registro', async () => {
        ligarContagem();
        expect(() => avisar('toque', { processo: '01', quando: 'lixo' })).not.toThrow();
        await expect(contar('toque', { processo: '01', quando: 'lixo' })).rejects.toThrow();

        await salvar('itens', item());
        const toque = await registrarToque({ itemId: 'i1', etapa: 'd3', enviadoEm: '2026-12-04T13:05:00.000Z' });
        expect(toque.etapa).toBe('d3');
    });
});

describe('contar', () => {
    it('toque às 23h50 de Fortaleza conta no dia local, não no dia UTC', async () => {
        await contar('toque', { processo: '01', quando: '2026-12-09T02:50:00.000Z' });

        const fila = await lerMeta('fila_uso');
        expect(Object.keys(fila.dias)).toEqual(['2026-12-08']);
        expect(fila.alterados).toEqual(['2026-12-08']);
    });

    it('três toques em 01, 01 e 05 somam por processo', async () => {
        const quando = meioDia('2026-12-09');
        await contar('toque', { processo: '01', quando });
        await contar('toque', { processo: '01', quando });
        await contar('toque', { processo: '05', quando });

        const fila = await lerMeta('fila_uso');
        expect(fila.dias['2026-12-09']).toEqual({
            enviados: 3,
            respostas: 0,
            resolvidos: 0,
            por_processo: { '01': 2, '05': 1 },
        });
        expect(fila.alterados).toEqual(['2026-12-09']);
    });

    it('dois contar sem await entre eles somam 2', async () => {
        const quando = meioDia('2026-12-09');
        await Promise.all([
            contar('toque', { processo: '01', quando }),
            contar('resposta', { processo: '01', quando }),
            contar('toque', { processo: '01', quando }),
        ]);

        const dia = (await lerMeta('fila_uso')).dias['2026-12-09'];
        expect(dia.enviados).toBe(2);
        expect(dia.respostas).toBe(1);
        expect(dia.por_processo).toEqual({ '01': 2 });
    });

    it('resposta e resolvido não mexem em por_processo; evento desconhecido é ignorado', async () => {
        const quando = meioDia('2026-12-09');
        await contar('resposta', { processo: '01', quando });
        await contar('resolvido', { processo: '01', quando });
        await contar('outro', { processo: '01', quando });

        expect((await lerMeta('fila_uso')).dias['2026-12-09']).toEqual({
            enviados: 0,
            respostas: 1,
            resolvidos: 1,
            por_processo: {},
        });
    });

    it('processo fora do formato não vira chave', async () => {
        await contar('toque', { processo: 'abc', quando: meioDia('2026-12-09') });
        await contar('toque', { processo: null, quando: meioDia('2026-12-09') });

        const dia = (await lerMeta('fila_uso')).dias['2026-12-09'];
        expect(dia.enviados).toBe(2);
        expect(dia.por_processo).toEqual({});
    });

    it('remove dias com mais de 40 dias antes do mais novo', async () => {
        await contar('toque', { processo: '01', quando: meioDia('2026-10-01') });
        await contar('toque', { processo: '01', quando: meioDia('2026-10-02') });
        await contar('toque', { processo: '01', quando: meioDia('2026-11-11') });

        const fila = await lerMeta('fila_uso');
        expect(Object.keys(fila.dias).sort()).toEqual(['2026-10-02', '2026-11-11']);
        expect(fila.alterados).toEqual(['2026-10-02', '2026-11-11']);
    });
});

describe('lotesParaEnviar e marcarEnviados', () => {
    it('40 dias alterados viram dois lotes (31 e 9), do mais antigo ao mais novo', async () => {
        const inicio = '2026-11-01';
        const dias = Array.from({ length: 40 }, (_, i) => somarDias(inicio, i));
        // Grava fora de ordem para conferir a ordenação.
        for (const dia of [...dias].reverse()) {
            await contar('toque', { processo: '01', quando: meioDia(dia) });
        }

        const lotes = await lotesParaEnviar();
        expect(lotes.map((l) => l.length)).toEqual([31, 9]);
        expect(lotes.flat().map((d) => d.dia)).toEqual(dias);
        for (const d of lotes.flat()) {
            expect(Object.keys(d).sort()).toEqual(['dia', 'enviados', 'por_processo', 'resolvidos', 'respostas']);
        }
    });

    it('dia em alterados que já não existe em dias não entra', async () => {
        await gravarMeta('fila_uso', {
            dias: { '2026-12-09': { enviados: 1, respostas: 0, resolvidos: 0, por_processo: { '01': 1 } } },
            alterados: ['2026-10-01', '2026-12-09'],
            ultimo_envio_em: null,
        });

        const lotes = await lotesParaEnviar();
        expect(lotes).toEqual([
            [{ dia: '2026-12-09', enviados: 1, respostas: 0, resolvidos: 0, por_processo: { '01': 1 } }],
        ]);
    });

    it('sem nada alterado devolve lista vazia', async () => {
        expect(await lotesParaEnviar()).toEqual([]);
    });

    it('marcarEnviados tira o dia e um toque novo volta com o total 4', async () => {
        const quando = meioDia('2026-12-09');
        for (const processo of ['01', '01', '05']) {
            await contar('toque', { processo, quando });
        }
        const [lote] = await lotesParaEnviar();
        await marcarEnviados(lote, new Date('2026-12-09T16:00:00.000Z'));

        let fila = await lerMeta('fila_uso');
        expect(fila.alterados).toEqual([]);
        expect(fila.ultimo_envio_em).toBe('2026-12-09T16:00:00.000Z');
        expect(fila.dias['2026-12-09'].enviados).toBe(3);
        expect(await lotesParaEnviar()).toEqual([]);

        await contar('toque', { processo: '05', quando });
        fila = await lerMeta('fila_uso');
        expect(fila.alterados).toEqual(['2026-12-09']);
        const [[dia]] = await lotesParaEnviar();
        expect(dia).toEqual({
            dia: '2026-12-09',
            enviados: 4,
            respostas: 0,
            resolvidos: 0,
            por_processo: { '01': 2, '05': 2 },
        });
    });

    it('toque entre lotesParaEnviar e marcarEnviados deixa o dia em alterados com o total novo', async () => {
        await contar('toque', { processo: '01', quando: meioDia('2026-12-08') });
        await contar('toque', { processo: '01', quando: meioDia('2026-12-09') });
        const [lote] = await lotesParaEnviar();

        await contar('toque', { processo: '01', quando: meioDia('2026-12-09') });
        await marcarEnviados(lote, '2026-12-09T16:00:00.000Z');

        const fila = await lerMeta('fila_uso');
        expect(fila.alterados).toEqual(['2026-12-09']);
        const [[dia]] = await lotesParaEnviar();
        expect(dia.enviados).toBe(2);
    });

    it('marcarEnviados recusa lista de textos', async () => {
        await expect(marcarEnviados(['2026-12-09'])).rejects.toThrow(TypeError);
    });

    it('fila_uso serializada só tem datas e chaves de processo como texto', async () => {
        ligarContagem();
        await salvar('itens', item({ processo: '01', servico: 'Corte de cabelo' }));
        const agora = new Date().toISOString();
        const toque = await registrarToque({ itemId: 'i1', etapa: 'd1', enviadoEm: agora });
        await marcarRespondeu(toque.id, agora);
        await resolverPendencia('i1', 'confirmou');
        await vi.waitFor(async () => {
            const fila = await lerMeta('fila_uso');
            expect(fila?.dias[hojeEmFortaleza(new Date(agora))]?.resolvidos).toBe(1);
        });
        const [lote] = await lotesParaEnviar();
        await marcarEnviados(lote, '2026-12-09T16:00:00.000Z');

        const texto = JSON.stringify(await lerMeta('fila_uso'));
        const textos = texto.match(/"[^"]*"/g).map((s) => s.slice(1, -1));
        const permitidos = new Set(['dias', 'alterados', 'ultimo_envio_em', 'enviados', 'respostas', 'resolvidos', 'por_processo']);
        for (const t of textos) {
            const ehData = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}\.\d{3}Z)?$/.test(t);
            const ehProcesso = /^\d{2}$/.test(t);
            expect(ehData || ehProcesso || permitidos.has(t), `texto inesperado: ${t}`).toBe(true);
        }
        expect(texto).not.toContain('i1');
        expect(texto).not.toContain('Corte');
    });
});
