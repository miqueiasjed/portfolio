// Modelos de mensagem da pré-venda: 6 etapas x 2 segmentos x 2 variações.
// Só dados. O preenchimento fica em `regras/preencher.js`.
//
// Regra de linha: `{servico}`, `{negocio}`, `{assinatura}`, `{pix}` e o
// `{valor}` do 04 podem vir vazios. Cada um fica numa linha própria, sem outra
// variável, para a linha sumir inteira quando faltar. `{nome}`, `{data}`,
// `{hora}` e o `{valor}` do 05 ficam no meio da frase.
// A palavra "Pix" só aparece na linha do `{pix}`, e nada vem depois da chave
// (pontuação colada atrapalha quem copia).

export const textos = [
    // 01 Confirmação de horário, véspera
    {
        processo: '01',
        etapa: 'vespera',
        segmento: 'clinica',
        variacao: 1,
        texto: 'Oi, {nome}. Lembrando do seu horário amanhã, {data}, às {hora}.\nÉ para {servico}.\nPode confirmar com um sim? Se precisar remarcar, me avisa.\n\n{assinatura}\n{negocio}',
    },
    {
        processo: '01',
        etapa: 'vespera',
        segmento: 'clinica',
        variacao: 2,
        texto: 'Oi, {nome}. Amanhã, {data}, às {hora}, a gente se vê?\nSeu horário está reservado para {servico}.\nUm sim já confirma. Se surgiu alguma coisa, me fala que eu remarco.\n\n{assinatura}\n{negocio}',
    },
    {
        processo: '01',
        etapa: 'vespera',
        segmento: 'servicos',
        variacao: 1,
        texto: 'Oi, {nome}. Só confirmando o nosso combinado de amanhã, {data}, às {hora}.\nO serviço é {servico}.\nMe confirma com um sim? Se precisar mudar o dia, é só avisar.\n\n{assinatura}\n{negocio}',
    },
    {
        processo: '01',
        etapa: 'vespera',
        segmento: 'servicos',
        variacao: 2,
        texto: 'Oi, {nome}, tudo bem? Amanhã, {data}, às {hora}, tenho você na agenda.\nO trabalho é {servico}.\nContinua valendo? Responde com um sim, ou com o melhor dia se precisar trocar.\n\n{assinatura}\n{negocio}',
    },

    // 04 Orçamento sem retorno, primeiro acompanhamento
    {
        processo: '04',
        etapa: 'd3',
        segmento: 'clinica',
        variacao: 1,
        texto: 'Oi, {nome}, tudo bem?\nQueria saber se ficou alguma dúvida sobre o orçamento que te mandei no dia {data}.\nEra para {servico}.\nSe quiser, te explico cada etapa do tratamento por aqui mesmo.\n\n{assinatura}\n{negocio}',
    },
    {
        processo: '04',
        etapa: 'd3',
        segmento: 'clinica',
        variacao: 2,
        texto: 'Oi, {nome}. Conseguiu olhar com calma o orçamento do dia {data}?\nEle é para {servico}.\nSe ficou alguma dúvida sobre as sessões ou o valor, pode perguntar. Respondo por aqui.\n\n{assinatura}\n{negocio}',
    },
    {
        processo: '04',
        etapa: 'd3',
        segmento: 'servicos',
        variacao: 1,
        texto: 'Oi, {nome}, tudo bem?\nQueria saber o que você achou do orçamento que te mandei no dia {data}.\nEra para {servico}.\nSe tiver dúvida ou quiser mudar alguma parte, é só falar.\n\n{assinatura}\n{negocio}',
    },
    {
        processo: '04',
        etapa: 'd3',
        segmento: 'servicos',
        variacao: 2,
        texto: 'Oi, {nome}. Deu tempo de ver o orçamento do dia {data}?\nO trabalho é {servico}.\nO que não ficou claro, me pergunta. Explico item por item.\n\n{assinatura}\n{negocio}',
    },

    // 04 Orçamento sem retorno, último contato
    {
        processo: '04',
        etapa: 'd7',
        segmento: 'clinica',
        variacao: 1,
        texto: 'Oi, {nome}. Essa é a última vez que te chamo sobre o orçamento do dia {data}, para não ficar te incomodando.\nEra para {servico}.\nSe o valor pesou, dá para começar com menos sessões.\nE se não for o momento, tudo bem. Quando quiser, me chama.\n\n{assinatura}\n{negocio}',
    },
    {
        processo: '04',
        etapa: 'd7',
        segmento: 'clinica',
        variacao: 2,
        texto: 'Oi, {nome}, tudo bem? Passo aqui uma última vez por causa do orçamento do dia {data}.\nEle é para {servico}.\nSe o preço foi o que travou, me fala. A gente pode ajustar o que entra no tratamento.\nSe preferir deixar para mais adiante, sem problema.\n\n{assinatura}\n{negocio}',
    },
    {
        processo: '04',
        etapa: 'd7',
        segmento: 'servicos',
        variacao: 1,
        texto: 'Oi, {nome}. Último recado sobre o orçamento do dia {data}, prometo.\nEra para {servico}.\nSe o valor ficou alto, dá para tirar alguma parte ou fazer em etapas.\nE se não for agora, fica para quando você precisar.\n\n{assinatura}\n{negocio}',
    },
    {
        processo: '04',
        etapa: 'd7',
        segmento: 'servicos',
        variacao: 2,
        texto: 'Oi, {nome}, tudo bem? Não vou insistir no orçamento do dia {data}. Ele fica com você, para decidir no seu tempo.\nO trabalho é {servico}.\nSe o preço foi o problema, me diz. Dá para ajustar o tamanho do serviço.\nQuando precisar, já sabe onde me achar.\n\n{assinatura}\n{negocio}',
    },

    // 05 Cobrança, primeiro lembrete
    {
        processo: '05',
        etapa: 'd1',
        segmento: 'clinica',
        variacao: 1,
        texto: 'Oi, {nome}, tudo bem? Só lembrando do pagamento de {valor}, que venceu no dia {data}.\nAtendimento: {servico}\nPara facilitar, segue a chave Pix: {pix}\nSe já pagou, pode desconsiderar.\n\n{assinatura}\n{negocio}',
    },
    {
        processo: '05',
        etapa: 'd1',
        segmento: 'clinica',
        variacao: 2,
        texto: 'Oi, {nome}. O pagamento de {valor}, do dia {data}, ainda não apareceu por aqui.\nAtendimento: {servico}\nSe já pagou, me avisa que eu confiro.\nChave Pix: {pix}\n\n{assinatura}\n{negocio}',
    },
    {
        processo: '05',
        etapa: 'd1',
        segmento: 'servicos',
        variacao: 1,
        texto: 'Oi, {nome}, tudo bem? Passando para lembrar do pagamento de {valor}, que venceu no dia {data}.\nServiço: {servico}\nPara facilitar, segue a chave Pix: {pix}\nSe já acertou, pode desconsiderar.\n\n{assinatura}\n{negocio}',
    },
    {
        processo: '05',
        etapa: 'd1',
        segmento: 'servicos',
        variacao: 2,
        texto: 'Oi, {nome}. Vi aqui que o pagamento de {valor}, do dia {data}, ficou em aberto.\nServiço: {servico}\nDeve ter passado na correria, acontece.\nChave Pix: {pix}\n\n{assinatura}\n{negocio}',
    },

    // 05 Cobrança, segundo contato
    {
        processo: '05',
        etapa: 'd5',
        segmento: 'clinica',
        variacao: 1,
        texto: 'Oi, {nome}. Volto a falar do pagamento de {valor}, que venceu no dia {data} e segue em aberto.\nAtendimento: {servico}\nConsegue me dizer quando dá para acertar?\nChave Pix: {pix}\n\n{assinatura}\n{negocio}',
    },
    {
        processo: '05',
        etapa: 'd5',
        segmento: 'clinica',
        variacao: 2,
        texto: 'Oi, {nome}, tudo bem? O valor de {valor}, do dia {data}, ainda está em aberto aqui.\nAtendimento: {servico}\nMe dá um retorno de quando consegue pagar? Assim eu organizo as contas por aqui.\nSe for pagar agora, a chave Pix é esta: {pix}\n\n{assinatura}\n{negocio}',
    },
    {
        processo: '05',
        etapa: 'd5',
        segmento: 'servicos',
        variacao: 1,
        texto: 'Oi, {nome}. O pagamento de {valor}, que venceu no dia {data}, continua em aberto.\nServiço: {servico}\nMe diz até quando você consegue acertar, para eu me organizar aqui.\nChave Pix: {pix}\n\n{assinatura}\n{negocio}',
    },
    {
        processo: '05',
        etapa: 'd5',
        segmento: 'servicos',
        variacao: 2,
        texto: 'Oi, {nome}, tudo bem? Te escrevo de novo sobre o valor de {valor}, do dia {data}, que ainda não entrou.\nServiço: {servico}\nConsegue ver isso essa semana?\nSe for pagar agora, a chave Pix é esta: {pix}\n\n{assinatura}\n{negocio}',
    },

    // 05 Cobrança, conversa e novo combinado
    {
        processo: '05',
        etapa: 'd15',
        segmento: 'clinica',
        variacao: 1,
        texto: 'Oi, {nome}. O pagamento de {valor}, do dia {data}, ainda está em aberto.\nAtendimento: {servico}\nSe o mês apertou, a gente conversa e faz um novo combinado, com outra data ou em partes. Me diz o que funciona para você.\nSe preferir acertar agora, segue a chave Pix: {pix}\n\n{assinatura}\n{negocio}',
    },
    {
        processo: '05',
        etapa: 'd15',
        segmento: 'clinica',
        variacao: 2,
        texto: 'Oi, {nome}, tudo bem? Queria conversar com você sobre o valor de {valor}, que venceu no dia {data}.\nAtendimento: {servico}\nSei que às vezes as contas apertam. Me fala qual data ou forma de pagamento fica boa, e a gente acerta um novo combinado.\nChave Pix: {pix}\n\n{assinatura}\n{negocio}',
    },
    {
        processo: '05',
        etapa: 'd15',
        segmento: 'servicos',
        variacao: 1,
        texto: 'Oi, {nome}. Já faz um tempo que o valor de {valor}, do dia {data}, está em aberto.\nServiço: {servico}\nQueria resolver isso com você numa conversa rápida. Dá para combinar outra data ou dividir em partes.\nSe der para acertar agora, segue a chave Pix: {pix}\n\n{assinatura}\n{negocio}',
    },
    {
        processo: '05',
        etapa: 'd15',
        segmento: 'servicos',
        variacao: 2,
        texto: 'Oi, {nome}, tudo bem? Vamos achar juntos um jeito de resolver o valor de {valor}, que venceu no dia {data}?\nServiço: {servico}\nPode ser numa conversa rápida, quando for melhor para você. A gente combina uma data nova ou divide em partes.\nChave Pix: {pix}\n\n{assinatura}\n{negocio}',
    },
];
