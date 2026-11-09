// Lógica da tela Mensagem e da checagem do envio pendente ao abrir a
// ferramenta. Funções puras, sem React nem banco, para os testes rodarem sem
// navegador.

import { escolherTexto, preencher, valoresDaMensagem } from '../regras/preencher.js';
import { ETAPAS, PROCESSOS } from './rotulos.js';
import { rotaDaMensagem } from './listaDoDia.js';

// Topo da tela: "Confirmar horário, Véspera". Sem dias no rótulo, porque os
// prazos mudam em Ajustes. Parte desconhecida fica de fora.
export function rotuloDaEtapa(processo, etapa) {
    return [PROCESSOS[processo], ETAPAS[etapa]].filter(Boolean).join(', ');
}

// Só existem duas variações: a 1 vira 2 e qualquer outra coisa vira 1.
export function outraVariacao(variacao) {
    return Number(variacao) === 1 ? 2 : 1;
}

// Variação inicial da tela: a dos ajustes, ou a 1.
export function variacaoInicial(ajustes) {
    return Number(ajustes?.variacao) === 2 ? 2 : 1;
}

// Texto pronto para o item na etapa e variação pedidas, ou null sem texto.
export function textoDaMensagem({ textos, item, cliente, ajustes, etapa, variacao } = {}) {
    const modelo = escolherTexto(textos, {
        processo: item?.processo,
        etapa,
        segmento: ajustes?.segmento,
        variacao,
    });
    if (modelo === null) return null;
    return preencher(modelo, valoresDaMensagem({ cliente, item, ajustes }));
}

// Pendência que ainda pede mensagem: existe, está aberta e tem cliente.
export function pendenciaAberta(item, cliente) {
    return Boolean(item) && item.status === 'aberto' && Boolean(cliente);
}

// Houve edição quando o texto do campo difere do texto pronto.
export function houveEdicao(editado, pronto) {
    return typeof editado === 'string' && editado !== (pronto ?? '');
}

// Pendente que a tela guarda em memória ao tocar em "Abrir no WhatsApp", no
// mesmo formato do guardado no aparelho.
export function pendenteEmMemoria({ itemId, etapa, abertoEm }) {
    return { item_id: itemId, etapa, aberto_em: new Date(abertoEm).toISOString() };
}

// "Já voltei do WhatsApp": abre pelo hook quando ele já leu este mesmo
// pendente; senão abre com o da memória, que vale mesmo se a gravação no
// aparelho não terminou. Sem nenhum dos dois, null.
export function comoAbrirAVolta({ doHook, local } = {}) {
    if (local) {
        return doHook && doHook.aberto_em === local.aberto_em ? 'hook' : 'local';
    }
    return doHook ? 'hook' : null;
}

// Decisão ao abrir a ferramenta com um pendente guardado.
// - Sem pendente: `{ acao: 'nada' }`.
// - Item inexistente ou já não aberto: `{ acao: 'limpar' }`.
// - Item aberto: `{ acao: 'ir', rota }` para a mensagem dele, onde a folha
//   "Enviou?" abre sozinha, só quando a ferramenta abriu na Hoje (onde a PWA
//   reabre); em outra tela o dono escolheu ir para lá e fica `{ acao: 'nada' }`.
// `rotaAtual` é o `{ tela, params }` de lerRota.
export function decidirPendenteAoAbrir({ pendente, item, rotaAtual } = {}) {
    if (!pendente) return { acao: 'nada' };
    if (!item || item.id !== pendente.item_id || item.status !== 'aberto') return { acao: 'limpar' };

    const jaEsta =
        rotaAtual?.tela === 'mensagem' &&
        rotaAtual.params?.itemId === pendente.item_id &&
        rotaAtual.params?.etapa === pendente.etapa;
    if (jaEsta || rotaAtual?.tela !== 'hoje') return { acao: 'nada' };

    return { acao: 'ir', rota: rotaDaMensagem({ item: { id: pendente.item_id }, etapa: pendente.etapa }) };
}
