// Leitura e conferência dos campos de uma pendência, digitados no cadastro
// rápido ou vindos de uma linha de planilha. Tudo entra como texto e sai no
// formato guardado: cliente `{ nome, whatsapp }` e item
// `{ processo, data, hora, servico, valor_centavos }`.

import { normalizarTelefone } from './whatsapp.js';
import { ehDiaValido } from './datas.js';

export const MENSAGENS = {
    nome: 'Falta o nome.',
    processoVazio: 'Escolha o processo: confirmação, orçamento ou cobrança.',
    processoInvalido: 'Não reconheci o processo. Use confirmação, orçamento ou cobrança.',
    dataVazia: {
        '01': 'Coloque a data do horário marcado.',
        '04': 'Coloque a data em que o orçamento foi enviado.',
        '05': 'Coloque a data de vencimento.',
        geral: 'Coloque a data.',
    },
    dataInvalida: 'Essa data não existe.',
    horaVazia: 'Coloque a hora do horário marcado.',
    horaInvalida: 'Essa hora não parece certa. Use, por exemplo, 14:30.',
    valorVazio: 'Coloque o valor da cobrança.',
    valorInvalido: 'Esse valor não parece certo. Use, por exemplo, 1.250,00.',
};

function comoTexto(valor) {
    return valor === null || valor === undefined ? '' : String(valor);
}

// Tira espaço das pontas e junta espaços repetidos no meio.
function limparEspacos(valor) {
    return comoTexto(valor).replace(/\s+/g, ' ').trim();
}

function doisDigitos(n) {
    return String(n).padStart(2, '0');
}

// `2026-12-08`, `08/12/2026`, `8/12/2026`, `08/12/26` (vira 2026) ou
// `08-12-2026` (planilha que salva a data com hífen).
// Devolve `YYYY-MM-DD` ou null quando o dia não existe no calendário.
export function lerData(texto) {
    const limpo = comoTexto(texto).trim();
    let ano;
    let mes;
    let dia;

    const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(limpo);
    const br = /^(\d{1,2})([/-])(\d{1,2})\2(\d{2}|\d{4})$/.exec(limpo);
    if (iso) {
        [ano, mes, dia] = [iso[1], iso[2], iso[3]];
    } else if (br) {
        [dia, mes, ano] = [br[1], br[3], br[4]];
        if (ano.length === 2) ano = `20${ano}`;
    } else {
        return null;
    }

    const resultado = `${ano}-${doisDigitos(mes)}-${doisDigitos(dia)}`;
    return ehDiaValido(resultado) ? resultado : null;
}

// `14:00`, `9:30`, `14h` ou `14h30`. Devolve `HH:MM` ou null.
export function lerHora(texto) {
    const limpo = comoTexto(texto).trim().toLowerCase();
    const achado = /^(\d{1,2})(?::(\d{2})|h(\d{2})?)$/.exec(limpo);
    if (!achado) return null;

    const hora = Number(achado[1]);
    const minuto = Number(achado[2] ?? achado[3] ?? '0');
    if (hora > 23 || minuto > 59) return null;
    return `${doisDigitos(hora)}:${doisDigitos(minuto)}`;
}

const MILHAR = /^\d{1,3}(\.\d{3})+$/;

// Parte inteira em reais: só dígitos ou milhar separado por ponto.
function lerInteiro(parte) {
    if (/^\d+$/.test(parte)) return parte;
    if (MILHAR.test(parte)) return parte.replace(/\./g, '');
    return null;
}

// Valor em reais para centavos (inteiro maior que zero) ou null.
// Com vírgula, ponto é milhar e vírgula é decimal (`1.250,50`).
// Sem vírgula, `1250.5` é decimal e qualquer outro ponto é milhar (`1.250`).
export function lerValor(texto) {
    const limpo = comoTexto(texto).replace(/r\$/gi, '').replace(/\s+/g, '');
    if (limpo === '') return null;

    let inteiro;
    let decimal = '';
    if (limpo.includes(',')) {
        const achado = /^([\d.]+),(\d{1,2})$/.exec(limpo);
        if (!achado) return null;
        inteiro = lerInteiro(achado[1]);
        decimal = achado[2];
    } else {
        const ponto = /^(\d+)\.(\d{1,2})$/.exec(limpo);
        if (ponto) {
            inteiro = ponto[1];
            decimal = ponto[2];
        } else {
            inteiro = lerInteiro(limpo);
        }
    }
    if (inteiro === null) return null;

    const centavos = Number(inteiro) * 100 + Number(decimal.padEnd(2, '0'));
    if (!Number.isSafeInteger(centavos) || centavos <= 0) return null;
    return centavos;
}

// Sem acento e em minúsculas, para comparar o que a pessoa digitou.
function semAcento(texto) {
    return comoTexto(texto).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

const PROCESSOS = {
    '01': '01', '1': '01', confirmacao: '01', confirmar: '01', horario: '01',
    'confirmar horario': '01',
    '04': '04', '4': '04', orcamento: '04', 'orcamento enviado': '04',
    '05': '05', '5': '05', cobranca: '05',
};

// Código do processo (`'01'`, `'04'` ou `'05'`) ou null.
export function lerProcesso(texto) {
    const chave = semAcento(texto).replace(/\s+/g, ' ');
    // `hasOwnProperty` em vez de `Object.hasOwn`, que falta em Safari antigo.
    return Object.prototype.hasOwnProperty.call(PROCESSOS, chave) ? PROCESSOS[chave] : null;
}

// Confere os campos de uma pendência. Com erro, `cliente` e `item` vêm null,
// para nenhum dado pela metade ser gravado.
export function validarPendencia(campos = {}) {
    const erros = {};

    const nome = limparEspacos(campos.nome);
    if (nome === '') erros.nome = MENSAGENS.nome;

    const telefone = normalizarTelefone(campos.whatsapp);
    if (!telefone.ok) erros.whatsapp = telefone.erro;

    const processoTexto = comoTexto(campos.processo).trim();
    const processo = lerProcesso(processoTexto);
    if (processoTexto === '') erros.processo = MENSAGENS.processoVazio;
    else if (processo === null) erros.processo = MENSAGENS.processoInvalido;

    const dataTexto = comoTexto(campos.data).trim();
    const data = lerData(dataTexto);
    if (dataTexto === '') erros.data = MENSAGENS.dataVazia[processo ?? 'geral'];
    else if (data === null) erros.data = MENSAGENS.dataInvalida;

    // Hora só vale no 01.
    let hora = null;
    if (processo === '01') {
        const horaTexto = comoTexto(campos.hora).trim();
        hora = lerHora(horaTexto);
        if (horaTexto === '') erros.hora = MENSAGENS.horaVazia;
        else if (hora === null) erros.hora = MENSAGENS.horaInvalida;
    }

    // Valor é obrigatório no 05, opcional no 04 e não existe no 01.
    let valor = null;
    if (processo === '04' || processo === '05') {
        const valorTexto = comoTexto(campos.valor).trim();
        valor = lerValor(valorTexto);
        if (valorTexto === '') {
            if (processo === '05') erros.valor = MENSAGENS.valorVazio;
        } else if (valor === null) {
            erros.valor = MENSAGENS.valorInvalido;
        }
    }

    const ok = Object.keys(erros).length === 0;
    if (!ok) return { ok, erros, cliente: null, item: null };

    return {
        ok,
        erros,
        cliente: { nome, whatsapp: telefone.numero },
        item: {
            processo,
            data,
            hora,
            servico: limparEspacos(campos.servico),
            valor_centavos: valor,
        },
    };
}
