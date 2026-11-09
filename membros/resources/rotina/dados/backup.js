// Backup JSON do aparelho. É a única cópia dos dados fora dele, levada pelo
// próprio dono. A store `meta` nunca entra: ela guarda o token do aparelho.
// A confirmação antes de importar fica com a tela, não com estas funções.
import { transacao } from './banco.js';

export const VERSAO_BACKUP = 1;

// Store do backup e o campo que serve de chave em cada uma.
const STORES = {
    clientes: 'id',
    itens: 'id',
    toques: 'id',
    ajustes: 'chave',
};
const NOMES = Object.keys(STORES);

const MENSAGEM_INVALIDO = 'Arquivo de backup inválido.';

export async function exportarBackup(agora = new Date()) {
    const dados = await transacao(NOMES, 'readonly', (l) => {
        const pedidos = {};
        for (const nome of NOMES) {
            pedidos[nome] = l[nome].getAll();
        }
        return pedidos;
    });

    return {
        versao: VERSAO_BACKUP,
        exportado_em: agora.toISOString(),
        clientes: dados.clientes,
        itens: dados.itens,
        toques: dados.toques,
        ajustes: dados.ajustes,
    };
}

function chaveValida(valor) {
    return (typeof valor === 'string' && valor !== '') || (typeof valor === 'number' && Number.isFinite(valor));
}

function registroValido(registro, campoChave) {
    return (
        registro !== null &&
        typeof registro === 'object' &&
        !Array.isArray(registro) &&
        chaveValida(registro[campoChave])
    );
}

function validar(dados) {
    if (typeof dados === 'string') {
        try {
            dados = JSON.parse(dados);
        } catch {
            return null;
        }
    }
    if (dados === null || typeof dados !== 'object' || Array.isArray(dados)) {
        return null;
    }
    if (dados.versao !== VERSAO_BACKUP) {
        return null;
    }
    for (const [nome, campoChave] of Object.entries(STORES)) {
        const lista = dados[nome];
        if (!Array.isArray(lista) || !lista.every((r) => registroValido(r, campoChave))) {
            return null;
        }
    }
    return dados;
}

// Aceita o objeto já lido do arquivo ou o texto JSON cru. Valida tudo antes de
// abrir a transação; depois limpa as quatro stores e grava os registros numa
// transação só, então qualquer falha desfaz tudo e o banco fica como estava.
// Campos fora do contrato (inclusive um `meta` no arquivo) são ignorados.
export async function importarBackup(dados) {
    const valido = validar(dados);
    if (!valido) {
        throw new Error(MENSAGEM_INVALIDO);
    }

    try {
        await transacao(NOMES, 'readwrite', (l) => {
            for (const nome of NOMES) {
                l[nome].clear();
            }
            for (const nome of NOMES) {
                for (const registro of valido[nome]) {
                    l[nome].put(registro);
                }
            }
        });
    } catch (erro) {
        // Registro que o navegador não consegue gravar: a transação já foi
        // desfeita, só troca o erro técnico pela mensagem da tela.
        throw new Error(MENSAGEM_INVALIDO, { cause: erro });
    }
}
