// Operações das pendências (store `itens`) e importação da planilha.
// Tudo passa pelo banco.js; nada aqui abre conexão própria nem sai do aparelho.
// Os campos chegam já conferidos por `validarPendencia` (regras/campos.js):
// cliente `{ nome, whatsapp }` e item `{ processo, data, hora, servico, valor_centavos }`.
import { transacao } from './banco.js';
import { normalizarTexto } from './clientes.js';

// Resultados aceitos ao resolver, por processo. Os nomes mostrados na tela
// ficam em ui/rotulos.js, com as mesmas chaves.
export const RESULTADOS = Object.freeze({
    '01': Object.freeze(['confirmou', 'remarcou', 'cancelou']),
    '04': Object.freeze(['fechou', 'recusou']),
    '05': Object.freeze(['pagou']),
});

const CAMPOS_EDITAVEIS = ['data', 'hora', 'servico', 'valor_centavos'];

function agora() {
    return new Date().toISOString();
}

function novoCliente(dados, momento) {
    return {
        id: crypto.randomUUID(),
        nome: dados.nome,
        whatsapp: dados.whatsapp,
        obs: dados.obs ?? '',
        criado_em: momento,
        atualizado_em: momento,
    };
}

function novoItem(clienteId, dados, momento) {
    return {
        id: crypto.randomUUID(),
        cliente_id: clienteId,
        processo: dados.processo,
        data: dados.data,
        hora: dados.hora ?? null,
        servico: dados.servico ?? '',
        valor_centavos: dados.valor_centavos ?? null,
        status: 'aberto',
        resultado: null,
        criado_em: momento,
        atualizado_em: momento,
    };
}

// Mesma pendência do mesmo cliente: processo, data, hora, valor e serviço
// (serviço sem diferença de caixa, acento e espaços).
function chaveDoItem(clienteId, item) {
    return [
        clienteId,
        item.processo,
        item.data ?? '',
        item.hora ?? '',
        item.valor_centavos ?? '',
        normalizarTexto(item.servico),
    ].join('|');
}

// Registra uma pendência. Com `cliente_id`, usa esse cliente; sem ele,
// reaproveita o cliente com o mesmo WhatsApp ou cria um novo. Tudo numa
// transação só. Resolve com `{ cliente, item, clienteNovo }`.
export async function registrarPendencia({ cliente, item, cliente_id: clienteId } = {}) {
    if (!item || !RESULTADOS[item.processo]) {
        throw new Error('Escolha o processo da pendência.');
    }
    if (!clienteId && !cliente?.whatsapp) {
        throw new Error('Falta o WhatsApp do cliente.');
    }

    const momento = agora();
    let escolhido = null;
    let clienteNovo = false;
    let gravado = null;

    await transacao(['clientes', 'itens'], 'readwrite', (l) => {
        const gravarItem = (registro) => {
            escolhido = registro;
            gravado = novoItem(registro.id, item, momento);
            l.itens.put(gravado);
        };

        if (clienteId) {
            const pedido = l.clientes.get(clienteId);
            pedido.onsuccess = () => {
                if (pedido.result) gravarItem(pedido.result);
            };
            return;
        }

        const pedido = l.clientes.getAll();
        pedido.onsuccess = () => {
            const existente = pedido.result.find((c) => String(c.whatsapp ?? '') === String(cliente.whatsapp));
            if (existente) {
                gravarItem(existente);
                return;
            }
            const criado = novoCliente(cliente, momento);
            l.clientes.put(criado);
            clienteNovo = true;
            gravarItem(criado);
        };
    });

    if (!gravado) {
        throw new Error('Cliente não encontrado.');
    }
    return { cliente: escolhido, item: gravado, clienteNovo };
}

// Lê o item e, se `mudar(atual)` devolver um registro, grava esse registro.
// Resolve com o item como ficou. Item inexistente rejeita sem gravar nada;
// `mudar` pode devolver um Error para rejeitar também sem gravar.
async function alterarItem(id, mudar) {
    let resultado = null;
    let erro = null;

    await transacao('itens', 'readwrite', (l) => {
        const pedido = l.itens.get(id);
        pedido.onsuccess = () => {
            const atual = pedido.result;
            if (!atual) return;
            const novo = mudar(atual);
            if (novo instanceof Error) {
                erro = novo;
                return;
            }
            if (novo) l.itens.put(novo);
            resultado = novo ?? atual;
        };
    });

    if (erro) throw erro;
    if (!resultado) throw new Error('Pendência não encontrada.');
    return resultado;
}

// Altera só `data`, `hora`, `servico` e `valor_centavos` (os informados) e
// `atualizado_em`. Resolve com o item gravado.
export function atualizarPendencia(id, campos = {}) {
    return alterarItem(id, (atual) => {
        const novo = { ...atual, atualizado_em: agora() };
        for (const campo of CAMPOS_EDITAVEIS) {
            if (campos[campo] !== undefined) novo[campo] = campos[campo];
        }
        return novo;
    });
}

// Marca o item como resolvido com um resultado do processo dele. Resultado de
// outro processo rejeita. Item que já não está aberto fica como está.
export function resolverPendencia(id, resultado) {
    return alterarItem(id, (atual) => {
        const aceitos = RESULTADOS[atual.processo] ?? [];
        if (!aceitos.includes(resultado)) {
            return new Error(`Resultado "${resultado}" não vale para esta pendência. Use: ${aceitos.join(', ')}.`);
        }
        if (atual.status !== 'aberto') return null;
        return { ...atual, status: 'resolvido', resultado, atualizado_em: agora() };
    });
}

// Marca o item como cancelado. Item que já não está aberto fica como está.
export function cancelarPendencia(id) {
    return alterarItem(id, (atual) => {
        if (atual.status !== 'aberto') return null;
        return { ...atual, status: 'cancelado', atualizado_em: agora() };
    });
}

// Grava as linhas válidas da planilha (`{ cliente, item }`, como saem de
// `lerPlanilha`) numa transação só. Cliente é reaproveitado pelo WhatsApp,
// inclusive entre linhas do mesmo arquivo. Linha igual a um item aberto que o
// cliente já tem (ou a uma linha anterior do mesmo arquivo) não cria outro e
// conta em `repetidos`. Entrada sem `cliente` ou `item` (linha inválida) é
// ignorada. Resolve com `{ clientesNovos, itens, repetidos }`.
export async function importarPendencias(linhasValidas = []) {
    const linhas = linhasValidas.filter((linha) => linha?.cliente && linha?.item);
    const contagem = { clientesNovos: 0, itens: 0, repetidos: 0 };
    if (linhas.length === 0) return contagem;

    const momento = agora();

    await transacao(['clientes', 'itens'], 'readwrite', (l) => {
        const pedidoClientes = l.clientes.getAll();
        pedidoClientes.onsuccess = () => {
            const pedidoAbertos = l.itens.index('status').getAll('aberto');
            pedidoAbertos.onsuccess = () => {
                const porWhatsapp = new Map();
                for (const c of pedidoClientes.result) {
                    porWhatsapp.set(String(c.whatsapp ?? ''), c);
                }
                const existentes = new Set(pedidoAbertos.result.map((i) => chaveDoItem(i.cliente_id, i)));

                for (const { cliente, item } of linhas) {
                    const whatsapp = String(cliente.whatsapp ?? '');
                    let registro = porWhatsapp.get(whatsapp);
                    if (!registro) {
                        registro = novoCliente(cliente, momento);
                        porWhatsapp.set(whatsapp, registro);
                        l.clientes.put(registro);
                        contagem.clientesNovos += 1;
                    }

                    const chave = chaveDoItem(registro.id, item);
                    if (existentes.has(chave)) {
                        contagem.repetidos += 1;
                        continue;
                    }
                    existentes.add(chave);
                    l.itens.put(novoItem(registro.id, item, momento));
                    contagem.itens += 1;
                }
            };
        };
    });

    return contagem;
}

// Situação do item para a tela: 'resolvido', 'cancelado', 'sem retorno'
// (04 aberto que já teve o toque `d7`) ou 'aberto'. Função pura.
export function situacao(item, toquesDoItem = []) {
    if (item.status === 'resolvido' || item.status === 'cancelado') return item.status;
    if (item.processo === '04' && (toquesDoItem ?? []).some((toque) => toque.etapa === 'd7')) {
        return 'sem retorno';
    }
    return 'aberto';
}
