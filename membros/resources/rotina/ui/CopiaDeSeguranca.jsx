// Cópia de segurança dos dados do aparelho: baixar um arquivo e restaurar a
// partir dele. O arquivo é gerado e lido aqui no navegador; nada vai para o
// servidor. Restaurar troca tudo e só acontece depois da confirmação própria,
// que é onde fica o acento vermelho.

import { useId, useRef, useState } from 'react';
import { exportarBackup, importarBackup } from '../dados/backup.js';
import { lerCopia, nomeDoArquivoDeCopia, textoDaCopia } from '../regras/copia.js';
import { hojeEmFortaleza } from '../regras/datas.js';
import { baixarArquivo } from './baixarArquivo.js';
import Confirmar from './Confirmar.jsx';

const BOTAO_CHEIO =
    'flex min-h-[44px] w-full items-center justify-center bg-grafite px-4 text-base font-medium text-papel disabled:opacity-60';
const BOTAO_CONTORNO =
    'flex min-h-[44px] w-full items-center justify-center border border-tinta px-4 text-base font-medium text-tinta disabled:opacity-60';

const ERRO_BAIXAR = 'Não deu para baixar a cópia agora. Tente de novo.';
// A mensagem do importarBackup nunca vai para a tela: ela fala de arquivo, e
// o arquivo já foi conferido antes. Aqui só sobra a falha ao gravar.
const ERRO_RESTAURAR = 'Não deu para restaurar. Seus dados atuais continuam aqui.';

function contar(numero, nenhum, singular, plural) {
    if (numero === 0) return nenhum;
    return `${numero.toLocaleString('pt-BR')} ${numero === 1 ? singular : plural}`;
}

function textoDoResumo({ clientes, pendencias }) {
    const quantos = contar(clientes, 'nenhum cliente', 'cliente', 'clientes');
    const abertas = contar(pendencias, 'nenhuma pendência em aberto', 'pendência em aberto', 'pendências em aberto');
    return `A cópia tem ${quantos} e ${abertas}. Tudo o que está neste aparelho agora será trocado por ela.`;
}

export default function CopiaDeSeguranca() {
    // 'parado' | 'baixando' | 'lendo' | 'restaurando'
    const [etapa, setEtapa] = useState('parado');
    const [aviso, setAviso] = useState('');
    const [erro, setErro] = useState('');
    // Cópia já conferida, esperando a confirmação: { dados, resumo }.
    const [pendente, setPendente] = useState(null);
    const entrada = useRef(null);
    const idTitulo = useId();

    const ocupado = etapa !== 'parado';

    function limpar() {
        setAviso('');
        setErro('');
    }

    async function baixar() {
        if (ocupado) return;
        limpar();
        setEtapa('baixando');
        try {
            const dados = await exportarBackup();
            baixarArquivo(nomeDoArquivoDeCopia(hojeEmFortaleza()), textoDaCopia(dados), 'application/json');
            setAviso('Cópia baixada.');
        } catch {
            setErro(ERRO_BAIXAR);
        } finally {
            setEtapa('parado');
        }
    }

    function escolherArquivo() {
        if (ocupado) return;
        entrada.current?.click();
    }

    async function aoEscolher(evento) {
        const arquivo = evento.target.files?.[0];
        // Limpa o campo para dar para escolher o mesmo arquivo de novo.
        evento.target.value = '';
        if (!arquivo) return;

        limpar();
        setEtapa('lendo');
        let conteudo = null;
        try {
            conteudo = await arquivo.text();
        } catch {
            // Sem texto, o lerCopia recusa com a mensagem de arquivo que não é cópia.
        }
        const resultado = lerCopia(conteudo);
        setEtapa('parado');

        if (!resultado.ok) {
            setErro(resultado.erro);
            return;
        }
        setPendente({ dados: resultado.dados, resumo: resultado.resumo });
    }

    async function restaurar() {
        if (!pendente || etapa === 'restaurando') return;
        setEtapa('restaurando');
        try {
            await importarBackup(pendente.dados);
            setAviso('Cópia restaurada.');
        } catch {
            setErro(ERRO_RESTAURAR);
        } finally {
            setPendente(null);
            setEtapa('parado');
        }
    }

    function voltar() {
        if (etapa === 'restaurando') return;
        setPendente(null);
    }

    return (
        <section aria-labelledby={idTitulo} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
                <h2 id={idTitulo} className="text-xl font-medium">
                    Cópia de segurança
                </h2>
                <p className="font-light">
                    Seus clientes ficam só neste aparelho. Baixe uma cópia de vez em quando e guarde fora do celular.
                </p>
            </div>

            <input
                ref={entrada}
                type="file"
                accept=".json,application/json"
                onChange={aoEscolher}
                tabIndex={-1}
                aria-hidden="true"
                className="hidden"
            />

            <div className="flex flex-col gap-2">
                <button type="button" onClick={baixar} disabled={ocupado} className={BOTAO_CHEIO}>
                    {etapa === 'baixando' ? 'Montando a cópia...' : 'Baixar cópia dos meus dados'}
                </button>
                <button type="button" onClick={escolherArquivo} disabled={ocupado} className={BOTAO_CONTORNO}>
                    {etapa === 'lendo' ? 'Lendo o arquivo...' : 'Restaurar cópia'}
                </button>
            </div>

            <div role="status">{aviso && <p>{aviso}</p>}</div>
            {erro && (
                <p role="alert" className="border-l-2 border-tinta pl-3">
                    {erro}
                </p>
            )}

            <Confirmar
                aberto={pendente !== null}
                titulo="Restaurar esta cópia?"
                texto={pendente ? textoDoResumo(pendente.resumo) : ''}
                rotuloConfirmar={etapa === 'restaurando' ? 'Restaurando...' : 'Restaurar'}
                rotuloVoltar="Voltar"
                destrutivo
                aoConfirmar={restaurar}
                aoVoltar={voltar}
            />
        </section>
    );
}
