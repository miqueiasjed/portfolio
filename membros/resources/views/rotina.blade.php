<!doctype html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <meta name="theme-color" content="#1C1D20">
    <meta name="robots" content="noindex,nofollow">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-title" content="Rotina do Dia">
    <link rel="manifest" href="/rotina/manifest.webmanifest">
    <link rel="apple-touch-icon" href="/icones/rotina-180.png">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;500&display=swap" rel="stylesheet">
    @viteReactRefresh
    @vite(['resources/rotina/rotina.css', 'resources/rotina/main.jsx'])
    <title>Rotina do Dia</title>
</head>
<body>
    <div id="rotina"></div>
    <noscript><p style="padding:24px;font-family:sans-serif">Ative o JavaScript do navegador para usar a Rotina do Dia.</p></noscript>
</body>
</html>
