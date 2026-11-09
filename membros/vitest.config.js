import { defineConfig } from 'vitest/config';

// Config própria dos testes JS: não reaproveita o vite.config.js
// porque o plugin do Laravel não serve no ambiente de teste.
export default defineConfig({
    test: {
        include: ['resources/rotina/**/*.test.js'],
        environment: 'node',
    },
});
