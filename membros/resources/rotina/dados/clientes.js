// Operações das telas de clientes, sobre as stores `clientes`, `itens` e `toques`.
// Tudo passa pelo banco.js; nada aqui abre conexão própria nem sai do aparelho.
import { listar, transacao } from './banco.js';

const MAXIMO_PARECIDOS = 3;
const MINIMO_DIGITOS = 4;
const MINIMO_LETRAS = 2;

// Minúsculas, sem acento e com espaços simples, para comparar nomes.
export function normalizarTexto(valor) {
    return String(valor ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

function soDigitos(valor) {
    return String(valor ?? '').replace(/\D/g, '');
}

function compararNomes(a, b) {
    return String(a.nome ?? '').localeCompare(String(b.nome ?? ''), 'pt-BR', { sensitivity: 'base' });
}

function nomeContem(cliente, texto) {
    return texto !== '' && normalizarTexto(cliente.nome).includes(texto);
}

function whatsappContem(cliente, digitos) {
    return digitos !== '' && String(cliente.whatsapp ?? '').includes(digitos);
}

// O número digitado pode vir sem o 55; o guardado sempre tem.
function whatsappIgual(cliente, digitos) {
    const guardado = String(cliente.whatsapp ?? '');
    return digitos !== '' && (guardado === digitos || guardado === `55${digitos}`);
}

// Até 3 clientes que já parecem ser quem está sendo cadastrado: telefone que
// contém os dígitos digitados (a partir de 4) ou nome que contém o texto (a
// partir de 2 letras, sem diferença de caixa e acento). Telefone igual primeiro,
// depois telefone parecido, depois só nome; empate em ordem alfabética.
export async function acharClienteParecido({ nome, whatsapp } = {}) {
    const texto = normalizarTexto(nome);
    const digitos = soDigitos(whatsapp);
    const usarNome = texto.length >= MINIMO_LETRAS ? texto : '';
    const usarDigitos = digitos.length >= MINIMO_DIGITOS ? digitos : '';

    if (!usarNome && !usarDigitos) {
        return [];
    }

    const peso = (cliente) => {
        if (whatsappIgual(cliente, usarDigitos)) return 0;
        if (whatsappContem(cliente, usarDigitos)) return 1;
        if (nomeContem(cliente, usarNome)) return 2;
        return -1;
    };

    const clientes = await listar('clientes');
    return clientes
        .map((cliente) => ({ cliente, peso: peso(cliente) }))
        .filter((par) => par.peso >= 0)
        .sort((a, b) => a.peso - b.peso || compararNomes(a.cliente, b.cliente))
        .slice(0, MAXIMO_PARECIDOS)
        .map((par) => par.cliente);
}

// Termo feito só de dígitos e pontuação de telefone também procura no WhatsApp.
function casaComTermo(cliente, termo) {
    const texto = normalizarTexto(termo);
    if (texto === '') {
        return true;
    }
    if (nomeContem(cliente, texto)) {
        return true;
    }
    if (/^[\d\s()+.-]+$/.test(texto)) {
        return whatsappContem(cliente, soDigitos(texto));
    }
    return false;
}

// Clientes que casam com o termo (vazio traz todos), cada um com `abertas`
// (quantos itens `aberto` ele tem), em ordem alfabética.
export async function buscarClientes(termo = '') {
    const dados = await transacao(['clientes', 'itens'], 'readonly', (l) => ({
        clientes: l.clientes.getAll(),
        abertos: l.itens.index('status').getAll('aberto'),
    }));

    const abertasPorCliente = new Map();
    for (const item of dados.abertos) {
        abertasPorCliente.set(item.cliente_id, (abertasPorCliente.get(item.cliente_id) ?? 0) + 1);
    }

    return dados.clientes
        .filter((cliente) => casaComTermo(cliente, termo))
        .map((cliente) => ({ ...cliente, abertas: abertasPorCliente.get(cliente.id) ?? 0 }))
        .sort(compararNomes);
}

function compararPorData(a, b) {
    const porData = String(a.data ?? '').localeCompare(String(b.data ?? ''));
    return porData || String(a.hora ?? '').localeCompare(String(b.hora ?? ''));
}

// Cliente com as pendências separadas e os toques de cada uma.
// - `abertas`: itens `aberto`, data (e hora) crescente.
// - `fechadas`: itens `resolvido` e `cancelado`, `atualizado_em` decrescente.
// - `toques`: `{ [item_id]: [toque, ...] }` por `enviado_em` crescente; todo item
//   do cliente aparece, com lista vazia quando ainda não tem toque.
// Cliente inexistente resolve com `null`.
export async function detalheCliente(id) {
    let cliente = null;
    let itens = [];
    const toques = {};

    await transacao(['clientes', 'itens', 'toques'], 'readonly', (l) => {
        const pedidoCliente = l.clientes.get(id);
        pedidoCliente.onsuccess = () => {
            cliente = pedidoCliente.result ?? null;
        };

        const pedidoItens = l.itens.index('cliente_id').getAll(id);
        pedidoItens.onsuccess = () => {
            itens = pedidoItens.result;
            for (const item of itens) {
                toques[item.id] = [];
                const pedidoToques = l.toques.index('item_id').getAll(item.id);
                pedidoToques.onsuccess = () => {
                    toques[item.id] = pedidoToques.result.sort((a, b) =>
                        String(a.enviado_em ?? '').localeCompare(String(b.enviado_em ?? '')),
                    );
                };
            }
        };
    });

    if (!cliente) {
        return null;
    }

    const abertas = itens.filter((item) => item.status === 'aberto').sort(compararPorData);
    const fechadas = itens
        .filter((item) => item.status === 'resolvido' || item.status === 'cancelado')
        .sort((a, b) => String(b.atualizado_em ?? '').localeCompare(String(a.atualizado_em ?? '')));

    return { cliente, abertas, fechadas, toques };
}

// Atualiza um cliente que já existe. `whatsapp` chega normalizado (só dígitos,
// com 55). Campo não informado mantém o valor guardado. Resolve com o registro
// gravado; cliente inexistente rejeita sem gravar nada.
export async function salvarCliente({ id, nome, whatsapp, obs } = {}) {
    let gravado = null;

    await transacao('clientes', 'readwrite', (l) => {
        const pedido = l.clientes.get(id);
        pedido.onsuccess = () => {
            const atual = pedido.result;
            if (!atual) {
                return;
            }
            gravado = {
                ...atual,
                nome: nome ?? atual.nome,
                whatsapp: whatsapp ?? atual.whatsapp,
                obs: obs ?? atual.obs,
                atualizado_em: new Date().toISOString(),
            };
            l.clientes.put(gravado);
        };
    });

    if (!gravado) {
        throw new Error('Cliente não encontrado.');
    }
    return gravado;
}

// Apaga o cliente, as pendências dele e os toques dessas pendências, tudo na
// mesma transação: ou some tudo, ou nada muda. Resolve com quantos itens e
// toques foram apagados junto.
export async function excluirCliente(id) {
    const apagados = { itens: 0, toques: 0 };

    await transacao(['clientes', 'itens', 'toques'], 'readwrite', (l) => {
        const pedidoItens = l.itens.index('cliente_id').getAllKeys(id);
        pedidoItens.onsuccess = () => {
            for (const itemId of pedidoItens.result) {
                const pedidoToques = l.toques.index('item_id').getAllKeys(itemId);
                pedidoToques.onsuccess = () => {
                    for (const toqueId of pedidoToques.result) {
                        l.toques.delete(toqueId);
                        apagados.toques += 1;
                    }
                };
                l.itens.delete(itemId);
                apagados.itens += 1;
            }
        };
        l.clientes.delete(id);
    });

    return apagados;
}
