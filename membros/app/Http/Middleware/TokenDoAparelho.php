<?php

namespace App\Http\Middleware;

use App\Models\Product;
use App\Models\RotinaAparelho;
use Closure;
use Illuminate\Contracts\Auth\Middleware\AuthenticatesRequests;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Rotas da ferramenta Rotina do Dia que usam o token do aparelho
 * (Authorization: Bearer). Responde sempre em JSON, com ou sem Accept.
 *
 * O contrato AuthenticatesRequests põe este middleware no lugar do auth na
 * ordem de prioridade do Laravel. Sem ele, o throttle da rota roda antes e o
 * limite passa a contar por IP em vez de por usuário.
 */
class TokenDoAparelho implements AuthenticatesRequests
{
    public function handle(Request $request, Closure $next): Response
    {
        // A busca é pelo hash do token; o valor puro não é guardado nem registrado.
        $aparelho = RotinaAparelho::porToken($request->bearerToken());
        $dono = $aparelho?->user;

        if (! $dono) {
            return response()->json(['liberado' => false, 'motivo' => 'aparelho'], 401);
        }

        // Intencional: revogar a compra não apaga os tokens. Se a compra for
        // liberada de novo, os aparelhos antigos voltam a entrar.
        $produto = Product::where('slug', Product::ROTINA)->first();

        if (! $produto || ! $produto->compradoPor($dono)) {
            return response()->json(['liberado' => false, 'motivo' => 'compra'], 403);
        }

        // Só nesta request; nada é gravado na sessão.
        Auth::setUser($dono);
        $request->attributes->set('aparelho', $aparelho);

        return $next($request);
    }
}
