// Lógica pura do aviso de instalar: sem DOM, para testar em ambiente node.

// iPhone, iPad e iPod. O iPad recente se anuncia como Mac, então a pista é o toque.
export function ehAparelhoApple({ userAgent = '', platform = '', maxTouchPoints = 0 } = {}) {
    if (/iPhone|iPad|iPod/.test(userAgent)) return true;
    return platform === 'MacIntel' && maxTouchPoints > 1;
}

// Aberto pelo ícone da tela de início: `standalone` do Safari ou display-mode do navegador.
export function estaInstalado({ standalone = false, displayModeStandalone = false } = {}) {
    return Boolean(standalone) || Boolean(displayModeStandalone);
}

// O aviso aparece só em aparelho Apple, fora do app instalado e antes de dispensado.
export function deveAvisar({ apple, instalado, dispensado }) {
    return Boolean(apple) && !instalado && !dispensado;
}
