// Tela Clientes (`#/clientes`): lista dos clientes guardados no aparelho, com
// busca por nome ou número e quantas pendências cada um tem em aberto. Atalhos
// para cadastrar (`#/novo`) e para importar planilha, que abre aqui mesmo no
// lugar da lista. Fundo creme. O acento vermelho aparece uma vez só, no Novo.

import { useEffect, useRef, useState } from 'react';
import { buscarClientes } from '../dados/clientes.js';
import { formatarTelefone } from '../regras/whatsapp.js';
import ImportarPlanilha from '../ui/ImportarPlanilha.jsx';

const ESPERA_BUSCA = 150;

const CAMPO =
    'min-h-[44px] w-full min-w-0 appearance-none border border-filete-claro bg-transparent px-3 text-base text-tinta placeholder:text-apoio';
const BOTAO_ACENTO =
    'flex min-h-[48px] w-full items-center justify-center bg-caneta-creme px-4 text-base font-medium text-papel';
const BOTAO_CONTORNO =
    'flex min-h-[48px] w-full items-center justify-center border border-tinta px-2 text-center text-base leading-tight font-medium text-tinta';

function Atalhos({ importarRef, aoImportar, empilhados }) {
    return (
        <div className={empilhados ? 'flex flex-col gap-2' : 'grid grid-cols-[2fr_3fr] gap-2'}>
            <a href="#/novo" className={BOTAO_ACENTO}>
                Novo
            </a>
            <button type="button" ref={importarRef} onClick={aoImportar} className={BOTAO_CONTORNO}>
                Importar planilha
            </button>
        </div>
    );
}

function Linha({ cliente }) {
    return (
        <li className="border-b border-filete-claro last:border-b-0">
            <a
                href={`#/clientes/${encodeURIComponent(cliente.id)}`}
                className="flex min-h-[56px] items-center justify-between gap-3 py-2"
            >
                <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{cliente.nome}</span>
                    <span className="truncate text-sm">{formatarTelefone(cliente.whatsapp)}</span>
                </span>
                {cliente.abertas > 0 && (
                    <span className="shrink-0 text-sm font-medium">
                        {cliente.abertas.toLocaleString('pt-BR')} em aberto
                    </span>
                )}
            </a>
        </li>
    );
}

export default function Clientes() {
    const [importando, setImportando] = useState(false);
    const [termo, setTermo] = useState('');
    // null enquanto a primeira busca não volta.
    const [clientes, setClientes] = useState(null);
    const [erro, setErro] = useState(false);
    // Muda para buscar de novo com o mesmo termo (depois de importar ou do erro).
    const [versao, setVersao] = useState(0);

    // Só a busca mais recente pode trocar a lista.
    const busca = useRef(0);
    const importarRef = useRef(null);
    const importarAreaRef = useRef(null);
    const voltouDoImportar = useRef(false);

    useEffect(() => {
        if (importando) return undefined;
        const vez = ++busca.current;
        // Campo vazio busca na hora; digitando, espera a pausa entre teclas.
        const espera = termo.trim() === '' ? 0 : ESPERA_BUSCA;
        const relogio = setTimeout(() => {
            buscarClientes(termo)
                .then((achados) => {
                    if (vez !== busca.current) return;
                    setClientes(achados);
                    setErro(false);
                })
                .catch(() => {
                    if (vez === busca.current) setErro(true);
                });
        }, espera);
        return () => clearTimeout(relogio);
    }, [termo, versao, importando]);

    // Foco acompanha a troca entre lista e importação. Na volta, espera a
    // lista chegar, porque o botão pode mudar de lugar (lista vazia ou não).
    useEffect(() => {
        if (importando) {
            importarAreaRef.current?.focus();
        } else if (voltouDoImportar.current && clientes !== null) {
            voltouDoImportar.current = false;
            importarRef.current?.focus();
        }
    }, [importando, clientes]);

    function abrirImportar() {
        setImportando(true);
    }

    function fecharImportar() {
        voltouDoImportar.current = true;
        setImportando(false);
    }

    // Importou: volta para a lista inteira, já com os clientes novos.
    function terminarImportar() {
        voltouDoImportar.current = true;
        setTermo('');
        setClientes(null);
        setVersao((n) => n + 1);
        setImportando(false);
    }

    const buscando = termo.trim() !== '';
    const semClientes = clientes !== null && clientes.length === 0 && !buscando;

    let conteudo;
    if (erro) {
        conteudo = (
            <div className="mt-6 flex flex-col gap-3">
                <p role="alert">Não deu para abrir a lista agora. Tente de novo.</p>
                <button type="button" onClick={() => setVersao((n) => n + 1)} className={BOTAO_CONTORNO}>
                    Tentar de novo
                </button>
            </div>
        );
    } else if (clientes === null) {
        conteudo = (
            <p role="status" className="mt-6">
                Abrindo a lista...
            </p>
        );
    } else if (semClientes) {
        conteudo = (
            <div className="mt-6 flex flex-col gap-4">
                <p className="text-lg font-medium">Nenhum cliente ainda.</p>
                <Atalhos importarRef={importarRef} aoImportar={abrirImportar} empilhados />
            </div>
        );
    } else if (clientes.length === 0) {
        conteudo = (
            <p role="status" className="mt-6">
                Ninguém com esse nome ou número.
            </p>
        );
    } else {
        conteudo = (
            <ul aria-label="Clientes" className="mt-4 flex flex-col border-t border-filete-claro">
                {clientes.map((cliente) => (
                    <Linha key={cliente.id} cliente={cliente} />
                ))}
            </ul>
        );
    }

    return (
        <section aria-labelledby="clientes-titulo" className="py-2">
            <h1 id="clientes-titulo" className="text-2xl font-medium">
                Clientes
            </h1>

            {importando ? (
                <div ref={importarAreaRef} tabIndex={-1} className="mt-4 outline-none">
                    <ImportarPlanilha aoTerminar={terminarImportar} aoFechar={fecharImportar} />
                </div>
            ) : (
                <>
                    {!semClientes && clientes !== null && (
                        <div className="mt-4 flex flex-col gap-3">
                            <div className="flex min-w-0 flex-col gap-1">
                                <label htmlFor="clientes-busca" className="text-sm">
                                    Buscar
                                </label>
                                <input
                                    id="clientes-busca"
                                    type="search"
                                    autoComplete="off"
                                    spellCheck={false}
                                    enterKeyHint="search"
                                    placeholder="Nome ou número"
                                    value={termo}
                                    onChange={(e) => setTermo(e.target.value)}
                                    className={CAMPO}
                                />
                            </div>
                            <Atalhos importarRef={importarRef} aoImportar={abrirImportar} />
                        </div>
                    )}
                    {conteudo}
                </>
            )}
        </section>
    );
}
