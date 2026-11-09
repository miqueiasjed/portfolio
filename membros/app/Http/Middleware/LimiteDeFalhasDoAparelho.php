<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Contracts\Auth\Middleware\AuthenticatesRequests;
use Illuminate\Http\Request;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Symfony\Component\HttpFoundation\Response;

/**
 * Aplica o limiter rotina-aparelho-falhas (AppServiceProvider) antes do
 * middleware aparelho, para contar os 401 e 403 que ele devolve.
 *
 * Um throttle:rotina-aparelho-falhas direto na rota não serve: o Laravel
 * ordena todo ThrottleRequests depois de AuthenticatesRequests, e o aparelho
 * implementa esse contrato. Uma classe sem contrato também não: os
 * middlewares com prioridade sobem acima dela. Com o mesmo contrato do
 * aparelho, os dois ficam na mesma prioridade e a ordem declarada na rota vale.
 */
class LimiteDeFalhasDoAparelho implements AuthenticatesRequests
{
    public function __construct(private ThrottleRequests $throttle) {}

    public function handle(Request $request, Closure $next): Response
    {
        return $this->throttle->handle($request, $next, 'rotina-aparelho-falhas');
    }
}
