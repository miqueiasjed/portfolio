// Registro do toque ("enviei") e da resposta do cliente, e o gancho único de
// eventos que a medição de uso (Plano 6) escuta. Nada aqui sai do aparelho.
import { transacao } from './banco.js';

const EVENTOS = ['toque', 'resposta', 'resolvido'];

let aoRegistrar = null;

// Define quem escuta os eventos. `null` desliga.
export function definirAoRegistrar(fn) {
    aoRegistrar = typeof fn === 'function' ? fn : null;
}

// Chama o gancho com `{ processo, quando }`. Erro do gancho é engolido:
// nunca impede nem desfaz uma gravação.
export function avisar(evento, dados) {
    if (!aoRegistrar || !EVENTOS.includes(evento)) return;
    try {
        const retorno = aoRegistrar(evento, dados);
        if (retorno && typeof retorno.catch === 'function') retorno.catch(() => {});
    } catch {
        // Gancho com defeito não atrapalha o registro.
    }
}

// `enviado_em` sempre como string ISO: `diaDoEnvio` (regras/hoje.js) ignora Date.
// Aceita Date, milissegundos ou texto ISO (com hora); texto como "04/12/2026"
// é recusado, porque o navegador leria mês e dia trocados.
function comoIso(valor) {
    if (valor === undefined || valor === null || valor === '') throw new Error('Falta a data do envio.');
    const textoIso = typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(valor);
    if (!(valor instanceof Date) && typeof valor !== 'number' && !textoIso) {
        throw new Error('Data do envio inválida.');
    }
    const instante = valor instanceof Date ? valor : new Date(valor);
    if (Number.isNaN(instante.getTime())) throw new Error('Data do envio inválida.');
    return instante.toISOString();
}

// Grava o toque de uma etapa do item. Se a etapa já tem toque, devolve o
// existente sem gravar e sem avisar. A conferência e a gravação ficam na
// mesma transação, para dois "Enviei" seguidos não virarem dois registros.
export async function registrarToque({ itemId, etapa, enviadoEm } = {}) {
    const enviado_em = comoIso(enviadoEm);
    let item = null;
    let toque = null;
    let novo = false;

    await transacao(['itens', 'toques'], 'readwrite', (l) => {
        const pedidoItem = l.itens.get(itemId);
        pedidoItem.onsuccess = () => {
            item = pedidoItem.result ?? null;
            if (!item) return;
            const pedidoToques = l.toques.index('item_id').getAll(itemId);
            pedidoToques.onsuccess = () => {
                const existente = pedidoToques.result.find((t) => t.etapa === etapa);
                if (existente) {
                    toque = existente;
                    return;
                }
                toque = { id: crypto.randomUUID(), item_id: itemId, etapa, enviado_em, respondeu: false };
                l.toques.put(toque);
                novo = true;
            };
        };
    });

    if (!item) throw new Error('Pendência não encontrada.');
    if (novo) avisar('toque', { processo: item.processo, quando: enviado_em });
    return toque;
}

// Marca que o cliente respondeu ao toque. Devolve `true` quando gravou e
// `false` quando já estava marcado (aí não avisa de novo).
export async function marcarRespondeu(toqueId, agora = new Date().toISOString()) {
    let achou = false;
    let mudou = false;
    let processo = null;

    await transacao(['toques', 'itens'], 'readwrite', (l) => {
        const pedidoToque = l.toques.get(toqueId);
        pedidoToque.onsuccess = () => {
            const atual = pedidoToque.result;
            if (!atual) return;
            achou = true;
            if (atual.respondeu === true) return;
            l.toques.put({ ...atual, respondeu: true });
            mudou = true;
            const pedidoItem = l.itens.get(atual.item_id);
            pedidoItem.onsuccess = () => {
                processo = pedidoItem.result?.processo ?? null;
            };
        };
    });

    if (!achou) throw new Error('Envio não encontrado.');
    if (!mudou) return false;
    avisar('resposta', { processo, quando: agora });
    return true;
}
