// O que a tela Hoje mostra a partir da saída de `listaDeHoje`: grupos por
// processo com contagem, linha de apoio de cada etapa e a data do topo.
// Funções puras: não leem o relógio nem o banco.

import { diasEntre, ehDiaValido, formatarDiaMes } from '../regras/datas.js';
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
