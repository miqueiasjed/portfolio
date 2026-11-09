// Ajustes do dono (store `ajustes`, um registro só com `chave: 'geral'`).
import { pegar, transacao } from './banco.js';

const CHAVE = 'geral';

export const AJUSTES_PADRAO = Object.freeze({
    chave: CHAVE,
    segmento: 'clinica',
    negocio: '',
    assinatura: '',
    chave_pix: '',
    prazos: Object.freeze({
        orcamento: Object.freeze([3, 7]),
        cobranca: Object.freeze([1, 5, 15]),
    }),
    variacao: 1,
});

function ehObjeto(valor) {
    return valor !== null && typeof valor === 'object' && !Array.isArray(valor);
}

// Copia só os campos definidos de `extra` sobre `base`; `prazos` mescla um nível
// abaixo (as listas de dias entram inteiras). Devolve objeto novo, sem tocar nos
// originais, e sempre com `chave: 'geral'`.
function mesclar(base, extra) {
    const saida = structuredClone({ ...base, prazos: { ...base.prazos } });
    if (ehObjeto(extra)) {
        for (const [nome, valor] of Object.entries(extra)) {
            if (valor === undefined || nome === 'prazos') {
                continue;
            }
            saida[nome] = structuredClone(valor);
        }
        if (ehObjeto(extra.prazos)) {
            for (const [nome, valor] of Object.entries(extra.prazos)) {
                if (valor !== undefined) {
                    saida.prazos[nome] = structuredClone(valor);
                }
            }
        }
    }
    saida.chave = CHAVE;
    return saida;
}

// Registro salvo por cima do padrão, ou o padrão quando ainda não há nada.
export async function lerAjustes() {
    const salvo = await pegar('ajustes', CHAVE);
    return mesclar(AJUSTES_PADRAO, salvo);
}

// Mescla `parcial` com o que está salvo e grava, lendo e escrevendo na mesma
// transação para duas chamadas seguidas não se atropelarem. Resolve com os
// ajustes completos que ficaram gravados.
export async function salvarAjustes(parcial = {}) {
    let final;
    await transacao('ajustes', 'readwrite', (l) => {
        const pedido = l.ajustes.get(CHAVE);
        pedido.onsuccess = () => {
            final = mesclar(mesclar(AJUSTES_PADRAO, pedido.result), parcial);
            l.ajustes.put(final);
        };
    });
    return final;
}
