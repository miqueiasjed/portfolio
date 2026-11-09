import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAst } from 'vite';

// Varredura dos textos que aparecem na tela: palavra proibida, travessão e
// emoji. Cada falha diz `arquivo:linha` e o trecho. Mudança de texto volta
// para o usuário aprovar: aqui só se aponta.

const ROTINA = fileURLToPath(new URL('..', import.meta.url));

function fontesDe(pasta) {
    return readdirSync(join(ROTINA, pasta))
        .filter((nome) => /\.(jsx?|mjs)$/.test(nome) && !/\.test\.jsx?$/.test(nome))
        .sort()
        .map((nome) => join(ROTINA, pasta, nome));
}

// `ERROS` de regras/whatsapp.js aparece na tela de cadastro.
const ARQUIVOS = [...fontesDe('telas'), ...fontesDe('ui'), join(ROTINA, 'regras', 'whatsapp.js')];

// Pelos códigos, para o caractere não entrar no arquivo.
const TRAVESSAO = /[—–]/;
const EMOJI = /\p{Extended_Pictographic}/u;

// Mesma lista e mesma normalização de textos/textos.test.js (task 3.7):
// `.claude/rules.md` somada às regras globais de escrita.
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

// Sem diferença de caixa e de acento.
const normalizar = (s) =>
    s
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase();

// Palavra inteira: nem letra nem número colados antes ou depois.
const regexProibida = (palavra) => {
    const escapada = normalizar(palavra)
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\s+/g, '\\s+');
    return new RegExp(`(?<![\\p{L}\\p{N}])${escapada}(?![\\p{L}\\p{N}])`, 'u');
};
const REGEX_PROIBIDAS = PROIBIDAS.map((palavra) => [palavra, regexProibida(palavra)]);

// Literais que não chegam à tela: chave de uma palavra minúscula
// (`'token'` do meta), caminho (`/api/...`) e cabeçalho HTTP.
function ficaDeFora(texto) {
    const limpo = texto.trim();
    if (limpo === '') return true;
    if (!/\s/.test(limpo) && limpo === limpo.toLowerCase()) return true;
    if (limpo.startsWith('/')) return true;
    if (limpo === 'Authorization' || limpo.startsWith('Bearer ')) return true;
    return false;
}

// Strings entre aspas, partes fixas de crases e texto JSX entre `>` e `<`,
// com a posição no código. Nome de variável, import e comentário ficam fora.
function literais(codigo) {
    const ast = parseAst(codigo, { lang: 'jsx' });
    const achados = [];
    const visitar = (no, pai, campo) => {
        if (!no || typeof no.type !== 'string') return;
        if (no.type === 'Literal' && typeof no.value === 'string') {
            const deImport = campo === 'source';
            const chave = campo === 'key' && pai?.type === 'Property' && !pai.computed;
            if (!deImport && !chave) achados.push({ texto: no.value, inicio: no.start });
        } else if (no.type === 'TemplateElement') {
            achados.push({ texto: no.value.cooked ?? no.value.raw, inicio: no.start });
        } else if (no.type === 'JSXText') {
            achados.push({ texto: no.value, inicio: no.start });
        }
        for (const [nome, valor] of Object.entries(no)) {
            if (Array.isArray(valor)) valor.forEach((filho) => visitar(filho, no, nome));
            else if (valor && typeof valor === 'object') visitar(valor, no, nome);
        }
    };
    visitar(ast, null, null);
    return achados;
}

const linhaDe = (codigo, posicao) => codigo.slice(0, posicao).split('\n').length;
const trecho = (texto) => JSON.stringify(texto.replace(/\s+/g, ' ').trim().slice(0, 80));

// Problemas de palavra proibida: `arquivo:linha "trecho" (palavra)`.
function palavrasProibidas(codigo, nome = 'codigo') {
    const problemas = [];
    for (const { texto, inicio } of literais(codigo)) {
        if (ficaDeFora(texto)) continue;
        const normalizado = normalizar(texto);
        for (const [palavra, regex] of REGEX_PROIBIDAS) {
            if (regex.test(normalizado)) problemas.push(`${nome}:${linhaDe(codigo, inicio)} ${trecho(texto)} (${palavra})`);
        }
    }
    return problemas;
}

// Travessão ou emoji em qualquer linha do arquivo, comentário incluído.
function caracteresProibidos(codigo, nome) {
    const problemas = [];
    codigo.split('\n').forEach((linha, i) => {
        if (TRAVESSAO.test(linha)) problemas.push(`${nome}:${i + 1} travessão: ${trecho(linha)}`);
        if (EMOJI.test(linha)) problemas.push(`${nome}:${i + 1} emoji: ${trecho(linha)}`);
    });
    return problemas;
}

const FONTES = ARQUIVOS.map((caminho) => [relative(ROTINA, caminho), readFileSync(caminho, 'utf8')]);

describe('a própria varredura', () => {
    it('acha os arquivos de telas, ui e o whatsapp.js', () => {
        const nomes = FONTES.map(([nome]) => nome);
        expect(nomes).toContain('regras/whatsapp.js');
        expect(nomes.some((n) => n.startsWith('telas/') && n.endsWith('.jsx'))).toBe(true);
        expect(nomes.some((n) => n.startsWith('ui/') && n.endsWith('.js'))).toBe(true);
        expect(nomes.some((n) => n.endsWith('.test.js'))).toBe(false);
    });

    it('acusa "token" em texto visível, em JSX, aspas ou crase', () => {
        expect(palavrasProibidas('const a = <p>Seu Token expirou</p>;')).toHaveLength(1);
        expect(palavrasProibidas("const a = 'Confira o token do aparelho.';")).toHaveLength(1);
        expect(palavrasProibidas('const a = `Falta o token, ${nome}.`;')).toHaveLength(1);
        expect(palavrasProibidas('const a = <Botao rotulo="Sincronizar agora" />;')).toHaveLength(1);
        expect(palavrasProibidas("const a = 'Erro na API.';")[0]).toMatch(/^codigo:1 "Erro na API\." \(API\)$/);
    });

    it('não acusa token como variável, chave do meta, caminho ou cabeçalho', () => {
        const codigo = [
            "import { token } from './token.js';",
            "// comentário sobre o token do aparelho",
            'const token = await lerMeta(\'token\');',
            "await gravarMeta('token', meta.token);",
            "const r = { token, 'token_aparelho': 1 };",
            'fetch(`/api/rotina/acesso?token=${token}`, { headers: { Authorization: `Bearer ${token}` } });',
            'const b = <p className="tela">{token}</p>;',
        ].join('\n');
        expect(palavrasProibidas(codigo)).toEqual([]);
    });

    it('compara palavra inteira, sem caixa e sem acento', () => {
        expect(palavrasProibidas("const a = 'Tokenizado no elevador.';")).toEqual([]);
        expect(palavrasProibidas("const a = 'PROMPT de comando';")).toHaveLength(1);
        expect(palavrasProibidas("const a = 'Envio automatico';")).toHaveLength(1);
    });
});

describe.each(FONTES)('%s', (nome, codigo) => {
    it('sem palavra proibida nos textos', () => {
        expect(palavrasProibidas(codigo, nome)).toEqual([]);
    });

    it('sem travessão e sem emoji', () => {
        expect(caracteresProibidos(codigo, nome)).toEqual([]);
    });
});
