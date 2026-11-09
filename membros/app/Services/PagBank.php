<?php

namespace App\Services;

use App\Models\Product;
use App\Models\Purchase;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Cliente mínimo da API do PagBank (Checkout + consulta de pedido).
 * Docs: https://developer.pagbank.com.br/docs/checkout
 */
class PagBank
{
    public function baseUrl(): string
    {
        return config('services.pagbank.sandbox')
            ? 'https://sandbox.api.pagseguro.com'
            : 'https://api.pagseguro.com';
    }

    private function http()
    {
        $token = config('services.pagbank.token');

        if (! $token) {
            throw new RuntimeException('PAGBANK_TOKEN não configurado.');
        }

        return Http::withToken($token)
            ->acceptJson()
            ->timeout(20)
            ->baseUrl($this->baseUrl());
    }

    /**
     * Cria um checkout para a compra e devolve [id do checkout, link de pagamento].
     *
     * @return array{0: string, 1: string}
     */
    public function criarCheckout(Purchase $compra, Product $produto): array
    {
        $payload = [
            'reference_id' => $compra->reference,
            'expiration_date' => now()->addDay()->toIso8601String(),
            'items' => [[
                'reference_id' => $produto->slug,
                'name' => $produto->nome,
                'quantity' => 1,
                'unit_amount' => $produto->preco_centavos,
            ]],
            'payment_methods' => [
                ['type' => 'CREDIT_CARD'],
                ['type' => 'PIX'],
            ],
            'redirect_url' => route('obrigado', ['ref' => $compra->reference]),
            'notification_urls' => [route('webhooks.pagbank')],
            'payment_notification_urls' => [route('webhooks.pagbank')],
        ];

        if ($compra->email) {
            $payload['customer'] = ['email' => $compra->email];
        }

        $resposta = $this->http()->post('/checkouts', $payload)->throw()->json();

        $link = collect($resposta['links'] ?? [])->firstWhere('rel', 'PAY')['href'] ?? null;

        if (! $link) {
            throw new RuntimeException('PagBank não devolveu o link de pagamento.');
        }

        return [$resposta['id'], $link];
    }

    /** Consulta um pedido direto no PagBank (fonte da verdade do status). */
    public function pedido(string $orderId): array
    {
        return $this->http()->get('/orders/'.$orderId)->throw()->json();
    }

    /** Um pedido está pago quando alguma cobrança dele tem status PAID. */
    public static function pedidoPago(array $pedido): bool
    {
        return collect($pedido['charges'] ?? [])->contains(fn ($c) => ($c['status'] ?? null) === 'PAID');
    }

    /**
     * Confere a assinatura do aviso: sha256("{token}-{corpo}") no cabeçalho x-authenticity-token.
     * https://developer.pagbank.com.br/reference/webhooks-checkout
     */
    public static function assinaturaValida(?string $assinatura, string $corpo): bool
    {
        $token = (string) config('services.pagbank.token');

        return $assinatura !== null
            && hash_equals(hash('sha256', $token.'-'.$corpo), strtolower($assinatura));
    }
}
