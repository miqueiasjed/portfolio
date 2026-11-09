// Funções puras de data da Rotina do Dia.
// Tudo entra e sai como string `YYYY-MM-DD`, sempre no fuso de Fortaleza
// (UTC-3, sem horário de verão), nunca no fuso do aparelho.

const FUSO = 'America/Fortaleza';
const UM_DIA_MS = 24 * 60 * 60 * 1000;
const FORMATO_DIA = /^(\d{4})-(\d{2})-(\d{2})$/;

const formatadorFortaleza = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
});

function doisDigitos(n) {
    return String(n).padStart(2, '0');
}

// Quebra `YYYY-MM-DD` em números. Devolve null quando o formato não bate.
function partes(dia) {
    if (typeof dia !== 'string') return null;
    const achado = FORMATO_DIA.exec(dia);
    if (!achado) return null;
    return { ano: Number(achado[1]), mes: Number(achado[2]), dia: Number(achado[3]) };
}

// Meia-noite UTC do dia, em milissegundos. Lança erro para dia inválido,
// porque conta com data errada não deve passar calada.
function emUtc(dia) {
    if (!ehDiaValido(dia)) {
        throw new Error(`Dia inválido: ${dia}`);
    }
    const p = partes(dia);
    return Date.UTC(p.ano, p.mes - 1, p.dia);
}

function deUtc(ms) {
    const d = new Date(ms);
    return `${String(d.getUTCFullYear()).padStart(4, '0')}-${doisDigitos(d.getUTCMonth() + 1)}-${doisDigitos(d.getUTCDate())}`;
}

// Dia de hoje em Fortaleza para o instante recebido.
export function hojeEmFortaleza(agora = new Date()) {
    const valores = {};
    for (const parte of formatadorFortaleza.formatToParts(agora)) {
        valores[parte.type] = parte.value;
    }
    return `${valores.year}-${valores.month}-${valores.day}`;
}

// Soma n dias (n pode ser negativo). Conta feita em UTC.
export function somarDias(dia, n) {
    return deUtc(emUtc(dia) + Math.trunc(n) * UM_DIA_MS);
}

// Quantos dias vão de `de` até `ate`. Negativo quando `ate` vem antes.
export function diasEntre(de, ate) {
    return Math.round((emUtc(ate) - emUtc(de)) / UM_DIA_MS);
}

// `2026-12-08` vira `08/12`.
export function formatarDiaMes(dia) {
    const p = partes(dia);
    if (!p) return '';
    return `${doisDigitos(p.dia)}/${doisDigitos(p.mes)}`;
}

// True só para `YYYY-MM-DD` que existe no calendário.
export function ehDiaValido(texto) {
    const p = partes(texto);
    if (!p) return false;
    if (p.mes < 1 || p.mes > 12 || p.dia < 1) return false;
    const d = new Date(Date.UTC(p.ano, p.mes - 1, p.dia));
    return d.getUTCFullYear() === p.ano && d.getUTCMonth() === p.mes - 1 && d.getUTCDate() === p.dia;
}
