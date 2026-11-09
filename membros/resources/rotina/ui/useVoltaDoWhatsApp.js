// Percebe que o dono voltou do WhatsApp e diz quando perguntar "Enviou?".
// A lógica fica em funções sem React (criarVoltaDoWhatsApp, ouvirVolta,
// responderEnviei, responderAindaNao e as do passo 2 da folha: opcoesDeResultado,
// responderResultado, responderSoRespondeu, conferirRemarcacao, responderRemarcou,
// desfazerRemarcacao) para os testes rodarem sem navegador.

import { useCallback, useEffect, useRef, useState } from 'react';
import { lerPendente, limparPendente } from '../dados/envioPendente.js';
import { marcarRespondeu, registrarToque } from '../dados/registro.js';
import {
    RESULTADOS,
    atualizarPendencia,
    cancelarPendencia,
    registrarPendencia,
    resolverPendencia,
} from '../dados/pendencias.js';
import { MENSAGENS, lerData, lerHora } from '../regras/campos.js';
import { RESULTADOS as ROTULOS_RESULTADOS } from './rotulos.js';

// Controla a pergunta de um item e etapa. A checagem é idempotente: com a
// pergunta aberta não faz nada, e chamadas juntas (visibilitychange, pageshow
// e focus disparando na mesma volta) dividem a mesma leitura do pendente.
// - `ler(agora)` e `limpar()`: lerPendente e limparPendente, trocáveis no teste.
// - `aoMudar({ perguntar, pendente })`: avisa cada mudança de estado.
export function criarVoltaDoWhatsApp({
    itemId,
    etapa,
    ler = lerPendente,
    limpar = limparPendente,
    agora = () => new Date(),
    aoMudar = () => {},
}) {
    let perguntar = false;
    let pendente = null; // último pendente lido deste item e etapa, com aberto_em
    const respondidos = new Set(); // aberto_em dos pendentes já respondidos nesta sessão
    let leitura = null; // checagem em curso, dividida entre chamadas juntas
    let limpeza = null; // limpeza em curso: a próxima leitura espera por ela
    let ativo = true;

    const deste = (lido) => Boolean(lido) && lido.item_id === itemId && lido.etapa === etapa;

    const emitir = () => {
        if (ativo) aoMudar({ perguntar, pendente });
    };

    async function lerAgora() {
        try {
            if (limpeza) await limpeza;
            const lido = await ler(agora());
            // Enquanto a leitura corria, alguém pode ter aberto, respondido ou desmontado.
            if (!ativo || perguntar) return perguntar;
            if (!deste(lido) || respondidos.has(lido.aberto_em)) return false;
            pendente = lido;
            perguntar = true;
            emitir();
            return true;
        } catch {
            // Sem leitura, sem pergunta: o item continua na lista.
            return false;
        }
    }

    function checar() {
        if (!ativo || perguntar) return Promise.resolve(perguntar);
        if (!leitura) {
            const atual = lerAgora().finally(() => {
                if (leitura === atual) leitura = null;
            });
            leitura = atual;
        }
        return leitura;
    }

    // Força a pergunta com o pendente em memória (botão "Já voltei do WhatsApp"),
    // mesmo que o guardado no aparelho já tenha sido limpo. Sem memória, lê.
    function abrir() {
        if (!ativo) return Promise.resolve(false);
        if (!pendente) return checar();
        if (!perguntar) {
            perguntar = true;
            emitir();
        }
        return Promise.resolve(true);
    }

    // Fecha a pergunta e limpa o pendente. O mesmo pendente não reabre depois,
    // nem se uma leitura antiga terminar agora ou se a limpeza falhar.
    // `abertoEm`: o da folha aberta pela memória da tela ("Já voltei"), que o
    // hook talvez ainda não tenha lido; também fica marcado como respondido.
    function encerrar(abertoEm) {
        if (pendente) respondidos.add(pendente.aberto_em);
        if (abertoEm) respondidos.add(abertoEm);
        if (perguntar) {
            perguntar = false;
            emitir();
        }
        const atual = Promise.resolve()
            .then(() => limpar())
            .catch(() => {})
            .finally(() => {
                if (limpeza === atual) limpeza = null;
            });
        limpeza = atual;
        return atual;
    }

    function destruir() {
        ativo = false;
    }

    return {
        checar,
        abrir,
        encerrar,
        destruir,
        get perguntar() {
            return perguntar;
        },
        get pendente() {
            return pendente;
        },
    };
}

// Liga a checagem à volta para a aba. Parte dos iPhones não dispara
// visibilitychange ao voltar de outro app, por isso pageshow e focus também.
// Devolve a função que remove os três listeners.
export function ouvirVolta({ documento, janela, aoVoltar }) {
    const visivel = () => documento.visibilityState !== 'hidden';
    const aoMudarVisibilidade = () => {
        if (visivel()) aoVoltar();
    };
    const aoVoltarJanela = () => {
        if (visivel()) aoVoltar();
    };

    documento.addEventListener('visibilitychange', aoMudarVisibilidade);
    janela.addEventListener('pageshow', aoVoltarJanela);
    janela.addEventListener('focus', aoVoltarJanela);

    return () => {
        documento.removeEventListener('visibilitychange', aoMudarVisibilidade);
        janela.removeEventListener('pageshow', aoVoltarJanela);
        janela.removeEventListener('focus', aoVoltarJanela);
    };
}

// "Enviei": registra o toque com enviado_em igual à hora em que o WhatsApp foi
// aberto e limpa o pendente. Se a limpeza falhar, o toque já está gravado e
// registrarToque não grava outro na mesma etapa.
export async function responderEnviei({ itemId, etapa, pendente, registrar = registrarToque, limpar = limparPendente }) {
    if (!pendente?.aberto_em) throw new Error('Falta a hora em que o WhatsApp foi aberto.');
    const toque = await registrar({ itemId, etapa, enviadoEm: pendente.aberto_em });
    try {
        await limpar();
    } catch {
        // O controle da pergunta não reabre o mesmo pendente nesta sessão.
    }
    return toque;
}

// "Ainda não": só limpa o pendente. Nada é gravado sem confirmação.
export async function responderAindaNao({ limpar = limparPendente } = {}) {
    try {
        await limpar();
    } catch {
        // Mesmo motivo do responderEnviei.
    }
}

// Passo 2 da folha ("O cliente já respondeu?"). Nada aqui cria ou apaga toque:
// o toque chega já gravado pelo "Enviei".

// Botões de resultado do processo do item, na ordem de RESULTADOS, com o nome
// de ui/rotulos.js. Processo desconhecido devolve lista vazia.
export function opcoesDeResultado(processo) {
    return (RESULTADOS[processo] ?? []).map((resultado) => ({
        resultado,
        rotulo: ROTULOS_RESULTADOS[resultado] ?? resultado,
    }));
}

const agoraIso = () => new Date().toISOString();

// Um resultado: marca a resposta no toque e resolve o item. As duas gravações
// não repetem: marcarRespondeu não marca de novo e resolverPendencia deixa como
// está o item que já não está aberto. Repetir depois de uma falha no meio é seguro.
export async function responderResultado({
    toque,
    item,
    resultado,
    agora = agoraIso,
    marcar = marcarRespondeu,
    resolver = resolverPendencia,
}) {
    await marcar(toque.id, agora());
    return resolver(item.id, resultado);
}

// "Respondeu, mas ainda não resolveu": só marca a resposta; o item fica aberto.
export async function responderSoRespondeu({ toque, agora = agoraIso, marcar = marcarRespondeu }) {
    await marcar(toque.id, agora());
}

// Data e hora novas do "Remarcou", com a mesma leitura e as mesmas frases da
// tela Novo. Devolve `{ ok, erros, data, hora }`; com erro, data e hora vêm null.
export function conferirRemarcacao({ data, hora } = {}) {
    const erros = {};
    const dataTexto = String(data ?? '').trim();
    const horaTexto = String(hora ?? '').trim();
    const dataLida = lerData(dataTexto);
    const horaLida = lerHora(horaTexto);

    if (dataTexto === '') erros.data = MENSAGENS.dataVazia['01'];
    else if (dataLida === null) erros.data = MENSAGENS.dataInvalida;
    if (horaTexto === '') erros.hora = MENSAGENS.horaVazia;
    else if (horaLida === null) erros.hora = MENSAGENS.horaInvalida;

    const ok = Object.keys(erros).length === 0;
    return { ok, erros, data: ok ? dataLida : null, hora: ok ? horaLida : null };
}

// "Remarcou" com data nova: marca a resposta, cria o item 01 novo do mesmo
// cliente e serviço e só depois resolve o antigo com `remarcou`. Não há
// transação que junte as duas gravações, então a ordem garante que uma falha no
// meio nunca deixe o cliente sem horário em aberto (no pior caso, ficam dois).
// `memoria` (objeto que quem chama guarda entre tentativas) recebe o item novo
// assim que ele é gravado; a nova tentativa reaproveita esse item em vez de criar
// outro e, se a data ou a hora mudaram, corrige o item antes de resolver o antigo.
// Sem `data`, é o "Pular": cancela o item novo de uma tentativa anterior, se
// houver, e resolve o antigo sem criar outro.
// Resolve com `{ antigo, novo }` (`novo` null no "Pular").
export async function responderRemarcou({
    toque,
    item,
    data = null,
    hora = null,
    memoria = {},
    agora = agoraIso,
    marcar = marcarRespondeu,
    registrar = registrarPendencia,
    atualizar = atualizarPendencia,
    cancelar = cancelarPendencia,
    resolver = resolverPendencia,
}) {
    await marcar(toque.id, agora());
    if (!data) {
        await desfazerRemarcacao({ memoria, cancelar });
    } else if (!memoria.novo) {
        const { item: novo } = await registrar({
            cliente_id: item.cliente_id,
            item: { processo: '01', data, hora, servico: item.servico ?? '', valor_centavos: null },
        });
        memoria.novo = novo;
    } else if (memoria.novo.data !== data || memoria.novo.hora !== hora) {
        memoria.novo = await atualizar(memoria.novo.id, { data, hora });
    }
    const antigo = await resolver(item.id, 'remarcou');
    return { antigo, novo: data ? memoria.novo : null };
}

// Saída do passo 2 que não conclui o "Remarcou" (Esc, toque fora, "Voltar",
// "Pular", outro resultado, "Ainda não respondeu"): cancela o item 01 novo que
// uma tentativa anterior já gravou, para não ficar um horário a mais em aberto.
// Sem item novo na `memoria`, não grava nada. Falhou, rejeita e a `memoria`
// continua com o item, para a nova tentativa cancelar de novo.
export async function desfazerRemarcacao({ memoria = {}, cancelar = cancelarPendencia } = {}) {
    if (!memoria.novo) return;
    await cancelar(memoria.novo.id);
    delete memoria.novo;
}

// Hook da tela Mensagem. Devolve `{ perguntar, pendente, abrir, encerrar }`.
// Checa ao montar (a ferramenta pode ter recarregado enquanto o dono estava
// no WhatsApp) e a cada volta para a aba. Remove os listeners ao desmontar.
export function useVoltaDoWhatsApp({ itemId, etapa }) {
    const chave = `${itemId}|${etapa}`;
    const [estado, setEstado] = useState({ chave: null, perguntar: false, pendente: null });
    const controle = useRef(null);

    useEffect(() => {
        const atual = criarVoltaDoWhatsApp({
            itemId,
            etapa,
            aoMudar: ({ perguntar, pendente }) => setEstado({ chave, perguntar, pendente }),
        });
        controle.current = atual;
        const parar = ouvirVolta({ documento: document, janela: window, aoVoltar: atual.checar });
        atual.checar();

        return () => {
            parar();
            atual.destruir();
            if (controle.current === atual) controle.current = null;
        };
    }, [chave, itemId, etapa]);

    const abrir = useCallback(() => controle.current?.abrir() ?? Promise.resolve(false), []);
    const encerrar = useCallback((abertoEm) => controle.current?.encerrar(abertoEm) ?? Promise.resolve(), []);

    // Estado de outro item ou etapa (antes de o efeito trocar o controle) não vale.
    const vale = estado.chave === chave;
    return {
        perguntar: vale && estado.perguntar,
        pendente: vale ? estado.pendente : null,
        abrir,
        encerrar,
    };
}

export default useVoltaDoWhatsApp;
