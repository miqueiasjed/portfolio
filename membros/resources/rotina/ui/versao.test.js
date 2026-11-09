import { describe, expect, it, vi } from 'vitest';
import { acompanharVersao, INTERVALO_DE_PROCURA } from './versao.js';

// Imitações mínimas do que o navegador entrega, em cima do EventTarget do Node.
class Trabalhador extends EventTarget {
    constructor(state = 'installing') {
        super();
        this.state = state;
        this.postMessage = vi.fn();
    }

    mudar(state) {
        this.state = state;
        this.dispatchEvent(new Event('statechange'));
    }
}

class Registro extends EventTarget {
    constructor({ waiting = null, installing = null } = {}) {
        super();
        this.waiting = waiting;
        this.installing = installing;
        this.update = vi.fn(() => Promise.resolve());
    }

    chegou(trabalhador) {
        this.installing = trabalhador;
        this.dispatchEvent(new Event('updatefound'));
    }
}

class Container extends EventTarget {
    constructor(controller = null) {
        super();
        this.controller = controller;
    }

    trocar(controller) {
        this.controller = controller;
        this.dispatchEvent(new Event('controllerchange'));
    }
}

class Documento extends EventTarget {
    constructor() {
        super();
        this.visibilityState = 'visible';
    }

    mostrar(estado) {
        this.visibilityState = estado;
        this.dispatchEvent(new Event('visibilitychange'));
    }
}

function montar({ registro = new Registro(), sw = new Container(), documento = null, agora } = {}) {
    const aoAvisar = vi.fn();
    const recarregar = vi.fn();
    const controle = acompanharVersao({ registro, sw, aoAvisar, recarregar, documento, agora });
    return { registro, sw, aoAvisar, recarregar, controle };
}

describe('acompanharVersao', () => {
    it('primeira instalação não mostra aviso nem recarrega', () => {
        const primeira = new Trabalhador();
        const { registro, sw, aoAvisar, recarregar } = montar({ registro: new Registro({ installing: primeira }) });

        primeira.mudar('installed');
        primeira.mudar('activated');
        // O clients.claim() da primeira instalação dispara controllerchange.
        sw.trocar(primeira);
        registro.chegou(new Trabalhador());

        expect(aoAvisar).not.toHaveBeenCalled();
        expect(recarregar).not.toHaveBeenCalled();
    });

    it('primeira instalação vista pelo updatefound também não avisa', () => {
        const { registro, sw, aoAvisar, recarregar } = montar();
        const primeira = new Trabalhador();

        registro.chegou(primeira);
        primeira.mudar('installed');
        sw.trocar(primeira);

        expect(aoAvisar).not.toHaveBeenCalled();
        expect(recarregar).not.toHaveBeenCalled();
    });

    it('waiting que já existe mostra o aviso na hora', () => {
        const esperando = new Trabalhador('installed');
        const { aoAvisar } = montar({
            registro: new Registro({ waiting: esperando }),
            sw: new Container(new Trabalhador('activated')),
        });

        expect(aoAvisar).toHaveBeenCalledTimes(1);
    });

    it('installing que chega a installed com controller mostra o aviso', () => {
        const { registro, aoAvisar } = montar({ sw: new Container(new Trabalhador('activated')) });
        const nova = new Trabalhador();

        registro.chegou(nova);
        expect(aoAvisar).not.toHaveBeenCalled();

        nova.mudar('installed');
        expect(aoAvisar).toHaveBeenCalledTimes(1);
    });

    it('installing que já vinha no registro também avisa ao chegar a installed', () => {
        const nova = new Trabalhador();
        const { aoAvisar } = montar({
            registro: new Registro({ installing: nova }),
            sw: new Container(new Trabalhador('activated')),
        });

        nova.mudar('installed');
        expect(aoAvisar).toHaveBeenCalledTimes(1);
    });

    it('controllerchange sem pedido do dono não recarrega', () => {
        const esperando = new Trabalhador('installed');
        const { sw, recarregar } = montar({
            registro: new Registro({ waiting: esperando }),
            sw: new Container(new Trabalhador('activated')),
        });

        sw.trocar(esperando);
        expect(recarregar).not.toHaveBeenCalled();
    });

    it('com o pedido do dono manda atualizar e recarrega uma vez só', () => {
        const esperando = new Trabalhador('installed');
        const { sw, recarregar, controle } = montar({
            registro: new Registro({ waiting: esperando }),
            sw: new Container(new Trabalhador('activated')),
        });

        expect(controle.atualizar()).toBe(true);
        expect(esperando.postMessage).toHaveBeenCalledWith('atualizar');
        expect(recarregar).not.toHaveBeenCalled();

        sw.trocar(esperando);
        sw.trocar(esperando);
        expect(recarregar).toHaveBeenCalledTimes(1);
    });

    it('atualiza a versão que chegou a installed mesmo sem waiting no registro', () => {
        const { registro, controle } = montar({ sw: new Container(new Trabalhador('activated')) });
        const nova = new Trabalhador();

        registro.chegou(nova);
        nova.mudar('installed');

        expect(controle.atualizar()).toBe(true);
        expect(nova.postMessage).toHaveBeenCalledWith('atualizar');
    });

    it('sem versão esperando o toque não marca o pedido', () => {
        const { sw, recarregar, controle } = montar({ sw: new Container(new Trabalhador('activated')) });

        expect(controle.atualizar()).toBe(false);
        sw.trocar(new Trabalhador('activated'));
        expect(recarregar).not.toHaveBeenCalled();
    });

    it('parar tira o ouvinte de controllerchange', () => {
        const esperando = new Trabalhador('installed');
        const { sw, recarregar, controle } = montar({
            registro: new Registro({ waiting: esperando }),
            sw: new Container(new Trabalhador('activated')),
        });

        controle.atualizar();
        controle.parar();
        sw.trocar(esperando);

        expect(recarregar).not.toHaveBeenCalled();
    });

    it('parar tira o ouvinte de updatefound', () => {
        const { registro, aoAvisar, controle } = montar({ sw: new Container(new Trabalhador('activated')) });
        const nova = new Trabalhador();

        controle.parar();
        registro.chegou(nova);
        nova.mudar('installed');

        expect(aoAvisar).not.toHaveBeenCalled();
    });

    it('parar tira o ouvinte de statechange', () => {
        const nova = new Trabalhador();
        const { aoAvisar, controle } = montar({
            registro: new Registro({ installing: nova }),
            sw: new Container(new Trabalhador('activated')),
        });

        controle.parar();
        nova.mudar('installed');

        expect(aoAvisar).not.toHaveBeenCalled();
    });

    it('parar tira o ouvinte de visibilitychange', () => {
        let relogio = 0;
        const documento = new Documento();
        const { registro, controle } = montar({ documento, agora: () => relogio });

        controle.parar();
        relogio = INTERVALO_DE_PROCURA + 1;
        documento.mostrar('hidden');
        documento.mostrar('visible');

        expect(registro.update).not.toHaveBeenCalled();
    });

    describe('duas abas abertas', () => {
        // Cada aba tem o próprio registro e o próprio navigator.serviceWorker,
        // mas os trabalhadores são os mesmos.
        function duasAbas() {
            const velha = new Trabalhador('activated');
            const nova = new Trabalhador('installed');
            const a = montar({ registro: new Registro({ waiting: nova }), sw: new Container(velha) });
            const b = montar({ registro: new Registro({ waiting: nova }), sw: new Container(velha) });
            return { velha, nova, a, b };
        }

        // O SW novo ativa e o clients.claim() troca o controller nas duas abas.
        function ativar(nova, ...abas) {
            nova.state = 'activated';
            abas.forEach((aba) => {
                aba.registro.waiting = null;
                aba.sw.trocar(nova);
            });
        }

        it('o toque em A recarrega A; o toque seguinte em B só recarrega B, uma vez', () => {
            const { nova, a, b } = duasAbas();
            expect(a.aoAvisar).toHaveBeenCalledTimes(1);
            expect(b.aoAvisar).toHaveBeenCalledTimes(1);

            a.controle.atualizar();
            expect(nova.postMessage).toHaveBeenCalledTimes(1);
            ativar(nova, a, b);

            expect(a.recarregar).toHaveBeenCalledTimes(1);
            // B não recarrega sozinha.
            expect(b.recarregar).not.toHaveBeenCalled();

            expect(b.controle.atualizar()).toBe(true);
            expect(b.recarregar).toHaveBeenCalledTimes(1);
            // Nada de mandar 'atualizar' a um SW que já está ativo.
            expect(nova.postMessage).toHaveBeenCalledTimes(1);

            b.controle.atualizar();
            b.sw.trocar(nova);
            expect(b.recarregar).toHaveBeenCalledTimes(1);
        });

        it('versão esperando que ativa porque as outras abas fecharam: o toque só recarrega', () => {
            const { nova, b } = duasAbas();

            // A fecha; a versão nova assume sem pedido de ninguém.
            ativar(nova, b);
            expect(b.recarregar).not.toHaveBeenCalled();

            expect(b.controle.atualizar()).toBe(true);
            expect(b.recarregar).toHaveBeenCalledTimes(1);
            expect(nova.postMessage).not.toHaveBeenCalled();
        });

        it('troca de controller sem aviso na tela não muda o toque', () => {
            // Primeira instalação: o claim troca o controller sem aviso. Depois
            // chega uma versão nova, e o toque ainda precisa mandar 'atualizar'.
            const primeira = new Trabalhador('activated');
            const { registro, sw, recarregar, controle } = montar();
            sw.trocar(primeira);

            const nova = new Trabalhador();
            registro.chegou(nova);
            nova.mudar('installed');
            registro.waiting = nova;

            expect(controle.atualizar()).toBe(true);
            expect(nova.postMessage).toHaveBeenCalledWith('atualizar');
            expect(recarregar).not.toHaveBeenCalled();
        });
    });

    describe('procura de versão nova ao voltar do segundo plano', () => {
        function comRelogio() {
            let relogio = 1_000;
            const documento = new Documento();
            const aba = montar({ documento, agora: () => relogio });
            return {
                ...aba,
                documento,
                avancar(ms) {
                    relogio += ms;
                },
            };
        }

        it('chama update() ao voltar a visible depois do intervalo', () => {
            const { registro, documento, avancar } = comRelogio();

            avancar(INTERVALO_DE_PROCURA);
            documento.mostrar('hidden');
            expect(registro.update).not.toHaveBeenCalled();

            documento.mostrar('visible');
            expect(registro.update).toHaveBeenCalledTimes(1);
        });

        it('respeita o intervalo mínimo entre procuras', () => {
            const { registro, documento, avancar } = comRelogio();

            avancar(INTERVALO_DE_PROCURA - 1);
            documento.mostrar('visible');
            expect(registro.update).not.toHaveBeenCalled();

            avancar(1);
            documento.mostrar('visible');
            expect(registro.update).toHaveBeenCalledTimes(1);

            avancar(INTERVALO_DE_PROCURA - 1);
            documento.mostrar('visible');
            expect(registro.update).toHaveBeenCalledTimes(1);

            avancar(1);
            documento.mostrar('visible');
            expect(registro.update).toHaveBeenCalledTimes(2);
        });

        it('ignora falha do update(), recusada ou lançada', async () => {
            const { registro, documento, avancar } = comRelogio();
            registro.update.mockImplementationOnce(() => Promise.reject(new Error('sem rede')));

            avancar(INTERVALO_DE_PROCURA);
            expect(() => documento.mostrar('visible')).not.toThrow();
            // Deixa a recusa acontecer: sem tratamento, o vitest acusaria.
            await Promise.resolve();
            await Promise.resolve();

            registro.update.mockImplementationOnce(() => {
                throw new Error('recusado');
            });
            avancar(INTERVALO_DE_PROCURA);
            expect(() => documento.mostrar('visible')).not.toThrow();
            expect(registro.update).toHaveBeenCalledTimes(2);
        });
    });
});
