<?php

use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\TokenDoAparelho;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->web(append: [
            HandleInertiaRequests::class,
        ]);
        $middleware->alias([
            'aparelho' => TokenDoAparelho::class,
        ]);
        // O PagBank não manda token CSRF. As rotas da Rotina do Dia abaixo não
        // usam a sessão para autorizar nada (Bearer ou código por e-mail), e a
        // casca vem do cache do service worker com a meta csrf-token velha.
        $middleware->validateCsrfTokens(except: [
            'webhooks/pagbank',
            'rotina/uso',
            'rotina/codigo',
            'rotina/codigo/confirmar',
        ]);
        $middleware->redirectGuestsTo(fn () => route('entrar'));
        // atrás da Cloudflare
        $middleware->trustProxies(at: '*');
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Erros em rotina/* saem em JSON mesmo sem Accept (o fetch da ferramenta
        // não manda), menos rotina/entrar, que precisa redirecionar para /entrar.
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*')
                || $request->expectsJson()
                || ($request->is('rotina/*') && ! $request->is('rotina/entrar')),
        );
    })->create();
