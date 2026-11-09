<?php

return [
    // link que vai no e-mail da compra: mais longo, porque a pessoa pode abrir só depois
    'link_compra_minutos' => (int) env('MEMBROS_LINK_COMPRA_MINUTOS', 60 * 24 * 7),
    // link pedido em "entrar"
    'link_entrada_minutos' => (int) env('MEMBROS_LINK_ENTRADA_MINUTOS', 30),
    // de onde a página de vendas chama (para o botão "voltar")
    'site_url' => env('MEMBROS_SITE_URL', 'https://miqueias.ia.br'),
    'whatsapp_raio_x' => env('MEMBROS_WHATSAPP_RAIO_X', 'https://wa.me/5585994181234?text=Oi%2C%20Miqu%C3%A9ias!%20Quero%20meu%20Raio-X%20da%20Opera%C3%A7%C3%A3o.'),
];
