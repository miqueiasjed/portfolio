import { describe, it, expect } from 'vitest';
import {
    primeiroNome,
    formatarBRL,
    valoresDaMensagem,
    preencher,
    escolherTexto,
    mensagemPronta,
} from './preencher.js';

// Confere o que nenhum texto pronto pode ter.
function esperarLimpo(resultado) {
    expect(resultado).not.toMatch(/[{}]/);
    expect(resultado).not.toMatch(/ {2}/);
    expect(resultado).not.toMatch(/ [,.!?;:]/);
    expect(resultado).not.toMatch(/^\s*\n/);
    expect(resultado).not.toMatch(/\n\s*$/);
    expect(resultado).not.toMatch(/\n\s*\n\s*\n/);
}

const vazios = {
    nome: '',
    data: '',
    hora: '',
    servico: '',
    valor: '',
    negocio: '',
    assinatura: '',
    pix: '',
};

describe('primeiroNome', () => {
    it('pega a primeira palavra sem espaços nas pontas', () => {
        expect(primeiroNome('  Ana Maria Souza ')).toBe('Ana');
    });

    it('capitaliza nome todo em maiúsculas ou todo em minúsculas', () => {
        expect(primeiroNome('ANA MARIA')).toBe('Ana');
        expect(primeiroNome('joão silva')).toBe('João');
        expect(primeiroNome('ÉRICA')).toBe('Érica');
    });

    it('mantém caixa mista como veio', () => {
        expect(primeiroNome('McDonald Silva')).toBe('McDonald');
        expect(primeiroNome('ANA Maria')).toBe('ANA');
    });

    it('devolve vazio para nome ausente', () => {
        expect(primeiroNome('')).toBe('');
        expect(primeiroNome('   ')).toBe('');
        expect(primeiroNome(undefined)).toBe('');
        expect(primeiroNome(null)).toBe('');
    });
});

describe('formatarBRL', () => {
    it('formata centavos com espaço comum depois do símbolo', () => {
        const texto = formatarBRL(125000);
        expect(texto).toBe('R$ 1.250,00');
        expect(texto.charCodeAt(2)).toBe(32);
        expect(formatarBRL(5)).toBe('R$ 0,05');
        expect(formatarBRL(0)).toBe('R$ 0,00');
    });

    it('devolve vazio para valor que não é número', () => {
        expect(formatarBRL(null)).toBe('');
        expect(formatarBRL(undefined)).toBe('');
        expect(formatarBRL('125000')).toBe('');
        expect(formatarBRL(Number.NaN)).toBe('');
    });
});

describe('valoresDaMensagem', () => {
    it('monta todos os valores a partir do cliente, do item e dos ajustes', () => {
        const valores = valoresDaMensagem({
            cliente: { nome: 'MARIA DAS DORES' },
            item: { data: '2026-12-08', hora: '14:30', servico: 'Limpeza', valor_centavos: 125000 },
            ajustes: { negocio: 'Clínica Sorriso', assinatura: 'Ana', chave_pix: 'pix@clinica.com' },
        });
        expect(valores).toEqual({
            nome: 'Maria',
            data: '08/12',
            hora: '14:30',
            servico: 'Limpeza',
            valor: 'R$ 1.250,00',
            negocio: 'Clínica Sorriso',
            assinatura: 'Ana',
            pix: 'pix@clinica.com',
        });
    });

    it('usa string vazia para tudo o que faltar', () => {
        expect(valoresDaMensagem({})).toEqual(vazios);
        expect(valoresDaMensagem()).toEqual(vazios);
        expect(valoresDaMensagem({ item: { data: 'ontem', valor_centavos: null } })).toEqual(vazios);
    });
});

describe('preencher', () => {
    it('troca as variáveis pelos valores', () => {
        const resultado = preencher('Oi, {nome}! Seu horário é dia {data} às {hora}.', {
            nome: 'Ana',
            data: '08/12',
            hora: '14:30',
        });
        expect(resultado).toBe('Oi, Ana! Seu horário é dia 08/12 às 14:30.');
        esperarLimpo(resultado);
    });

    it('nome vazio some sem deixar vírgula dobrada', () => {
        const resultado = preencher('Oi, {nome}, tudo bem?', { nome: '' });
        expect(resultado).toBe('Oi, tudo bem?');
        esperarLimpo(resultado);
    });

    it('limpa espaço antes da pontuação e vírgula antes de ponto', () => {
        expect(preencher('Oi {nome}!', { nome: '' })).toBe('Oi!');
        expect(preencher('Obrigado, {nome}.', { nome: '' })).toBe('Obrigado.');
        expect(preencher('Amanhã, {data} , às {hora}.', { data: '', hora: '14:30' })).toBe('Amanhã, às 14:30.');
        expect(preencher('Até {data}, {nome}.', { data: '08/12', nome: '' })).toBe('Até 08/12.');
        expect(preencher('{nome}, tudo bem?', { nome: '' })).toBe('tudo bem?');
    });

    it('linha do Pix sai inteira sem chave e fica preenchida com chave', () => {
        const texto = 'Oi, {nome}.\nSegue o valor de {valor}.\nPix: {pix}\nObrigado!';
        const sem = preencher(texto, { nome: 'Ana', valor: 'R$ 80,00', pix: '' });
        expect(sem).toBe('Oi, Ana.\nSegue o valor de R$ 80,00.\nObrigado!');
        esperarLimpo(sem);

        const com = preencher(texto, { nome: 'Ana', valor: 'R$ 80,00', pix: '85999998888' });
        expect(com).toBe('Oi, Ana.\nSegue o valor de R$ 80,00.\nPix: 85999998888\nObrigado!');
        esperarLimpo(com);
    });

    it('linha de assinatura e negócio perde só o que está vazio', () => {
        const texto = 'Até amanhã!\n\n{assinatura}, {negocio}';
        const soNegocioVazio = preencher(texto, { assinatura: 'Ana', negocio: '' });
        expect(soNegocioVazio).toBe('Até amanhã!\n\nAna');
        esperarLimpo(soNegocioVazio);

        expect(preencher('{assinatura}, {negocio}', { assinatura: 'Ana', negocio: '' })).toBe('Ana');
        expect(preencher('{assinatura}, {negocio}', { assinatura: '', negocio: 'Clínica Sorriso' })).toBe(
            'Clínica Sorriso',
        );

        const osDoisVazios = preencher(texto, { assinatura: '', negocio: '' });
        expect(osDoisVazios).toBe('Até amanhã!');
        esperarLimpo(osDoisVazios);
        expect(preencher('{assinatura}, {negocio}', { assinatura: '', negocio: '' })).toBe('');
    });

    it('nome, data e hora vazios só somem, sem derrubar a linha', () => {
        expect(preencher('Tudo certo, {nome}?\nPix: {pix}', { nome: '', pix: '' })).toBe('Tudo certo?');
        expect(preencher('{servico} no dia {data}\nAté lá.', { servico: '', data: '' })).toBe('Até lá.');
    });

    it('junta linhas em branco repetidas e tira as das pontas', () => {
        const texto = '\n\nOi, {nome}.\n\n{servico}\n\nPix: {pix}\n\nAté logo.\n\n';
        const resultado = preencher(texto, { nome: 'Ana', servico: '', pix: '' });
        expect(resultado).toBe('Oi, Ana.\n\nAté logo.');
        esperarLimpo(resultado);
    });

    it('junta espaços repetidos que sobram da variável vazia', () => {
        const resultado = preencher('Seu {servico} está marcado para {data}.', { servico: '', data: '08/12' });
        expect(resultado).toBe('Seu está marcado para 08/12.');
        esperarLimpo(resultado);
    });

    it('mantém variável desconhecida como está', () => {
        expect(preencher('Oi, {apelido}!', { nome: 'Ana' })).toBe('Oi, {apelido}!');
        expect(preencher('{apelido} {nome}', { nome: '' })).toBe('{apelido}');
    });

    it('não reinterpreta caracteres especiais do valor', () => {
        expect(preencher('Total: {valor}', { valor: 'R$ 10,00' })).toBe('Total: R$ 10,00');
        expect(preencher('Oi, {nome}.', { nome: '{pix}' })).toBe('Oi, {pix}.');
    });
});

describe('escolherTexto', () => {
    const textos = [
        { processo: '01', etapa: 'vespera', segmento: 'clinica', variacao: 1, texto: 'clinica 1' },
        { processo: '01', etapa: 'vespera', segmento: 'clinica', variacao: 2, texto: 'clinica 2' },
        { processo: '01', etapa: 'vespera', segmento: 'servicos', variacao: 1, texto: 'servicos 1' },
    ];

    it('devolve o texto da combinação pedida', () => {
        expect(escolherTexto(textos, { processo: '01', etapa: 'vespera', segmento: 'clinica', variacao: 2 })).toBe(
            'clinica 2',
        );
    });

    it('cai na variação 1 quando a pedida não existe', () => {
        expect(escolherTexto(textos, { processo: '01', etapa: 'vespera', segmento: 'servicos', variacao: 2 })).toBe(
            'servicos 1',
        );
        expect(escolherTexto(textos, { processo: '01', etapa: 'vespera', segmento: 'servicos' })).toBe('servicos 1');
    });

    it('devolve null para combinação inexistente', () => {
        expect(escolherTexto(textos, { processo: '05', etapa: 'd1', segmento: 'clinica', variacao: 1 })).toBeNull();
        expect(escolherTexto([], { processo: '01', etapa: 'vespera', segmento: 'clinica', variacao: 1 })).toBeNull();
        expect(escolherTexto(undefined, {})).toBeNull();
    });
});

describe('mensagemPronta', () => {
    const textos = [
        {
            processo: '05',
            etapa: 'd1',
            segmento: 'servicos',
            variacao: 1,
            texto: 'Oi, {nome}, tudo bem?\nO {servico} de {valor} venceu dia {data}.\nPix: {pix}\n\n{assinatura}\n{negocio}',
        },
        {
            processo: '05',
            etapa: 'd1',
            segmento: 'servicos',
            variacao: 2,
            texto: 'Olá, {nome}!\nPix: {pix}',
        },
    ];
    const item = { processo: '05', data: '2026-12-08', servico: 'Conserto', valor_centavos: 25000 };
    const cliente = { nome: 'joão pedro' };

    it('escolhe o texto pelos ajustes e pelo item e preenche', () => {
        const resultado = mensagemPronta({
            textos,
            item,
            cliente,
            etapa: 'd1',
            ajustes: { segmento: 'servicos', variacao: 1, negocio: '', assinatura: 'Ana', chave_pix: '' },
        });
        expect(resultado).toBe('Oi, João, tudo bem?\nO Conserto de R$ 250,00 venceu dia 08/12.\n\nAna');
        esperarLimpo(resultado);
    });

    it('usa a variação dos ajustes', () => {
        const resultado = mensagemPronta({
            textos,
            item,
            cliente,
            etapa: 'd1',
            ajustes: { segmento: 'servicos', variacao: 2, chave_pix: 'joao@pix.com' },
        });
        expect(resultado).toBe('Olá, João!\nPix: joao@pix.com');
        esperarLimpo(resultado);
    });

    it('devolve null quando não há texto para a combinação', () => {
        expect(
            mensagemPronta({ textos, item, cliente, etapa: 'd5', ajustes: { segmento: 'servicos', variacao: 1 } }),
        ).toBeNull();
        expect(
            mensagemPronta({ textos, item, cliente, etapa: 'd1', ajustes: { segmento: 'clinica', variacao: 1 } }),
        ).toBeNull();
    });
});
