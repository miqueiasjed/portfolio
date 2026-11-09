import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { NOME_BANCO, fechar, gravarMeta, lerMeta } from './banco.js';
import { DIAS_SEM_REDE, gravarEntrada, lerXsrf, resolverAcesso } from './acesso.js';

const DIA = 24 * 60 * 60 * 1000;
const AGORA = Date.parse('2026-12-10T12:00:00.000Z');
const ANA = { nome: 'Ana', email: 'ana@exemplo.com' };

function apagarBanco() {
    return new Promise((resolve, reject) => {
        const pedido = indexedDB.deleteDatabase(NOME_BANCO);
        pedido.onsuccess = () => resolve();
        pedido.onerror = () => reject(pedido.error);
        pedido.onblocked = () => reject(new Error('apagar o banco ficou bloqueado'));
    });
}

const json = (status, corpo) => Response.json(corpo, { status });
const html = (status) => new Response('<html>erro</html>', { status, headers: { 'content-type': 'text/html' } });
const SEM_REDE = new TypeError('Failed to fetch');

// fetch falso: devolve as respostas na ordem (um Error vira rejeição) e guarda as chamadas.
function fetchFalso(...respostas) {
    const chamadas = [];
    const fn = async (url, opcoes) => {
        chamadas.push({ url, opcoes });
        const proxima = respostas.shift();
        if (proxima === undefined) {
            throw new Error(`chamada inesperada para ${url}`);
        }
        if (proxima instanceof Error) {
            throw proxima;
        }
        return proxima;
    };
    fn.chamadas = chamadas;
    return fn;
}

async function aparelhoGuardado({ token = 'tok-antigo', diasDesdeChecagem, usuario = ANA } = {}) {
    await gravarMeta('token', token);
    await gravarMeta('usuario', usuario);
    if (diasDesdeChecagem !== undefined) {
        await gravarMeta('acesso_ok_em', new Date(AGORA - diasDesdeChecagem * DIA).toISOString());
    }
}

beforeEach(async () => {
    await fechar();
    await apagarBanco();
});

describe('com token guardado', () => {
    it('token válido: liberado e acesso_ok_em gravado', async () => {
        await aparelhoGuardado({ diasDesdeChecagem: 10 });
        const fetch = fetchFalso(json(200, { nome: 'Ana Paula', email: 'ana@exemplo.com', liberado: true }));

        const r = await resolverAcesso({ fetch, agora: AGORA, csrf: 'csrf-1' });

        expect(r).toEqual({ estado: 'liberado', usuario: { nome: 'Ana Paula', email: 'ana@exemplo.com' } });
        expect(await lerMeta('acesso_ok_em')).toBe(new Date(AGORA).toISOString());
        expect(await lerMeta('usuario')).toEqual({ nome: 'Ana Paula', email: 'ana@exemplo.com' });
        expect(fetch.chamadas).toHaveLength(1);
        expect(fetch.chamadas[0].url).toBe('/rotina/acesso');
        expect(fetch.chamadas[0].opcoes.method).toBe('GET');
        expect(fetch.chamadas[0].opcoes.headers).toEqual({
            Authorization: 'Bearer tok-antigo',
            Accept: 'application/json',
        });
    });

    it('403 da compra: inativo, apaga acesso_ok_em e mantém o token', async () => {
        await aparelhoGuardado({ diasDesdeChecagem: 2 });
        const fetch = fetchFalso(json(403, { liberado: false, motivo: 'compra' }));

        const r = await resolverAcesso({ fetch, agora: AGORA });

        expect(r.estado).toBe('inativo');
        expect(await lerMeta('acesso_ok_em')).toBeUndefined();
        expect(await lerMeta('token')).toBe('tok-antigo');
        expect(fetch.chamadas.map((c) => c.url)).toEqual(['/rotina/acesso']);
    });

    it('403 seguido de nova abertura sem rede: sem_rede', async () => {
        await aparelhoGuardado({ diasDesdeChecagem: 2 });
        await resolverAcesso({ fetch: fetchFalso(json(403, { liberado: false, motivo: 'compra' })), agora: AGORA });

        const r = await resolverAcesso({ fetch: fetchFalso(SEM_REDE), agora: AGORA + DIA });

        expect(r).toEqual({ estado: 'sem_rede', usuario: null });
    });

    it('token recusado (401) seguido de POST 201: liberado com token novo', async () => {
        await aparelhoGuardado({ diasDesdeChecagem: 2 });
        const fetch = fetchFalso(
            json(401, { liberado: false, motivo: 'aparelho' }),
            json(201, { token: 'tok-novo', nome: 'Ana', email: 'ana@exemplo.com' }),
        );

        const r = await resolverAcesso({ fetch, agora: AGORA, csrf: 'csrf-1' });

        expect(r).toEqual({ estado: 'liberado', usuario: ANA });
        expect(await lerMeta('token')).toBe('tok-novo');
        expect(await lerMeta('acesso_ok_em')).toBe(new Date(AGORA).toISOString());
        expect(fetch.chamadas.map((c) => c.url)).toEqual(['/rotina/acesso', '/rotina/aparelho']);
    });

    it('401 seguido de sem rede no POST, com checagem de 2 dias: sem_rede e aparelho esquecido', async () => {
        await aparelhoGuardado({ diasDesdeChecagem: 2 });
        const fetch = fetchFalso(json(401, { liberado: false, motivo: 'aparelho' }), SEM_REDE);

        const r = await resolverAcesso({ fetch, agora: AGORA });

        expect(r).toEqual({ estado: 'sem_rede', usuario: null });
        expect(await lerMeta('token')).toBeUndefined();
        expect(await lerMeta('usuario')).toBeUndefined();
        expect(await lerMeta('acesso_ok_em')).toBeUndefined();
    });

    it('401 seguido de POST 401: entrar', async () => {
        await aparelhoGuardado({ diasDesdeChecagem: 2 });
        const fetch = fetchFalso(
            json(401, { liberado: false, motivo: 'aparelho' }),
            json(401, { message: 'Unauthenticated.' }),
        );

        expect((await resolverAcesso({ fetch, agora: AGORA })).estado).toBe('entrar');
    });
});

describe('sem rede com token guardado', () => {
    it('checagem de 29 dias: liberado com o usuario guardado', async () => {
        await aparelhoGuardado({ diasDesdeChecagem: 29 });
        const fetch = fetchFalso(SEM_REDE);

        const r = await resolverAcesso({ fetch, agora: AGORA });

        expect(r).toEqual({ estado: 'liberado', usuario: ANA });
        expect(await lerMeta('acesso_ok_em')).toBe(new Date(AGORA - 29 * DIA).toISOString());
        expect(fetch.chamadas.map((c) => c.url)).toEqual(['/rotina/acesso']);
    });

    it('checagem de 31 dias: sem_rede', async () => {
        await aparelhoGuardado({ diasDesdeChecagem: 31 });

        const r = await resolverAcesso({ fetch: fetchFalso(SEM_REDE), agora: AGORA });

        expect(r).toEqual({ estado: 'sem_rede', usuario: null });
    });

    it('exatamente DIAS_SEM_REDE dias: sem_rede', async () => {
        expect(DIAS_SEM_REDE).toBe(30);
        await aparelhoGuardado({ diasDesdeChecagem: DIAS_SEM_REDE });

        expect((await resolverAcesso({ fetch: fetchFalso(SEM_REDE), agora: AGORA })).estado).toBe('sem_rede');
    });

    it('token sem nunca ter checado: sem_rede', async () => {
        await aparelhoGuardado();

        expect((await resolverAcesso({ fetch: fetchFalso(SEM_REDE), agora: AGORA })).estado).toBe('sem_rede');
    });

    it('503 no /rotina/acesso com checagem de 2 dias: liberado', async () => {
        await aparelhoGuardado({ diasDesdeChecagem: 2 });

        const r = await resolverAcesso({ fetch: fetchFalso(json(503, { message: 'Service Unavailable' })), agora: AGORA });

        expect(r).toEqual({ estado: 'liberado', usuario: ANA });
        expect(await lerMeta('token')).toBe('tok-antigo');
    });

    it('503 com checagem de 31 dias: sem_rede', async () => {
        await aparelhoGuardado({ diasDesdeChecagem: 31 });

        expect((await resolverAcesso({ fetch: fetchFalso(html(503)), agora: AGORA })).estado).toBe('sem_rede');
    });

    it('429 dos limites do /rotina/acesso: carência, sem apagar nada', async () => {
        await aparelhoGuardado({ diasDesdeChecagem: 2 });

        const r = await resolverAcesso({ fetch: fetchFalso(json(429, { message: 'Too Many Attempts.' })), agora: AGORA });

        expect(r.estado).toBe('liberado');
        expect(await lerMeta('token')).toBe('tok-antigo');
        expect(await lerMeta('acesso_ok_em')).toBe(new Date(AGORA - 2 * DIA).toISOString());
    });

    it('403 sem o motivo do Laravel (página da Cloudflare): carência e nada apagado', async () => {
        await aparelhoGuardado({ diasDesdeChecagem: 2 });

        const r = await resolverAcesso({ fetch: fetchFalso(html(403)), agora: AGORA });

        expect(r.estado).toBe('liberado');
        expect(await lerMeta('acesso_ok_em')).toBe(new Date(AGORA - 2 * DIA).toISOString());
    });

    it('401 sem o motivo do Laravel: carência e token mantido', async () => {
        await aparelhoGuardado({ diasDesdeChecagem: 2 });

        const r = await resolverAcesso({ fetch: fetchFalso(html(401)), agora: AGORA });

        expect(r.estado).toBe('liberado');
        expect(await lerMeta('token')).toBe('tok-antigo');
    });

    it('200 que não é a resposta do Laravel (portal de Wi-Fi): carência sem renovar a checagem', async () => {
        await aparelhoGuardado({ diasDesdeChecagem: 2 });

        const r = await resolverAcesso({ fetch: fetchFalso(html(200)), agora: AGORA });

        expect(r.estado).toBe('liberado');
        expect(await lerMeta('acesso_ok_em')).toBe(new Date(AGORA - 2 * DIA).toISOString());
    });
});

describe('relógio e resposta fora do padrão', () => {
    it('200 em JSON sem liberado: true cai na carência e não renova acesso_ok_em', async () => {
        await aparelhoGuardado({ diasDesdeChecagem: 2 });

        const r = await resolverAcesso({ fetch: fetchFalso(json(200, { nome: 'Outra', email: 'x@y.com' })), agora: AGORA });

        expect(r).toEqual({ estado: 'liberado', usuario: ANA });
        expect(await lerMeta('acesso_ok_em')).toBe(new Date(AGORA - 2 * DIA).toISOString());
        expect(await lerMeta('usuario')).toEqual(ANA);
    });

    it('acesso_ok_em 2 dias no futuro, sem rede: sem_rede', async () => {
        await aparelhoGuardado({ diasDesdeChecagem: -2 });

        const r = await resolverAcesso({ fetch: fetchFalso(SEM_REDE), agora: AGORA });

        expect(r).toEqual({ estado: 'sem_rede', usuario: null });
    });

    it('acesso_ok_em 12 horas no futuro, sem rede: liberado', async () => {
        await aparelhoGuardado({ diasDesdeChecagem: -0.5 });

        const r = await resolverAcesso({ fetch: fetchFalso(SEM_REDE), agora: AGORA });

        expect(r).toEqual({ estado: 'liberado', usuario: ANA });
    });

    it('acesso_ok_em inválido, sem rede: sem_rede', async () => {
        await aparelhoGuardado();
        await gravarMeta('acesso_ok_em', 'não é data');

        const r = await resolverAcesso({ fetch: fetchFalso(SEM_REDE), agora: AGORA });

        expect(r).toEqual({ estado: 'sem_rede', usuario: null });
    });
});

describe('gravarEntrada', () => {
    it('grava token, usuario e acesso_ok_em e devolve o usuario', async () => {
        const usuario = await gravarEntrada({ token: 'tok-codigo', nome: 'Ana', email: 'ana@exemplo.com' }, AGORA);

        expect(usuario).toEqual(ANA);
        expect(await lerMeta('token')).toBe('tok-codigo');
        expect(await lerMeta('usuario')).toEqual(ANA);
        expect(await lerMeta('acesso_ok_em')).toBe(new Date(AGORA).toISOString());
    });
});

describe('sem token', () => {
    it('com sessão: POST 201 salva token, usuario e acesso_ok_em', async () => {
        const fetch = fetchFalso(json(201, { token: 'tok-novo', nome: 'Ana', email: 'ana@exemplo.com' }));

        const r = await resolverAcesso({ fetch, agora: AGORA, csrf: 'csrf-1' });

        expect(r).toEqual({ estado: 'liberado', usuario: ANA });
        expect(await lerMeta('token')).toBe('tok-novo');
        expect(await lerMeta('usuario')).toEqual(ANA);
        expect(await lerMeta('acesso_ok_em')).toBe(new Date(AGORA).toISOString());
        expect(fetch.chamadas).toHaveLength(1);
        expect(fetch.chamadas[0].url).toBe('/rotina/aparelho');
        expect(fetch.chamadas[0].opcoes).toEqual({
            method: 'POST',
            headers: { Accept: 'application/json', 'X-CSRF-TOKEN': 'csrf-1' },
            credentials: 'same-origin',
        });
    });

    it('401 da sessão: entrar', async () => {
        const r = await resolverAcesso({ fetch: fetchFalso(json(401, { message: 'Unauthenticated.' })), agora: AGORA });

        expect(r).toEqual({ estado: 'entrar', usuario: null });
        expect(await lerMeta('token')).toBeUndefined();
    });

    it('419 (sessão vencida): entrar', async () => {
        const r = await resolverAcesso({ fetch: fetchFalso(json(419, { message: 'CSRF token mismatch.' })), agora: AGORA });

        expect(r.estado).toBe('entrar');
    });

    it('403 sem compra: inativo', async () => {
        // Corpo real do abort(403) do Laravel em produção.
        const r = await resolverAcesso({ fetch: fetchFalso(json(403, { message: '' })), agora: AGORA });

        expect(r).toEqual({ estado: 'inativo', usuario: null });
    });

    it('403 em HTML (Cloudflare) no POST: sem_rede, não inativo', async () => {
        const r = await resolverAcesso({ fetch: fetchFalso(html(403)), agora: AGORA });

        expect(r).toEqual({ estado: 'sem_rede', usuario: null });
    });

    it('sem nunca ter entrado e sem rede: sem_rede', async () => {
        expect((await resolverAcesso({ fetch: fetchFalso(SEM_REDE), agora: AGORA })).estado).toBe('sem_rede');
    });

    it('429 ou 5xx no POST: sem_rede', async () => {
        expect((await resolverAcesso({ fetch: fetchFalso(json(429, {})), agora: AGORA })).estado).toBe('sem_rede');
        expect((await resolverAcesso({ fetch: fetchFalso(html(502)), agora: AGORA })).estado).toBe('sem_rede');
    });

    it('201 sem token no corpo: sem_rede e nada gravado', async () => {
        const r = await resolverAcesso({ fetch: fetchFalso(json(201, { nome: 'Ana' })), agora: AGORA });

        expect(r.estado).toBe('sem_rede');
        expect(await lerMeta('token')).toBeUndefined();
    });

    it('sem csrf: não manda o header X-CSRF-TOKEN', async () => {
        const fetch = fetchFalso(json(401, { message: 'Unauthenticated.' }));

        await resolverAcesso({ fetch, agora: AGORA });

        expect(fetch.chamadas[0].opcoes.headers).toEqual({ Accept: 'application/json' });
    });

    it('com cookie XSRF: manda só o X-XSRF-TOKEN, mesmo com a meta', async () => {
        const fetch = fetchFalso(json(201, { token: 'tok-novo', nome: 'Ana', email: 'ana@exemplo.com' }));

        const r = await resolverAcesso({ fetch, agora: AGORA, csrf: 'meta-velha', xsrf: 'cookie=novo' });

        expect(r.estado).toBe('liberado');
        expect(fetch.chamadas[0].opcoes.headers).toEqual({
            Accept: 'application/json',
            'X-XSRF-TOKEN': 'cookie=novo',
        });
    });

    it('com token guardado e válido: não faz o POST nem usa o XSRF', async () => {
        await aparelhoGuardado({ diasDesdeChecagem: 2 });
        const fetch = fetchFalso(json(200, { nome: 'Ana', email: 'ana@exemplo.com', liberado: true }));

        await resolverAcesso({ fetch, agora: AGORA, xsrf: 'cookie' });

        expect(fetch.chamadas).toHaveLength(1);
        expect(fetch.chamadas[0].opcoes.headers['X-XSRF-TOKEN']).toBeUndefined();
    });
});

describe('lerXsrf', () => {
    it('acha e decodifica o cookie entre outros', () => {
        expect(lerXsrf('a=1; XSRF-TOKEN=eyJpdiI6%3D%3D; laravel_session=xyz')).toBe('eyJpdiI6==');
    });

    it('sem o cookie, vazio ou mal formado: null', () => {
        expect(lerXsrf('laravel_session=xyz')).toBeNull();
        expect(lerXsrf('')).toBeNull();
        expect(lerXsrf(undefined)).toBeNull();
        expect(lerXsrf('XSRF-TOKEN=')).toBeNull();
        expect(lerXsrf('XSRF-TOKEN=%E0%A4%A')).toBeNull();
    });

    it('não confunde com cookie de nome parecido', () => {
        expect(lerXsrf('OUTRO-XSRF-TOKEN=abc')).toBeNull();
    });
});
