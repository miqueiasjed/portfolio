// Primeiro uso: aparece na Hoje quando o aparelho ainda não tem ajustes nem
// clientes. Três passos curtos, um por vez: tipo de negócio, nome e assinatura,
// primeiro cliente. O passo 2 grava os ajustes, então a Hoje não volta a
// mostrar isto mesmo que o dono pule o passo 3. Fundo creme. O acento vermelho
// aparece uma vez só, no botão "Anotar cliente" do passo 3.

import { useEffect, useRef, useState } from 'react';
import { salvarAjustes } from '../dados/ajustes.js';
import { SEGMENTOS } from '../regras/ajustes.js';
import { ajustesDoPrimeiroUso, contagemDoPasso, passoAnterior, passoSeguinte } from '../regras/primeiroUso.js';
import Botao from '../ui/Botao.jsx';
import Campo from '../ui/Campo.jsx';

const ERRO_GUARDAR = 'Não deu para guardar agora. Tente de novo.';
const TITULO = 'text-2xl font-medium outline-none';

// Props: `aoTerminar`, chamado em "Fazer isso depois" para a Hoje ler a lista
// de novo (o endereço pode já ser `#/hoje`, e aí nada muda sozinho).
export default function PrimeiroUso({ aoTerminar }) {
    const [passo, setPasso] = useState(1);
    const [segmento, setSegmento] = useState(null);
    const [negocio, setNegocio] = useState('');
    const [assinatura, setAssinatura] = useState('');
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState('');

    // A cada troca de passo o foco vai para o título novo, para o leitor de
    // tela anunciar a pergunta. Na abertura fica onde o navegador deixou.
    const titulo = useRef(null);
    const montado = useRef(false);
    useEffect(() => {
        if (!montado.current) {
            montado.current = true;
            return;
        }
        titulo.current?.focus();
    }, [passo]);

    function escolherSegmento(valor) {
        setSegmento(valor);
        setPasso(passoSeguinte(1));
    }

    async function continuar(evento) {
        evento.preventDefault();
        if (salvando) return;
        setSalvando(true);
        setErro('');
        try {
            await salvarAjustes(ajustesDoPrimeiroUso({ segmento, negocio, assinatura }));
        } catch {
            setSalvando(false);
            setErro(ERRO_GUARDAR);
            return;
        }
        setSalvando(false);
        setPasso(passoSeguinte(2));
    }

    let corpo;
    if (passo === 1) {
        corpo = (
            <>
                <h1 id="primeiro-uso-titulo" ref={titulo} tabIndex={-1} className={TITULO}>
                    Que tipo de negócio é o seu?
                </h1>
                <p className="mt-2">Os textos das mensagens mudam conforme a resposta.</p>
                <div className="mt-6 flex flex-col gap-3">
                    {SEGMENTOS.map(({ valor, rotulo }) => (
                        <Botao
                            key={valor}
                            largura="total"
                            aria-pressed={segmento === valor}
                            onClick={() => escolherSegmento(valor)}
                            className="py-4"
                        >
                            {rotulo}
                        </Botao>
                    ))}
                </div>
            </>
        );
    } else if (passo === 2) {
        corpo = (
            <>
                <h1 id="primeiro-uso-titulo" ref={titulo} tabIndex={-1} className={TITULO}>
                    Seu negócio
                </h1>
                <form onSubmit={continuar} noValidate className="mt-6 flex flex-col gap-5">
                    <Campo
                        id="primeiro-uso-negocio"
                        rotulo="Como seu negócio se chama?"
                        autoComplete="organization"
                        autoCapitalize="words"
                        enterKeyHint="next"
                        value={negocio}
                        onChange={(e) => setNegocio(e.target.value)}
                    />
                    <Campo
                        id="primeiro-uso-assinatura"
                        rotulo="Como você assina as mensagens?"
                        ajuda="Vai no fim das mensagens, acima do nome do negócio. Ex.: Ana."
                        autoComplete="off"
                        enterKeyHint="done"
                        value={assinatura}
                        onChange={(e) => setAssinatura(e.target.value)}
                    />
                    {erro && (
                        <p role="alert" className="border-l-2 border-tinta pl-3">
                            {erro}
                        </p>
                    )}
                    <div className="flex flex-col items-start gap-2">
                        <Botao tipo="submit" largura="total" desabilitado={salvando}>
                            {salvando ? 'Guardando...' : 'Continuar'}
                        </Botao>
                        <Botao variante="texto" onClick={() => setPasso(passoAnterior(2))} className="-ml-1">
                            Voltar
                        </Botao>
                    </div>
                </form>
            </>
        );
    } else {
        corpo = (
            <>
                <h1 id="primeiro-uso-titulo" ref={titulo} tabIndex={-1} className={TITULO}>
                    Agora anote seu primeiro cliente.
                </h1>
                <p className="mt-2">Com ele anotado, a Hoje mostra quando chamar.</p>
                <div className="mt-6 flex flex-col items-start gap-2">
                    <Botao variante="principal" href="#/novo" largura="total">
                        Anotar cliente
                    </Botao>
                    <Botao variante="texto" href="#/hoje" onClick={aoTerminar} className="-ml-1">
                        Fazer isso depois
                    </Botao>
                </div>
            </>
        );
    }

    return (
        <section aria-labelledby="primeiro-uso-titulo" className="py-2">
            <p className="mb-3 text-sm">{contagemDoPasso(passo)}</p>
            {corpo}
        </section>
    );
}
