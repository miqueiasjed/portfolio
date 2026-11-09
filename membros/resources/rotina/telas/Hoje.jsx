// Tela Hoje (`#/hoje`): quem o dono precisa chamar hoje, agrupado por processo
// com contagem. Cada linha leva direto ao texto pronto da Mensagem (um toque).
// Fundo creme. O acento vermelho aparece uma vez só: o filete à esquerda da
// primeira linha da lista, a mais urgente.
//
// A lista é lida de novo a cada montagem: o App desmonta esta tela ao abrir a
// Mensagem, então a volta depois de "Enviei" já não traz aquele item.
//
// Aparelho sem ajustes gravados e sem clientes mostra o primeiro uso no lugar
// da tela (`ehPrimeiroUso`).

import { useEffect, useState } from 'react';
import { listar, listarPorIndice, pegar } from '../dados/banco.js';
import { lerAjustes } from '../dados/ajustes.js';
import { listaDeHoje } from '../regras/hoje.js';
import { hojeEmFortaleza } from '../regras/datas.js';
import { ehPrimeiroUso } from '../regras/primeiroUso.js';
import { agruparPorProcesso, dataDoTopo, linhaDeApoio, nomesDaLista, rotaDaMensagem } from '../ui/listaDoDia.js';
import Botao from '../ui/Botao.jsx';
import PrimeiroUso from './PrimeiroUso.jsx';

async function lerLista(hoje) {
    const [itens, toques, clientes, ajustes, ajustesSalvos] = await Promise.all([
        listarPorIndice('itens', 'status', 'aberto'),
        listar('toques'),
        listar('clientes'),
        lerAjustes(),
        // `lerAjustes` sempre devolve o padrão; o registro cru diz se já há ajustes.
        pegar('ajustes', 'geral'),
    ]);
    return {
        lista: listaDeHoje({ itens, toques, clientes, hoje, ajustes }),
        primeiroUso: ehPrimeiroUso(ajustesSalvos, clientes),
    };
}

function Linha({ entrada, nome, hoje, urgente }) {
    const servico = typeof entrada.item.servico === 'string' ? entrada.item.servico.trim() : '';
    return (
        <li className="border-b border-filete-claro last:border-b-0">
            <a
                href={rotaDaMensagem(entrada)}
                className={`flex min-h-[56px] flex-col justify-center border-l-4 py-2 pl-3 ${
                    urgente ? 'border-l-caneta-creme' : 'border-l-transparent'
                }`}
            >
                <span className="flex min-w-0 items-baseline gap-2">
                    <span className="shrink-0 font-medium">{nome}</span>
                    {servico && <span className="truncate">{servico}</span>}
                </span>
                <span className="text-sm">{linhaDeApoio(entrada, hoje)}</span>
            </a>
        </li>
    );
}

export default function Hoje() {
    // O dia é fixado ao montar, para a data do topo e a lista baterem.
    const [hoje] = useState(() => hojeEmFortaleza());
    // null enquanto a leitura não volta: nada de vazio antes dos dados.
    const [lista, setLista] = useState(null);
    const [primeiroUso, setPrimeiroUso] = useState(false);
    const [erro, setErro] = useState(false);
    const [versao, setVersao] = useState(0);

    useEffect(() => {
        let ativo = true;
        lerLista(hoje)
            .then((achados) => {
                if (!ativo) return;
                setLista(achados.lista);
                setPrimeiroUso(achados.primeiroUso);
                setErro(false);
            })
            .catch(() => {
                if (ativo) setErro(true);
            });
        return () => {
            ativo = false;
        };
    }, [hoje, versao]);

    function tentarDeNovo() {
        setErro(false);
        setLista(null);
        setVersao((n) => n + 1);
    }

    // "Fazer isso depois": os ajustes já foram gravados no passo 2, então a
    // releitura cai na Hoje normal.
    function sairDoPrimeiroUso() {
        setPrimeiroUso(false);
        tentarDeNovo();
    }

    if (primeiroUso && !erro) {
        return <PrimeiroUso aoTerminar={sairDoPrimeiroUso} />;
    }

    let conteudo = null;
    if (erro) {
        conteudo = (
            <div className="mt-6 flex flex-col gap-3">
                <p role="alert">Não deu para abrir a lista agora. Tente de novo.</p>
                <Botao largura="total" onClick={tentarDeNovo}>
                    Tentar de novo
                </Botao>
            </div>
        );
    } else if (lista !== null && lista.length === 0) {
        conteudo = (
            <div className="mt-6 flex flex-col items-start gap-2">
                <p className="text-lg font-medium">Nada para hoje. Volte amanhã de manhã.</p>
                <Botao variante="texto" href="#/novo" className="-ml-1">
                    Anotar um cliente
                </Botao>
            </div>
        );
    } else if (lista !== null) {
        const grupos = agruparPorProcesso(lista);
        const primeira = grupos[0]?.entradas[0];
        const nomes = nomesDaLista(lista);
        conteudo = (
            <div className="mt-4 flex flex-col gap-6">
                {grupos.map((grupo) => (
                    <section key={grupo.processo} aria-labelledby={`hoje-grupo-${grupo.processo}`}>
                        <h2 id={`hoje-grupo-${grupo.processo}`} className="text-lg font-medium">
                            {grupo.titulo}
                        </h2>
                        <ul className="mt-2 flex flex-col border-t border-filete-claro">
                            {grupo.entradas.map((entrada) => (
                                <Linha
                                    key={entrada.item.id}
                                    entrada={entrada}
                                    nome={nomes.get(entrada.item.id)}
                                    hoje={hoje}
                                    urgente={entrada === primeira}
                                />
                            ))}
                        </ul>
                    </section>
                ))}
            </div>
        );
    }

    return (
        <section aria-labelledby="hoje-titulo" aria-busy={lista === null && !erro} className="py-2">
            <h1 id="hoje-titulo" className="text-2xl font-medium">
                Hoje
            </h1>
            <p className="mt-1">{dataDoTopo(hoje)}</p>
            {conteudo}
        </section>
    );
}
