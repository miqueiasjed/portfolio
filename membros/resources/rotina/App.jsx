// Raiz da ferramenta: decide o acesso ao abrir e mostra a tela de acesso ou a moldura.

import { useCallback, useEffect, useState } from 'react';
import { lerXsrf, resolverAcesso, voltarDaOutraConta } from './dados/acesso.js';
import { useRota } from './rotas.js';
import Moldura from './ui/Moldura.jsx';
import Acesso from './telas/Acesso.jsx';
import OutraConta from './telas/OutraConta.jsx';
import AvisoVersao from './ui/AvisoVersao.jsx';

const CARREGANDO = { estado: 'carregando', usuario: null };

const NOMES = {
    hoje: 'Hoje',
    mensagem: 'Mensagem',
    clientes: 'Clientes',
    cliente: 'Cliente',
    novo: 'Novo cliente',
    ajustes: 'Ajustes',
};

// Placeholder das telas. Os Planos 4 e 5 trocam cada um pela tela real.
function EmBreve({ nome }) {
    return (
        <section className="py-6">
            <h1 className="text-2xl font-medium">{nome}</h1>
            <p className="mt-2 text-apoio">Em breve.</p>
        </section>
    );
}

function Carregando() {
    return (
        <div className="flex min-h-dvh items-center justify-center bg-grafite text-papel">
            <p>Abrindo...</p>
        </div>
    );
}

// Ferramenta liberada: moldura com a tela da rota atual.
function Ferramenta() {
    const rota = useRota();

    return (
        <Moldura rota={rota}>
            <EmBreve nome={NOMES[rota.tela] ?? NOMES.hoje} />
        </Moldura>
    );
}

// Props: `csrf`, o valor da meta csrf-token da casca.
export default function App({ csrf }) {
    const [acesso, setAcesso] = useState(CARREGANDO);
    const [tentativa, setTentativa] = useState(0);

    useEffect(() => {
        let ativo = true;

        // O cookie é lido a cada tentativa: o Laravel o renova a cada resposta.
        resolverAcesso({ csrf, xsrf: lerXsrf(document.cookie) })
            .then((resultado) => {
                if (ativo) setAcesso(resultado);
            })
            .catch(() => {
                // O banco do aparelho não abriu (outra aba segurando, sem espaço, modo privado).
                if (ativo) setAcesso({ estado: 'erro', usuario: null });
            });

        return () => {
            ativo = false;
        };
    }, [csrf, tentativa]);

    const tentarDeNovo = useCallback(() => {
        setAcesso(CARREGANDO);
        setTentativa((n) => n + 1);
    }, []);

    const liberar = useCallback((usuario) => {
        setAcesso({ estado: 'liberado', usuario: usuario ?? null });
    }, []);

    // Código por e-mail de outra conta: o resultado traz o pendente, só em memória.
    const outraConta = useCallback((resultado) => {
        setAcesso(resultado);
    }, []);

    // Voltar da tela de outra conta: encerra a sessão quando ela veio do link
    // mágico e descarta o pendente. Nada é apagado nem gravado no aparelho.
    const origem = acesso.origem;
    const voltar = useCallback(async () => {
        const seguinte = await voltarDaOutraConta({ origem, csrf, xsrf: lerXsrf(document.cookie) });
        setAcesso(seguinte);
    }, [origem, csrf]);

    let tela;
    if (acesso.estado === 'carregando') {
        tela = <Carregando />;
    } else if (acesso.estado === 'liberado') {
        tela = <Ferramenta />;
    } else if (acesso.estado === 'outra_conta') {
        tela = <OutraConta dono={acesso.dono} email={acesso.pendente?.email ?? ''} aoVoltar={voltar} />;
    } else {
        tela = (
            <Acesso
                estado={acesso.estado}
                aoTentarDeNovo={tentarDeNovo}
                aoLiberar={liberar}
                aoOutraConta={outraConta}
            />
        );
    }

    // O aviso de versão nova vale para qualquer estado e fica na mesma posição
    // da árvore, para o registro do service worker não recomeçar a cada troca.
    return (
        <>
            {tela}
            <AvisoVersao acimaDaBarra={acesso.estado === 'liberado'} />
        </>
    );
}
