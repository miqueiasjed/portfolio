// Decide quando avisar que há versão nova e quando recarregar a página.
// Sem DOM e sem React: recebe o registro do service worker, o
// navigator.serviceWorker e o document (ou imitações nos testes).
//
// Regras:
// - aviso só com versão nova esperando: um `waiting` que já existe, ou um
//   `installing` que chega a `installed` enquanto outra versão controla a
//   página. Sem `controller` é a primeira instalação, e nada aparece;
// - a página só recarrega depois que o dono tocou no aviso. O
//   `clients.claim()` da primeira instalação também dispara
//   `controllerchange`, e esse não pode recarregar;
// - com o aviso na tela, a versão nova pode assumir sem pedido desta aba:
//   o dono tocou em outra aba, ou as outras abas fecharam. A página fica
//   como está, e o toque seguinte só recarrega;
// - recarrega uma vez só, mesmo que o evento chegue de novo;
// - ao voltar do segundo plano procura versão nova, no máximo a cada
//   INTERVALO_DE_PROCURA. O app instalado no iPhone fica dias aberto sem
//   navegar, e o navegador só procura sozinho numa navegação.

export const INTERVALO_DE_PROCURA = 30 * 60 * 1000;

// Props: `registro` (ServiceWorkerRegistration), `sw` (navigator.serviceWorker),
// `aoAvisar` (chamado quando há versão nova esperando), `recarregar`,
// `documento` (document, opcional, para ouvir a volta do segundo plano) e
// `agora` (relógio em ms, trocado nos testes).
// Devolve `atualizar()`, para o toque no aviso, e `parar()`, para desmontar.
export function acompanharVersao({ registro, sw, aoAvisar, recarregar, documento = null, agora = Date.now }) {
    let pediuAtualizar = false;
    let recarregou = false;
    let avisou = false;
    // A versão nova já controla a página, sem pedido desta aba.
    let versaoAtiva = false;
    // Última versão nova que chegou a `installed`, para o caso de
    // `registro.waiting` ainda não refletir a troca.
    let novaVersao = null;
    // Versão que controlava a página quando ela abriu.
    const controllerInicial = sw.controller ?? null;
    // O register() que entregou o registro acabou de procurar versão nova.
    let ultimaProcura = agora();
    const acompanhados = new Set();
    const desfazer = [];

    function ouvir(alvo, evento, funcao) {
        alvo.addEventListener(evento, funcao);
        desfazer.push(() => alvo.removeEventListener(evento, funcao));
    }

    function avisar(trabalhador) {
        novaVersao = trabalhador;
        avisou = true;
        aoAvisar();
    }

    function recarregarUmaVez() {
        if (recarregou) return;
        recarregou = true;
        recarregar();
    }

    function acompanhar(trabalhador) {
        if (!trabalhador || acompanhados.has(trabalhador)) return;
        acompanhados.add(trabalhador);

        ouvir(trabalhador, 'statechange', () => {
            if (trabalhador.state === 'installed' && sw.controller) {
                avisar(trabalhador);
            }
        });
    }

    ouvir(sw, 'controllerchange', () => {
        if (pediuAtualizar) {
            recarregarUmaVez();
            return;
        }

        // Troca sem pedido desta aba. Sem aviso na tela (primeira instalação)
        // nada muda. Com aviso, a versão nova já assumiu: nada recarrega
        // agora, e o toque no aviso passa a só recarregar.
        const atual = sw.controller;
        if (avisou && atual && (atual === novaVersao || atual !== controllerInicial)) {
            versaoAtiva = true;
        }
    });

    ouvir(registro, 'updatefound', () => acompanhar(registro.installing));

    if (documento) {
        ouvir(documento, 'visibilitychange', () => {
            if (documento.visibilityState !== 'visible') return;
            const instante = agora();
            if (instante - ultimaProcura < INTERVALO_DE_PROCURA) return;
            ultimaProcura = instante;
            try {
                // Sem rede ou com o servidor fora, a procura falha e tudo segue.
                Promise.resolve(registro.update()).catch(() => undefined);
            } catch {
                // Navegador sem update() ou que recusa na hora: ignora.
            }
        });
    }

    if (registro.waiting) {
        avisar(registro.waiting);
    }

    // O registro pode voltar com a instalação já em andamento, antes de o
    // `updatefound` ser ouvido aqui.
    acompanhar(registro.installing);

    return {
        atualizar() {
            if (versaoAtiva) {
                recarregarUmaVez();
                return true;
            }

            const alvo = registro.waiting ?? novaVersao;
            if (!alvo) return false;
            pediuAtualizar = true;
            alvo.postMessage('atualizar');
            return true;
        },
        parar() {
            desfazer.splice(0).forEach((tirar) => tirar());
        },
    };
}
