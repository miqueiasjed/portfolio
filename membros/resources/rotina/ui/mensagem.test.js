import { describe, expect, it } from 'vitest';
import { textos } from '../textos/textos.js';
import { linkWhatsApp } from '../regras/whatsapp.js';
import {
    comoAbrirAVolta,
    decidirPendenteAoAbrir,
    houveEdicao,
    outraVariacao,
    pendenciaAberta,
    pendenteEmMemoria,
    rotuloDaEtapa,
    textoDaMensagem,
    variacaoInicial,
} from './mensagem.js';

const cliente = { id: 'c1', nome: 'MARIA da Silva', whatsapp: '5585999998888' };
const ajustes = { segmento: 'clinica', negocio: 'Clínica Sol', assinatura: 'Ana', chave_pix: '', variacao: 1 };

describe('rotuloDaEtapa', () => {
    it('junta processo e etapa sem dias', () => {
        expect(rotuloDaEtapa('01', 'vespera')).toBe('Confirmar horário, Véspera');
        expect(rotuloDaEtapa('04', 'd3')).toBe('Orçamento enviado, 1º retorno');
        expect(rotuloDaEtapa('05', 'd15')).toBe('Cobrança, 3º lembrete');
    });

    it('deixa de fora a parte desconhecida', () => {
        expect(rotuloDaEtapa('05', 'x')).toBe('Cobrança');
        expect(rotuloDaEtapa('99', 'd1')).toBe('1º lembrete');
    });
});

describe('variação', () => {
    it('alterna entre 1 e 2', () => {
        expect(outraVariacao(1)).toBe(2);
        expect(outraVariacao(2)).toBe(1);
        expect(outraVariacao(undefined)).toBe(1);
    });

    it('começa na dos ajustes', () => {
        expect(variacaoInicial({ variacao: 2 })).toBe(2);
        expect(variacaoInicial({ variacao: 1 })).toBe(1);
        expect(variacaoInicial({})).toBe(1);
    });
});

describe('textoDaMensagem', () => {
    const item = { id: 'i1', processo: '05', data: '2026-12-10', valor_centavos: 125000, servico: 'Limpeza', status: 'aberto' };

    it('escolhe por processo, etapa, segmento e variação e preenche', () => {
        const v1 = textoDaMensagem({ textos, item, cliente, ajustes, etapa: 'd1', variacao: 1 });
        const v2 = textoDaMensagem({ textos, item, cliente, ajustes, etapa: 'd1', variacao: 2 });
        expect(v1).toContain('Oi, Maria, tudo bem? Só lembrando do pagamento de R$ 1.250,00, que venceu no dia 10/12.');
        expect(v2).toContain('Oi, Maria. O pagamento de R$ 1.250,00, do dia 10/12, ainda não apareceu por aqui.');
        expect(v1).not.toBe(v2);
        expect(v1.endsWith('Ana\nClínica Sol')).toBe(true);
    });

    it('Pix só aparece com a chave preenchida', () => {
        const sem = textoDaMensagem({ textos, item, cliente, ajustes, etapa: 'd1', variacao: 1 });
        const com = textoDaMensagem({ textos, item, cliente, ajustes: { ...ajustes, chave_pix: 'a@b.com' }, etapa: 'd1', variacao: 1 });
        expect(sem).not.toContain('Pix');
        expect(com).toContain('chave Pix: a@b.com');
    });

    it('segmento muda o texto', () => {
        const clinica = textoDaMensagem({ textos, item, cliente, ajustes, etapa: 'd1', variacao: 1 });
        const servicos = textoDaMensagem({ textos, item, cliente, ajustes: { ...ajustes, segmento: 'servicos' }, etapa: 'd1', variacao: 1 });
        expect(servicos).not.toBe(clinica);
    });

    it('etapa que não é do processo não tem texto', () => {
        expect(textoDaMensagem({ textos, item, cliente, ajustes, etapa: 'vespera', variacao: 1 })).toBeNull();
    });

    it('texto editado vai para o link com o texto codificado', () => {
        const editado = 'Oi, Maria. Tudo certo & pago?';
        const resultado = linkWhatsApp(cliente.whatsapp, editado);
        expect(resultado.link).toBe(`https://wa.me/5585999998888?text=${encodeURIComponent(editado)}`);
    });
});

describe('pendenciaAberta e houveEdicao', () => {
    it('só aberta e com cliente', () => {
        expect(pendenciaAberta({ status: 'aberto' }, cliente)).toBe(true);
        expect(pendenciaAberta({ status: 'resolvido' }, cliente)).toBe(false);
        expect(pendenciaAberta(null, cliente)).toBe(false);
        expect(pendenciaAberta({ status: 'aberto' }, null)).toBe(false);
    });

    it('edição só quando o texto difere', () => {
        expect(houveEdicao(null, 'a')).toBe(false);
        expect(houveEdicao('a', 'a')).toBe(false);
        expect(houveEdicao('b', 'a')).toBe(true);
    });
});

describe('pendente em memória e volta', () => {
    const local = pendenteEmMemoria({ itemId: 'i1', etapa: 'd1', abertoEm: new Date('2026-12-10T12:00:00Z') });

    it('tem o formato do guardado no aparelho', () => {
        expect(local).toEqual({ item_id: 'i1', etapa: 'd1', aberto_em: '2026-12-10T12:00:00.000Z' });
    });

    it('usa o hook só quando ele leu o mesmo pendente', () => {
        expect(comoAbrirAVolta({ doHook: { ...local }, local })).toBe('hook');
        expect(comoAbrirAVolta({ doHook: { ...local, aberto_em: '2026-12-09T12:00:00.000Z' }, local })).toBe('local');
        expect(comoAbrirAVolta({ doHook: null, local })).toBe('local');
        expect(comoAbrirAVolta({ doHook: local, local: null })).toBe('hook');
        expect(comoAbrirAVolta({})).toBeNull();
    });
});

describe('decidirPendenteAoAbrir', () => {
    const pendente = { item_id: 'i1', etapa: 'd5', aberto_em: '2026-12-10T12:00:00.000Z' };
    const hoje = { tela: 'hoje', params: {} };

    it('sem pendente não faz nada', () => {
        expect(decidirPendenteAoAbrir({ pendente: null, item: null, rotaAtual: hoje })).toEqual({ acao: 'nada' });
    });

    it('item aberto leva para a mensagem dele', () => {
        expect(decidirPendenteAoAbrir({ pendente, item: { id: 'i1', status: 'aberto' }, rotaAtual: hoje })).toEqual({
            acao: 'ir',
            rota: '#/mensagem/i1/d5',
        });
    });

    it('já na mensagem dele não navega', () => {
        const rotaAtual = { tela: 'mensagem', params: { itemId: 'i1', etapa: 'd5' } };
        expect(decidirPendenteAoAbrir({ pendente, item: { id: 'i1', status: 'aberto' }, rotaAtual })).toEqual({ acao: 'nada' });
    });

    it('fora da Hoje não leva para a mensagem', () => {
        const ajustes = { tela: 'ajustes', params: {} };
        expect(decidirPendenteAoAbrir({ pendente, item: { id: 'i1', status: 'aberto' }, rotaAtual: ajustes })).toEqual({ acao: 'nada' });
        expect(decidirPendenteAoAbrir({ pendente, item: null, rotaAtual: ajustes })).toEqual({ acao: 'limpar' });
    });

    it('item inexistente ou fechado é limpo', () => {
        expect(decidirPendenteAoAbrir({ pendente, item: null, rotaAtual: hoje })).toEqual({ acao: 'limpar' });
        expect(decidirPendenteAoAbrir({ pendente, item: { id: 'i1', status: 'resolvido' }, rotaAtual: hoje })).toEqual({
            acao: 'limpar',
        });
    });
});
