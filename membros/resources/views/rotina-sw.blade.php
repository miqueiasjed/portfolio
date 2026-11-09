// Service worker da Rotina do Dia, montado pelo RotinaCascaController::sw()
// a partir do manifest do Vite. Guarda só a casca e os arquivos do build da
// ferramenta. Nenhuma resposta com dado do usuário entra no cache.

const VERSAO = {!! json_encode($versao) !!};
const CACHE = 'rotina-' + VERSAO;
const CACHE_FONTES = 'rotina-fontes';
const CASCA = '/rotina';
const ARQUIVOS = {!! json_encode($arquivos, JSON_UNESCAPED_SLASHES) !!};
const LISTA = new Set(ARQUIVOS);
const HOSTS_DE_FONTE = ['fonts.googleapis.com', 'fonts.gstatic.com'];
// Quanto a navegação espera a rede antes de abrir a casca guardada.
const TEMPO_DA_REDE = 3000;

// Instala a versão nova em cache próprio. Ela fica esperando até o dono
// tocar em "atualizar"; por isso não há skipWaiting aqui.
self.addEventListener('install', (evento) => {
    evento.waitUntil(
        caches.open(CACHE).then((cache) => cache.addAll([CASCA, ...ARQUIVOS]))
    );
});

// A tela manda 'atualizar' quando o dono aceita a versão nova.
self.addEventListener('message', (evento) => {
    if (evento.data === 'atualizar') {
        self.skipWaiting();
    }
});

// Apaga os caches de versões anteriores e mantém o das fontes.
self.addEventListener('activate', (evento) => {
    evento.waitUntil(
        caches.keys()
            .then((nomes) => Promise.all(
                nomes
                    .filter((nome) => nome.startsWith('rotina-') && nome !== CACHE && nome !== CACHE_FONTES)
                    .map((nome) => caches.delete(nome))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (evento) => {
    const pedido = evento.request;

    // Só GET. POST de aparelho, código e uso passam direto.
    if (pedido.method !== 'GET') {
        return;
    }

    const url = new URL(pedido.url);

    if (url.origin === self.location.origin) {
        // Aceita /rotina e /rotina/, sempre com a chave /rotina no cache.
        const caminho = url.pathname.replace(/\/+$/, '');

        if (pedido.mode === 'navigate' && caminho === CASCA) {
            evento.respondWith(casca(evento));
            return;
        }

        if (LISTA.has(url.pathname)) {
            evento.respondWith(doCacheOuDaRede(pedido));
        }

        // Todo o resto (/rotina/acesso, /rotina/aparelho, /rotina/entrar,
        // /rotina/codigo, /rotina/uso e qualquer outra rota) vai direto para
        // a rede, sem passar pelo cache.
        return;
    }

    if (HOSTS_DE_FONTE.includes(url.hostname)) {
        evento.respondWith(fonte(evento));
    }
});

// Casca: rede primeiro, para a meta csrf-token não envelhecer. Abre a cópia
// guardada quando a rede falha, demora mais de TEMPO_DA_REDE ou responde com
// erro. Sem cópia guardada, espera a rede e devolve o que ela mandar.
function casca(evento) {
    const daRede = fetch(evento.request).then((resposta) => ({
        resposta,
        // Cópia para o cache tirada antes de a página ler o corpo.
        copia: resposta.ok ? resposta.clone() : null,
    }));

    // A gravação segue em segundo plano, inclusive quando a página já
    // recebeu a casca guardada. waitUntil é chamado ainda durante o evento.
    evento.waitUntil(
        daRede
            .then(({ copia }) => (copia ? guardarCasca(copia) : undefined))
            .catch(() => undefined)
    );

    return responderCasca(daRede);
}

async function responderCasca(daRede) {
    const prazo = esperar(TEMPO_DA_REDE);
    const cache = await caches.open(CACHE);
    const guardada = await cache.match(CASCA);

    if (!guardada) {
        const { resposta } = await daRede;
        return resposta;
    }

    const resposta = await Promise.race([
        daRede.then(({ resposta: daVez }) => daVez, () => null),
        prazo.then(() => null),
    ]);

    return resposta && serve(resposta) ? resposta : guardada;
}

// Resposta da rede que vai para a tela: 2xx ou redirect. Navegação usa
// redirect manual, que chega como opaqueredirect com status 0. Qualquer
// outro status (500 do Laravel, 502 do Nginx, 52x do Cloudflare) cede a vez
// à casca guardada.
function serve(resposta) {
    return resposta.ok
        || resposta.type === 'opaqueredirect'
        || (resposta.status >= 300 && resposta.status < 400);
}

function esperar(ms) {
    return new Promise((pronto) => setTimeout(pronto, ms));
}

// Só troca a casca guardada quando ela cita arquivos do build e todos estão
// na lista desta versão. Depois de um deploy, a casca nova aponta para
// arquivos que esta versão não guardou; sem rede, ela abriria quebrada. Uma
// casca sem nenhum /build/ (página de erro, manutenção) nunca entra.
async function guardarCasca(resposta) {
    const html = await resposta.text();
    const citados = html.match(/\/build\/[^"'\s?#]+/g) || [];

    if (citados.length === 0 || !citados.every((arquivo) => LISTA.has(arquivo))) {
        return;
    }

    const cache = await caches.open(CACHE);

    await cache.put(CASCA, new Response(html, {
        status: resposta.status,
        statusText: resposta.statusText,
        headers: resposta.headers,
    }));
}

// Arquivos do build têm nome com hash e não mudam: cache primeiro.
async function doCacheOuDaRede(pedido) {
    const cache = await caches.open(CACHE);
    const guardada = await cache.match(pedido);

    if (guardada) {
        return guardada;
    }

    const resposta = await fetch(pedido);

    if (resposta.ok) {
        await cache.put(pedido, resposta.clone());
    }

    return resposta;
}

// Fontes do Google: responde do cache e atualiza em segundo plano.
async function fonte(evento) {
    const cache = await caches.open(CACHE_FONTES);
    const guardada = await cache.match(evento.request);

    const daRede = fetch(evento.request).then(async (resposta) => {
        if (resposta.ok || resposta.type === 'opaque') {
            await cache.put(evento.request, resposta.clone());
        }

        return resposta;
    });

    if (guardada) {
        evento.waitUntil(daRede.catch(() => undefined));
        return guardada;
    }

    return daRede;
}
