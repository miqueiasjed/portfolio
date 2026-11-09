// Contagem de uso no aparelho (Plano 6). Só números e datas: nada de cliente,
// item ou texto entra aqui. Este arquivo não faz chamada de rede; o envio fica
// na task 6.8.
//
// Formato de `meta.fila_uso`:
//   { dias: { 'YYYY-MM-DD': { enviados, respostas, resolvidos, por_processo: { '01': n } } },
//     alterados: ['YYYY-MM-DD', ...],
//     ultimo_envio_em: null | 'ISO' }
// Cada dia guarda o total do dia (o servidor substitui o dia inteiro a cada envio).
//
// Contrato para a 6.8:
// - `lotesParaEnviar(limite)` resolve com uma lista de lotes. Cada lote é uma
//   lista de dias, cada dia com exatamente as cinco chaves do endpoint:
//   `{ dia, enviados, respostas, resolvidos, por_processo }`. O corpo do POST é
//   `{ dias: lote }`, sem mexer no lote.
// - Depois do 204, chamar `marcarEnviados(lote, agora)` com o mesmo lote. Não há
//   marca de versão separada: o próprio dia enviado serve de versão. O dia só
//   sai de `alterados` se o total guardado ainda é igual ao que foi enviado;
//   se houve uso no meio do envio, ele fica para o próximo lote com o total novo.
// - Toda leitura e gravação da `fila_uso` acontece numa transação só.
import { transacao } from './banco.js';
import { definirAoRegistrar } from './registro.js';
import { diasEntre, ehDiaValido, hojeEmFortaleza } from '../regras/datas.js';

const CHAVE = 'fila_uso';
const DIAS_GUARDADOS = 40;
const LIMITE_LOTE = 31;
const CHAVE_PROCESSO = /^\d{2}$/;
const CAMPO_DO_EVENTO = { toque: 'enviados', resposta: 'respostas', resolvido: 'resolvidos' };

function filaVazia() {
    return { dias: {}, alterados: [], ultimo_envio_em: null };
}

// Aceita o que estiver guardado e devolve sempre a forma completa.
function normalizar(valor) {
    const fila = filaVazia();
    if (!valor || typeof valor !== 'object') return fila;
    if (valor.dias && typeof valor.dias === 'object') fila.dias = { ...valor.dias };
    if (Array.isArray(valor.alterados)) fila.alterados = valor.alterados.filter((d) => d in fila.dias);
    if (typeof valor.ultimo_envio_em === 'string') fila.ultimo_envio_em = valor.ultimo_envio_em;
    return fila;
}

function diaVazio() {
    return { enviados: 0, respostas: 0, resolvidos: 0, por_processo: {} };
}

// Lê a `fila_uso`, aplica `mudar` e grava, tudo na mesma transação.
// `mudar` é síncrona e altera a fila recebida.
function alterarFila(mudar) {
    return transacao('meta', 'readwrite', (l) => {
        const pedido = l.meta.get(CHAVE);
        pedido.onsuccess = () => {
            const fila = normalizar(pedido.result?.valor);
            mudar(fila);
            l.meta.put({ chave: CHAVE, valor: fila });
        };
    });
}

// Tira os dias com mais de 40 dias antes do dia mais novo guardado.
function podar(fila) {
    const dias = Object.keys(fila.dias).sort();
    if (dias.length === 0) return;
    const maisNovo = dias[dias.length - 1];
    for (const dia of dias) {
        if (diasEntre(dia, maisNovo) > DIAS_GUARDADOS) delete fila.dias[dia];
    }
    fila.alterados = fila.alterados.filter((d) => d in fila.dias);
}

function paraEnvio(dia, total) {
    return {
        dia,
        enviados: total.enviados,
        respostas: total.respostas,
        resolvidos: total.resolvidos,
        por_processo: { ...total.por_processo },
    };
}

function mesmoTotal(guardado, enviado) {
    if (!guardado || !enviado) return false;
    if (guardado.enviados !== enviado.enviados) return false;
    if (guardado.respostas !== enviado.respostas) return false;
    if (guardado.resolvidos !== enviado.resolvidos) return false;
    const a = guardado.por_processo ?? {};
    const b = enviado.por_processo ?? {};
    const chaves = Object.keys(a);
    if (chaves.length !== Object.keys(b).length) return false;
    return chaves.every((k) => a[k] === b[k]);
}

// Soma um evento do gancho de registro.js no dia local (Fortaleza) de `quando`.
// Evento desconhecido é ignorado. `quando` inválido lança erro (o gancho engole).
export async function contar(evento, { processo, quando } = {}) {
    const campo = CAMPO_DO_EVENTO[evento];
    if (!campo) return;
    const instante = new Date(quando);
    if (quando === undefined || quando === null || Number.isNaN(instante.getTime())) {
        throw new Error('Momento do evento inválido.');
    }
    const dia = hojeEmFortaleza(instante);

    await alterarFila((fila) => {
        const total = { ...diaVazio(), ...fila.dias[dia] };
        total.por_processo = { ...total.por_processo };
        total[campo] += 1;
        // Só chave de processo no formato do servidor entra no por_processo.
        if (evento === 'toque' && typeof processo === 'string' && CHAVE_PROCESSO.test(processo)) {
            total.por_processo[processo] = (total.por_processo[processo] ?? 0) + 1;
        }
        fila.dias[dia] = total;
        if (!fila.alterados.includes(dia)) fila.alterados.push(dia);
        podar(fila);
    });
}

// Dias alterados em ordem crescente, em lotes de até `limite` (máximo 31).
// Resolve com `[[{ dia, enviados, respostas, resolvidos, por_processo }, ...], ...]`.
export async function lotesParaEnviar(limite = LIMITE_LOTE) {
    const tamanho = Math.max(1, Math.min(LIMITE_LOTE, Math.trunc(Number(limite)) || LIMITE_LOTE));
    const registro = await transacao('meta', 'readonly', (l) => l.meta.get(CHAVE));
    const fila = normalizar(registro?.valor);

    const dias = [...new Set(fila.alterados)]
        .filter((d) => ehDiaValido(d) && fila.dias[d])
        .sort()
        .map((d) => paraEnvio(d, fila.dias[d]));

    const lotes = [];
    for (let i = 0; i < dias.length; i += tamanho) {
        lotes.push(dias.slice(i, i + tamanho));
    }
    return lotes;
}

// Recebe o lote enviado (os dias como saíram de `lotesParaEnviar`) e grava
// `ultimo_envio_em`. Tira de `alterados` só o dia cujo total guardado ainda é
// igual ao enviado. Os totais ficam guardados.
export async function marcarEnviados(dias, agora = new Date()) {
    if (!Array.isArray(dias) || dias.some((d) => !d || typeof d !== 'object' || typeof d.dia !== 'string')) {
        throw new TypeError('marcarEnviados espera os dias como saíram de lotesParaEnviar.');
    }
    const momento = new Date(agora);
    if (Number.isNaN(momento.getTime())) throw new Error('Momento do envio inválido.');
    const enviadoEm = momento.toISOString();

    await alterarFila((fila) => {
        const enviados = new Map(dias.map((d) => [d.dia, d]));
        fila.alterados = fila.alterados.filter((dia) => {
            const enviado = enviados.get(dia);
            return !enviado || !mesmoTotal(fila.dias[dia], enviado);
        });
        fila.ultimo_envio_em = enviadoEm;
    });
}

// Liga a contagem ao gancho de registro.js. Quem chama no boot é a task 6.8.
export function ligarContagem() {
    definirAoRegistrar(contar);
}
