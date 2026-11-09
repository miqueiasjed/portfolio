import { useEffect, useState } from 'react';

const HOJE = { tela: 'hoje', params: {} };

// Decodifica um segmento; devolve null se vier mal formado (ex.: "%E0%A4%A").
function decodificar(segmento) {
    try {
        return decodeURIComponent(segmento);
    } catch {
        return null;
    }
}

// Lê um hash (`#/mensagem/abc/d3`) e devolve `{ tela, params }`.
// Função pura: vazio, desconhecido ou mal formado cai em `hoje`.
export function lerRota(hash) {
    const texto = typeof hash === 'string' ? hash : '';
    const limpo = texto.replace(/^#\/?/, '').replace(/\/+$/, '');
    if (limpo === '') return HOJE;

    const partes = limpo.split('/');
    const valores = partes.map(decodificar);
    if (valores.some((v) => v === null || v === '')) return HOJE;

    const [raiz, a, b] = valores;

    if (raiz === 'hoje' && partes.length === 1) return HOJE;
    if (raiz === 'clientes' && partes.length === 1) return { tela: 'clientes', params: {} };
    if (raiz === 'clientes' && partes.length === 2) return { tela: 'cliente', params: { id: a } };
    if (raiz === 'novo' && partes.length === 1) return { tela: 'novo', params: {} };
    if (raiz === 'ajustes' && partes.length === 1) return { tela: 'ajustes', params: {} };
    if (raiz === 'mensagem' && partes.length === 3) {
        return { tela: 'mensagem', params: { itemId: a, etapa: b } };
    }

    return HOJE;
}

// Troca o hash. Aceita com ou sem `#`: irPara('/clientes') e irPara('#/clientes').
export function irPara(caminho) {
    const destino = String(caminho).replace(/^#/, '');
    window.location.hash = destino.startsWith('/') ? destino : `/${destino}`;
}

// Hook: devolve a rota atual e re-renderiza a cada `hashchange`.
export function useRota() {
    const [rota, setRota] = useState(() => lerRota(window.location.hash));

    useEffect(() => {
        const aoMudar = () => setRota(lerRota(window.location.hash));
        window.addEventListener('hashchange', aoMudar);
        aoMudar();
        return () => window.removeEventListener('hashchange', aoMudar);
    }, []);

    return rota;
}
