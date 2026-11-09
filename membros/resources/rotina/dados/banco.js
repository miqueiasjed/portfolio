// Banco local da ferramenta, sobre o IndexedDB nativo do navegador.
// Nada aqui faz chamada de rede: os dados de clientes ficam só no aparelho.

export const NOME_BANCO = 'rotina-do-dia';
export const VERSAO = 1;

let promessaConexao = null;
let conexaoAtual = null;

// Solta a conexão só se ela ainda é a reaproveitada (pode já ter sido trocada).
function esquecerConexao(db) {
    if (conexaoAtual === db) {
        conexaoAtual = null;
        promessaConexao = null;
    }
    db.onversionchange = null;
    db.onclose = null;
}

function criarStores(db) {
    db.createObjectStore('clientes', { keyPath: 'id' });

    const itens = db.createObjectStore('itens', { keyPath: 'id' });
    itens.createIndex('cliente_id', 'cliente_id');
    itens.createIndex('status', 'status');

    const toques = db.createObjectStore('toques', { keyPath: 'id' });
    toques.createIndex('item_id', 'item_id');

    db.createObjectStore('ajustes', { keyPath: 'chave' });
    db.createObjectStore('meta', { keyPath: 'chave' });
}

// Abre o banco uma vez e reaproveita a conexão nas chamadas seguintes.
export function abrir() {
    if (promessaConexao) {
        return promessaConexao;
    }

    promessaConexao = new Promise((resolve, reject) => {
        let pedido;
        try {
            pedido = indexedDB.open(NOME_BANCO, VERSAO);
        } catch (erro) {
            reject(erro);
            return;
        }

        pedido.onupgradeneeded = () => {
            const db = pedido.result;
            if (db.objectStoreNames.length === 0) {
                criarStores(db);
            }
        };

        pedido.onsuccess = () => {
            const db = pedido.result;
            // Outra aba (ou o teste) quer apagar ou subir a versão do banco:
            // fecha esta conexão para não bloquear, e a próxima chamada reabre.
            db.onversionchange = () => {
                db.close();
                esquecerConexao(db);
            };
            // Fechamento inesperado pelo navegador.
            db.onclose = () => esquecerConexao(db);
            conexaoAtual = db;
            resolve(db);
        };

        pedido.onerror = () => reject(pedido.error);
        pedido.onblocked = () => reject(new Error('Banco bloqueado por outra aba aberta.'));
    });

    // Falhou ao abrir: deixa a próxima chamada tentar de novo.
    const promessa = promessaConexao;
    promessa.catch(() => {
        if (promessaConexao === promessa) {
            promessaConexao = null;
        }
    });

    return promessa;
}

// Fecha e descarta a conexão reaproveitada (os testes usam antes de apagar o banco).
export async function fechar() {
    const promessa = promessaConexao;
    if (!promessa) {
        return;
    }
    promessaConexao = null;

    let db;
    try {
        db = await promessa;
    } catch {
        return;
    }
    // Sem passar por esquecerConexao: uma abertura nova, pedida durante o
    // await acima, não pode ser descartada aqui.
    if (conexaoAtual === db) {
        conexaoAtual = null;
    }
    db.onversionchange = null;
    db.onclose = null;
    db.close();
}

function desembrulhar(valor) {
    return valor instanceof IDBRequest ? valor.result : valor;
}

function resultadoDe(valor) {
    if (Array.isArray(valor)) {
        return valor.map(desembrulhar);
    }
    if (valor && Object.getPrototypeOf(valor) === Object.prototype) {
        const saida = {};
        for (const [nome, item] of Object.entries(valor)) {
            saida[nome] = desembrulhar(item);
        }
        return saida;
    }
    return desembrulhar(valor);
}

// Roda várias operações numa transação só.
//
// - `stores`: nome de uma store ou lista de nomes; `modo`: 'readonly' ou 'readwrite'.
// - `fn(lojas, tx)` recebe `lojas`, objeto com cada IDBObjectStore pelo nome
//   (`lojas.clientes`, `lojas.itens`...), e a IDBTransaction crua.
// - `fn` precisa ser síncrona: só enfileira pedidos (get, getAll, put, clear...).
//   Um `await` dentro dela deixa a transação terminar antes da hora.
// - A Promise resolve no `oncomplete` da transação (tudo gravado) com o que `fn`
//   devolveu. Pedidos IDBRequest devolvidos direto, numa lista ou como valores de
//   um objeto simples são trocados pelo `.result` deles. Ex.:
//   `transacao(['clientes', 'itens'], 'readonly', (l) => ({ clientes: l.clientes.getAll(), itens: l.itens.getAll() }))`
//   resolve com `{ clientes: [...], itens: [...] }`.
// - Se `fn` lançar erro ou algum pedido falhar, a transação é desfeita inteira
//   e a Promise rejeita com o erro.
export async function transacao(stores, modo, fn) {
    const db = await abrir();
    const nomes = Array.isArray(stores) ? stores : [stores];

    return new Promise((resolve, reject) => {
        let tx;
        try {
            tx = db.transaction(nomes, modo);
        } catch (erro) {
            reject(erro);
            return;
        }

        let retorno;
        let erroDeFn = null;

        tx.oncomplete = () => resolve(resultadoDe(retorno));
        tx.onerror = (evento) => {
            reject(evento.target?.error ?? tx.error);
        };
        tx.onabort = () => {
            reject(erroDeFn ?? tx.error ?? new Error('Transação cancelada.'));
        };

        try {
            const lojas = {};
            for (const nome of nomes) {
                lojas[nome] = tx.objectStore(nome);
            }
            retorno = fn(lojas, tx);
        } catch (erro) {
            erroDeFn = erro;
            try {
                tx.abort();
            } catch {
                // A transação já tinha terminado.
            }
            reject(erro);
        }
    });
}

export function pegar(store, chave) {
    return transacao(store, 'readonly', (l) => l[store].get(chave));
}

// Grava (insere ou substitui) e resolve com a chave do registro.
export function salvar(store, registro) {
    return transacao(store, 'readwrite', (l) => l[store].put(registro));
}

export function listar(store) {
    return transacao(store, 'readonly', (l) => l[store].getAll());
}

export function listarPorIndice(store, indice, valor) {
    return transacao(store, 'readonly', (l) => l[store].index(indice).getAll(valor));
}

export async function apagar(store, chave) {
    await transacao(store, 'readwrite', (l) => l[store].delete(chave));
}

export async function limpar(store) {
    await transacao(store, 'readwrite', (l) => l[store].clear());
}

// Cada registro de `meta` tem a forma `{ chave, valor }`.
export async function lerMeta(chave) {
    const registro = await pegar('meta', chave);
    return registro?.valor;
}

export async function gravarMeta(chave, valor) {
    await salvar('meta', { chave, valor });
}
