<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\Purchase;
use App\Services\PagBank;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Throwable;

class CompraController extends Controller
{
    /** O botão "Quero o kit" do site cai aqui: cria a compra e manda para o checkout do PagBank. */
    public function iniciar(Request $request, Product $product, PagBank $pagbank)
    {
        abort_unless($product->ativo, 404);

        $compra = Purchase::create([
            'product_id' => $product->id,
            'reference' => (string) Str::uuid(),
            'email' => $request->user()?->email,
            'valor_centavos' => $product->preco_centavos,
            'origem' => collect($request->only(['utm_source', 'utm_medium', 'utm_campaign', 'utm_content']))
                ->filter()->map(fn ($v, $k) => "$k=$v")->implode('&') ?: null,
        ]);

        try {
            [$checkoutId, $link] = $pagbank->criarCheckout($compra, $product);
        } catch (Throwable $e) {
            Log::error('pagbank: falha ao criar checkout', ['compra' => $compra->id, 'erro' => $e->getMessage()]);
            $compra->update(['status' => Purchase::CANCELADA]);

            return Inertia::render('Erro', [
                'titulo' => 'Não conseguimos abrir o pagamento agora.',
                'texto' => 'Tente de novo em alguns minutos. Se continuar, fale com a gente pelo WhatsApp.',
            ])->toResponse($request)->setStatusCode(502);
        }

        $compra->update(['pagbank_checkout_id' => $checkoutId]);

        return Inertia::location($link);
    }

    /** Volta do PagBank. O acesso é liberado pelo aviso do PagBank, não por esta página. */
    public function obrigado(Request $request)
    {
        $compra = Purchase::with('product')->where('reference', (string) $request->query('ref'))->first();

        return Inertia::render('Obrigado', [
            'paga' => (bool) $compra?->estaPaga(),
            'produto' => $compra?->product?->nome,
            // a página é pública: só nome, slug e situação, nada de e-mail, valor ou usuário
            'slug' => $compra?->product?->slug,
        ]);
    }
}
