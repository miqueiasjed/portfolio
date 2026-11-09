// Leitura da planilha CSV do dono e modelo de planilha para baixar.
// Tudo roda no aparelho: o texto do arquivo entra, sai a lista de linhas com
// o que vale importar e o motivo das que não valem. A conferência de cada
// campo fica em `validarPendencia`.

import { validarPendencia } from './campos.js';

export const LIMITE_LINHAS = 2000;

export const ERROS = {
    vazia: 'A planilha está vazia.',
    semLinhas: 'A planilha só tem o cabeçalho. Coloque um cliente por linha embaixo dele.',
    muitasLinhas: `A planilha tem mais de ${LIMITE_LINHAS.toLocaleString('pt-BR')} linhas. Divida em partes menores e importe uma de cada vez.`,
};

const BOM = '\uFEFF';

const OBRIGATORIAS = ['nome', 'whatsapp', 'processo', 'data'];

// Nome escrito no cabeçalho (já sem acento e em minúsculas) para o campo.
const COLUNAS = {
    nome: 'nome',
    whatsapp: 'whatsapp',
    telefone: 'whatsapp',
    celular: 'whatsapp',
    processo: 'processo',
    data: 'data',
    hora: 'hora',
    valor: 'valor',
    servico: 'servico',
};

function semAcento(texto) {
    return String(texto).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

// Conta `;` e `,` fora de aspas na primeira linha com conteúdo.
// Empate fica com a vírgula.
function escolherSeparador(texto) {
    let pontoEVirgula = 0;
    let virgula = 0;
    let entreAspas = false;
    let comecou = false;

    for (const caractere of texto) {
        if (caractere === '"') {
            entreAspas = !entreAspas;
        } else if (!entreAspas && (caractere === '\n' || caractere === '\r')) {
            if (comecou) break;
        } else if (!entreAspas && caractere === ';') {
            pontoEVirgula += 1;
        } else if (!entreAspas && caractere === ',') {
            virgula += 1;
        }
        if (caractere.trim() !== '') comecou = true;
    }
    return pontoEVirgula > virgula ? ';' : ',';
}

// Quebra o texto em registros (listas de campos). Campo entre aspas pode ter
// o separador e quebra de linha dentro; `""` vira `"`. Cada registro guarda
// a posição dele no arquivo, que é o número da linha na planilha.
function quebrarRegistros(texto, separador) {
    const registros = [];
    let campos = [];
    let campo = '';
    let entreAspas = false;
    let i = 0;

    const fecharRegistro = () => {
        campos.push(campo);
        registros.push(campos);
        campos = [];
        campo = '';
    };

    while (i < texto.length) {
        const caractere = texto[i];
        if (entreAspas) {
            if (caractere === '"') {
                if (texto[i + 1] === '"') {
                    campo += '"';
                    i += 1;
                } else {
                    entreAspas = false;
                }
            } else {
                campo += caractere;
            }
        } else if (caractere === '"') {
            entreAspas = true;
        } else if (caractere === separador) {
            campos.push(campo);
            campo = '';
        } else if (caractere === '\r' && texto[i + 1] === '\n') {
            fecharRegistro();
            i += 1;
        } else if (caractere === '\n' || caractere === '\r') {
            fecharRegistro();
        } else {
            campo += caractere;
        }
        i += 1;
    }

    // Último registro, quando o arquivo não termina com quebra de linha.
    if (campo !== '' || campos.length > 0) fecharRegistro();

    return registros.map((lista, indice) => ({ numero: indice + 1, campos: lista }));
}

function estaVazio(registro) {
    return registro.campos.every((valor) => valor.trim() === '');
}

// Posição de cada campo conhecido no cabeçalho. Coluna repetida: vale a
// primeira. Coluna desconhecida: ignorada.
function lerCabecalho(campos) {
    const posicoes = {};
    campos.forEach((titulo, indice) => {
        const campo = COLUNAS[semAcento(titulo).replace(/\s+/g, ' ')];
        if (campo && posicoes[campo] === undefined) posicoes[campo] = indice;
    });
    return posicoes;
}

function erroColunasFaltando(faltando) {
    if (faltando.length === 1) return `Falta a coluna ${faltando[0]} no cabeçalho da planilha.`;
    const lista = `${faltando.slice(0, -1).join(', ')} e ${faltando[faltando.length - 1]}`;
    return `Faltam as colunas ${lista} no cabeçalho da planilha.`;
}

// Lê o texto de um arquivo CSV. Devolve `{ ok: false, erro }` quando a
// planilha inteira não dá para usar, ou `{ ok: true, linhas, validas,
// invalidas }` com uma entrada por linha de dados.
export function lerPlanilha(texto) {
    let conteudo = texto === null || texto === undefined ? '' : String(texto);
    if (conteudo.startsWith(BOM)) conteudo = conteudo.slice(1);

    const separador = escolherSeparador(conteudo);
    const registros = quebrarRegistros(conteudo, separador).filter((registro) => !estaVazio(registro));
    if (registros.length === 0) return { ok: false, erro: ERROS.vazia };

    const [cabecalho, ...dados] = registros;
    const posicoes = lerCabecalho(cabecalho.campos);
    const faltando = OBRIGATORIAS.filter((campo) => posicoes[campo] === undefined);
    if (faltando.length > 0) return { ok: false, erro: erroColunasFaltando(faltando) };

    if (dados.length === 0) return { ok: false, erro: ERROS.semLinhas };
    if (dados.length > LIMITE_LINHAS) return { ok: false, erro: ERROS.muitasLinhas };

    let validas = 0;
    const linhas = dados.map((registro) => {
        const campos = {};
        for (const [campo, indice] of Object.entries(posicoes)) {
            campos[campo] = registro.campos[indice] ?? '';
        }
        const resultado = validarPendencia(campos);
        if (resultado.ok) validas += 1;
        return {
            numero: registro.numero,
            valida: resultado.ok,
            erros: Object.values(resultado.erros),
            cliente: resultado.cliente,
            item: resultado.item,
            campos,
        };
    });

    return { ok: true, linhas, validas, invalidas: linhas.length - validas };
}

// Modelo para baixar. BOM e `;` fazem o Excel em português abrir com os
// acentos certos e cada campo na sua coluna.
export function modeloPlanilha() {
    const linhas = [
        'nome;whatsapp;processo;data;hora;valor;servico',
        'Ana Souza;(85) 99999-1234;Confirmar horário;10/12/2026;14:30;;Corte e escova',
        'Bruno Lima;(85) 98888-5678;Orçamento enviado;08/12/2026;;150,00;Instalação de prateleiras',
        'Carla Mendes;(85) 97777-9012;Cobrança;15/12/2026;;150,00;Mensalidade de dezembro',
    ];
    return `${BOM}${linhas.join('\r\n')}\r\n`;
}
