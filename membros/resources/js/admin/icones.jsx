// Ícones em SVG inline, traço fino, herdam a cor do texto.

function Icone({ children, tamanho = 18, className = '', ...resto }) {
    return (
        <svg
            width={tamanho}
            height={tamanho}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
            className={`shrink-0 ${className}`}
            {...resto}
        >
            {children}
        </svg>
    );
}

export const IconeVisao = (p) => (
    <Icone {...p}>
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </Icone>
);

export const IconeCompras = (p) => (
    <Icone {...p}>
        <path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.76L21 8H6.2" />
        <circle cx="9" cy="20" r="1.2" />
        <circle cx="18" cy="20" r="1.2" />
    </Icone>
);

export const IconeAlunos = (p) => (
    <Icone {...p}>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5" />
        <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.8c1.6.8 2.6 2.5 3 5.2" />
    </Icone>
);

export const IconeCursos = (p) => (
    <Icone {...p}>
        <path d="M3 5.5A1.5 1.5 0 0 1 4.5 4H10a2 2 0 0 1 2 2v14a1.5 1.5 0 0 0-1.5-1.5h-6A1.5 1.5 0 0 1 3 17V5.5Z" />
        <path d="M21 5.5A1.5 1.5 0 0 0 19.5 4H14a2 2 0 0 0-2 2v14a1.5 1.5 0 0 1 1.5-1.5h6A1.5 1.5 0 0 0 21 17V5.5Z" />
    </Icone>
);

export const IconeMenu = (p) => (
    <Icone {...p}>
        <path d="M4 7h16M4 12h16M4 17h16" />
    </Icone>
);

export const IconeFechar = (p) => (
    <Icone {...p}>
        <path d="M6 6l12 12M18 6 6 18" />
    </Icone>
);

export const IconeMais = (p) => (
    <Icone {...p}>
        <path d="M12 5v14M5 12h14" />
    </Icone>
);

export const IconeSair = (p) => (
    <Icone {...p}>
        <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10" />
    </Icone>
);

export const IconeBusca = (p) => (
    <Icone {...p}>
        <circle cx="11" cy="11" r="6.5" />
        <path d="m20 20-4.2-4.2" />
    </Icone>
);

export const IconeBaixar = (p) => (
    <Icone {...p}>
        <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
    </Icone>
);

export const IconeEnviar = (p) => (
    <Icone {...p}>
        <path d="M12 20V9M7 14l5-5 5 5M5 4h14" />
    </Icone>
);

export const IconeCopiar = (p) => (
    <Icone {...p}>
        <rect x="8" y="8" width="12" height="12" rx="1" />
        <path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
    </Icone>
);

export const IconeCheck = (p) => (
    <Icone {...p}>
        <path d="m5 12.5 4.5 4.5L19 7.5" />
    </Icone>
);

export const IconeLapis = (p) => (
    <Icone {...p}>
        <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" />
        <path d="m13.5 6.5 4 4" />
    </Icone>
);

export const IconeLixo = (p) => (
    <Icone {...p}>
        <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3" />
    </Icone>
);

export const IconeSubir = (p) => (
    <Icone {...p}>
        <path d="m6 15 6-6 6 6" />
    </Icone>
);

export const IconeDescer = (p) => (
    <Icone {...p}>
        <path d="m6 9 6 6 6-6" />
    </Icone>
);

export const IconeSeta = (p) => (
    <Icone {...p}>
        <path d="M5 12h14M13 6l6 6-6 6" />
    </Icone>
);

export const IconeArrastar = (p) => (
    <Icone {...p}>
        <circle cx="9" cy="6" r="1" fill="currentColor" />
        <circle cx="15" cy="6" r="1" fill="currentColor" />
        <circle cx="9" cy="12" r="1" fill="currentColor" />
        <circle cx="15" cy="12" r="1" fill="currentColor" />
        <circle cx="9" cy="18" r="1" fill="currentColor" />
        <circle cx="15" cy="18" r="1" fill="currentColor" />
    </Icone>
);

export const IconeVideo = (p) => (
    <Icone {...p}>
        <rect x="3" y="6" width="13" height="12" rx="1" />
        <path d="m16 10.5 5-3v9l-5-3" />
    </Icone>
);

export const IconeClipe = (p) => (
    <Icone {...p}>
        <path d="m20 11.5-8.2 8.2a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8" />
    </Icone>
);

export const IconeRelogio = (p) => (
    <Icone {...p}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 2" />
    </Icone>
);

export const IconeOlhoFechado = (p) => (
    <Icone {...p}>
        <path d="M3 3l18 18M10.6 6.1A9.7 9.7 0 0 1 12 6c5 0 8.5 4.2 9.5 6-.4.8-1.4 2.2-2.8 3.5M6.6 7.6C4.6 8.9 3.2 10.8 2.5 12c1 1.8 4.5 6 9.5 6 1.5 0 2.9-.4 4.1-1" />
        <path d="M9.9 10a3 3 0 0 0 4.1 4.1" />
    </Icone>
);

export const IconeArquivo = (p) => (
    <Icone {...p}>
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
        <path d="M14 3v5h5" />
    </Icone>
);

export const IconeLink = (p) => (
    <Icone {...p}>
        <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
        <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </Icone>
);

export const IconeExterno = (p) => (
    <Icone {...p}>
        <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </Icone>
);

export const IconeAlerta = (p) => (
    <Icone {...p}>
        <path d="M12 4 2.5 20h19L12 4Z" />
        <path d="M12 10v4.5M12 17.5v.01" />
    </Icone>
);

export const IconeEmail = (p) => (
    <Icone {...p}>
        <rect x="3" y="5" width="18" height="14" rx="1" />
        <path d="m3.5 6 8.5 7 8.5-7" />
    </Icone>
);
