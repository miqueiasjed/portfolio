// Arquivo da cópia de segurança, gerado e lido no próprio navegador.
// Funções puras: quem grava no aparelho é o `importarBackup` de dados/backup.js,
// que confere de novo e grava tudo numa transação só.

const VERSAO_ATUAL = 1;
const LISTAS = ['clientes', 'itens', 'toques', 'ajustes'];
const PROCESSOS = ['01', '04', '05'];

export const ERRO_NAO_E_COPIA = 'Esse arquivo não é uma cópia da Rotina do Dia.';
export const ERRO_VERSAO_NOVA = 'Essa cópia veio de uma versão mais nova da ferramenta. Atualize a página e tente de novo.';

export function textoDaCopia(dados) {
    return JSON.stringify(dados, null, 2);
}

// `hoje` chega como `YYYY-MM-DD`.
export function nomeDoArquivoDeCopia(hoje) {
    return `rotina-do-dia-copia-${hoje}.json`;
}

function objeto(valor) {
    return valor !== null && typeof valor === 'object' && !Array.isArray(valor);
}

function texto(valor) {
    return typeof valor === 'string' && valor.trim() !== '';
}

// Mesma regra de chave do backup.js: texto não vazio ou número finito.
function chave(valor) {
    return texto(valor) || (typeof valor === 'number' && Number.isFinite(valor));
}

function clienteValido(cliente) {
    return objeto(cliente) && chave(cliente.id) && texto(cliente.nome) && texto(cliente.whatsapp);
}

function itemValido(item) {
    return objeto(item) && chave(item.id) && chave(item.cliente_id) && PROCESSOS.includes(item.processo);
}

// Toque sem `id` ou ajuste sem `chave` o navegador não consegue gravar, então
// recusa aqui em vez de deixar a falha para a hora de restaurar.
function toqueValido(toque) {
    return objeto(toque) && chave(toque.id);
}

function ajusteValido(ajuste) {
    return objeto(ajuste) && chave(ajuste.chave);
}

function falha(erro) {
    return { ok: false, erro };
}

export function lerCopia(conteudo) {
    if (typeof conteudo !== 'string') {
        return falha(ERRO_NAO_E_COPIA);
    }

    let dados;
    try {
        dados = JSON.parse(conteudo);
    } catch {
        return falha(ERRO_NAO_E_COPIA);
    }

    if (!objeto(dados) || typeof dados.versao !== 'number' || !Number.isInteger(dados.versao)) {
        return falha(ERRO_NAO_E_COPIA);
    }
    // A versão vem antes das listas: uma cópia mais nova pode ter outro formato.
    if (dados.versao > VERSAO_ATUAL) {
        return falha(ERRO_VERSAO_NOVA);
    }
    if (dados.versao !== VERSAO_ATUAL) {
        return falha(ERRO_NAO_E_COPIA);
    }
    if (!LISTAS.every((nome) => Array.isArray(dados[nome]))) {
        return falha(ERRO_NAO_E_COPIA);
    }

    const valido =
        dados.clientes.every(clienteValido) &&
        dados.itens.every(itemValido) &&
        dados.toques.every(toqueValido) &&
        dados.ajustes.every(ajusteValido);
    if (!valido) {
        return falha(ERRO_NAO_E_COPIA);
    }

    return {
        ok: true,
        dados,
        resumo: {
            clientes: dados.clientes.length,
            pendencias: dados.itens.filter((item) => item.status === 'aberto').length,
        },
    };
}
