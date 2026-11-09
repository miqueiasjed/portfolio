import { createInertiaApp } from '@inertiajs/react';
import { createRoot } from 'react-dom/client';

createInertiaApp({
    title: (t) => (t ? `${t} · Miquéias Mesquita` : 'Área de membros · Miquéias Mesquita'),
    // cada página vira um arquivo separado: o primeiro carregamento baixa só o que a tela usa
    resolve: (name) => {
        const pages = import.meta.glob('./Pages/**/*.jsx');
        return pages[`./Pages/${name}.jsx`]();
    },
    setup({ el, App, props }) {
        createRoot(el).render(<App {...props} />);
    },
    progress: { color: '#CE4C3C' },
});
