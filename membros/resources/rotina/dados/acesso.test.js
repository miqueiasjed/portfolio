import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NOME_BANCO, fechar, gravarMeta, lerMeta, listar, salvar, transacao } from './banco.js';
import {
    DIAS_SEM_REDE,
    ERRO_CODIGO,
    ERRO_CONFIRMAR_INCERTO,
    ERRO_EMAIL,
    ERRO_GERAL,
    ERRO_GRAVAR,
    ERRO_MUITAS,
    ERRO_REDE,
    apagarDadosEEntrar,
    confirmarCodigo,
    gravarEntrada,
    lerXsrf,
    mascararEmail,
    pedirCodigo,
    resolverAcesso,
    sairDaSessao,
    voltarDaOutraConta,
} from './acesso.js';

// `transacao` espiada: repassa tudo ao banco real e, quando o teste define
// `espiao.antes`, deixa ele mexer nas lojas antes da função da transação rodar.
const espiao = vi.hoisted(() => ({ antes: null }));
vi.mock('./banco.js', async (importOriginal) => {
    const real = await importOriginal();
    return {
        ...real,
        transacao: vi.fn((stores, modo, fn) =>
            real.transacao(stores, modo, (lojas, tx) => {
                espiao.antes?.(lojas, tx);
                return fn(lojas, tx);
            }),
        ),
    };
});

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
    espiao.antes = null;
    transacao.mockClear();
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
        const r = await gravarEntrada({ token: 'tok-codigo', nome: 'Ana', email: 'ana@exemplo.com' }, AGORA);

        expect(r).toEqual({ estado: 'liberado', usuario: ANA });
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

const semConteudo = () => new Response(null, { status: 204 });
// 429 do throttle por IP: texto em inglês e header Retry-After.
const throttle = () =>
    Response.json({ message: 'Too Many Attempts.' }, { status: 429, headers: { 'retry-after': '60' } });

describe('pedirCodigo', () => {
    it('204: true, com o e-mail limpo no corpo', async () => {
        const fetch = fetchFalso(semConteudo());

        const r = await pedirCodigo({ email: '  ana@exemplo.com ', fetch });

        expect(r).toBe(true);
        expect(fetch.chamadas).toHaveLength(1);
        expect(fetch.chamadas[0].url).toBe('/rotina/codigo');
        expect(fetch.chamadas[0].opcoes.method).toBe('POST');
        expect(fetch.chamadas[0].opcoes.headers).toEqual({
            Accept: 'application/json',
            'Content-Type': 'application/json',
        });
        expect(JSON.parse(fetch.chamadas[0].opcoes.body)).toEqual({ email: 'ana@exemplo.com' });
    });

    it('com csrf: manda o X-CSRF-TOKEN', async () => {
        const fetch = fetchFalso(semConteudo());

        await pedirCodigo({ email: 'ana@exemplo.com', csrf: 'csrf-1', fetch });

        expect(fetch.chamadas[0].opcoes.headers['X-CSRF-TOKEN']).toBe('csrf-1');
    });

    it('e-mail inválido: erro sem chamar o fetch', async () => {
        const fetch = fetchFalso();

        for (const email of ['', 'ana', 'ana@exemplo', 'ana @exemplo.com', undefined]) {
            expect(await pedirCodigo({ email, fetch })).toEqual({ erro: ERRO_EMAIL });
        }
        expect(fetch.chamadas).toHaveLength(0);
    });

    it('422 da validação (texto em inglês): erro em português', async () => {
        const fetch = fetchFalso(
            json(422, { message: 'The email field must be a valid email address.', errors: { email: ['x'] } }),
        );

        expect(await pedirCodigo({ email: 'ana@exemplo.com', fetch })).toEqual({ erro: ERRO_EMAIL });
    });

    it('429 do throttle: texto padrão, nunca o inglês', async () => {
        expect(await pedirCodigo({ email: 'ana@exemplo.com', fetch: fetchFalso(throttle()) })).toEqual({
            erro: ERRO_MUITAS,
        });
    });

    it('429 em HTML (limite da Cloudflare): ERRO_MUITAS', async () => {
        expect(await pedirCodigo({ email: 'ana@exemplo.com', fetch: fetchFalso(html(429)) })).toEqual({
            erro: ERRO_MUITAS,
        });
    });

    it('sem rede, 5xx ou resposta que não é JSON: erro curto', async () => {
        expect(await pedirCodigo({ email: 'ana@exemplo.com', fetch: fetchFalso(SEM_REDE) })).toEqual({ erro: ERRO_REDE });
        expect(await pedirCodigo({ email: 'ana@exemplo.com', fetch: fetchFalso(html(502)) })).toEqual({
            erro: ERRO_GERAL,
        });
        expect(await pedirCodigo({ email: 'ana@exemplo.com', fetch: fetchFalso(json(500, { message: 'Server Error' })) })).toEqual({
            erro: ERRO_GERAL,
        });
    });
});

describe('confirmarCodigo', () => {
    it('201: grava token, usuario e acesso_ok_em e devolve liberado', async () => {
        const fetch = fetchFalso(json(201, { token: 'tok-codigo', nome: 'Ana', email: 'ana@exemplo.com' }));

        const r = await confirmarCodigo({ email: 'ana@exemplo.com', codigo: '123456', fetch, agora: AGORA });

        expect(r).toEqual({ estado: 'liberado', usuario: ANA });
        expect(await lerMeta('token')).toBe('tok-codigo');
        expect(await lerMeta('usuario')).toEqual(ANA);
        expect(await lerMeta('acesso_ok_em')).toBe(new Date(AGORA).toISOString());
        expect(fetch.chamadas[0].url).toBe('/rotina/codigo/confirmar');
        expect(fetch.chamadas[0].opcoes.method).toBe('POST');
        expect(JSON.parse(fetch.chamadas[0].opcoes.body)).toEqual({ email: 'ana@exemplo.com', codigo: '123456' });
    });

    it('422 do código errado: a mensagem do servidor, sem gravar nada', async () => {
        const fetch = fetchFalso(json(422, { message: 'Código errado ou vencido. Peça um novo.' }));

        const r = await confirmarCodigo({ email: 'ana@exemplo.com', codigo: '000000', fetch, agora: AGORA });

        expect(r).toEqual({ erro: 'Código errado ou vencido. Peça um novo.' });
        expect(await lerMeta('token')).toBeUndefined();
        expect(await lerMeta('acesso_ok_em')).toBeUndefined();
    });

    it('422 da validação do Laravel: não leva o texto em inglês', async () => {
        const fetch = fetchFalso(
            json(422, { message: 'The codigo field must be 6 digits.', errors: { codigo: ['x'] } }),
        );

        const r = await confirmarCodigo({ email: 'ana@exemplo.com', codigo: '123456', fetch });

        expect(r.erro).toBe('Confira o e-mail e o código.');
    });

    it('e-mail inválido ou código fora de 6 dígitos: erro sem chamar o fetch', async () => {
        const fetch = fetchFalso();

        expect(await confirmarCodigo({ email: 'ana@', codigo: '123456', fetch })).toEqual({ erro: ERRO_EMAIL });
        for (const codigo of ['12345', '1234567', '12a456', '', undefined]) {
            expect(await confirmarCodigo({ email: 'ana@exemplo.com', codigo, fetch })).toEqual({ erro: ERRO_CODIGO });
        }
        expect(fetch.chamadas).toHaveLength(0);
    });

    it('429 sem message: texto padrão', async () => {
        const r = await confirmarCodigo({
            email: 'ana@exemplo.com',
            codigo: '123456',
            fetch: fetchFalso(json(429, {})),
        });

        expect(r).toEqual({ erro: ERRO_MUITAS });
    });

    it('429 do limite por e-mail: a mensagem do servidor', async () => {
        const fetch = fetchFalso(json(429, { message: 'Muitas tentativas. Peça um novo código daqui a pouco.' }));

        const r = await confirmarCodigo({ email: 'ana@exemplo.com', codigo: '123456', fetch });

        expect(r).toEqual({ erro: 'Muitas tentativas. Peça um novo código daqui a pouco.' });
    });

    it('429 do throttle por IP: texto padrão, nunca o inglês', async () => {
        const r = await confirmarCodigo({ email: 'ana@exemplo.com', codigo: '123456', fetch: fetchFalso(throttle()) });

        expect(r).toEqual({ erro: ERRO_MUITAS });
    });

    it('sem rede depois do envio: orienta a tentar o mesmo código e pedir outro, nada gravado', async () => {
        const r = await confirmarCodigo({ email: 'ana@exemplo.com', codigo: '123456', fetch: fetchFalso(SEM_REDE) });

        expect(r).toEqual({ erro: ERRO_CONFIRMAR_INCERTO });
        expect(ERRO_CONFIRMAR_INCERTO).toBe('Não deu para confirmar agora. Se o mesmo código não funcionar, peça um novo.');
        expect(await lerMeta('token')).toBeUndefined();
    });

    it('201 sem token: erro geral e nada gravado', async () => {
        const email = 'ana@exemplo.com';
        expect(await confirmarCodigo({ email, codigo: '123456', fetch: fetchFalso(json(201, { nome: 'Ana' })) })).toEqual({
            erro: ERRO_GERAL,
        });
        expect(await lerMeta('token')).toBeUndefined();
    });

    it('resposta ilegível (HTML) depois do envio: orienta como na queda de rede', async () => {
        const email = 'ana@exemplo.com';
        expect(await confirmarCodigo({ email, codigo: '123456', fetch: fetchFalso(html(201)) })).toEqual({
            erro: ERRO_CONFIRMAR_INCERTO,
        });
        expect(await confirmarCodigo({ email, codigo: '123456', fetch: fetchFalso(html(502)) })).toEqual({
            erro: ERRO_CONFIRMAR_INCERTO,
        });
        expect(await lerMeta('token')).toBeUndefined();
    });

    it('201 com token, mas a gravação falha: ERRO_GRAVAR e não liberado', async () => {
        const fetch = fetchFalso(json(201, { token: 'tok-codigo', nome: 'Ana', email: 'ana@exemplo.com' }));
        const gravar = async () => {
            throw new Error('QuotaExceededError');
        };

        const r = await confirmarCodigo({ email: 'ana@exemplo.com', codigo: '123456', fetch, agora: AGORA, gravar });

        expect(r).toEqual({ erro: ERRO_GRAVAR });
        expect(r.estado).toBeUndefined();
        expect(await lerMeta('token')).toBeUndefined();
    });

    it('429 em HTML (limite da Cloudflare): ERRO_MUITAS', async () => {
        const r = await confirmarCodigo({ email: 'ana@exemplo.com', codigo: '123456', fetch: fetchFalso(html(429)) });

        expect(r).toEqual({ erro: ERRO_MUITAS });
    });
});

// Outra conta no mesmo aparelho (task 4.13).

const BIA = { nome: 'Bia', email: 'bia@outra.com' };
const ENTRADA_BIA = { token: 'tok-bia', ...BIA };
const RECUSADO = () => json(401, { liberado: false, motivo: 'aparelho' });

const CLIENTES_ANA = [
    { id: 'c1', nome: 'Carla', whatsapp: '5585999990001' },
    { id: 'c2', nome: 'Davi', whatsapp: '5585999990002' },
];

// Dados de negócio da Ana no aparelho. `clientes: false` deixa as três stores de clientes vazias.
async function dadosDaAna({ clientes = true } = {}) {
    if (clientes) {
        for (const cliente of CLIENTES_ANA) {
            await salvar('clientes', cliente);
        }
        await salvar('itens', { id: 'i1', cliente_id: 'c1', processo: '05', status: 'aberto' });
        await salvar('toques', { id: 't1', item_id: 'i1', etapa: 1 });
    }
    await salvar('ajustes', { chave: 'geral', negocio: 'Studio Ana', chave_pix: 'ana@exemplo.com' });
    await gravarMeta('fila_uso', [{ dia: '2026-12-09', enviados: 4 }]);
}

async function storesDeDados() {
    return {
        clientes: await listar('clientes'),
        itens: await listar('itens'),
        toques: await listar('toques'),
        ajustes: await listar('ajustes'),
    };
}

const VAZIAS = { clientes: [], itens: [], toques: [], ajustes: [] };

describe('outra conta no mesmo aparelho', () => {
    it.each([
        ['com dono gravado', true],
        ['aparelho de antes do marcador (sem dono)', false],
    ])('A com 2 clientes, token recusado, B entra pelo link (%s): outra_conta e nada de B gravado', async (_, comDono) => {
        await aparelhoGuardado({ diasDesdeChecagem: 2 });
        if (comDono) {
            await gravarMeta('dono', 'ana@exemplo.com');
        }
        await dadosDaAna();
        const antes = await storesDeDados();
        const fetch = fetchFalso(RECUSADO(), json(201, ENTRADA_BIA));

        const r = await resolverAcesso({ fetch, agora: AGORA, csrf: 'csrf-1' });

        expect(r).toEqual({
            estado: 'outra_conta',
            usuario: null,
            pendente: ENTRADA_BIA,
            dono: 'a***@exemplo.com',
            origem: 'sessao',
        });
        expect(await lerMeta('token')).toBeUndefined();
        expect(await lerMeta('usuario')).toBeUndefined();
        expect(await lerMeta('acesso_ok_em')).toBeUndefined();
        expect(await lerMeta('dono')).toBe('ana@exemplo.com');
        expect(await lerMeta('fila_uso')).toEqual([{ dia: '2026-12-09', enviados: 4 }]);
        expect(await storesDeDados()).toEqual(antes);
        expect((await listar('clientes')).map((c) => c.id)).toEqual(['c1', 'c2']);
    });

    it('mesmo cenário pelo código por e-mail: outra_conta com origem codigo e nada de B gravado', async () => {
        await aparelhoGuardado({ diasDesdeChecagem: 2 });
        await dadosDaAna();
        const antes = await storesDeDados();
        // Token da Ana recusado e sem sessão: a tela de entrada aparece.
        const boot = await resolverAcesso({
            fetch: fetchFalso(RECUSADO(), json(401, { message: 'Unauthenticated.' })),
            agora: AGORA,
        });
        expect(boot.estado).toBe('entrar');

        const r = await confirmarCodigo({
            email: 'bia@outra.com',
            codigo: '123456',
            fetch: fetchFalso(json(201, ENTRADA_BIA)),
            agora: AGORA,
        });

        expect(r).toEqual({
            estado: 'outra_conta',
            usuario: null,
            pendente: ENTRADA_BIA,
            dono: 'a***@exemplo.com',
            origem: 'codigo',
        });
        expect(r.erro).toBeUndefined();
        expect(await lerMeta('token')).toBeUndefined();
        expect(await lerMeta('usuario')).toBeUndefined();
        expect(await lerMeta('dono')).toBe('ana@exemplo.com');
        expect(await storesDeDados()).toEqual(antes);
    });

    it.each(['clientes', 'itens', 'toques'])('dono diferente e só a store %s com dado: outra_conta', async (store) => {
        await gravarMeta('dono', 'ana@exemplo.com');
        await salvar(store, { id: 'x1' });

        const r = await gravarEntrada(ENTRADA_BIA, AGORA);

        expect(r.estado).toBe('outra_conta');
        expect(await lerMeta('token')).toBeUndefined();
        expect(await listar(store)).toEqual([{ id: 'x1' }]);
    });

    it('gravarEntrada sem dono, com usuario da Ana e clientes, recebendo a Bia: outra_conta e nada gravado', async () => {
        await gravarMeta('usuario', ANA);
        await dadosDaAna();
        const dadosAntes = await storesDeDados();
        const metaAntes = await listar('meta');

        const r = await gravarEntrada(ENTRADA_BIA, AGORA);

        expect(r).toEqual({ estado: 'outra_conta', usuario: null, pendente: ENTRADA_BIA, dono: 'a***@exemplo.com' });
        expect(await listar('meta')).toEqual(metaAntes);
        expect(await lerMeta('token')).toBeUndefined();
        expect(await lerMeta('dono')).toBeUndefined();
        expect(await lerMeta('usuario')).toEqual(ANA);
        expect(await storesDeDados()).toEqual(dadosAntes);
    });

    it('conferir o dono e gravar a entrada acontecem numa transação só', async () => {
        await gravarMeta('dono', 'ana@exemplo.com');
        transacao.mockClear();

        await gravarEntrada(ENTRADA_BIA, AGORA);

        expect(transacao).toHaveBeenCalledTimes(1);
        const [stores, modo] = transacao.mock.calls[0];
        expect([...stores].sort()).toEqual(['ajustes', 'clientes', 'itens', 'meta', 'toques']);
        expect(modo).toBe('readwrite');
    });

    it('esquecerAparelho sem dono grava dono com o e-mail de usuario, em minúsculas', async () => {
        await aparelhoGuardado({ diasDesdeChecagem: 2, usuario: { nome: 'Ana', email: ' Ana@Exemplo.com ' } });
        expect(await lerMeta('dono')).toBeUndefined();

        await resolverAcesso({ fetch: fetchFalso(RECUSADO(), json(401, { message: 'Unauthenticated.' })), agora: AGORA });

        expect(await lerMeta('dono')).toBe('ana@exemplo.com');
        expect(await lerMeta('token')).toBeUndefined();
        expect(await lerMeta('usuario')).toBeUndefined();
        expect(await lerMeta('acesso_ok_em')).toBeUndefined();
    });

    it('esquecerAparelho com dono gravado não troca o dono', async () => {
        await aparelhoGuardado({ diasDesdeChecagem: 2, usuario: { nome: 'Outra', email: 'outra@exemplo.com' } });
        await gravarMeta('dono', 'ana@exemplo.com');

        await resolverAcesso({ fetch: fetchFalso(RECUSADO(), json(401, { message: 'Unauthenticated.' })), agora: AGORA });

        expect(await lerMeta('dono')).toBe('ana@exemplo.com');
    });

    it('checagem aceita grava dono com o e-mail do servidor, inclusive quando ele muda', async () => {
        await aparelhoGuardado({ diasDesdeChecagem: 2 });
        await gravarMeta('dono', 'ana@exemplo.com');

        await resolverAcesso({
            fetch: fetchFalso(json(200, { nome: 'Ana', email: 'Ana.Nova@Exemplo.com', liberado: true })),
            agora: AGORA,
        });

        expect(await lerMeta('dono')).toBe('ana.nova@exemplo.com');
    });

    it('primeira entrada grava dono', async () => {
        await resolverAcesso({ fetch: fetchFalso(json(201, { token: 'tok', nome: 'Ana', email: 'Ana@Exemplo.com' })), agora: AGORA });

        expect(await lerMeta('dono')).toBe('ana@exemplo.com');
    });

    it('B entra num aparelho de A sem nenhum cliente: entra direto, dono vira B, ajustes e fila_uso de A apagados', async () => {
        await aparelhoGuardado({ diasDesdeChecagem: 2 });
        await gravarMeta('dono', 'ana@exemplo.com');
        await dadosDaAna({ clientes: false });

        const r = await resolverAcesso({ fetch: fetchFalso(RECUSADO(), json(201, ENTRADA_BIA)), agora: AGORA });

        expect(r).toEqual({ estado: 'liberado', usuario: BIA });
        expect(await lerMeta('dono')).toBe('bia@outra.com');
        expect(await lerMeta('token')).toBe('tok-bia');
        expect(await lerMeta('usuario')).toEqual(BIA);
        expect(await lerMeta('acesso_ok_em')).toBe(new Date(AGORA).toISOString());
        expect(await lerMeta('fila_uso')).toBeUndefined();
        expect(await storesDeDados()).toEqual(VAZIAS);
    });

    it('B entra pelo código num aparelho de A sem clientes: entra direto e ajustes de A apagados', async () => {
        await gravarMeta('dono', 'ana@exemplo.com');
        await dadosDaAna({ clientes: false });

        const r = await confirmarCodigo({
            email: 'bia@outra.com',
            codigo: '123456',
            fetch: fetchFalso(json(201, ENTRADA_BIA)),
            agora: AGORA,
        });

        expect(r).toEqual({ estado: 'liberado', usuario: BIA });
        expect(await lerMeta('dono')).toBe('bia@outra.com');
        expect(await listar('ajustes')).toEqual([]);
        expect(await lerMeta('fila_uso')).toBeUndefined();
    });

    it('mesmo e-mail com caixa diferente (Ana@x.com e ana@x.com): entra direto e nada apagado', async () => {
        await aparelhoGuardado({ diasDesdeChecagem: 2, usuario: { nome: 'Ana', email: 'Ana@x.com' } });
        await dadosDaAna();
        const antes = await storesDeDados();

        const r = await resolverAcesso({
            fetch: fetchFalso(RECUSADO(), json(201, { token: 'tok-novo', nome: 'Ana', email: 'ana@x.com' })),
            agora: AGORA,
        });

        expect(r).toEqual({ estado: 'liberado', usuario: { nome: 'Ana', email: 'ana@x.com' } });
        expect(await lerMeta('token')).toBe('tok-novo');
        expect(await lerMeta('dono')).toBe('ana@x.com');
        expect(await lerMeta('fila_uso')).toEqual([{ dia: '2026-12-09', enviados: 4 }]);
        expect(await storesDeDados()).toEqual(antes);
    });
});

describe('apagarDadosEEntrar', () => {
    it('stores de dados vazias, fila_uso apagada, dono e token de B gravados', async () => {
        await gravarMeta('dono', 'ana@exemplo.com');
        await dadosDaAna();

        const usuario = await apagarDadosEEntrar(ENTRADA_BIA, AGORA);

        expect(usuario).toEqual(BIA);
        expect(await storesDeDados()).toEqual(VAZIAS);
        expect(await lerMeta('fila_uso')).toBeUndefined();
        expect(await lerMeta('dono')).toBe('bia@outra.com');
        expect(await lerMeta('token')).toBe('tok-bia');
        expect(await lerMeta('usuario')).toEqual(BIA);
        expect(await lerMeta('acesso_ok_em')).toBe(new Date(AGORA).toISOString());
    });

    it('atomicidade: put da meta falha depois dos clear enfileirados e nada muda', async () => {
        await gravarMeta('dono', 'ana@exemplo.com');
        await dadosDaAna();
        const dadosAntes = await storesDeDados();
        const metaAntes = await listar('meta');

        const operacoes = [];
        espiao.antes = (lojas) => {
            for (const [nome, loja] of Object.entries(lojas)) {
                const clear = loja.clear.bind(loja);
                loja.clear = () => {
                    operacoes.push(`clear ${nome}`);
                    return clear();
                };
            }
            const put = lojas.meta.put.bind(lojas.meta);
            lojas.meta.put = (registro) => {
                operacoes.push(`put ${registro.chave}`);
                if (registro.chave === 'dono') {
                    throw new Error('falha simulada na gravação');
                }
                return put(registro);
            };
        };

        await expect(apagarDadosEEntrar(ENTRADA_BIA, AGORA)).rejects.toThrow('falha simulada na gravação');
        espiao.antes = null;

        expect(operacoes).toEqual([
            'clear clientes',
            'clear itens',
            'clear toques',
            'clear ajustes',
            'put token',
            'put usuario',
            'put acesso_ok_em',
            'put dono',
        ]);
        expect(await storesDeDados()).toEqual(dadosAntes);
        expect(await listar('meta')).toEqual(metaAntes);
        expect(await lerMeta('token')).toBeUndefined();
    });

    it('atomicidade: gravação de dono falha de forma assíncrona depois dos clear concluídos e nada muda', async () => {
        await gravarMeta('dono', 'ana@exemplo.com');
        await dadosDaAna();
        const dadosAntes = await storesDeDados();
        const metaAntes = await listar('meta');

        const operacoes = [];
        espiao.antes = (lojas) => {
            for (const [nome, loja] of Object.entries(lojas)) {
                const clear = loja.clear.bind(loja);
                loja.clear = () => {
                    const pedido = clear();
                    pedido.addEventListener('success', () => operacoes.push(`clear ${nome} concluído`));
                    return pedido;
                };
            }
            // `add` sobre a chave 'dono', que já existe na meta: o pedido é aceito
            // e só falha depois, com ConstraintError, quando a fila chega nele.
            const put = lojas.meta.put.bind(lojas.meta);
            const add = lojas.meta.add.bind(lojas.meta);
            lojas.meta.put = (registro) => {
                if (registro.chave !== 'dono') {
                    return put(registro);
                }
                const pedido = add(registro);
                pedido.addEventListener('error', () => operacoes.push(`add dono falhou: ${pedido.error?.name}`));
                return pedido;
            };
        };

        await expect(apagarDadosEEntrar(ENTRADA_BIA, AGORA)).rejects.toMatchObject({ name: 'ConstraintError' });
        espiao.antes = null;

        expect(operacoes).toEqual([
            'clear clientes concluído',
            'clear itens concluído',
            'clear toques concluído',
            'clear ajustes concluído',
            'add dono falhou: ConstraintError',
        ]);
        expect(await storesDeDados()).toEqual(dadosAntes);
        expect(await listar('meta')).toEqual(metaAntes);
        expect(await lerMeta('token')).toBeUndefined();
        expect(await lerMeta('dono')).toBe('ana@exemplo.com');
        expect(await lerMeta('fila_uso')).toEqual([{ dia: '2026-12-09', enviados: 4 }]);
    });

    it('pendente sem token: lança e nada muda', async () => {
        await dadosDaAna();
        const antes = await storesDeDados();

        await expect(apagarDadosEEntrar({ nome: 'Bia', email: 'bia@outra.com' }, AGORA)).rejects.toThrow();

        expect(await storesDeDados()).toEqual(antes);
    });
});

describe('Voltar da tela de outra conta', () => {
    it('origem sessao: chama POST /sair com o XSRF do cookie e não mexe no aparelho', async () => {
        await gravarMeta('dono', 'ana@exemplo.com');
        await dadosDaAna();
        const antes = await storesDeDados();
        const fetch = fetchFalso(html(200));

        const r = await voltarDaOutraConta({ origem: 'sessao', fetch, csrf: 'meta-velha', xsrf: 'cookie-novo' });

        expect(r).toEqual({ estado: 'entrar', usuario: null });
        expect(fetch.chamadas).toHaveLength(1);
        expect(fetch.chamadas[0].url).toBe('/sair');
        expect(fetch.chamadas[0].opcoes).toEqual({
            method: 'POST',
            headers: { Accept: 'application/json', 'X-XSRF-TOKEN': 'cookie-novo' },
            credentials: 'same-origin',
        });
        expect(await storesDeDados()).toEqual(antes);
        expect(await lerMeta('token')).toBeUndefined();
        expect(await lerMeta('dono')).toBe('ana@exemplo.com');
    });

    it('origem codigo: não chama o servidor', async () => {
        const fetch = fetchFalso();

        const r = await voltarDaOutraConta({ origem: 'codigo', fetch });

        expect(r).toEqual({ estado: 'entrar', usuario: null });
        expect(fetch.chamadas).toHaveLength(0);
    });

    it('sairDaSessao ignora falha de rede e resposta de erro', async () => {
        await expect(sairDaSessao({ fetch: fetchFalso(SEM_REDE) })).resolves.toBeUndefined();
        await expect(sairDaSessao({ fetch: fetchFalso(json(419, { message: 'CSRF token mismatch.' })) })).resolves.toBeUndefined();
    });

    it('sairDaSessao sem cookie XSRF manda a meta csrf', async () => {
        const fetch = fetchFalso(html(200));

        await sairDaSessao({ fetch, csrf: 'csrf-1' });

        expect(fetch.chamadas[0].opcoes.headers).toEqual({ Accept: 'application/json', 'X-CSRF-TOKEN': 'csrf-1' });
    });

    it('depois de Voltar com a sessão encerrada, abrir de novo cai em entrar sem reabrir a tela nem gravar token', async () => {
        await aparelhoGuardado({ diasDesdeChecagem: 2 });
        await dadosDaAna();
        const antes = await storesDeDados();

        const primeira = await resolverAcesso({ fetch: fetchFalso(RECUSADO(), json(201, ENTRADA_BIA)), agora: AGORA });
        expect(primeira.estado).toBe('outra_conta');

        const sair = fetchFalso(html(200));
        await voltarDaOutraConta({ origem: primeira.origem, fetch: sair, xsrf: 'cookie' });
        expect(sair.chamadas.map((c) => c.url)).toEqual(['/sair']);

        // Recarga: sem token guardado, só o POST /rotina/aparelho, que agora não tem sessão.
        const fetch = fetchFalso(json(401, { message: 'Unauthenticated.' }));
        const r = await resolverAcesso({ fetch, agora: AGORA + 60_000, xsrf: 'cookie' });

        expect(r).toEqual({ estado: 'entrar', usuario: null });
        expect(fetch.chamadas.map((c) => c.url)).toEqual(['/rotina/aparelho']);
        expect(await lerMeta('token')).toBeUndefined();
        expect(await lerMeta('usuario')).toBeUndefined();
        expect(await lerMeta('dono')).toBe('ana@exemplo.com');
        expect(await storesDeDados()).toEqual(antes);
    });
});

describe('mascararEmail', () => {
    it('primeira letra, ***, @ e domínio', () => {
        expect(mascararEmail('miqueias@gmail.com')).toBe('m***@gmail.com');
        expect(mascararEmail(' Ana@Exemplo.com ')).toBe('a***@exemplo.com');
        expect(mascararEmail('a@b.co')).toBe('a***@b.co');
    });

    it('domínio sem ponto também é mascarado', () => {
        expect(mascararEmail('ana@localhost')).toBe('a***@localhost');
        expect(mascararEmail('Ana@Exemplo')).toBe('a***@exemplo');
    });

    it('sem e-mail reconhecível: texto vazio, para a tela usar a frase sem o e-mail', () => {
        for (const valor of ['', '   ', 'ana', 'ana@', '@exemplo.com', 'ana@@exemplo.com', 'a na@exemplo.com', undefined, null, 42]) {
            expect(mascararEmail(valor)).toBe('');
        }
    });
});
