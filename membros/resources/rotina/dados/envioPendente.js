// Lembra no aparelho que o dono abriu o WhatsApp para uma pendência, para a
// pergunta "Enviou?" aparecer na volta mesmo que a ferramenta tenha recarregado.
// Abrir o WhatsApp não registra toque: só a resposta "Enviei" registra.

import { apagar, gravarMeta, lerMeta } from './banco.js';

const CHAVE = 'envio_pendente';

// Depois disso a pergunta "Enviou?" já não faz sentido e o item segue na lista.
export const PRAZO_PENDENTE_HORAS = 12;

const PRAZO_MS = PRAZO_PENDENTE_HORAS * 60 * 60 * 1000;

function paraIso(data) {
    const valor = data instanceof Date ? data : new Date(data);
    if (Number.isNaN(valor.getTime())) {
        throw new Error('Data de abertura inválida.');
    }
    return valor.toISOString();
}

// Só existe um pendente por vez: guardar outro substitui o anterior.
export async function guardarPendente({ itemId, etapa, abertoEm }) {
    const registro = { item_id: itemId, etapa, aberto_em: paraIso(abertoEm) };
    await gravarMeta(CHAVE, registro);
    return registro;
}

// Devolve `{ item_id, etapa, aberto_em }` ou null. Pendente vencido é apagado.
export async function lerPendente(agora = new Date()) {
    const pendente = await lerMeta(CHAVE);
    if (!pendente) {
        return null;
    }

    const aberto = new Date(pendente.aberto_em).getTime();
    const momento = (agora instanceof Date ? agora : new Date(agora)).getTime();
    if (Number.isNaN(aberto) || momento - aberto > PRAZO_MS) {
        await limparPendente();
        return null;
    }

    return pendente;
}

export async function limparPendente() {
    await apagar('meta', CHAVE);
}
