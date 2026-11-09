// Envio da contagem de uso para POST /rotina/uso (Plano 6). O corpo é só o que
// `lotesParaEnviar` monta: datas e números, nada de cliente. Sai do aparelho
// também o token, no cabeçalho Authorization.
//
// Como cada resposta é tratada:
// - 204: único sucesso. Os dias saem de `alterados` (se não mudaram no meio).
// - 401 ou 403 com JSON do Laravel: para tudo e não marca nada; a checagem de
//   acesso trata na próxima abertura.
// - 422 com JSON: reenvia o lote um dia por vez. Dia aceito sai como enviado;
//   dia recusado é descartado, menos o de hoje local, que fica em `alterados`
//   (relógio do aparelho adiantado perto da meia-noite).
// - 429: para e tenta na próxima oportunidade, sem marcar nada.
// - Erro de rede, 5xx ou resposta que não é JSON do Laravel (página da
//   Cloudflare, portal de Wi-Fi, proxy): para e tenta na próxima oportunidade.
import { lerJson } from './acesso.js';
import { lerMeta } from './banco.js';
import { lotesParaEnviar, marcarEnviados } from './uso.js';
import { diasEntre, hojeEmFortaleza } from '../regras/datas.js';

// Sem query string: qualquer parâmetro na URL dá 422 no servidor.
const URL_USO = '/rotina/uso';
const UMA_HORA_MS = 60 * 60 * 1000;
// O servidor recusa dia com mais de 60 dias antes de hoje.
const DIAS_ACEITOS = 60;

// Envio em andamento. Timer e evento `online` juntos não fazem segunda requisição.
let emAndamento = null;

// Um POST. Devolve 'ok', 'recusado', 'invalido', 'limite', 'servidor' ou 'rede'.
async function postar(buscar, token, dias) {
    let resposta;
    try {
        resposta = await buscar(URL_USO, {
            method: 'POST',
            credentials: 'omit',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify({ dias }),
        });
    } catch {
        return 'rede';
    }

    if (resposta.status === 204) return 'ok';
    if (resposta.status === 429) return 'limite';
    // Sem JSON, a resposta não saiu do Laravel e nunca conta como recusa.
    const corpo = await lerJson(resposta);
    if (!corpo) return 'rede';
    if (resposta.status === 401 || resposta.status === 403) return 'recusado';
    if (resposta.status === 422) return 'invalido';
    return 'servidor';
}

async function enviar(buscar, agora, resultado) {
    const token = await lerMeta('token');
    if (typeof token !== 'string' || token === '') {
        resultado.parou = 'sem_token';
        return resultado;
    }

    const hoje = hojeEmFortaleza(agora);
    const lotes = await lotesParaEnviar();

    for (const original of lotes) {
        // Dia velho demais nunca passa: sai da fila sem ir para o servidor.
        const velhos = original.filter((d) => diasEntre(d.dia, hoje) > DIAS_ACEITOS);
        if (velhos.length > 0) {
            await marcarEnviados(velhos, agora);
            resultado.descartados += velhos.length;
        }
        // Dia depois de hoje local fica guardado até deixar de ser futuro.
        const lote = original.filter((d) => !velhos.includes(d) && d.dia <= hoje);
        if (lote.length === 0) continue;

        const situacao = await postar(buscar, token, lote);
        if (situacao === 'ok') {
            await marcarEnviados(lote, agora);
            resultado.enviados += lote.length;
            continue;
        }
        if (situacao !== 'invalido') {
            resultado.parou = situacao;
            return resultado;
        }

        // 422: um dia por vez, para descartar só o dia recusado.
        for (const dia of lote) {
            const doDia = lote.length > 1 ? await postar(buscar, token, [dia]) : situacao;
            if (doDia === 'ok') {
                await marcarEnviados([dia], agora);
                resultado.enviados += 1;
            } else if (doDia === 'invalido') {
                if (dia.dia < hoje) {
                    console.warn('Contagem de uso recusada pelo servidor e descartada:', dia.dia);
                    await marcarEnviados([dia], agora);
                    resultado.descartados += 1;
                }
            } else {
                resultado.parou = doDia;
                return resultado;
            }
        }
    }
    return resultado;
}

// Manda os dias alterados. Nunca lança erro: resolve com
// `{ enviados, descartados, parou }`, com `parou` em null quando foi até o fim.
// Chamado de novo durante um envio, devolve o envio em andamento.
export function enviarAgora({ fetch = globalThis.fetch, agora = new Date() } = {}) {
    if (emAndamento) return emAndamento;

    // Sempre chamado como função solta: como método de outro objeto, o fetch
    // do navegador dispara "Illegal invocation".
    const buscar = fetch;
    const resultado = { enviados: 0, descartados: 0, parou: null };
    emAndamento = enviar(buscar, agora, resultado)
        .catch(() => ({ ...resultado, parou: 'erro' }))
        .finally(() => {
            emAndamento = null;
        });
    return emAndamento;
}

const FOLGA_MS = 60 * 1000;

// Envia ao abrir e depois no máximo uma vez a cada `intervaloMs`: pelo timer ou
// quando a rede volta, só se a última tentativa foi há `intervaloMs` ou mais.
// Devolve a função que desliga timer e listener.
export function iniciarEnvioDeUso({ intervaloMs = UMA_HORA_MS, fetch } = {}) {
    let ultimaTentativa = 0;

    const tentar = () => {
        ultimaTentativa = Date.now();
        enviarAgora({ fetch });
    };
    // Folga de 1 minuto: sem ela, um timer que dispara um pouco antes da hora, ou
    // uma volta da rede que reinicia a contagem, faz o envio pular uma hora inteira.
    const folga = Math.min(FOLGA_MS, intervaloMs / 10);
    const seJaPassou = () => {
        if (Date.now() - ultimaTentativa >= intervaloMs - folga) tentar();
    };

    tentar();
    const timer = setInterval(seJaPassou, intervaloMs);
    const janela = typeof window !== 'undefined' && typeof window.addEventListener === 'function' ? window : null;
    janela?.addEventListener('online', seJaPassou);

    return () => {
        clearInterval(timer);
        janela?.removeEventListener('online', seJaPassou);
    };
}
