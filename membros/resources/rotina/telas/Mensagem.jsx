// Tela Mensagem (`#/mensagem/:itemId/:etapa`): o texto pronto da etapa com as
// variáveis preenchidas, editável só para este envio, e o link que abre o
// WhatsApp do dono com esse texto. A ferramenta nunca envia nada: quem aperta
// enviar é o dono, no próprio WhatsApp. Fundo creme. O acento vermelho aparece
// uma vez só, no botão "Abrir no WhatsApp".
//
// Os ajustes são lidos de novo a cada montagem, sem cache: o que mudou em
// Ajustes já vale na próxima abertura.

import { useEffect, useRef, useState } from 'react';
import { pegar } from '../dados/banco.js';
import { lerAjustes } from '../dados/ajustes.js';
import { guardarPendente } from '../dados/envioPendente.js';
import { linkWhatsApp } from '../regras/whatsapp.js';
import { primeiroNome } from '../regras/preencher.js';
import { textos } from '../textos/textos.js';
import { irPara } from '../rotas.js';
import Botao from '../ui/Botao.jsx';
import Campo from '../ui/Campo.jsx';
import Confirmar from '../ui/Confirmar.jsx';
import FolhaEnviou, { AVISO_AINDA_NAO_MS } from '../ui/FolhaEnviou.jsx';
import useVoltaDoWhatsApp from '../ui/useVoltaDoWhatsApp.js';
import {
    comoAbrirAVolta,
    houveEdicao,
    outraVariacao,
    pendenciaAberta,
    pendenteEmMemoria,
    rotuloDaEtapa,
    textoDaMensagem,
    variacaoInicial,
} from '../ui/mensagem.js';

const LINK = 'flex min-h-[44px] items-center text-base underline underline-offset-4';

async function lerDados(itemId) {
    const [item, ajustes] = await Promise.all([pegar('itens', itemId), lerAjustes()]);
    const cliente = item ? await pegar('clientes', item.cliente_id) : null;
    return { item: item ?? null, cliente: cliente ?? null, ajustes };
}

// Props: `itemId` e `etapa`, vindos da rota.
export default function Mensagem({ itemId, etapa }) {
    // undefined enquanto lê; depois `{ item, cliente, ajustes }`.
    const [dados, setDados] = useState(undefined);
    const [erro, setErro] = useState(false);
    const [versao, setVersao] = useState(0);
    const [variacao, setVariacao] = useState(1);
    // null: sem edição, o campo mostra o texto pronto.
    const [editado, setEditado] = useState(null);
    const [confirmandoTroca, setConfirmandoTroca] = useState(false);
    // Pendente do último toque em "Abrir no WhatsApp", guardado também em
    // memória: no iPhone a gravação no aparelho pode não terminar antes de a
    // página ir para segundo plano.
    const [local, setLocal] = useState(null);
    const [folhaLocal, setFolhaLocal] = useState(false);
    const [aviso, setAviso] = useState(null);
    const contaAviso = useRef(0);

    const { perguntar, pendente, abrir, encerrar } = useVoltaDoWhatsApp({ itemId, etapa });

    useEffect(() => {
        let ativo = true;
        lerDados(itemId)
            .then((lidos) => {
                if (!ativo) return;
                setDados(lidos);
                setVariacao(variacaoInicial(lidos.ajustes));
                setEditado(null);
                setErro(false);
            })
            .catch(() => {
                if (ativo) setErro(true);
            });
        return () => {
            ativo = false;
        };
    }, [itemId, versao]);

    // O aviso do "Ainda não" some sozinho.
    useEffect(() => {
        if (!aviso) return undefined;
        const espera = setTimeout(() => setAviso(null), AVISO_AINDA_NAO_MS);
        return () => clearTimeout(espera);
    }, [aviso]);

    const voltarParaHoje = (
        <a href="#/hoje" className={`${LINK} self-start`}>
            Voltar
        </a>
    );

    if (erro) {
        return (
            <section className="flex flex-col gap-3 py-2">
                {voltarParaHoje}
                <p role="alert">Não deu para abrir essa mensagem agora. Tente de novo.</p>
                <Botao
                    largura="total"
                    onClick={() => {
                        setErro(false);
                        setDados(undefined);
                        setVersao((n) => n + 1);
                    }}
                >
                    Tentar de novo
                </Botao>
            </section>
        );
    }

    if (dados === undefined) {
        return (
            <section className="flex flex-col gap-3 py-2" aria-busy="true">
                {voltarParaHoje}
                <p role="status">Abrindo...</p>
            </section>
        );
    }

    const { item, cliente, ajustes } = dados;

    if (!pendenciaAberta(item, cliente)) {
        return (
            <section className="flex flex-col gap-3 py-2">
                <p className="text-lg font-medium">Essa pendência já foi resolvida.</p>
                <a href="#/hoje" className={`${LINK} self-start`}>
                    Voltar para hoje
                </a>
            </section>
        );
    }

    const pronto = textoDaMensagem({ textos, item, cliente, ajustes, etapa, variacao });

    if (pronto === null) {
        return (
            <section className="flex flex-col gap-3 py-2">
                <p className="text-lg font-medium">Não achei o texto dessa etapa.</p>
                <a href="#/hoje" className={`${LINK} self-start`}>
                    Voltar para hoje
                </a>
            </section>
        );
    }

    const texto = editado ?? pronto;
    const link = linkWhatsApp(cliente.whatsapp, texto);

    function trocarTexto() {
        setEditado(null);
        setVariacao((atual) => outraVariacao(atual));
    }

    function pedirTroca() {
        if (houveEdicao(editado, pronto)) {
            setConfirmandoTroca(true);
            return;
        }
        trocarTexto();
    }

    function abrirWhatsApp() {
        // A gravação começa antes de qualquer outra coisa e não segura o link.
        const abertoEm = new Date();
        guardarPendente({ itemId, etapa, abertoEm }).catch(() => {});
        setLocal(pendenteEmMemoria({ itemId, etapa, abertoEm }));
        setAviso(null);
    }

    function jaVoltei() {
        const como = comoAbrirAVolta({ doHook: pendente, local });
        if (como === 'hook') abrir();
        else if (como === 'local') setFolhaLocal(true);
    }

    // Contrato da FolhaEnviou: encerrar() no aoFechar e no aoTerminar.
    function aoFechar(frase) {
        encerrar(local?.aberto_em);
        setFolhaLocal(false);
        setLocal(null);
        contaAviso.current += 1;
        setAviso({ frase, n: contaAviso.current });
    }

    function aoTerminar() {
        encerrar(local?.aberto_em);
        setFolhaLocal(false);
        setLocal(null);
        irPara('/hoje');
    }

    const folhaAberta = perguntar || folhaLocal;
    const pendenteDaFolha = folhaLocal ? local : pendente;

    return (
        <section aria-labelledby="mensagem-titulo" className="flex min-w-0 flex-col py-2">
            {voltarParaHoje}

            <h1 id="mensagem-titulo" className="mt-2 text-2xl font-medium wrap-anywhere">
                {primeiroNome(cliente.nome) || 'Cliente'}
            </h1>
            <p className="mt-1">{rotuloDaEtapa(item.processo, etapa)}</p>

            <div className="mt-4">
                <Campo
                    tipo="textarea"
                    id="mensagem-texto"
                    rotulo="Mensagem"
                    ajuda="O que você mudar aqui vale só para este envio."
                    value={texto}
                    onChange={(e) => setEditado(e.target.value)}
                />
            </div>

            <Botao variante="texto" className="-ml-1 mt-2 self-start" onClick={pedirTroca}>
                Trocar texto
            </Botao>

            <div className="mt-4 flex flex-col gap-2">
                {link.ok ? (
                    <Botao
                        variante="principal"
                        largura="total"
                        href={link.link}
                        target="_blank"
                        rel="noopener"
                        onClick={abrirWhatsApp}
                    >
                        Abrir no WhatsApp
                    </Botao>
                ) : (
                    <div className="flex flex-col items-start gap-1">
                        <p>Esse número não parece um WhatsApp.</p>
                        <a href={`#/clientes/${encodeURIComponent(cliente.id)}`} className={LINK}>
                            Corrigir número
                        </a>
                    </div>
                )}

                {link.ok && local && (
                    <Botao largura="total" onClick={jaVoltei}>
                        Já voltei do WhatsApp
                    </Botao>
                )}
            </div>

            <div aria-live="polite" className="mt-3 min-h-[1.5rem]">
                {aviso && <p key={aviso.n}>{aviso.frase}</p>}
            </div>

            <FolhaEnviou
                item={item}
                etapa={etapa}
                pendente={pendenteDaFolha}
                aberta={folhaAberta}
                aoFechar={aoFechar}
                aoTerminar={aoTerminar}
            />

            <Confirmar
                aberto={confirmandoTroca}
                titulo="Trocar o texto?"
                texto="Sua edição será trocada pelo outro texto."
                rotuloConfirmar="Trocar texto"
                rotuloVoltar="Manter minha edição"
                aoConfirmar={() => {
                    setConfirmandoTroca(false);
                    trocarTexto();
                }}
                aoVoltar={() => setConfirmandoTroca(false)}
            />
        </section>
    );
}
