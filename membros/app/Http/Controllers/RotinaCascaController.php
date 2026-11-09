<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Contracts\View\View;

// Casca pública da ferramenta Rotina do Dia e o manifest instalável.
// Nenhuma das duas respostas carrega dado de usuário.
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
}
