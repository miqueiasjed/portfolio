<?php

namespace App\Http\Controllers;

use Illuminate\Contracts\View\View;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;

// Casca pública da ferramenta Rotina do Dia, o manifest instalável e o
// service worker. Nenhuma das três respostas carrega dado de usuário.
class RotinaCascaController extends Controller
{
    public function casca(): View
    {
        return view('rotina');
    }

    public function manifest(): JsonResponse
    {
        return response()->json([
            'name' => 'Rotina do Dia',
            'short_name' => 'Rotina do Dia',
            'lang' => 'pt-BR',
            'start_url' => '/rotina#/hoje',
            'scope' => '/rotina',
            'display' => 'standalone',
            'background_color' => '#F5F2EC',
            'theme_color' => '#1C1D20',
            'icons' => [
                ['src' => '/icones/rotina-192.png', 'sizes' => '192x192', 'type' => 'image/png', 'purpose' => 'any maskable'],
                ['src' => '/icones/rotina-512.png', 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'any maskable'],
            ],
        ], 200, ['Content-Type' => 'application/manifest+json'], JSON_UNESCAPED_SLASHES);
    }

    // Entradas do Vite que formam a ferramenta.
    private const ENTRADAS = [
        'resources/rotina/main.jsx',
        'resources/rotina/rotina.css',
    ];

    // Entradas da área de membros. A recursão nunca entra nelas, nem em
    // qualquer outra chave com isEntry que não esteja em ENTRADAS.
    private const ENTRADAS_DA_AREA = [
        'resources/js/app.jsx',
        'resources/css/app.css',
    ];

    public function sw(): Response
    {
        $arquivos = $this->arquivosDaRotina();

        if ($arquivos === null) {
            // Fora de local e testing, sem manifest não há SW: um SW com lista
            // vazia substituiria o bom durante um deploy. Com 503 o install
            // nem começa e o SW atual segue no aparelho.
            if (! app()->environment(['local', 'testing'])) {
                return response('Service worker indisponível.', 503, [
                    'Content-Type' => 'text/plain; charset=utf-8',
                    'Cache-Control' => 'no-store',
                ]);
            }

            $arquivos = [];
        }

        return response()->view('rotina-sw', [
            'arquivos' => $arquivos,
            // A versão sai só da lista da ferramenta: um deploy que muda apenas
            // a área de membros não gera aviso de versão nova aqui.
            'versao' => $arquivos === [] ? 'dev' : md5(json_encode($arquivos)),
        ], 200, [
            'Content-Type' => 'application/javascript; charset=utf-8',
            'Cache-Control' => 'no-cache',
            // O script mora em /rotina/sw.js, cujo escopo padrão é /rotina/ e
            // não cobre a página /rotina.
            'Service-Worker-Allowed' => '/rotina',
        ]);
    }

    // Arquivos do build usados pela ferramenta, com prefixo /build/ e sem
    // repetição. Devolve null quando não há manifest legível ou quando ele
    // não traz nenhum arquivo da ferramenta.
    private function arquivosDaRotina(): ?array
    {
        $caminho = public_path('build/manifest.json');

        if (! is_file($caminho)) {
            return null;
        }

        $manifest = json_decode((string) file_get_contents($caminho), true);

        if (! is_array($manifest)) {
            return null;
        }

        $arquivos = [];
        $visitados = [];

        foreach (self::ENTRADAS as $chave) {
            $this->juntar($manifest, $chave, $arquivos, $visitados);
        }

        return $arquivos === [] ? null : array_keys($arquivos);
    }

    // Junta file, css e assets da chave e, de forma recursiva, de cada import
    // estático e dinâmico, sem entrar nas entradas da área de membros. O array
    // associativo mantém a ordem e evita repetir.
    private function juntar(array $manifest, string $chave, array &$arquivos, array &$visitados): void
    {
        if (isset($visitados[$chave]) || ! isset($manifest[$chave]) || ! is_array($manifest[$chave])) {
            return;
        }

        $item = $manifest[$chave];

        if (! $this->podeEntrar($chave, $item)) {
            return;
        }

        $visitados[$chave] = true;

        $proprios = array_merge(
            isset($item['file']) ? [$item['file']] : [],
            $item['css'] ?? [],
            $item['assets'] ?? [],
        );

        foreach ($proprios as $arquivo) {
            if (is_string($arquivo) && $arquivo !== '') {
                $arquivos['/build/'.ltrim($arquivo, '/')] = true;
            }
        }

        foreach (array_merge($item['imports'] ?? [], $item['dynamicImports'] ?? []) as $importado) {
            if (is_string($importado)) {
                $this->juntar($manifest, $importado, $arquivos, $visitados);
            }
        }
    }

    // As duas entradas da ferramenta entram; as da área de membros e qualquer
    // outra entrada do build ficam de fora.
    private function podeEntrar(string $chave, array $item): bool
    {
        if (in_array($chave, self::ENTRADAS, true)) {
            return true;
        }

        if (in_array($chave, self::ENTRADAS_DA_AREA, true)) {
            return false;
        }

        return ($item['isEntry'] ?? false) !== true;
    }
}
