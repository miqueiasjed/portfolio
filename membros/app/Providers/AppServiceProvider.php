<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Symfony\Component\HttpFoundation\Response;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->limitesDaRotina();
    }

    /**
     * Limite da Rotina do Dia que o throttle por IP não cobre sozinho. Os
     * limites por e-mail ficam no RotinaController, sem header na resposta.
     */
    private function limitesDaRotina(): void
    {
        // O 401 do middleware aparelho sai antes do throttle por usuário. Este
        // limite conta só esses 401, por IP, e não pesa para quem tem token válido.
        RateLimiter::for('rotina-aparelho-falhas', fn (Request $request) => Limit::perMinute(120)
            ->by($request->ip())
            ->after(fn (Response $resposta) => $resposta->getStatusCode() === 401));
    }
}
