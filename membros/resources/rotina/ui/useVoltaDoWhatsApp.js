// Percebe que o dono voltou do WhatsApp e diz quando perguntar "Enviou?".
// A lógica fica em funções sem React (criarVoltaDoWhatsApp, ouvirVolta,
// responderEnviei, responderAindaNao) para os testes rodarem sem navegador.

import { useCallback, useEffect, useRef, useState } from 'react';
import { lerPendente, limparPendente } from '../dados/envioPendente.js';
import { registrarToque } from '../dados/registro.js';

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
    let respondido = null; // aberto_em do pendente já respondido nesta sessão
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
            if (!deste(lido) || lido.aberto_em === respondido) return false;
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
    function encerrar() {
        if (pendente) respondido = pendente.aberto_em;
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
    const encerrar = useCallback(() => controle.current?.encerrar() ?? Promise.resolve(), []);

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
