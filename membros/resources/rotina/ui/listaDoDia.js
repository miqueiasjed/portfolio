// O que a tela Hoje mostra a partir da saída de `listaDeHoje`: grupos por
// processo com contagem, linha de apoio de cada etapa e a data do topo.
// Funções puras: não leem o relógio nem o banco.

import { diasEntre, ehDiaValido, formatarDiaMes } from '../regras/datas.js';
import { primeiroNome } from '../regras/preencher.js';
import { PROCESSOS } from './rotulos.js';

const ORDEM = ['01', '05', '04'];

const DIAS_DA_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

// Agrupa na ordem 01, 05, 04, mantendo a ordem de dentro de cada grupo.
// Grupo vazio não entra. Devolve `[{ processo, titulo, entradas }]`, com
// `titulo` já com a contagem: "Cobrança (2)".
export function agruparPorProcesso(entradas = []) {
    const grupos = [];
    for (const processo of ORDEM) {
        const doGrupo = entradas.filter((entrada) => entrada && entrada.processo === processo);
        if (doGrupo.length === 0) continue;
        grupos.push({
            processo,
            titulo: `${PROCESSOS[processo]} (${doGrupo.length.toLocaleString('pt-BR')})`,
            entradas: doGrupo,
        });
    }
    return grupos;
}

function texto(valor) {
    return typeof valor === 'string' ? valor.trim() : '';
}

// Linha de apoio de uma entrada, conforme a etapa. `hoje` em `YYYY-MM-DD`.
export function linhaDeApoio({ item, etapa, atraso_dias: atraso } = {}, hoje) {
    const dia = formatarDiaMes(item?.data);

    if (etapa === 'vespera') {
        const hora = texto(item?.hora);
        return hora ? `Amanhã, ${hora}` : 'Amanhã';
    }

    if (etapa === 'd3' || etapa === 'd7') {
        return `Orçamento de ${dia}, sem resposta`;
    }

    if (etapa === 'd1' || etapa === 'd5' || etapa === 'd15') {
        const base = `Venceu em ${dia}`;
        if (!(atraso > 0) || !ehDiaValido(item?.data) || !ehDiaValido(hoje)) return base;
        // "há n dias" conta desde o vencimento, que é o que a frase diz.
        const dias = diasEntre(item.data, hoje);
        if (dias <= 0) return base;
        return `${base}, há ${dias.toLocaleString('pt-BR')} ${dias === 1 ? 'dia' : 'dias'}`;
    }

    return '';
}

// "segunda, 14/12" para `2026-12-14`. Dia inválido devolve ''.
export function dataDoTopo(hoje) {
    if (!ehDiaValido(hoje)) return '';
    const [ano, mes, dia] = hoje.split('-').map(Number);
    const semana = DIAS_DA_SEMANA[new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay()];
    return `${semana}, ${formatarDiaMes(hoje)}`;
}

// Caminho da tela Mensagem para a entrada.
export function rotaDaMensagem({ item, etapa } = {}) {
    return `#/mensagem/${encodeURIComponent(item?.id ?? '')}/${encodeURIComponent(etapa ?? '')}`;
}

// Chave de comparação do primeiro nome: sem caixa e sem acento, para
// `Érica` e `ERICA` contarem como o mesmo nome na tela.
function chaveDoNome(nome) {
    return nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

const LIGACOES = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);

// Inicial do sobrenome (última palavra que não é `da`, `de`, `dos`...),
// em maiúscula e com ponto: `Maria da Silva` dá `S.`. Sem sobrenome, ''.
function inicialDoSobrenome(nome) {
    const palavras = texto(nome).split(/\s+/).slice(1).filter((p) => !LIGACOES.has(p.toLocaleLowerCase('pt-BR')));
    const sobrenome = palavras[palavras.length - 1];
    if (!sobrenome) return '';
    return `${sobrenome.charAt(0).toLocaleUpperCase('pt-BR')}.`;
}

// Nome que cada linha da Hoje mostra, por `item.id`. Normalmente o primeiro
// nome; quando dois clientes diferentes da lista têm o mesmo primeiro nome,
// os dois ganham a inicial do sobrenome (`Maria S.` e `Maria A.`). Quem não
// tem sobrenome fica só com o primeiro nome. O mesmo cliente em duas linhas
// conta uma vez só.
export function nomesDaLista(entradas = []) {
    const clientesPorNome = new Map();
    for (const entrada of entradas) {
        const nome = primeiroNome(entrada?.cliente?.nome);
        if (!nome) continue;
        const chave = chaveDoNome(nome);
        if (!clientesPorNome.has(chave)) clientesPorNome.set(chave, new Set());
        clientesPorNome.get(chave).add(entrada.cliente.id ?? chaveDoNome(texto(entrada.cliente.nome)));
    }

    const nomes = new Map();
    for (const entrada of entradas) {
        if (!entrada?.item) continue;
        const nome = primeiroNome(entrada.cliente?.nome);
        const repetido = nome !== '' && clientesPorNome.get(chaveDoNome(nome)).size > 1;
        const inicial = repetido ? inicialDoSobrenome(entrada.cliente.nome) : '';
        nomes.set(entrada.item.id, inicial ? `${nome} ${inicial}` : nome);
    }
    return nomes;
}
