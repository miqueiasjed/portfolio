// Decide, ao abrir a ferramenta, se o dono entra ou qual tela de acesso vê.
// As únicas chamadas de rede são GET /rotina/acesso e POST /rotina/aparelho,
// e a única coisa que sai do aparelho é o próprio token.

import { apagar, lerMeta, transacao } from './banco.js';

// Dias que a ferramenta segue aberta sem rede desde a última checagem online.
export const DIAS_SEM_REDE = 30;

const DIA_MS = 24 * 60 * 60 * 1000;
const LIMITE_SEM_REDE_MS = DIAS_SEM_REDE * DIA_MS;

// Quanto a checagem guardada pode estar no futuro sem ser suspeita. Relógio
// levemente atrasado não pode trancar ninguém; mais que isso (relógio
// adiantado para renovar a carência para sempre) conta como vencido.
export const TOLERANCIA_RELOGIO_MS = DIA_MS;

// Corpo JSON da resposta, ou null quando não é JSON (página de erro da
// Cloudflare, portal de Wi-Fi, proxy). Resposta que não é JSON não veio do
// Laravel e por isso nunca conta como recusa do servidor.
async function lerJson(resposta) {
    const tipo = resposta.headers?.get?.('content-type') ?? '';
    if (!tipo.includes('json')) {
        return null;
    }
    try {
        const corpo = await resposta.json();
        return corpo && typeof corpo === 'object' ? corpo : null;
    } catch {
        return null;
    }
}

function usuarioDe(corpo) {
    return { nome: corpo.nome ?? '', email: corpo.email ?? '' };
}

// Grava a entrada depois de um 201 com { token, nome, email }. Usada aqui pelo
// POST /rotina/aparelho e exportada para a confirmação do código por e-mail
// (task 2.13). Tudo numa transação: nunca fica token sem usuario ou sem
// acesso_ok_em. Devolve o usuario gravado.
export async function gravarEntrada(corpo, agora) {
    const usuario = usuarioDe(corpo);
    await transacao('meta', 'readwrite', (l) => {
        l.meta.put({ chave: 'token', valor: corpo.token });
        l.meta.put({ chave: 'usuario', valor: usuario });
        l.meta.put({ chave: 'acesso_ok_em', valor: new Date(agora).toISOString() });
    });
    return usuario;
}

async function gravarChecagem(usuario, agora) {
    await transacao('meta', 'readwrite', (l) => {
        l.meta.put({ chave: 'usuario', valor: usuario });
        l.meta.put({ chave: 'acesso_ok_em', valor: new Date(agora).toISOString() });
    });
}

async function esquecerAparelho() {
    await transacao('meta', 'readwrite', (l) => {
        l.meta.delete('token');
        l.meta.delete('usuario');
        l.meta.delete('acesso_ok_em');
    });
}

// Sem resposta válida do servidor. A carência só vale com token guardado e
// checagem online bem-sucedida há menos de DIAS_SEM_REDE dias. Checagem mais
// de TOLERANCIA_RELOGIO_MS no futuro (relógio adiantado) não vale; data
// inválida também não.
async function semRede(agora) {
    const token = await lerMeta('token');
    const okEm = Date.parse(await lerMeta('acesso_ok_em'));

    const idade = agora - okEm;
    if (token && Number.isFinite(okEm) && idade < LIMITE_SEM_REDE_MS && idade >= -TOLERANCIA_RELOGIO_MS) {
        return { estado: 'liberado', usuario: (await lerMeta('usuario')) ?? null };
    }
    return { estado: 'sem_rede', usuario: null };
}

// Checagem online do token. Devolve o resultado, ou null quando o token foi
// recusado e já foi apagado (o boot segue como se não houvesse token).
async function checarToken(buscar, token, agora) {
    let resposta;
    try {
        resposta = await buscar('/rotina/acesso', {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });
    } catch {
        return semRede(agora);
    }

    const corpo = await lerJson(resposta);

    if (resposta.status === 200 && corpo?.liberado === true) {
        const usuario = usuarioDe(corpo);
        await gravarChecagem(usuario, agora);
        return { estado: 'liberado', usuario };
    }

    // O motivo vem do middleware TokenDoAparelho: sem ele, o 401 ou o 403 não
    // saiu do Laravel e não pode apagar nada do aparelho.
    if (resposta.status === 401 && corpo?.motivo === 'aparelho') {
        await esquecerAparelho();
        return null;
    }

    if (resposta.status === 403 && corpo?.motivo === 'compra') {
        // O token fica: se a compra voltar a ser paga, o aparelho volta a entrar.
        await apagar('meta', 'acesso_ok_em');
        return { estado: 'inativo', usuario: null };
    }

    // 429, 5xx e qualquer outro status: trata como sem rede.
    return semRede(agora);
}

// Valor do cookie XSRF-TOKEN já decodificado, ou null quando não existe ou
// vem mal formado. Recebe o texto de document.cookie.
export function lerXsrf(cookies) {
    const texto = typeof cookies === 'string' ? cookies : '';
    for (const parte of texto.split(';')) {
        const [nome, ...resto] = parte.trim().split('=');
        if (nome !== 'XSRF-TOKEN') {
            continue;
        }
        try {
            const valor = decodeURIComponent(resto.join('='));
            return valor === '' ? null : valor;
        } catch {
            return null;
        }
    }
    return null;
}

// Libera este aparelho pela sessão do navegador (link mágico).
// O Laravel renova o cookie XSRF-TOKEN a cada resposta, e a meta csrf-token
// pode estar velha quando a casca vem do cache. Como o Laravel lê primeiro o
// X-CSRF-TOKEN e só olha o X-XSRF-TOKEN quando o outro falta, mandar os dois
// com a meta velha daria 419 de novo: com o cookie, vai só ele.
async function liberarPelaSessao(buscar, csrf, xsrf, agora) {
    const headers = { Accept: 'application/json' };
    if (xsrf) {
        headers['X-XSRF-TOKEN'] = xsrf;
    } else if (csrf) {
        headers['X-CSRF-TOKEN'] = csrf;
    }

    let resposta;
    try {
        resposta = await buscar('/rotina/aparelho', {
            method: 'POST',
            headers,
            credentials: 'same-origin',
        });
    } catch {
        return semRede(agora);
    }

    const corpo = await lerJson(resposta);

    if (resposta.status === 201 && typeof corpo?.token === 'string' && corpo.token !== '') {
        const usuario = await gravarEntrada(corpo, agora);
        return { estado: 'liberado', usuario };
    }

    if (corpo && (resposta.status === 401 || resposta.status === 419)) {
        return { estado: 'entrar', usuario: null };
    }

    if (corpo && resposta.status === 403) {
        return { estado: 'inativo', usuario: null };
    }

    // 429, 5xx e qualquer outro status: sem rede (sem token, não há carência).
    return semRede(agora);
}

// Devolve { estado, usuario }, com estado em 'liberado' | 'entrar' | 'inativo' | 'sem_rede'.
// `usuario` ({ nome, email }) só vem preenchido em 'liberado'.
// `csrf` é a meta csrf-token; `xsrf`, o cookie XSRF-TOKEN decodificado (lerXsrf).
export async function resolverAcesso({ fetch = globalThis.fetch, agora = Date.now(), csrf, xsrf } = {}) {
    // Passado adiante e sempre chamado como função solta: chamado como método
    // de outro objeto, o fetch do navegador dispara "Illegal invocation".
    const buscar = fetch;

    const token = await lerMeta('token');
    if (token) {
        const resultado = await checarToken(buscar, token, agora);
        if (resultado) {
            return resultado;
        }
    }

    return liberarPelaSessao(buscar, csrf, xsrf, agora);
}
