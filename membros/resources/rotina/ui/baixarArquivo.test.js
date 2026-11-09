import { describe, expect, it, vi } from 'vitest';
import { baixarArquivo, ESPERA_PARA_LIBERAR } from './baixarArquivo.js';

// Imitação mínima do documento e do URL do navegador.
function navegador() {
    const eventos = [];
    const link = {
        href: '',
        download: '',
        click: vi.fn(() => eventos.push('click')),
        remove: vi.fn(() => eventos.push('remove')),
    };
    const documento = {
        createElement: vi.fn(() => link),
        body: { appendChild: vi.fn(() => eventos.push('append')) },
    };
    const enderecos = {
        createObjectURL: vi.fn(() => 'blob:teste/1'),
        revokeObjectURL: vi.fn(() => eventos.push('revoke')),
    };
    let liberar = null;
    const esperar = vi.fn((fn, ms) => {
        liberar = { fn, ms };
    });
    return { eventos, link, documento, enderecos, esperar, liberar: () => liberar };
}

describe('baixarArquivo', () => {
    it('monta o arquivo com o texto e o tipo e clica num link com o nome', async () => {
        const n = navegador();
        baixarArquivo('copia.json', '{"a":1}', 'application/json', n);

        const arquivo = n.enderecos.createObjectURL.mock.calls[0][0];
        expect(arquivo).toBeInstanceOf(Blob);
        expect(arquivo.type).toBe('application/json');
        expect(await arquivo.text()).toBe('{"a":1}');

        expect(n.documento.createElement).toHaveBeenCalledWith('a');
        expect(n.link.href).toBe('blob:teste/1');
        expect(n.link.download).toBe('copia.json');
        expect(n.eventos).toEqual(['append', 'click', 'remove']);
    });

    it('só libera o endereço depois da espera', () => {
        const n = navegador();
        baixarArquivo('modelo.csv', 'nome', 'text/csv;charset=utf-8', n);

        expect(n.enderecos.revokeObjectURL).not.toHaveBeenCalled();
        expect(n.liberar().ms).toBe(ESPERA_PARA_LIBERAR);

        n.liberar().fn();
        expect(n.enderecos.revokeObjectURL).toHaveBeenCalledWith('blob:teste/1');
    });

    it('tira o link e libera o endereço mesmo se o clique falhar', () => {
        const n = navegador();
        n.link.click.mockImplementation(() => {
            throw new Error('bloqueado');
        });

        expect(() => baixarArquivo('x.json', '{}', 'application/json', n)).toThrow('bloqueado');
        expect(n.link.remove).toHaveBeenCalled();
        n.liberar().fn();
        expect(n.enderecos.revokeObjectURL).toHaveBeenCalledWith('blob:teste/1');
    });
});
