// Folha "Enviou?", mostrada quando o dono volta do WhatsApp. Só a resposta
// "Enviei" registra o toque; "Ainda não", Esc e toque fora não gravam nada.
// O estado `passo` separa as etapas da folha: 'enviou' é o passo 1 (esta task);
// o passo 2, 'resultado' (o cliente já respondeu?), entra na task 5.5b.

import { useEffect, useRef, useState } from 'react';
import Botao from './Botao.jsx';
import Folha from './Folha.jsx';
import { responderAindaNao, responderEnviei } from './useVoltaDoWhatsApp.js';

// Frase do aviso curto que quem usa mostra depois do "Ainda não".
export const AVISO_AINDA_NAO = 'Tudo bem. Ele continua na lista de hoje.';
// Tempo do aviso na tela, em milissegundos.
export const AVISO_AINDA_NAO_MS = 3000;

// Contrato com quem usa (tela Mensagem):
// - Abrir com `aberta={perguntar}` do useVoltaDoWhatsApp.
// - Chamar `encerrar()` do hook no `aoFechar` e no fim do passo 2 (`aoTerminar`,
//   task 5.5b). Nunca no `aoEnviar`: o passo 2 sumiria. Sem `encerrar()` no
//   `aoFechar`, a folha continua aberta com os botões travados.
// - Mostrar a frase recebida no `aoFechar` por AVISO_AINDA_NAO_MS.
//
// Props:
// - `item`: a pendência (usa `item.id`).
// - `etapa`: a etapa do toque.
// - `pendente`: `{ item_id, etapa, aberto_em }` vindo do useVoltaDoWhatsApp.
// - `aberta` (bool, padrão true): para quem prefere deixar a folha montada.
// - `aoEnviar(toque)`: chamado depois de o toque ser registrado.
// - `aoFechar(aviso)`: chamado no "Ainda não", no Esc e no toque fora, com a
//   frase AVISO_AINDA_NAO para mostrar por AVISO_AINDA_NAO_MS.
export default function FolhaEnviou({ item, etapa, pendente, aberta = true, aoEnviar, aoFechar }) {
    const [passo, setPasso] = useState('enviou');
    const [gravando, setGravando] = useState(false);
    const [toque, setToque] = useState(null);
    const [erro, setErro] = useState('');
    // O estado só desabilita o botão no próximo desenho; a ref barra o segundo
    // toque que chega antes disso.
    const emCurso = useRef(false);

    // Reabriu: começa do passo 1 de novo.
    useEffect(() => {
        if (!aberta) return;
        emCurso.current = false;
        setPasso('enviou');
        setGravando(false);
        setToque(null);
        setErro('');
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
        // 5.5b: aqui entra setPasso('resultado').
        // Fora do try: erro de quem usa não pode virar "Não deu para registrar".
        aoEnviar?.(gravado);
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
        // 5.5b: no passo 'resultado', equivale a "Ainda não respondeu".
    };

    return (
        <Folha aberta={aberta} aoFechar={aoFecharFolha} titulo="Enviou?">
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
                    <div role="status" className="mt-3 min-h-[1.5rem] text-base">
                        {erro && <p>{erro}</p>}
                    </div>
                </div>
            )}
        </Folha>
    );
}
