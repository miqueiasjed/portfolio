import { describe, it, expect } from 'vitest';
import { lerData, lerHora, lerValor, lerProcesso, validarPendencia, MENSAGENS } from './campos.js';
import { ERROS as ERROS_TELEFONE } from './whatsapp.js';

// Mesma lista da `.claude/rules.md`.
const PROIBIDAS = [
    'automação', 'automático', 'integração', 'api', 'agente', 'prompt', 'mcp',
    'webhook', 'token', 'sincronizar', 'banco de dados', 'indexeddb',
];

function todasAsMensagens(objeto) {
    return Object.values(objeto).flatMap((v) => (typeof v === 'string' ? [v] : todasAsMensagens(v)));
}

describe('lerData', () => {
    it('aceita as formas do campo de data e da planilha', () => {
        for (const entrada of ['08/12/2026', '8/12/2026', '08/12/26', '2026-12-08', ' 8/12/26 ', '08-12-2026', '8-12-26']) {
            expect(lerData(entrada)).toBe('2026-12-08');
        }
    });

    it('recusa dia que não existe no calendário', () => {
        expect(lerData('31/02/2026')).toBeNull();
        expect(lerData('29/02/2026')).toBeNull();
        expect(lerData('29/02/2028')).toBe('2028-02-29');
        expect(lerData('2026-13-01')).toBeNull();
        expect(lerData('00/12/2026')).toBeNull();
    });

    it('recusa formatos que não são data', () => {
        for (const entrada of ['', null, undefined, 'amanhã', '08/12', '08/12-2026', '08/12/202', '2026/12/08']) {
            expect(lerData(entrada)).toBeNull();
        }
    });
});

describe('lerHora', () => {
    it('aceita as formas comuns', () => {
        expect(lerHora('14:00')).toBe('14:00');
        expect(lerHora('9:30')).toBe('09:30');
        expect(lerHora('14h')).toBe('14:00');
        expect(lerHora('14h30')).toBe('14:30');
        expect(lerHora('9H')).toBe('09:00');
        expect(lerHora('0:05')).toBe('00:05');
    });

    it('recusa hora que não existe', () => {
        for (const entrada of ['25:00', '24:00', '14:60', '14h75', '', null, '14', '14:5', 'meio-dia', '14:00h']) {
            expect(lerHora(entrada)).toBeNull();
        }
    });
});

describe('lerValor', () => {
    it('converte reais em centavos', () => {
        expect(lerValor('R$ 1.250,00')).toBe(125000);
        expect(lerValor('1.250,50')).toBe(125050);
        expect(lerValor('1250')).toBe(125000);
        expect(lerValor('1250.5')).toBe(125050);
        expect(lerValor('1250.50')).toBe(125050);
        expect(lerValor('1.250')).toBe(125000);
        expect(lerValor('1.250.000')).toBe(125000000);
        expect(lerValor('0,50')).toBe(50);
        expect(lerValor('150,5')).toBe(15050);
        expect(lerValor('r$80')).toBe(8000);
        expect(lerValor('R$ 350,00')).toBe(35000);
    });

    it('recusa zero, negativo e texto que não é valor', () => {
        for (const entrada of ['0', '0,00', 'abc', '', null, '-10', '1.25,00', '1.2345', '12,345', '1,250,00', ',50', '10,']) {
            expect(lerValor(entrada)).toBeNull();
        }
    });
});

describe('lerProcesso', () => {
    it('reconhece código e nome sem diferença de caixa e acento', () => {
        expect(lerProcesso('Cobrança')).toBe('05');
        expect(lerProcesso('COBRANCA')).toBe('05');
        expect(lerProcesso('5')).toBe('05');
        expect(lerProcesso('05')).toBe('05');
        expect(lerProcesso('orçamento')).toBe('04');
        expect(lerProcesso('4')).toBe('04');
        expect(lerProcesso('Orçamento  enviado')).toBe('04');
        expect(lerProcesso('Confirmar horário')).toBe('01');
        for (const entrada of ['01', '1', 'Confirmação', 'confirmar', 'Horário', ' horario ']) {
            expect(lerProcesso(entrada)).toBe('01');
        }
    });

    it('recusa o resto', () => {
        for (const entrada of ['', null, '02', '3', 'venda', 'toString', 'constructor']) {
            expect(lerProcesso(entrada)).toBeNull();
        }
    });
});

const BASE = { nome: 'Ana', whatsapp: '(85) 99999-8888', data: '08/12/2026', hora: '', valor: '', servico: '' };

describe('validarPendencia', () => {
    it('pendência de confirmação válida devolve cliente e item no formato guardado', () => {
        const r = validarPendencia({ ...BASE, nome: '  Ana   Maria ', processo: 'confirmação', hora: '14h30', valor: '200', servico: ' Limpeza ' });
        expect(r.ok).toBe(true);
        expect(r.erros).toEqual({});
        expect(r.cliente).toEqual({ nome: 'Ana Maria', whatsapp: '5585999998888' });
        expect(Object.keys(r.item).sort()).toEqual(['data', 'hora', 'processo', 'servico', 'valor_centavos']);
        expect(r.item).toEqual({ processo: '01', data: '2026-12-08', hora: '14:30', servico: 'Limpeza', valor_centavos: null });
    });

    it('cobrança válida guarda o valor e deixa a hora de fora', () => {
        const r = validarPendencia({ ...BASE, processo: '05', hora: '10:00', valor: 'R$ 1.250,00' });
        expect(r.ok).toBe(true);
        expect(r.item).toEqual({ processo: '05', data: '2026-12-08', hora: null, servico: '', valor_centavos: 125000 });
    });

    it('01 sem hora dá erro na hora', () => {
        const r = validarPendencia({ ...BASE, processo: '01' });
        expect(r.ok).toBe(false);
        expect(r.erros).toEqual({ hora: MENSAGENS.horaVazia });
        expect(r.cliente).toBeNull();
        expect(r.item).toBeNull();
    });

    it('01 com hora impossível dá erro na hora', () => {
        expect(validarPendencia({ ...BASE, processo: '01', hora: '25:00' }).erros).toEqual({ hora: MENSAGENS.horaInvalida });
    });

    it('05 sem valor dá erro no valor', () => {
        const r = validarPendencia({ ...BASE, processo: 'cobrança' });
        expect(r.ok).toBe(false);
        expect(r.erros).toEqual({ valor: MENSAGENS.valorVazio });
    });

    it('04 sem valor passa, com valor errado não', () => {
        const sem = validarPendencia({ ...BASE, processo: 'orçamento' });
        expect(sem.ok).toBe(true);
        expect(sem.item.valor_centavos).toBeNull();
        expect(sem.item.hora).toBeNull();

        const com = validarPendencia({ ...BASE, processo: '04', valor: '1.250,50' });
        expect(com.item.valor_centavos).toBe(125050);

        expect(validarPendencia({ ...BASE, processo: '04', valor: 'abc' }).erros).toEqual({ valor: MENSAGENS.valorInvalido });
        expect(validarPendencia({ ...BASE, processo: '04', valor: '0' }).erros).toEqual({ valor: MENSAGENS.valorInvalido });
    });

    it('acusa cada obrigatório vazio no campo certo', () => {
        const r = validarPendencia({});
        expect(r.ok).toBe(false);
        expect(r.erros).toEqual({
            nome: MENSAGENS.nome,
            whatsapp: ERROS_TELEFONE.vazio,
            processo: MENSAGENS.processoVazio,
            data: MENSAGENS.dataVazia.geral,
        });
        expect(validarPendencia().ok).toBe(false);
    });

    it('repassa a mensagem do telefone e diz qual data falta em cada processo', () => {
        expect(validarPendencia({ ...BASE, processo: '04', whatsapp: '123' }).erros).toEqual({ whatsapp: ERROS_TELEFONE.incompleto });
        expect(validarPendencia({ ...BASE, processo: '04', data: '' }).erros).toEqual({ data: MENSAGENS.dataVazia['04'] });
        expect(validarPendencia({ ...BASE, processo: '05', valor: '10', data: '' }).erros).toEqual({ data: MENSAGENS.dataVazia['05'] });
        expect(validarPendencia({ ...BASE, processo: '01', hora: '9:00', data: ' ' }).erros).toEqual({ data: MENSAGENS.dataVazia['01'] });
    });

    it('acusa data inexistente e processo desconhecido', () => {
        expect(validarPendencia({ ...BASE, processo: '04', data: '31/02/2026' }).erros).toEqual({ data: MENSAGENS.dataInvalida });
        expect(validarPendencia({ ...BASE, processo: 'venda' }).erros).toEqual({ processo: MENSAGENS.processoInvalido });
    });

    it('nome só com espaços conta como vazio', () => {
        expect(validarPendencia({ ...BASE, processo: '04', nome: '   ' }).erros).toEqual({ nome: MENSAGENS.nome });
    });
});

describe('mensagens', () => {
    const mensagens = todasAsMensagens(MENSAGENS);

    it('não usam palavra proibida', () => {
        for (const mensagem of mensagens) {
            const minuscula = mensagem.toLowerCase();
            for (const palavra of PROIBIDAS) {
                expect(new RegExp(`\\b${palavra}\\b`, 'u').test(minuscula), `${palavra} em "${mensagem}"`).toBe(false);
            }
        }
    });

    it('não usam travessão e terminam com ponto', () => {
        for (const mensagem of mensagens) {
            expect(/[\u2013\u2014]/.test(mensagem)).toBe(false);
            expect(mensagem.endsWith('.')).toBe(true);
        }
    });
});
