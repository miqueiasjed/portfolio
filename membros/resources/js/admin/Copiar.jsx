import { useEffect, useState } from 'react';
import { classesBotao } from './Campos';
import { IconeCheck, IconeCopiar } from './icones';

async function copiarTexto(texto) {
    try {
        await navigator.clipboard.writeText(texto);
        return true;
    } catch {
        // navegador sem permissão de área de transferência (http sem TLS, por exemplo)
        const campo = document.createElement('textarea');
        campo.value = texto;
        campo.setAttribute('readonly', '');
        campo.style.position = 'fixed';
        campo.style.opacity = '0';
        document.body.appendChild(campo);
        campo.select();
        const ok = document.execCommand('copy');
        campo.remove();
        return ok;
    }
}

/** Copia o texto e mostra "Copiado" por 2 segundos. */
export default function Copiar({ texto, rotulo = 'Copiar', rotuloAcessivel, variante = 'secundario', tamanho = 'sm', soIcone = false, className = '' }) {
    const [copiado, setCopiado] = useState(false);

    useEffect(() => {
        if (!copiado) return;
        const t = setTimeout(() => setCopiado(false), 2000);
        return () => clearTimeout(t);
    }, [copiado]);

    return (
        <button
            type="button"
            onClick={async (e) => {
                e.stopPropagation();
                if (await copiarTexto(texto)) setCopiado(true);
            }}
            aria-label={rotuloAcessivel ?? rotulo}
            title={soIcone ? rotuloAcessivel ?? rotulo : undefined}
            className={classesBotao(variante, soIcone ? 'icone' : tamanho, className)}
        >
            {copiado ? <IconeCheck tamanho={16} className="text-[#2F5A35]" /> : <IconeCopiar tamanho={16} />}
            {!soIcone && <span>{copiado ? 'Copiado' : rotulo}</span>}
            <span className="sr-only" aria-live="polite">{copiado ? 'Copiado' : ''}</span>
        </button>
    );
}
