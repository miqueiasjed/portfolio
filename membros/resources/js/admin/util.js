// Funções pequenas usadas nas telas do admin.

export const real = (c) => ((c ?? 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const numero = (n) => (n ?? 0).toLocaleString('pt-BR');

export const plural = (n, um, varios) => `${numero(n)} ${n === 1 ? um : varios}`;

/** Converte 'd/m/Y H:i' (fuso de Fortaleza, UTC-3 sem horário de verão) em Date. */
export function lerData(texto) {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}):(\d{2}))?$/.exec(texto ?? '');
    if (!m) return null;
    const [, d, mes, a, h = '00', min = '00'] = m;
    return new Date(Date.UTC(+a, +mes - 1, +d, +h + 3, +min));
}

/** "há 3 dias", "há 2 horas", "agora há pouco". */
export function relativo(texto, agora = Date.now()) {
    const data = lerData(texto);
    if (!data) return null;
    const seg = Math.round((agora - data.getTime()) / 1000);
    if (seg < 60) return 'agora há pouco';
    const min = Math.floor(seg / 60);
    if (min < 60) return `há ${min} ${min === 1 ? 'minuto' : 'minutos'}`;
    const horas = Math.floor(min / 60);
    if (horas < 24) return `há ${horas} ${horas === 1 ? 'hora' : 'horas'}`;
    const dias = Math.floor(horas / 24);
    if (dias === 1) return 'ontem';
    if (dias < 30) return `há ${dias} dias`;
    const meses = Math.floor(dias / 30);
    if (meses < 12) return `há ${meses} ${meses === 1 ? 'mês' : 'meses'}`;
    const anos = Math.floor(dias / 365);
    return `há ${anos} ${anos === 1 ? 'ano' : 'anos'}`;
}

/** Mesmo resultado do Str::slug do Laravel para os casos comuns. */
export function slugify(texto) {
    return (texto ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 100);
}

/** Tamanho de arquivo legível: 1,2 MB. */
export function tamanho(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} KB`;
    return `${(bytes / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
}

/** Remove chaves vazias antes de mandar filtros na URL. */
export function semVazios(obj) {
    return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v !== null && v !== undefined));
}

/** 'utm_source=insta&utm_campaign=x' vira [['Fonte', 'insta'], ['Campanha', 'x']]. */
export function lerOrigem(origem) {
    if (!origem) return [];
    if (origem === 'manual') return [['Origem', 'Liberação manual']];
    // origem simples (ex.: "instagram") não é query string
    if (!origem.includes('=')) return [['Origem', origem]];
    const nomes = { utm_source: 'Fonte', utm_medium: 'Mídia', utm_campaign: 'Campanha', utm_content: 'Conteúdo', utm_term: 'Termo' };
    try {
        const p = new URLSearchParams(origem);
        const linhas = [...p.entries()].map(([k, v]) => [nomes[k] ?? k, v]);
        return linhas.length ? linhas : [['Origem', origem]];
    } catch {
        return [['Origem', origem]];
    }
}

/** Texto curto da origem para a tabela. */
export function origemCurta(origem) {
    if (!origem) return null;
    if (origem === 'manual') return 'Manual';
    const p = new URLSearchParams(origem);
    return p.get('utm_source') ?? origem;
}

/** Prévia do player para YouTube e Vimeo (mesma regra do App\Support\Video). */
export function embedDeVideo(url) {
    let texto = (url ?? '').trim();
    if (!texto) return null;
    if (!/^https?:\/\//i.test(texto)) texto = 'https://' + texto;
    let u;
    try {
        u = new URL(texto);
    } catch {
        return null;
    }
    const host = u.hostname.toLowerCase().replace(/^(www\.|m\.)/, '');
    const seg = u.pathname.split('/').filter(Boolean);
    let yt = null;
    if (host === 'youtu.be') yt = seg[0];
    else if (['youtube.com', 'music.youtube.com', 'youtube-nocookie.com'].includes(host)) {
        if (seg[0] === 'watch') yt = u.searchParams.get('v');
        else if (['shorts', 'embed', 'live', 'v'].includes(seg[0])) yt = seg[1];
    }
    if (yt && /^[A-Za-z0-9_-]{6,20}$/.test(yt)) return `https://www.youtube.com/embed/${yt}`;
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
        let id = null;
        let hash = u.searchParams.get('h');
        seg.forEach((s, i) => {
            if (/^\d+$/.test(s)) {
                id = s;
                const seguinte = seg[i + 1];
                if (!hash && seguinte && /^[a-f0-9]{6,}$/i.test(seguinte)) hash = seguinte;
            }
        });
        if (id) return `https://player.vimeo.com/video/${id}` + (hash && /^[a-f0-9]+$/i.test(hash) ? `?h=${hash}` : '');
    }
    return null;
}
