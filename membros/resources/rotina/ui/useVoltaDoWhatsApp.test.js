import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NOME_BANCO, fechar, listar, salvar } from '../dados/banco.js';
import { guardarPendente, lerPendente } from '../dados/envioPendente.js';
import { criarVoltaDoWhatsApp, ouvirVolta, responderAindaNao, responderEnviei } from './useVoltaDoWhatsApp.js';

function apagarBanco() {
    return new Promise((resolve, reject) => {
        const pedido = indexedDB.deleteDatabase(NOME_BANCO);
        pedido.onsuccess = () => resolve();
        pedido.onerror = () => reject(pedido.error);
        pedido.onblocked = () => reject(new Error('apagar o banco ficou bloqueado'));
    });
}

const ABERTO = '2026-12-10T12:00:00.000Z';
const AGORA = new Date('2026-12-10T12:05:00.000Z');

// Pendente guardado em memória, com leitura que só termina quando o teste manda.
function armazemLento(inicial) {
    let valor = inicial;
    const esperando = [];
    return {
        ler: vi.fn(
            () =>
                new Promise((resolve) => {
                    esperando.push(() => resolve(valor));
                }),
        ),
        limpar: vi.fn(async () => {
            valor = null;
        }),
        soltar() {
            while (esperando.length) esperando.shift()();
        },
        guardar(novo) {
            valor = novo;
        },
    };
}

const esperar = () => new Promise((resolve) => setTimeout(resolve, 0));

// documento e janela de mentira, com EventTarget do próprio Node.
function ambiente() {
    const documento = new EventTarget();
    documento.visibilityState = 'visible';
    const janela = new EventTarget();
    return { documento, janela };
}

function voltar({ documento, janela }) {
    documento.visibilityState = 'visible';
    documento.dispatchEvent(new Event('visibilitychange'));
    janela.dispatchEvent(new Event('pageshow'));
    janela.dispatchEvent(new Event('focus'));
}

function item(campos = {}) {
    return {
        id: 'i1',
        cliente_id: 'c1',
        processo: '04',
        data: '2026-12-01',
        hora: null,
        servico: 'Pacote',
        valor_centavos: 15000,
        status: 'aberto',
        resultado: null,
        criado_em: '2026-12-01T12:00:00.000Z',
        atualizado_em: '2026-12-01T12:00:00.000Z',
        ...campos,
    };
}

describe('criarVoltaDoWhatsApp', () => {
    it('os três eventos juntos abrem a pergunta uma vez, com uma leitura só', async () => {
        const armazem = armazemLento({ item_id: 'i1', etapa: 2, aberto_em: ABERTO });
        const aoMudar = vi.fn();
        const volta = criarVoltaDoWhatsApp({ itemId: 'i1', etapa: 2, ler: armazem.ler, limpar: armazem.limpar, aoMudar });
        const amb = ambiente();
        ouvirVolta({ ...amb, aoVoltar: volta.checar });

        voltar(amb);
        armazem.soltar();
        await esperar();

        expect(armazem.ler).toHaveBeenCalledTimes(1);
        expect(aoMudar).toHaveBeenCalledTimes(1);
        expect(aoMudar).toHaveBeenCalledWith({ perguntar: true, pendente: { item_id: 'i1', etapa: 2, aberto_em: ABERTO } });

        // Com a pergunta aberta, nova volta não lê nem reabre.
        voltar(amb);
        await esperar();
        expect(armazem.ler).toHaveBeenCalledTimes(1);
        expect(aoMudar).toHaveBeenCalledTimes(1);
    });

    it('pendente de outro item ou etapa não abre', async () => {
        const armazem = armazemLento({ item_id: 'i1', etapa: 1, aberto_em: ABERTO });
        const volta = criarVoltaDoWhatsApp({ itemId: 'i1', etapa: 2, ler: armazem.ler, limpar: armazem.limpar });
        const resposta = volta.checar();
        armazem.soltar();
        expect(await resposta).toBe(false);
        expect(volta.perguntar).toBe(false);

        armazem.guardar({ item_id: 'i2', etapa: 2, aberto_em: ABERTO });
        const outra = volta.checar();
        armazem.soltar();
        expect(await outra).toBe(false);
    });

    it('depois de respondida, trocar de aba de novo não reabre', async () => {
        const armazem = armazemLento({ item_id: 'i1', etapa: 2, aberto_em: ABERTO });
        const volta = criarVoltaDoWhatsApp({ itemId: 'i1', etapa: 2, ler: armazem.ler, limpar: armazem.limpar });
        const amb = ambiente();
        ouvirVolta({ ...amb, aoVoltar: volta.checar });

        const primeira = volta.checar();
        armazem.soltar();
        await primeira;
        expect(volta.perguntar).toBe(true);

        await volta.encerrar();
        expect(volta.perguntar).toBe(false);
        expect(armazem.limpar).toHaveBeenCalledTimes(1);

        voltar(amb);
        armazem.soltar();
        await esperar();
        expect(volta.perguntar).toBe(false);
    });

    it('leitura antiga que termina depois do encerrar não reabre, mesmo se a limpeza falhar', async () => {
        const armazem = armazemLento({ item_id: 'i1', etapa: 2, aberto_em: ABERTO });
        const limpar = vi.fn(async () => {
            throw new Error('falhou');
        });
        const volta = criarVoltaDoWhatsApp({ itemId: 'i1', etapa: 2, ler: armazem.ler, limpar });

        const primeira = volta.checar();
        armazem.soltar();
        await primeira;
        await volta.encerrar();

        // O pendente continua guardado (limpeza falhou): a mesma abertura não volta.
        const segunda = volta.checar();
        armazem.soltar();
        expect(await segunda).toBe(false);

        // Uma abertura nova do WhatsApp volta a perguntar.
        armazem.guardar({ item_id: 'i1', etapa: 2, aberto_em: '2026-12-10T13:00:00.000Z' });
        const terceira = volta.checar();
        armazem.soltar();
        expect(await terceira).toBe(true);
    });

    it('folha aberta pela memória da tela: leitura em curso que termina depois do encerrar não reabre', async () => {
        const armazem = armazemLento({ item_id: 'i1', etapa: 2, aberto_em: ABERTO });
        const limpar = vi.fn(async () => {
            throw new Error('falhou');
        });
        const volta = criarVoltaDoWhatsApp({ itemId: 'i1', etapa: 2, ler: armazem.ler, limpar });

        // O hook ainda não leu nada; a tela abriu a folha com o pendente da memória.
        const emCurso = volta.checar();
        await volta.encerrar(ABERTO);
        armazem.soltar();
        expect(await emCurso).toBe(false);
    });

    it('a leitura que começa durante a limpeza espera por ela', async () => {
        let terminarLimpeza;
        let valor = { item_id: 'i1', etapa: 2, aberto_em: ABERTO };
        const ler = vi.fn(async () => valor);
        const limpar = vi.fn(
            () =>
                new Promise((resolve) => {
                    terminarLimpeza = () => {
                        valor = null;
                        resolve();
                    };
                }),
        );
        const volta = criarVoltaDoWhatsApp({ itemId: 'i1', etapa: 2, ler, limpar });
        await volta.checar();

        const fim = volta.encerrar();
        await esperar();
        const durante = volta.checar();
        await esperar();
        expect(ler).toHaveBeenCalledTimes(1);

        terminarLimpeza();
        await fim;
        expect(await durante).toBe(false);
        expect(ler).toHaveBeenCalledTimes(2);
    });

    it('abrir usa o pendente em memória mesmo depois de limpo', async () => {
        const armazem = armazemLento({ item_id: 'i1', etapa: 2, aberto_em: ABERTO });
        const volta = criarVoltaDoWhatsApp({ itemId: 'i1', etapa: 2, ler: armazem.ler, limpar: armazem.limpar });
        const primeira = volta.checar();
        armazem.soltar();
        await primeira;
        await volta.encerrar();

        expect(await volta.abrir()).toBe(true);
        expect(volta.perguntar).toBe(true);
        expect(volta.pendente).toEqual({ item_id: 'i1', etapa: 2, aberto_em: ABERTO });
    });

    it('abrir sem nada em memória lê o pendente', async () => {
        const armazem = armazemLento(null);
        const volta = criarVoltaDoWhatsApp({ itemId: 'i1', etapa: 2, ler: armazem.ler, limpar: armazem.limpar });
        const resposta = volta.abrir();
        armazem.soltar();
        expect(await resposta).toBe(false);
        expect(armazem.ler).toHaveBeenCalledTimes(1);
    });

    it('depois de destruído, leitura em curso não muda o estado', async () => {
        const armazem = armazemLento({ item_id: 'i1', etapa: 2, aberto_em: ABERTO });
        const aoMudar = vi.fn();
        const volta = criarVoltaDoWhatsApp({ itemId: 'i1', etapa: 2, ler: armazem.ler, limpar: armazem.limpar, aoMudar });
        const resposta = volta.checar();
        volta.destruir();
        armazem.soltar();
        await resposta;
        expect(aoMudar).not.toHaveBeenCalled();
        expect(volta.perguntar).toBe(false);
    });

    it('erro na leitura não abre a pergunta', async () => {
        const ler = vi.fn(async () => {
            throw new Error('falhou');
        });
        const volta = criarVoltaDoWhatsApp({ itemId: 'i1', etapa: 2, ler, limpar: vi.fn() });
        expect(await volta.checar()).toBe(false);
    });
});

describe('ouvirVolta', () => {
    it('chama na volta visível e ignora aba escondida', () => {
        const amb = ambiente();
        const aoVoltar = vi.fn();
        ouvirVolta({ ...amb, aoVoltar });

        amb.documento.visibilityState = 'hidden';
        amb.documento.dispatchEvent(new Event('visibilitychange'));
        expect(aoVoltar).not.toHaveBeenCalled();

        voltar(amb);
        expect(aoVoltar).toHaveBeenCalledTimes(3);
    });

    it('remove os três listeners ao parar', () => {
        const amb = ambiente();
        const aoVoltar = vi.fn();
        const parar = ouvirVolta({ ...amb, aoVoltar });
        parar();
        voltar(amb);
        expect(aoVoltar).not.toHaveBeenCalled();
    });
});

describe('com o aparelho de verdade (fake-indexeddb)', () => {
    beforeEach(async () => {
        await fechar();
        await apagarBanco();
        await salvar('itens', item());
    });

    it('recarregar com pendente guardado pergunta na primeira checagem', async () => {
        await guardarPendente({ itemId: 'i1', etapa: 2, abertoEm: ABERTO });
        const volta = criarVoltaDoWhatsApp({ itemId: 'i1', etapa: 2, agora: () => AGORA });
        expect(await volta.checar()).toBe(true);
        expect(volta.pendente.aberto_em).toBe(ABERTO);
    });

    it('"Enviei" grava o toque com enviado_em igual ao aberto_em e limpa o pendente', async () => {
        const pendente = await guardarPendente({ itemId: 'i1', etapa: 2, abertoEm: ABERTO });
        const toque = await responderEnviei({ itemId: 'i1', etapa: 2, pendente });

        expect(toque.enviado_em).toBe(ABERTO);
        expect(toque.respondeu).toBe(false);
        expect(await lerPendente(AGORA)).toBeNull();
        expect(await listar('toques')).toHaveLength(1);
    });

    it('dois "Enviei" seguidos gravam um toque só', async () => {
        const pendente = await guardarPendente({ itemId: 'i1', etapa: 2, abertoEm: ABERTO });
        const [a, b] = await Promise.all([
            responderEnviei({ itemId: 'i1', etapa: 2, pendente }),
            responderEnviei({ itemId: 'i1', etapa: 2, pendente }),
        ]);
        expect(a.id).toBe(b.id);
        expect(await listar('toques')).toHaveLength(1);
    });

    it('"Enviei" sem aberto_em não grava', async () => {
        await expect(responderEnviei({ itemId: 'i1', etapa: 2, pendente: null })).rejects.toThrow();
        expect(await listar('toques')).toHaveLength(0);
    });

    it('"Ainda não" limpa o pendente e não grava toque', async () => {
        await guardarPendente({ itemId: 'i1', etapa: 2, abertoEm: ABERTO });
        await responderAindaNao();
        expect(await lerPendente(AGORA)).toBeNull();
        expect(await listar('toques')).toHaveLength(0);
    });
});
