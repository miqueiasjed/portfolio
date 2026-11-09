// Decide, ao abrir a ferramenta, se o dono entra ou qual tela de acesso vê.
// As chamadas de rede são GET /rotina/acesso, POST /rotina/aparelho e, na
// entrada por código, POST /rotina/codigo e /rotina/codigo/confirmar; no Voltar
// da tela de outra conta, POST /sair. Sai do aparelho só o próprio token, ou o
// e-mail e o código digitados pelo dono.

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

// E-mail na forma guardada em `meta.dono`: sem espaços nas pontas e em minúsculas.
function normalizarEmail(email) {
    return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

// E-mail da outra conta para a tela: primeira letra, ***, @ e domínio. O
// domínio pode vir sem ponto (ana@localhost). Sem e-mail reconhecível, devolve
// '' e a tela usa a frase sem o e-mail.
export function mascararEmail(email) {
    const partes = /^([^\s@])[^\s@]*@([^\s@]+)$/.exec(normalizarEmail(email));
    return partes ? `${partes[1]}***@${partes[2]}` : '';
}

// Stores com dados do negócio. `clientes`, `itens` e `toques` são os dados de
// clientes; `ajustes` guarda nome do negócio e chave Pix do dono.
const STORES_DE_CLIENTES = ['clientes', 'itens', 'toques'];
const STORES_DE_DADOS = [...STORES_DE_CLIENTES, 'ajustes'];

// Roda `fn` com os resultados das leituras, dentro da mesma transação. Pedidos
// de uma transação terminam na ordem em que foram feitos: quando o último
// termina, todos os resultados estão prontos e a transação segue ativa para
// as gravações. Erro em `fn` desfaz a transação inteira; `falha.erro` guarda o
// erro original para quem chamou.
function aposLeituras(tx, pedidos, falha, fn) {
    pedidos[pedidos.length - 1].onsuccess = () => {
        try {
            fn(...pedidos.map((pedido) => pedido.result));
        } catch (erro) {
            falha.erro = erro;
            try {
                tx.abort();
            } catch {
                // A transação já tinha terminado.
            }
        }
    };
}

async function emTransacao(stores, fn) {
    const falha = { erro: null };
    try {
        await transacao(stores, 'readwrite', (l, tx) => fn(l, tx, falha));
    } catch (erro) {
        throw falha.erro ?? erro;
    }
}

// Enfileira a gravação da conta que entrou. `dono` vai por último.
function gravarConta(meta, corpo, agora) {
    const usuario = usuarioDe(corpo);
    meta.put({ chave: 'token', valor: corpo.token });
    meta.put({ chave: 'usuario', valor: usuario });
    meta.put({ chave: 'acesso_ok_em', valor: new Date(agora).toISOString() });
    const email = normalizarEmail(usuario.email);
    if (email) {
        meta.put({ chave: 'dono', valor: email });
    }
    return usuario;
}

// Grava a entrada depois de um 201 com { token, nome, email }, do POST
// /rotina/aparelho ou da confirmação do código por e-mail.
//
// Conferir de quem são os dados e gravar acontecem na mesma transação, então
// nada entra entre a leitura e a gravação:
// - aparelho sem dono, ou dono igual ao e-mail que chegou: grava token,
//   usuario, acesso_ok_em e dono;
// - dono diferente, sem clientes, itens nem toques: grava a conta nova e
//   apaga ajustes e fila_uso da conta anterior;
// - dono diferente com algum dado: não grava nada. O token novo fica só no
//   `pendente` devolvido, em memória.
//
// Devolve { estado: 'liberado', usuario } ou
// { estado: 'outra_conta', usuario: null, pendente, dono } com o dono mascarado
// ('' quando o e-mail guardado não é reconhecível).
// Sem `meta.dono`, vale o e-mail de `meta.usuario`, quando houver.
export async function gravarEntrada(corpo, agora) {
    const email = normalizarEmail(corpo.email);
    let usuario = null;
    let donoGuardado = '';

    await emTransacao([...STORES_DE_DADOS, 'meta'], (l, tx, falha) => {
        const pedidos = [
            l.meta.get('dono'),
            l.meta.get('usuario'),
            ...STORES_DE_CLIENTES.map((nome) => l[nome].count()),
        ];
        aposLeituras(tx, pedidos, falha, (registroDono, registroUsuario, ...contagens) => {
            const dono = normalizarEmail(registroDono?.valor) || normalizarEmail(registroUsuario?.valor?.email);
            if (dono && dono !== email) {
                if (contagens.some((n) => n > 0)) {
                    donoGuardado = dono;
                    return;
                }
                l.ajustes.clear();
                l.meta.delete('fila_uso');
            }
            usuario = gravarConta(l.meta, corpo, agora);
        });
    });

    if (donoGuardado) {
        return { estado: 'outra_conta', usuario: null, pendente: corpo, dono: mascararEmail(donoGuardado) };
    }
    if (!usuario) {
        // A transação terminou sem chegar à decisão: não conta como entrada.
        throw new Error('A entrada não foi gravada neste aparelho.');
    }
    return { estado: 'liberado', usuario };
}

// Outra conta no aparelho e o dono escolheu apagar: limpa as quatro stores de
// dados, apaga fila_uso e grava a conta de `pendente` numa transação só. Se
// qualquer operação falhar, nada muda. Devolve o usuario gravado ou lança.
export async function apagarDadosEEntrar(pendente, agora = Date.now()) {
    if (typeof pendente?.token !== 'string' || pendente.token === '') {
        throw new Error('Entrada sem a chave do aparelho.');
    }
    let usuario = null;
    await emTransacao([...STORES_DE_DADOS, 'meta'], (l) => {
        for (const nome of STORES_DE_DADOS) {
            l[nome].clear();
        }
        l.meta.delete('fila_uso');
        usuario = gravarConta(l.meta, pendente, agora);
    });
    return usuario;
}

// Token aceito pelo servidor prova que é a mesma conta: `dono` acompanha o
// e-mail da checagem, inclusive quando ele muda no servidor.
async function gravarChecagem(usuario, agora) {
    const email = normalizarEmail(usuario.email);
    await transacao('meta', 'readwrite', (l) => {
        l.meta.put({ chave: 'usuario', valor: usuario });
        l.meta.put({ chave: 'acesso_ok_em', valor: new Date(agora).toISOString() });
        if (email) {
            l.meta.put({ chave: 'dono', valor: email });
        }
    });
}

// Token recusado: apaga a entrada e mantém `dono`. Aparelho de antes do
// marcador ganha `dono` com o e-mail de `usuario` antes de ele sair.
async function esquecerAparelho() {
    await emTransacao('meta', (l, tx, falha) => {
        const pedidos = [l.meta.get('dono'), l.meta.get('usuario')];
        aposLeituras(tx, pedidos, falha, (registroDono, registroUsuario) => {
            const email = normalizarEmail(registroUsuario?.valor?.email);
            if (!normalizarEmail(registroDono?.valor) && email) {
                l.meta.put({ chave: 'dono', valor: email });
            }
            l.meta.delete('token');
            l.meta.delete('usuario');
            l.meta.delete('acesso_ok_em');
        });
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
function headersDaSessao(csrf, xsrf) {
    const headers = { Accept: 'application/json' };
    if (xsrf) {
        headers['X-XSRF-TOKEN'] = xsrf;
    } else if (csrf) {
        headers['X-CSRF-TOKEN'] = csrf;
    }
    return headers;
}

async function liberarPelaSessao(buscar, csrf, xsrf, agora) {
    let resposta;
    try {
        resposta = await buscar('/rotina/aparelho', {
            method: 'POST',
            headers: headersDaSessao(csrf, xsrf),
            credentials: 'same-origin',
        });
    } catch {
        return semRede(agora);
    }

    const corpo = await lerJson(resposta);

    if (resposta.status === 201 && typeof corpo?.token === 'string' && corpo.token !== '') {
        const resultado = await gravarEntrada(corpo, agora);
        return resultado.estado === 'outra_conta' ? { ...resultado, origem: 'sessao' } : resultado;
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

// Encerra a sessão do navegador (POST /sair). Usada no Voltar da tela de outra
// conta que veio do link mágico: com a sessão viva, cada recarga faria outro
// POST /rotina/aparelho e reabriria a tela. Ignora resposta e falha de rede.
export async function sairDaSessao({ fetch = globalThis.fetch, xsrf, csrf } = {}) {
    const buscar = fetch;
    try {
        await buscar('/sair', {
            method: 'POST',
            headers: headersDaSessao(csrf, xsrf),
            credentials: 'same-origin',
        });
    } catch {
        // Sem rede: nada a fazer aqui.
    }
}

// Voltar da tela de outra conta. Nada é apagado nem gravado no aparelho: o
// pendente só é descartado por quem chamou. Origem `sessao` encerra a sessão
// antes; origem `codigo` não tem sessão. Devolve o estado seguinte.
export async function voltarDaOutraConta({ origem, fetch = globalThis.fetch, xsrf, csrf } = {}) {
    if (origem === 'sessao') {
        await sairDaSessao({ fetch, xsrf, csrf });
    }
    return { estado: 'entrar', usuario: null };
}

// Devolve { estado, usuario }, com estado em 'liberado' | 'entrar' | 'inativo' |
// 'sem_rede' | 'outra_conta'. `usuario` ({ nome, email }) só vem preenchido em
// 'liberado'. Em 'outra_conta' vêm também `pendente` (a resposta do servidor,
// com o token novo, só em memória), `dono` (e-mail mascarado) e `origem`.
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

// Entrada por código (app adicionado à tela de início, sem o cookie do Safari).
// Os erros de validação do Laravel saem em inglês, por isso o e-mail e o
// código são conferidos aqui antes de postar e nenhum texto em inglês chega à
// tela: só passam as mensagens que o controller escreve em português.

export const ERRO_EMAIL = 'Confira o e-mail digitado.';
export const ERRO_CODIGO = 'O código tem 6 dígitos.';
export const ERRO_MUITAS = 'Muitas tentativas. Espere um minuto.';
export const ERRO_REDE = 'Sem conexão. Confira a internet e tente de novo.';
export const ERRO_GERAL = 'Não deu certo agora. Tente de novo em instantes.';
export const ERRO_GRAVAR = 'Não consegui gravar a entrada neste aparelho. Peça um novo código.';
// Rede caiu ou a resposta veio ilegível depois do envio: o servidor pode já ter
// aceitado e apagado o código, então a orientação é tentar o mesmo e, se falhar, pedir outro.
export const ERRO_CONFIRMAR_INCERTO = 'Não deu para confirmar agora. Se o mesmo código não funcionar, peça um novo.';

const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function emailValido(email) {
    return email.length <= 255 && FORMATO_EMAIL.test(email);
}

function textoDe(valor) {
    return typeof valor === 'string' ? valor.trim() : '';
}

async function postarJson(buscar, url, dados, csrf) {
    const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
    if (csrf) {
        headers['X-CSRF-TOKEN'] = csrf;
    }
    return buscar(url, { method: 'POST', headers, body: JSON.stringify(dados) });
}

// 429 com texto próprio do controller vira a mensagem; o throttle por IP manda
// "Too Many Attempts." em inglês junto com o header Retry-After, e aí vale o
// texto padrão.
function erroDe429(resposta, corpo) {
    const mensagem = textoDe(corpo?.message);
    const doThrottle = Boolean(resposta.headers?.get?.('retry-after'));
    return { erro: mensagem && !doThrottle ? mensagem : ERRO_MUITAS };
}

// Pede o código por e-mail. Devolve true quando o servidor aceitou o pedido
// (204, tenha o e-mail comprado ou não) ou { erro } com o texto para a tela.
export async function pedirCodigo({ email, csrf, fetch = globalThis.fetch } = {}) {
    const buscar = fetch;
    const limpo = textoDe(email);
    if (!emailValido(limpo)) {
        return { erro: ERRO_EMAIL };
    }

    let resposta;
    try {
        resposta = await postarJson(buscar, '/rotina/codigo', { email: limpo }, csrf);
    } catch {
        return { erro: ERRO_REDE };
    }

    if (resposta.status === 204) {
        return true;
    }

    const corpo = await lerJson(resposta);
    // 429 em HTML (limite da Cloudflare) não tem JSON, mas continua sendo excesso de tentativas.
    if (resposta.status === 429) {
        return erroDe429(resposta, corpo);
    }
    if (!corpo) {
        return { erro: ERRO_GERAL };
    }
    if (resposta.status === 422) {
        return { erro: ERRO_EMAIL };
    }
    return { erro: ERRO_GERAL };
}

// Troca o código pelo aparelho liberado. Devolve { estado: 'liberado', usuario }
// depois de gravar token, usuario e acesso_ok_em; { estado: 'outra_conta', ... }
// com `origem: 'codigo'` quando o aparelho guarda dados de outra conta (nada
// gravado); ou { erro } com o texto para a tela.
// `gravar` existe para os testes simularem falha na gravação.
export async function confirmarCodigo({
    email,
    codigo,
    csrf,
    fetch = globalThis.fetch,
    agora = Date.now(),
    gravar = gravarEntrada,
} = {}) {
    const buscar = fetch;
    const limpo = textoDe(email);
    const digitos = textoDe(codigo).replace(/\s+/g, '');
    if (!emailValido(limpo)) {
        return { erro: ERRO_EMAIL };
    }
    if (!/^\d{6}$/.test(digitos)) {
        return { erro: ERRO_CODIGO };
    }

    let resposta;
    try {
        resposta = await postarJson(buscar, '/rotina/codigo/confirmar', { email: limpo, codigo: digitos }, csrf);
    } catch {
        return { erro: ERRO_CONFIRMAR_INCERTO };
    }

    const corpo = await lerJson(resposta);
    if (resposta.status === 429) {
        return erroDe429(resposta, corpo);
    }
    if (!corpo) {
        return { erro: ERRO_CONFIRMAR_INCERTO };
    }

    if (resposta.status === 201 && typeof corpo.token === 'string' && corpo.token !== '') {
        try {
            const resultado = await gravar(corpo, agora);
            return resultado.estado === 'outra_conta' ? { ...resultado, origem: 'codigo' } : resultado;
        } catch {
            return { erro: ERRO_GRAVAR };
        }
    }

    if (resposta.status === 422) {
        // Com `errors`, é a validação do Laravel (texto em inglês): não vai para a tela.
        const mensagem = corpo.errors ? '' : textoDe(corpo.message);
        return { erro: mensagem || 'Confira o e-mail e o código.' };
    }

    return { erro: ERRO_GERAL };
}
