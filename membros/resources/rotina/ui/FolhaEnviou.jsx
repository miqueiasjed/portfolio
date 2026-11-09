// Folha "Enviou?", mostrada quando o dono volta do WhatsApp. Só a resposta
// "Enviei" registra o toque; "Ainda não", Esc e toque fora não gravam nada.
// O estado `passo` separa as etapas da folha: 'enviou' é o passo 1; 'resultado'
// é o passo 2 (o cliente já respondeu?), e 'remarcar' é a data e a hora novas
// do "Remarcou", dentro do passo 2.

import { useEffect, useRef, useState } from 'react';
import Botao from './Botao.jsx';
import Folha from './Folha.jsx';
import {
    conferirRemarcacao,
    desfazerRemarcacao,
    opcoesDeResultado,
    responderAindaNao,
    responderEnviei,
    responderRemarcou,
    responderResultado,
    responderSoRespondeu,
} from './useVoltaDoWhatsApp.js';

// Frase do aviso curto que quem usa mostra depois do "Ainda não".
export const AVISO_AINDA_NAO = 'Tudo bem. Ele continua na lista de hoje.';
// Tempo do aviso na tela, em milissegundos.
export const AVISO_AINDA_NAO_MS = 3000;

const ERRO_GRAVAR = 'Não deu para registrar. Tente de novo.';

// Mesmo visual dos campos de data e hora da tela Novo.
const CAMPO =
    'min-h-[44px] w-full min-w-0 appearance-none border border-filete-claro bg-transparent px-3 text-base text-tinta placeholder:text-apoio';

// Contrato com quem usa (tela Mensagem):
// - Abrir com `aberta={perguntar}` do useVoltaDoWhatsApp.
// - Chamar `encerrar()` do hook no `aoFechar` e no `aoTerminar`. Nunca no
//   `aoEnviar`: o passo 2 sumiria. Sem `encerrar()` nos dois, a folha continua
//   aberta com os botões travados.
// - Mostrar a frase recebida no `aoFechar` por AVISO_AINDA_NAO_MS.
// - No `aoTerminar`, voltar para `#/hoje`.
//
// Props:
// - `item`: a pendência (usa `id`, `processo`, `cliente_id`, `data`, `hora` e
//   `servico`).
// - `etapa`: a etapa do toque.
// - `pendente`: `{ item_id, etapa, aberto_em }` vindo do useVoltaDoWhatsApp.
// - `aberta` (bool, padrão true): para quem prefere deixar a folha montada.
// - `aoEnviar(toque)`: chamado depois de o toque ser registrado.
// - `aoFechar(aviso)`: chamado no "Ainda não", no Esc e no toque fora do passo 1,
//   com a frase AVISO_AINDA_NAO para mostrar por AVISO_AINDA_NAO_MS.
// - `aoTerminar()`: chamado no fim do passo 2, qualquer que seja a opção. No
//   passo 2, Esc e toque fora valem como "Ainda não respondeu" e também chamam
//   `aoTerminar()`, porque o toque já está gravado.
export default function FolhaEnviou({ item, etapa, pendente, aberta = true, aoEnviar, aoFechar, aoTerminar }) {
    const [passo, setPasso] = useState('enviou');
    const [gravando, setGravando] = useState(false);
    const [toque, setToque] = useState(null);
    const [erro, setErro] = useState('');
    const [remarcacao, setRemarcacao] = useState({ data: '', hora: '' });
    const [errosRemarcacao, setErrosRemarcacao] = useState({});
    // O estado só desabilita o botão no próximo desenho; a ref barra o segundo
    // toque que chega antes disso.
    const emCurso = useRef(false);
    // Item 01 novo já gravado pelo "Remarcou": a nova tentativa não cria outro, e
    // qualquer outra saída do passo 2 cancela esse item antes de seguir.
    const memoriaRemarcou = useRef({});
    const terminou = useRef(false);

    // Reabriu: começa do passo 1 de novo.
    useEffect(() => {
        if (!aberta) return;
        emCurso.current = false;
        memoriaRemarcou.current = {};
        terminou.current = false;
        setPasso('enviou');
        setGravando(false);
        setToque(null);
        setErro('');
        setRemarcacao({ data: '', hora: '' });
        setErrosRemarcacao({});
    }, [aberta, pendente?.aberto_em]);

    const enviei = async () => {
        if (emCurso.current || toque) return;
        emCurso.current = true;
        setGravando(true);
        setErro('');
        let gravado;
        try {
            gravado = await responderEnviei({ itemId: item.id, etapa, pendente });
        } catch {
            emCurso.current = false;
            setErro('Não deu para registrar. Tente de novo.');
            return;
        } finally {
            setGravando(false);
        }
        setToque(gravado);
        setPasso('resultado');
        emCurso.current = false;
        // Fora do try: erro de quem usa não pode virar "Não deu para registrar".
        aoEnviar?.(gravado);
    };

    const terminar = () => {
        if (terminou.current) return;
        terminou.current = true;
        aoTerminar?.();
    };

    // Roda uma gravação do passo 2 com os botões travados. Resolve com true se
    // deu certo; falhou, mostra o erro, destrava e resolve com false para tentar
    // de novo no mesmo passo.
    const gravar = async (fazer) => {
        if (emCurso.current || terminou.current || !toque) return false;
        emCurso.current = true;
        setGravando(true);
        setErro('');
        try {
            await fazer();
        } catch {
            emCurso.current = false;
            setGravando(false);
            setErro(ERRO_GRAVAR);
            return false;
        }
        emCurso.current = false;
        setGravando(false);
        return true;
    };

    const gravarETerminar = async (fazer) => {
        if (await gravar(fazer)) terminar();
    };

    // Toda saída que não conclui o "Remarcou" cancela antes o item 01 novo que
    // uma tentativa anterior já gravou. Se o cancelamento falha, nada segue.
    const semRemarcacao = (fazer) => async () => {
        await desfazerRemarcacao({ memoria: memoriaRemarcou.current });
        await fazer?.();
    };

    const escolherResultado = (resultado) => {
        if (resultado === 'remarcou') {
            if (emCurso.current) return;
            setRemarcacao({ data: item.data ?? '', hora: item.hora ?? '' });
            setErrosRemarcacao({});
            setErro('');
            setPasso('remarcar');
            return;
        }
        gravarETerminar(semRemarcacao(() => responderResultado({ toque, item, resultado })));
    };

    const soRespondeu = () => gravarETerminar(semRemarcacao(() => responderSoRespondeu({ toque })));

    const aindaNaoRespondeu = () => {
        if (emCurso.current) return;
        if (!memoriaRemarcou.current.novo) {
            terminar();
            return;
        }
        gravarETerminar(semRemarcacao());
    };

    const salvarRemarcacao = (evento) => {
        evento.preventDefault();
        if (emCurso.current) return;
        const conferido = conferirRemarcacao(remarcacao);
        setErrosRemarcacao(conferido.erros);
        if (!conferido.ok) return;
        gravarETerminar(() =>
            responderRemarcou({
                toque,
                item,
                data: conferido.data,
                hora: conferido.hora,
                memoria: memoriaRemarcou.current,
            }),
        );
    };

    const pularRemarcacao = () => gravarETerminar(() => responderRemarcou({ toque, item }));

    const voltarAosResultados = async () => {
        if (emCurso.current) return;
        if (memoriaRemarcou.current.novo && !(await gravar(semRemarcacao()))) return;
        setErro('');
        setPasso('resultado');
    };

    const mudarRemarcacao = (campo, valor) => {
        setRemarcacao((atual) => ({ ...atual, [campo]: valor }));
        setErrosRemarcacao((atual) => (atual[campo] ? { ...atual, [campo]: undefined } : atual));
    };

    const aindaNao = async () => {
        if (emCurso.current) return;
        emCurso.current = true;
        await responderAindaNao();
        aoFechar?.(AVISO_AINDA_NAO);
    };

    // Esc e toque fora valem como a saída segura de cada passo.
    const aoFecharFolha = () => {
        if (passo === 'enviou') {
            if (!toque) aindaNao();
            return;
        }
        // Passo 2 (inclusive a data nova do "Remarcou"): o toque já está gravado.
        aindaNaoRespondeu();
    };

    const avisoErro = (
        <div role="status" className="mt-3 min-h-[1.5rem] text-base">
            {erro && <p>{erro}</p>}
        </div>
    );

    const titulo = passo === 'enviou' ? 'Enviou?' : passo === 'remarcar' ? 'Novo horário' : 'O cliente já respondeu?';

    return (
        <Folha aberta={aberta} aoFechar={aoFecharFolha} titulo={titulo}>
            {passo === 'enviou' && (
                <div>
                    <p className="text-base font-light">A ferramenta só registra o envio se a mensagem saiu.</p>
                    <div className="mt-6 flex flex-col gap-2">
                        <Botao variante="principal" largura="total" desabilitado={gravando || Boolean(toque)} onClick={enviei}>
                            {gravando ? 'Registrando...' : 'Enviei'}
                        </Botao>
                        <Botao largura="total" desabilitado={gravando || Boolean(toque)} onClick={aindaNao}>
                            Ainda não
                        </Botao>
                    </div>
                    {avisoErro}
                </div>
            )}

            {passo === 'resultado' && (
                <div>
                    <p className="text-base font-light">Registrado.</p>
                    <div className="mt-6 flex flex-col gap-2">
                        {opcoesDeResultado(item.processo).map(({ resultado, rotulo }) => (
                            <Botao
                                key={resultado}
                                largura="total"
                                desabilitado={gravando}
                                onClick={() => escolherResultado(resultado)}
                            >
                                {rotulo}
                            </Botao>
                        ))}
                        <Botao largura="total" desabilitado={gravando} onClick={soRespondeu}>
                            Respondeu, mas ainda não resolveu
                        </Botao>
                        <Botao variante="texto" largura="total" desabilitado={gravando} onClick={aindaNaoRespondeu}>
                            Ainda não respondeu
                        </Botao>
                    </div>
                    {avisoErro}
                </div>
            )}

            {passo === 'remarcar' && (
                <form onSubmit={salvarRemarcacao} noValidate>
                    <p className="text-base font-light">Coloque o dia e a hora novos. Se ainda não tem, toque em Pular.</p>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="flex min-w-0 flex-col gap-1">
                            <label htmlFor="remarcar-data" className="text-sm">
                                Dia
                            </label>
                            <input
                                id="remarcar-data"
                                type="date"
                                className={CAMPO}
                                value={remarcacao.data}
                                onChange={(e) => mudarRemarcacao('data', e.target.value)}
                                aria-invalid={errosRemarcacao.data ? true : undefined}
                                aria-describedby={errosRemarcacao.data ? 'remarcar-data-erro' : undefined}
                            />
                            {errosRemarcacao.data && (
                                <p id="remarcar-data-erro" className="text-sm font-medium">
                                    {errosRemarcacao.data}
                                </p>
                            )}
                        </div>
                        <div className="flex min-w-0 flex-col gap-1">
                            <label htmlFor="remarcar-hora" className="text-sm">
                                Hora
                            </label>
                            <input
                                id="remarcar-hora"
                                type="time"
                                className={CAMPO}
                                value={remarcacao.hora}
                                onChange={(e) => mudarRemarcacao('hora', e.target.value)}
                                aria-invalid={errosRemarcacao.hora ? true : undefined}
                                aria-describedby={errosRemarcacao.hora ? 'remarcar-hora-erro' : undefined}
                            />
                            {errosRemarcacao.hora && (
                                <p id="remarcar-hora-erro" className="text-sm font-medium">
                                    {errosRemarcacao.hora}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="mt-6 flex flex-col gap-2">
                        <Botao variante="principal" tipo="submit" largura="total" desabilitado={gravando}>
                            {gravando ? 'Registrando...' : 'Salvar'}
                        </Botao>
                        <Botao largura="total" desabilitado={gravando} onClick={pularRemarcacao}>
                            Pular
                        </Botao>
                        <Botao variante="texto" largura="total" desabilitado={gravando} onClick={voltarAosResultados}>
                            Voltar
                        </Botao>
                    </div>
                    {avisoErro}
                </form>
            )}
        </Folha>
    );
}
