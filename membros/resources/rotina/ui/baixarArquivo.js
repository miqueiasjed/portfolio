// Baixa um arquivo gerado no próprio navegador: Blob, link temporário com
// `download` e liberação do endereço depois. Nada passa pelo servidor.
// Usado pela cópia de segurança e pelo modelo de planilha.

// Safari no iPhone ainda lê o endereço logo depois do clique.
export const ESPERA_PARA_LIBERAR = 1000;

// O último argumento só existe para os testes trocarem o que o navegador entrega.
export function baixarArquivo(
    nome,
    texto,
    tipo,
    { documento = globalThis.document, enderecos = globalThis.URL, esperar = globalThis.setTimeout } = {},
) {
    const arquivo = new Blob([texto], { type: tipo });
    const endereco = enderecos.createObjectURL(arquivo);
    const link = documento.createElement('a');
    link.href = endereco;
    link.download = nome;
    documento.body.appendChild(link);
    try {
        link.click();
    } finally {
        link.remove();
        esperar(() => enderecos.revokeObjectURL(endereco), ESPERA_PARA_LIBERAR);
    }
}
