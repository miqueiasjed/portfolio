// Raiz da ferramenta: decide o acesso ao abrir e mostra a tela de acesso ou a moldura.

import { useCallback, useEffect, useState } from 'react';
import { lerXsrf, resolverAcesso } from './dados/acesso.js';
import { useRota } from './rotas.js';
import Moldura from './ui/Moldura.jsx';
import Acesso from './telas/Acesso.jsx';

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

    let tela;
    if (acesso.estado === 'carregando') {
        tela = <Carregando />;
    } else if (acesso.estado === 'liberado') {
        tela = <Ferramenta />;
    } else {
        tela = <Acesso estado={acesso.estado} aoTentarDeNovo={tentarDeNovo} aoLiberar={liberar} />;
    }

    // Avisos que valem para qualquer estado (versão nova, iPhone) entram ao lado de `tela`.
    return tela;
}
