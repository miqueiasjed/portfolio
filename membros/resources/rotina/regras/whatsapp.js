// Telefone brasileiro e link do WhatsApp.
// A ferramenta nunca envia nada: só monta o link `wa.me` que o dono abre.
// O número guardado tem só dígitos e 55 na frente (ex. 5585999998888).

export const ERROS = {
    vazio: 'Digite o WhatsApp com DDD.',
    incompleto: 'Esse número parece incompleto. Use DDD e número, ex. (85) 99999-8888.',
    ddd: 'O DDD desse número não parece certo.',
    celular: 'Confira o número: celular com 11 dígitos começa com 9 depois do DDD.',
    numero: 'Esse número não parece certo. Confira o DDD e o número.',
};

function falha(erro) {
    return { ok: false, erro };
}

// Aceita as formas comuns de digitar um telefone e devolve `55` + DDD + número.
export function normalizarTelefone(entrada) {
    const texto = entrada === null || entrada === undefined ? '' : String(entrada);

    // 1. Só dígitos.
    let digitos = texto.replace(/\D/g, '');
    if (digitos === '') return falha(ERROS.vazio);

    // 2. Sem zeros à esquerda (prefixo de interurbano).
    digitos = digitos.replace(/^0+/, '');

    // 3. Código do país. Com 10 ou 11 dígitos o 55 é DDD e fica.
    if (digitos.startsWith('55') && (digitos.length === 12 || digitos.length === 13)) {
        digitos = digitos.slice(2);
    }

    // 4. DDD + número.
    if (digitos.length !== 10 && digitos.length !== 11) return falha(ERROS.incompleto);
    if (!/^[1-9]{2}$/.test(digitos.slice(0, 2))) return falha(ERROS.ddd);

    const ddd = digitos.slice(0, 2);
    const resto = digitos.slice(2);
    const primeiro = resto[0];

    // 5. Celular com 11 dígitos.
    if (digitos.length === 11) {
        if (primeiro !== '9') return falha(ERROS.celular);
        return { ok: true, numero: `55${ddd}${resto}` };
    }

    // 6. Dez dígitos: celular sem o 9 ou fixo.
    if ('6789'.includes(primeiro)) {
        return { ok: true, numero: `55${ddd}9${resto}` };
    }
    if ('2345'.includes(primeiro)) {
        return { ok: true, numero: `55${ddd}${resto}` };
    }
    return falha(ERROS.numero);
}

// Monta `https://wa.me/<numero>?text=<texto>`. Sem texto, o link vai sem `?text=`.
export function linkWhatsApp(telefone, texto) {
    const resultado = normalizarTelefone(telefone);
    if (!resultado.ok) return resultado;

    const base = `https://wa.me/${resultado.numero}`;
    const mensagem = texto === null || texto === undefined ? '' : String(texto);
    const link = mensagem === '' ? base : `${base}?text=${encodeURIComponent(mensagem)}`;
    return { ok: true, link };
}

// Só para exibir: `5585999998888` vira `(85) 99999-8888`.
// Entrada que não normaliza volta como veio.
export function formatarTelefone(numero) {
    const resultado = normalizarTelefone(numero);
    if (!resultado.ok) return numero;

    const local = resultado.numero.slice(2);
    const ddd = local.slice(0, 2);
    const resto = local.slice(2);
    const corte = resto.length - 4;
    return `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte)}`;
}
