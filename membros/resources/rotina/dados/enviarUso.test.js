import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NOME_BANCO, fechar, gravarMeta, lerMeta } from './banco.js';
import { contar } from './uso.js';
import { enviarAgora, iniciarEnvioDeUso } from './enviarUso.js';
import { somarDias } from '../regras/datas.js';

const HOJE = '2026-12-10';
// Meio-dia de Fortaleza (15h UTC) de HOJE.
const AGORA = new Date(`${HOJE}T15:00:00.000Z`);
const CHAVES_DO_DIA = ['dia', 'enviados', 'respostas', 'resolvidos', 'por_processo'].sort();

function apagarBanco() {
    return new Promise((resolve, reject) => {
        const pedido = indexedDB.deleteDatabase(NOME_BANCO);
        pedido.onsuccess = () => resolve();
        pedido.onerror = () => reject(pedido.error);
        pedido.onblocked = () => reject(new Error('apagar o banco ficou bloqueado'));
    });
}

function total(campos = {}) {
    return { enviados: 1, respostas: 0, resolvidos: 0, por_processo: { '04': 1 }, ...campos };
}

// Grava a fila com os dias informados, todos em `alterados`.
async function guardarDias(dias, campos = {}) {
    const fila = { dias: {}, alterados: [], ultimo_envio_em: null };
    for (const dia of dias) {
        fila.dias[dia] = total(campos[dia]);
        fila.alterados.push(dia);
    }
    await gravarMeta('fila_uso', fila);
}

// Dias seguidos terminando em `ate`.
function diasAte(ate, quantos) {
    return Array.from({ length: quantos }, (_, i) => somarDias(ate, i - quantos + 1));
}

function json(status, corpo = {}) {
    return new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } });
}

function html(status) {
    return new Response('<html>erro</html>', { status, headers: { 'content-type': 'text/html' } });
}

// fetch falso: `responder` recebe os dias do corpo e devolve a resposta.
function fetchFalso(responder = () => new Response(null, { status: 204 })) {
    return vi.fn(async (_url, opcoes) => responder(JSON.parse(opcoes.body).dias));
}

function diasDoCorpo(chamada) {
    return JSON.parse(chamada[1].body).dias.map((d) => d.dia);
}

async function alterados() {
    return (await lerMeta('fila_uso')).alterados;
}

beforeEach(async () => {
    await fechar();
    await apagarBanco();
    await gravarMeta('token', 'token-do-aparelho');
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('enviarAgora', () => {
    it('204 tira os dias de alterados e grava ultimo_envio_em', async () => {
        await guardarDias([somarDias(HOJE, -1), HOJE]);
        const fetch = fetchFalso();

        const resultado = await enviarAgora({ fetch, agora: AGORA });

        expect(resultado).toEqual({ enviados: 2, descartados: 0, parou: null });
        expect(fetch).toHaveBeenCalledTimes(1);
        const fila = await lerMeta('fila_uso');
        expect(fila.alterados).toEqual([]);
        expect(fila.ultimo_envio_em).toBe(AGORA.toISOString());
        expect(fila.dias[HOJE]).toEqual(total());
    });

    it('manda URL sem query string, Bearer, sem cookie e corpo só com dias e as cinco chaves', async () => {
        await guardarDias([HOJE]);
        const fetch = fetchFalso();

        await enviarAgora({ fetch, agora: AGORA });

        const [url, opcoes] = fetch.mock.calls[0];
        expect(url).toBe('/rotina/uso');
        expect(opcoes.method).toBe('POST');
        expect(opcoes.credentials).toBe('omit');
        expect(opcoes.headers).toEqual({
            Authorization: 'Bearer token-do-aparelho',
            'Content-Type': 'application/json',
            Accept: 'application/json',
        });
        const corpo = JSON.parse(opcoes.body);
        expect(Object.keys(corpo)).toEqual(['dias']);
        expect(corpo.dias).toHaveLength(1);
        expect(Object.keys(corpo.dias[0]).sort()).toEqual(CHAVES_DO_DIA);
        expect(corpo.dias[0]).toEqual({ dia: HOJE, ...total() });
    });

    it('40 dias alterados geram duas requisições, 31 e 9, na ordem', async () => {
        const dias = diasAte(HOJE, 40);
        await guardarDias(dias);
        const fetch = fetchFalso();

        const resultado = await enviarAgora({ fetch, agora: AGORA });

        expect(fetch).toHaveBeenCalledTimes(2);
        expect(diasDoCorpo(fetch.mock.calls[0])).toEqual(dias.slice(0, 31));
        expect(diasDoCorpo(fetch.mock.calls[1])).toEqual(dias.slice(31));
        expect(resultado.enviados).toBe(40);
        expect(await alterados()).toEqual([]);
    });

    it.each([401, 403])('%i com JSON no primeiro lote: nada sai e o segundo lote não vai', async (status) => {
        const dias = diasAte(HOJE, 40);
        await guardarDias(dias);
        const fetch = fetchFalso(() => json(status, { motivo: status === 401 ? 'aparelho' : 'compra' }));

        const resultado = await enviarAgora({ fetch, agora: AGORA });

        expect(fetch).toHaveBeenCalledTimes(1);
        expect(resultado).toEqual({ enviados: 0, descartados: 0, parou: 'recusado' });
        expect(await alterados()).toEqual(dias);
    });

    it('401 em HTML conta como sem rede, não como recusa, e não apaga nada', async () => {
        await guardarDias([HOJE]);
        const fetch = fetchFalso(() => html(401));

        const resultado = await enviarAgora({ fetch, agora: AGORA });

        expect(resultado.parou).toBe('rede');
        expect(await alterados()).toEqual([HOJE]);
        expect((await lerMeta('fila_uso')).ultimo_envio_em).toBeNull();
    });

    it('erro de rede: nada apagado e a função não lança', async () => {
        await guardarDias([HOJE]);
        const fetch = vi.fn(async () => {
            throw new TypeError('Failed to fetch');
        });

        const resultado = await enviarAgora({ fetch, agora: AGORA });

        expect(resultado.parou).toBe('rede');
        expect(await alterados()).toEqual([HOJE]);
    });

    it('5xx para e não marca nada', async () => {
        await guardarDias(diasAte(HOJE, 40));
        const fetch = fetchFalso(() => json(500, { message: 'Server Error' }));

        const resultado = await enviarAgora({ fetch, agora: AGORA });

        expect(fetch).toHaveBeenCalledTimes(1);
        expect(resultado.parou).toBe('servidor');
        expect(await alterados()).toHaveLength(40);
    });

    it('429 para sem marcar nada', async () => {
        const dias = diasAte(HOJE, 40);
        await guardarDias(dias);
        const fetch = fetchFalso(() => json(429, { message: 'Too Many Attempts.' }));

        const resultado = await enviarAgora({ fetch, agora: AGORA });

        expect(fetch).toHaveBeenCalledTimes(1);
        expect(resultado.parou).toBe('limite');
        expect(await alterados()).toEqual(dias);
        expect((await lerMeta('fila_uso')).ultimo_envio_em).toBeNull();
    });

    it('422 com JSON reenvia dia a dia: descarta só o recusado e mantém o de hoje', async () => {
        const bom = somarDias(HOJE, -2);
        const ruim = somarDias(HOJE, -1);
        await guardarDias([bom, ruim, HOJE], { [ruim]: { enviados: 10001 } });
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        // Recusa o dia acima do limite e o de hoje (relógio do aparelho adiantado).
        const fetch = fetchFalso((dias) =>
            dias.some((d) => d.dia === HOJE || d.enviados > 10000)
                ? json(422, { message: 'invalid', errors: {} })
                : new Response(null, { status: 204 }),
        );

        const resultado = await enviarAgora({ fetch, agora: AGORA });

        expect(fetch).toHaveBeenCalledTimes(4);
        expect(fetch.mock.calls.slice(1).map(diasDoCorpo)).toEqual([[bom], [ruim], [HOJE]]);
        expect(resultado).toEqual({ enviados: 1, descartados: 1, parou: null });
        expect(await alterados()).toEqual([HOJE]);
        expect(console.warn).toHaveBeenCalledTimes(1);
    });

    it('422 em HTML conta como sem rede e não descarta nada', async () => {
        await guardarDias([somarDias(HOJE, -1), HOJE]);
        const fetch = fetchFalso(() => html(422));

        const resultado = await enviarAgora({ fetch, agora: AGORA });

        expect(fetch).toHaveBeenCalledTimes(1);
        expect(resultado.parou).toBe('rede');
        expect(await alterados()).toHaveLength(2);
    });

    it('deixa de fora dia depois de hoje e descarta sem enviar dia com mais de 60 dias', async () => {
        const amanha = somarDias(HOJE, 1);
        const velho = somarDias(HOJE, -61);
        const limite = somarDias(HOJE, -60);
        await guardarDias([velho, limite, HOJE, amanha]);
        const fetch = fetchFalso();

        const resultado = await enviarAgora({ fetch, agora: AGORA });

        expect(fetch).toHaveBeenCalledTimes(1);
        expect(diasDoCorpo(fetch.mock.calls[0])).toEqual([limite, HOJE]);
        expect(resultado).toEqual({ enviados: 2, descartados: 1, parou: null });
        expect(await alterados()).toEqual([amanha]);
    });

    it('duas chamadas ao mesmo tempo fazem um fetch só', async () => {
        await guardarDias([HOJE]);
        const fetch = fetchFalso();

        const [a, b] = await Promise.all([enviarAgora({ fetch, agora: AGORA }), enviarAgora({ fetch, agora: AGORA })]);

        expect(fetch).toHaveBeenCalledTimes(1);
        expect(a).toEqual(b);
    });

    it('toque durante o fetch mantém o dia em alterados com o total novo', async () => {
        await guardarDias([HOJE]);
        const fetch = fetchFalso(async () => {
            await contar('toque', { processo: '04', quando: AGORA.toISOString() });
            return new Response(null, { status: 204 });
        });

        await enviarAgora({ fetch, agora: AGORA });

        const fila = await lerMeta('fila_uso');
        expect(fila.alterados).toEqual([HOJE]);
        expect(fila.dias[HOJE].enviados).toBe(2);
    });

    it('sem token: nenhuma chamada a fetch', async () => {
        await gravarMeta('token', null);
        await guardarDias([HOJE]);
        const fetch = fetchFalso();

        const resultado = await enviarAgora({ fetch, agora: AGORA });

        expect(fetch).not.toHaveBeenCalled();
        expect(resultado.parou).toBe('sem_token');
    });

    it('sem dias alterados: nenhuma chamada a fetch', async () => {
        const fetch = fetchFalso();

        const resultado = await enviarAgora({ fetch, agora: AGORA });

        expect(fetch).not.toHaveBeenCalled();
        expect(resultado).toEqual({ enviados: 0, descartados: 0, parou: null });
    });
});

// Espera com o setTimeout de verdade (só setInterval e Date ficam falsos,
// para o fake-indexeddb seguir funcionando).
function esperarReal(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ate(condicao) {
    for (let i = 0; i < 100; i += 1) {
        if (await condicao()) return;
        await esperarReal(10);
    }
    throw new Error('a condição não chegou a tempo');
}

describe('iniciarEnvioDeUso', () => {
    it('envia ao abrir; online 10 min depois não envia; o timer de 1 h envia de novo', async () => {
        vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
        vi.setSystemTime(AGORA);
        const janela = new EventTarget();
        vi.stubGlobal('window', janela);
        await guardarDias([HOJE]);
        const fetch = fetchFalso();

        const parar = iniciarEnvioDeUso({ fetch });
        await ate(async () => fetch.mock.calls.length === 1 && (await alterados()).length === 0);

        await contar('toque', { processo: '04', quando: AGORA.toISOString() });
        vi.advanceTimersByTime(10 * 60 * 1000);
        janela.dispatchEvent(new Event('online'));
        await esperarReal(50);
        expect(fetch).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(50 * 60 * 1000);
        await ate(async () => fetch.mock.calls.length === 2 && (await alterados()).length === 0);

        // Depois de parar, nem timer nem online disparam envio.
        parar();
        await contar('toque', { processo: '04', quando: AGORA.toISOString() });
        vi.advanceTimersByTime(2 * 60 * 60 * 1000);
        janela.dispatchEvent(new Event('online'));
        await esperarReal(50);
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('online depois de 1 h sem tentativa envia', async () => {
        vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
        vi.setSystemTime(AGORA);
        const janela = new EventTarget();
        vi.stubGlobal('window', janela);
        // Abertura sem rede: nada sai da fila.
        await guardarDias([HOJE]);
        const fetch = vi.fn(async () => {
            throw new TypeError('Failed to fetch');
        });

        const parar = iniciarEnvioDeUso({ fetch, intervaloMs: 60 * 60 * 1000 });
        await ate(async () => fetch.mock.calls.length === 1);
        await esperarReal(20);

        vi.setSystemTime(new Date(AGORA.getTime() + 61 * 60 * 1000));
        fetch.mockImplementation(async () => new Response(null, { status: 204 }));
        janela.dispatchEvent(new Event('online'));
        await ate(async () => fetch.mock.calls.length === 2 && (await alterados()).length === 0);
        parar();
    });

    it('timer que dispara um pouco antes da hora envia mesmo assim', async () => {
        vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
        vi.setSystemTime(AGORA);
        vi.stubGlobal('window', new EventTarget());
        await guardarDias([HOJE]);
        const fetch = fetchFalso();

        const parar = iniciarEnvioDeUso({ fetch });
        await ate(async () => fetch.mock.calls.length === 1 && (await alterados()).length === 0);

        // relógio do aparelho 1 ms atrás do timer: sem folga, a hora seria pulada
        vi.setSystemTime(new Date(AGORA.getTime() - 1));
        await contar('toque', { processo: '04', quando: AGORA.toISOString() });
        vi.advanceTimersByTime(60 * 60 * 1000);
        await ate(async () => fetch.mock.calls.length === 2 && (await alterados()).length === 0);
        parar();
    });
});
