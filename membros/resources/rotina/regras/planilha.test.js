import { describe, it, expect } from 'vitest';
import { lerPlanilha, modeloPlanilha, ERROS, LIMITE_LINHAS } from './planilha.js';
import { MENSAGENS } from './campos.js';
import { ERROS as ERROS_TELEFONE } from './whatsapp.js';

// Mesma lista da `.claude/rules.md`.
const PROIBIDAS = [
    'automação', 'automático', 'integração', 'api', 'agente', 'prompt', 'mcp',
    'webhook', 'token', 'sincronizar', 'banco de dados', 'indexeddb',
];

const CABECALHO = ['nome', 'whatsapp', 'processo', 'data', 'hora', 'valor', 'servico'];

// Monta o CSV com o separador pedido, pondo aspas onde o campo precisa.
function montarCsv(linhas, separador) {
    const formatar = (valor) => {
        const texto = String(valor);
        if (texto.includes(separador) || texto.includes('"') || texto.includes('\n')) {
            return `"${texto.replace(/"/g, '""')}"`;
        }
        return texto;
    };
    return linhas.map((linha) => linha.map(formatar).join(separador)).join('\n');
}

function linhaValida(i) {
    const telefone = `(85) 9${String(8000_0000 + i)}`;
    if (i % 3 === 0) return [`Cliente ${i}`, telefone, 'Confirmar horário', '10/12/2026', '14:30', '', 'Corte'];
    if (i % 3 === 1) return [`Cliente ${i}`, telefone, 'orçamento', '08/12/2026', '', '1.250,00', 'Reforma'];
    return [`Cliente ${i}`, telefone, '05', '2026-12-15', '', '150,00', 'Mensalidade'];
}

describe('lerPlanilha: separador e aspas', () => {
    const linhas = [
        CABECALHO,
        ['Silva, Ana', '85999998888', 'cobrança', '15/12/2026', '', '1.250,50', 'Ele disse "ok"'],
        ['Bruno; Lima', '(85) 98888-7777', '01', '10/12/2026', '9h30', '', 'Corte\nem duas linhas'],
    ];

    it('dá o mesmo resultado com vírgula e com ponto e vírgula', () => {
        const comVirgula = lerPlanilha(montarCsv(linhas, ','));
        const comPontoEVirgula = lerPlanilha(montarCsv(linhas, ';'));
        expect(comVirgula.ok).toBe(true);
        expect(comVirgula).toEqual(comPontoEVirgula);
        expect(comVirgula.validas).toBe(2);
    });

    it('não quebra coluna com separador entre aspas e troca "" por "', () => {
        const texto = 'nome,whatsapp,processo,data,valor,servico\n'
            + '"Silva, Ana",85999998888,cobrança,15/12/2026,"150,00","Ele disse ""ok"""\n';
        const resultado = lerPlanilha(texto);
        expect(resultado.ok).toBe(true);
        const [linha] = resultado.linhas;
        expect(linha.valida).toBe(true);
        expect(linha.cliente).toEqual({ nome: 'Silva, Ana', whatsapp: '5585999998888' });
        expect(linha.item.servico).toBe('Ele disse "ok"');
        expect(linha.item.valor_centavos).toBe(15000);
    });

    it('aceita quebra de linha dentro de aspas sem perder a contagem das linhas', () => {
        const texto = 'nome;whatsapp;processo;data;hora;servico\n'
            + 'Ana;85999998888;01;10/12/2026;14:00;"Corte\ne escova"\n'
            + 'Bia;85999997777;01;10/12/2026;15:00;Corte\n';
        const resultado = lerPlanilha(texto);
        expect(resultado.linhas.map((l) => l.numero)).toEqual([2, 3]);
        expect(resultado.linhas[0].item.servico).toBe('Corte e escova');
    });

    it('empate na contagem fica com a vírgula', () => {
        // Com vírgula, as colunas viram `nome;whatsapp`, `processo;data` e `hora`.
        const texto = 'nome;whatsapp,processo;data,hora\nAna;85999998888,01;10/12/2026,14:00';
        const resultado = lerPlanilha(texto);
        expect(resultado.ok).toBe(false);
        expect(resultado.erro).toContain('nome, whatsapp, processo e data');

        // Vírgula entre aspas no cabeçalho não entra na contagem.
        const separadorEntreAspas = lerPlanilha('"a,b,c,d,e";nome;whatsapp;processo;data\nx;Ana;85999998888;04;08/12/2026');
        expect(separadorEntreAspas.ok).toBe(true);
        expect(separadorEntreAspas.validas).toBe(1);
    });

    it('tira o BOM, aceita \\r\\n e ignora linhas vazias', () => {
        const texto = '\uFEFFnome;whatsapp;processo;data;hora\r\n'
            + 'Ana;85999998888;01;10/12/2026;14:00\r\n'
            + '\r\n'
            + ';;;;\r\n'
            + 'Bia;85999997777;01;11/12/2026;15:00\r\n\r\n';
        const resultado = lerPlanilha(texto);
        expect(resultado.ok).toBe(true);
        expect(resultado.linhas).toHaveLength(2);
        // A linha 3 e a 4 estão vazias, mas contam na numeração da planilha.
        expect(resultado.linhas.map((l) => l.numero)).toEqual([2, 5]);
        expect(resultado.validas).toBe(2);
    });

    it('aceita arquivo sem quebra de linha no fim', () => {
        const resultado = lerPlanilha('nome,whatsapp,processo,data,hora\nAna,85999998888,01,10/12/2026,14:00');
        expect(resultado.validas).toBe(1);
    });
});

describe('lerPlanilha: cabeçalho', () => {
    it('aceita Nome;Telefone;Processo;Data com caixa, acento e espaço', () => {
        const texto = 'Nome;Telefone;Processo;Data\nAna;85999998888;Orçamento enviado;08/12/2026\n';
        const resultado = lerPlanilha(texto);
        expect(resultado.ok).toBe(true);
        expect(resultado.linhas[0].valida).toBe(true);
        expect(resultado.linhas[0].item.processo).toBe('04');
    });

    it('aceita celular, serviço e colunas desconhecidas', () => {
        const texto = ' NOME ;Celular;PROCESSO;Data;Hora;Serviço;Observação\n'
            + 'Ana;85999998888;01;10/12/2026;14:00;Corte;cliente antiga\n';
        const resultado = lerPlanilha(texto);
        expect(resultado.ok).toBe(true);
        expect(resultado.linhas[0].item.servico).toBe('Corte');
        expect(resultado.linhas[0].campos).not.toHaveProperty('observacao');
    });

    it('sem a coluna data devolve erro citando data', () => {
        const resultado = lerPlanilha('Nome;Telefone;Processo\nAna;85999998888;01\n');
        expect(resultado.ok).toBe(false);
        expect(resultado.erro).toContain('data');
    });

    it('cita todas as colunas que faltam', () => {
        const resultado = lerPlanilha('nome;hora\nAna;14:00\n');
        expect(resultado.ok).toBe(false);
        expect(resultado.erro).toContain('whatsapp');
        expect(resultado.erro).toContain('processo');
        expect(resultado.erro).toContain('data');
    });

    it('recusa planilha vazia ou só com cabeçalho', () => {
        expect(lerPlanilha('')).toEqual({ ok: false, erro: ERROS.vazia });
        expect(lerPlanilha(null)).toEqual({ ok: false, erro: ERROS.vazia });
        expect(lerPlanilha('\uFEFF\n\n')).toEqual({ ok: false, erro: ERROS.vazia });
        expect(lerPlanilha('nome;whatsapp;processo;data\n')).toEqual({ ok: false, erro: ERROS.semLinhas });
    });
});

describe('lerPlanilha: linhas válidas e inválidas', () => {
    it('50 linhas com 3 inválidas: 47 válidas e as 3 com número e motivo', () => {
        const dados = Array.from({ length: 50 }, (_, i) => linhaValida(i));
        dados[9][1] = '8599';
        dados[24][3] = '31/02/2026';
        dados[39] = ['Cliente 39', '(85) 99999-0000', 'cobrança', '15/12/2026', '', '', 'Mensalidade'];

        const resultado = lerPlanilha(montarCsv([CABECALHO, ...dados], ';'));
        expect(resultado.ok).toBe(true);
        expect(resultado.linhas).toHaveLength(50);
        expect(resultado.validas).toBe(47);
        expect(resultado.invalidas).toBe(3);

        const invalidas = resultado.linhas.filter((l) => !l.valida);
        expect(invalidas.map((l) => l.numero)).toEqual([11, 26, 41]);
        expect(invalidas[0].erros).toEqual([ERROS_TELEFONE.incompleto]);
        expect(invalidas[1].erros).toEqual([MENSAGENS.dataInvalida]);
        expect(invalidas[2].erros).toEqual([MENSAGENS.valorVazio]);
        for (const linha of invalidas) {
            expect(linha.cliente).toBeNull();
            expect(linha.item).toBeNull();
        }
    });

    it('junta todos os motivos de uma linha', () => {
        const resultado = lerPlanilha('nome;whatsapp;processo;data\n;123;limpeza;amanhã\n');
        const [linha] = resultado.linhas;
        expect(linha.valida).toBe(false);
        expect(linha.erros).toHaveLength(4);
        expect(linha.erros).toContain(MENSAGENS.nome);
        expect(linha.erros).toContain(MENSAGENS.processoInvalido);
    });

    it('linha com menos colunas que o cabeçalho trata o que falta como vazio', () => {
        const resultado = lerPlanilha('nome;whatsapp;processo;data;hora\nAna;85999998888;01;10/12/2026\n');
        expect(resultado.linhas[0].erros).toEqual([MENSAGENS.horaVazia]);
    });

    it(`aceita até ${LIMITE_LINHAS} linhas e recusa acima disso`, () => {
        const linha = 'Ana;85999998888;01;10/12/2026;14:00';
        const noLimite = ['nome;whatsapp;processo;data;hora', ...Array(LIMITE_LINHAS).fill(linha)].join('\n');
        expect(lerPlanilha(noLimite).validas).toBe(LIMITE_LINHAS);

        const acima = `${noLimite}\n${linha}`;
        expect(lerPlanilha(acima)).toEqual({ ok: false, erro: ERROS.muitasLinhas });
    });
});

describe('modeloPlanilha', () => {
    it('começa com BOM, usa ponto e vírgula e o cabeçalho em português', () => {
        const modelo = modeloPlanilha();
        expect(modelo.startsWith('\uFEFF')).toBe(true);
        expect(modelo.slice(1).split('\r\n')[0]).toBe('nome;whatsapp;processo;data;hora;valor;servico');
        expect(modelo).toContain('150,00');
        expect(modelo).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    });

    it('é lido de volta com 3 linhas válidas, uma de cada processo', () => {
        const resultado = lerPlanilha(modeloPlanilha());
        expect(resultado.ok).toBe(true);
        expect(resultado.validas).toBe(3);
        expect(resultado.invalidas).toBe(0);
        expect(resultado.linhas.map((l) => l.item.processo)).toEqual(['01', '04', '05']);
    });
});

describe('textos', () => {
    it('não usam palavra proibida nem travessão', () => {
        const textos = [...Object.values(ERROS), modeloPlanilha()];
        textos.push(lerPlanilha('nome;hora\nAna;14:00').erro);
        textos.push(lerPlanilha('hora\n14:00').erro);
        for (const texto of textos) {
            const minusculo = texto.toLowerCase();
            for (const palavra of PROIBIDAS) {
                expect(minusculo).not.toMatch(new RegExp(`\\b${palavra}\\b`, 'u'));
            }
            expect(texto).not.toMatch(/[\u2013\u2014]/);
        }
    });
});
