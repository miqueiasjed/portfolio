import { describe, it, expect } from 'vitest';
import { textos } from './textos.js';
import { preencher } from '../regras/preencher.js';

// Varredura dos 24 textos da pré-venda. Cada falha diz a combinação
// (`05/d5/clinica/2`) e o trecho, para quem for corrigir achar rápido.
// Mudança de texto volta para o usuário aprovar: aqui só se aponta.

const ETAPAS = { '01': ['vespera'], '04': ['d3', 'd7'], '05': ['d1', 'd5', 'd15'] };
const SEGMENTOS = ['clinica', 'servicos'];
const VARIACOES = [1, 2];
const VARIAVEIS = ['nome', 'data', 'hora', 'servico', 'valor', 'negocio', 'assinatura', 'pix'];

// Pelos códigos, para o caractere não entrar no arquivo.
const TRAVESSAO = /[\u2014\u2013]/;
const EMOJI = /\p{Extended_Pictographic}/u;

// Lista da `.claude/rules.md` somada à das regras globais de escrita.
const PROIBIDAS = [
    'automação',
    'automático',
    'automática',
    'automatizar',
    'integração',
    'API',
    'agente',
    'prompt',
    'MCP',
    'webhook',
    'token',
    'sincronizar',
    'sincronização',
    'banco de dados',
    'IndexedDB',
    'vale ressaltar',
    'é importante notar',
    'em suma',
    'ademais',
    'nesse sentido',
    'no mundo de hoje',
    'mergulhar fundo',
    'desbloquear',
    'elevar',
    'jornada',
    'robusto',
    'poderoso',
    'sem esforço',
    'de forma eficiente e escalável',
];

// Valores de exemplo, todos preenchidos.
const CHEIO = {
    nome: 'Ana',
    data: '12/11',
    hora: '14:30',
    servico: 'limpeza de pele',
    valor: 'R$ 1.250,00',
    negocio: 'Clínica Sorriso',
    assinatura: 'Paula',
    pix: 'contato@clinicasorriso.com.br',
};

const rotulo = (t) => `${t.processo}/${t.etapa}/${t.segmento}/${t.variacao}`;

// Sem diferença de caixa e de acento.
const normalizar = (s) =>
    s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

// Palavra inteira: nem letra nem número colados antes ou depois.
const regexProibida = (palavra) => {
    const escapada = normalizar(palavra)
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\s+/g, '\\s+');
    return new RegExp(`(?<![\\p{L}\\p{N}])${escapada}(?![\\p{L}\\p{N}])`, 'u');
};
const REGEX_PROIBIDAS = PROIBIDAS.map((palavra) => [palavra, regexProibida(palavra)]);

// Variáveis que podem faltar. O `{valor}` só é opcional no 04; no 05 ele
// fica no meio da frase, como `{nome}`, `{data}` e `{hora}` (PRD, "Textos").
const opcionaisDe = (processo) => ['servico', 'negocio', 'assinatura', 'pix', ...(processo === '04' ? ['valor'] : [])];

const variaveisDe = (trecho) => [...trecho.matchAll(/\{([^{}]*)\}/g)].map((achado) => achado[1]);

// Problemas de um texto já preenchido, cada um com o trecho.
function problemasDoPreenchido(resultado, valores) {
    const problemas = [];
    if (resultado.trim() === '') problemas.push('ficou vazio');
    for (const linha of resultado.split('\n')) {
        if (/[{}]/.test(linha)) problemas.push(`chave sobrando: "${linha}"`);
        if (/ {2}/.test(linha)) problemas.push(`espaço duplo: "${linha}"`);
        if (/ [,.!?;:]/.test(linha)) problemas.push(`espaço antes de pontuação: "${linha}"`);
        if (/^\s*[,.!?;:]/.test(linha)) problemas.push(`linha começa com pontuação: "${linha}"`);
        if (valores.pix === '' && /pix/i.test(linha)) problemas.push(`"Pix" sem chave: "${linha}"`);
    }
    return problemas;
}

// Todas as combinações de opcionais vazias e preenchidas, com e sem nome.
function combinacoesDeValores(t) {
    const opcionais = opcionaisDe(t.processo).filter((nome) => t.texto.includes(`{${nome}}`));
    const combinacoes = [];
    for (let mascara = 0; mascara < 1 << opcionais.length; mascara++) {
        const vazias = opcionais.filter((_, i) => mascara & (1 << i));
        for (const semNome of [false, true]) {
            const valores = { ...CHEIO };
            for (const nome of vazias) valores[nome] = '';
            if (semNome) valores.nome = '';
            const descricao = [...vazias, ...(semNome ? ['nome'] : [])].join(',') || 'nenhuma';
            combinacoes.push({ descricao, valores });
        }
    }
    return combinacoes;
}

describe('estrutura', () => {
    it('tem exatamente 24 entradas', () => {
        expect(textos).toHaveLength(24);
    });

    it('cada entrada tem processo, etapa, segmento, variacao e texto não vazio', () => {
        const ruins = textos
            .filter(
                (t) =>
                    !t ||
                    typeof t.processo !== 'string' ||
                    typeof t.etapa !== 'string' ||
                    typeof t.segmento !== 'string' ||
                    typeof t.variacao !== 'number' ||
                    typeof t.texto !== 'string' ||
                    t.texto.trim() === '',
            )
            .map((t, i) => `entrada ${i}: ${JSON.stringify(t)}`);
        expect(ruins).toEqual([]);
    });
});

describe('combinações', () => {
    const esperadas = [];
    for (const [processo, etapas] of Object.entries(ETAPAS)) {
        for (const etapa of etapas) {
            for (const segmento of SEGMENTOS) {
                for (const variacao of VARIACOES) esperadas.push(rotulo({ processo, etapa, segmento, variacao }));
            }
        }
    }
    const vistas = textos.map(rotulo);

    it('cada uma das 24 esperadas aparece exatamente uma vez', () => {
        const erradas = esperadas
            .map((combinacao) => [combinacao, vistas.filter((vista) => vista === combinacao).length])
            .filter(([, vezes]) => vezes !== 1)
            .map(([combinacao, vezes]) => `${combinacao} aparece ${vezes} vez(es)`);
        expect(erradas).toEqual([]);
    });

    it('nenhuma fora da lista', () => {
        expect(vistas.filter((vista) => !esperadas.includes(vista))).toEqual([]);
    });
});

describe.each(textos.map((t) => [rotulo(t), t]))('%s', (_nome, t) => {
    it('só usa variáveis conhecidas, sem chave solta', () => {
        const desconhecidas = variaveisDe(t.texto).filter((nome) => !VARIAVEIS.includes(nome));
        expect(desconhecidas, `${rotulo(t)}: variável desconhecida`).toEqual([]);

        const soltas = t.texto
            .split('\n')
            .filter((linha) => /[{}]/.test(linha.replace(/\{\w+\}/g, '')));
        expect(soltas, `${rotulo(t)}: chave aberta ou fechada solta`).toEqual([]);
    });

    it('{hora} só no 01 e {pix} só no 05', () => {
        const nomes = variaveisDe(t.texto);
        if (t.processo !== '01') expect(nomes, `${rotulo(t)}: {hora} fora do 01`).not.toContain('hora');
        if (t.processo !== '05') expect(nomes, `${rotulo(t)}: {pix} fora do 05`).not.toContain('pix');
    });

    it('cada variável opcional fica numa linha sem outra variável', () => {
        const opcionais = opcionaisDe(t.processo);
        const misturadas = t.texto.split('\n').filter((linha) => {
            const nomes = variaveisDe(linha);
            return nomes.some((nome) => opcionais.includes(nome)) && nomes.length > 1;
        });
        expect(misturadas, `${rotulo(t)}: opcional dividindo linha`).toEqual([]);
    });

    it('sem palavra proibida', () => {
        const normalizado = normalizar(t.texto);
        const achadas = REGEX_PROIBIDAS.filter(([, regex]) => regex.test(normalizado)).map(([palavra]) => palavra);
        expect(achadas, `${rotulo(t)}: palavra proibida`).toEqual([]);
    });

    it('sem travessão e sem emoji', () => {
        const linhas = t.texto.split('\n');
        expect(
            linhas.filter((linha) => TRAVESSAO.test(linha)),
            `${rotulo(t)}: travessão`,
        ).toEqual([]);
        expect(
            linhas.filter((linha) => EMOJI.test(linha)),
            `${rotulo(t)}: emoji`,
        ).toEqual([]);
    });

    it('preenche limpo com qualquer combinação de opcionais vazias', () => {
        const problemas = [];
        for (const { descricao, valores } of combinacoesDeValores(t)) {
            const resultado = preencher(t.texto, valores);
            for (const problema of problemasDoPreenchido(resultado, valores)) {
                problemas.push(`[vazias: ${descricao}] ${problema}`);
            }
        }
        expect(problemas, `${rotulo(t)}: preenchimento`).toEqual([]);
    });
});
