<?php

namespace App\Http\Controllers;

use App\Models\Purchase;
use App\Services\Acesso;
use App\Services\PagBank;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Recebe os avisos do PagBank. O aviso só serve de gatilho: o status é sempre
 * reconsultado na API do PagBank antes de liberar qualquer acesso, então um
 * aviso forjado não libera nada.
 */
class PagBankWebhookController extends Controller
{
    public function __invoke(Request $request, PagBank $pagbank, Acesso $acesso)
    {
        $corpo = $request->getContent();
        $dados = json_decode($corpo, true) ?: [];

        if (! PagBank::assinaturaValida($request->header('x-authenticity-token'), $corpo)) {
            Log::warning('pagbank: aviso sem assinatura válida, segue para reconsulta', ['id' => $dados['id'] ?? null]);
        }

        $compra = Purchase::where('reference', $dados['reference_id'] ?? '')->first();

        if (! $compra) {
            return response()->noContent(); // aviso de algo que não é desta área
        }

        $orderId = $this->orderId($dados);

        // aviso só de checkout (ex.: EXPIRED), sem pedido
        if (! $orderId) {
            if (($dados['status'] ?? null) === 'EXPIRED' && $compra->status === Purchase::PENDENTE) {
                $compra->update(['status' => Purchase::CANCELADA]);
            }

            return response()->noContent();
        }

        try {
            $pedido = $pagbank->pedido($orderId);
        } catch (Throwable $e) {
            Log::error('pagbank: falha ao consultar pedido', ['order' => $orderId, 'erro' => $e->getMessage()]);

            return response('erro ao consultar', 500); // o PagBank reenvia
        }

        if (($pedido['reference_id'] ?? null) !== $compra->reference) {
            Log::warning('pagbank: pedido não bate com a compra', ['order' => $orderId, 'compra' => $compra->id]);

            return response()->noContent();
        }

        $compra->update(['pagbank_order_id' => $orderId]);

        if (! PagBank::pedidoPago($pedido)) {
            return response()->noContent();
        }

        $email = $pedido['customer']['email'] ?? $compra->email;

        if (! $email) {
            Log::error('pagbank: pedido pago sem e-mail', ['order' => $orderId]);

            return response()->noContent();
        }

        $acesso->liberar($compra, $email, $pedido['customer']['name'] ?? null);

        return response()->noContent();
    }

    /** O aviso de pagamento traz o pedido (ORDE_...); o de checkout traz os pedidos dentro dele. */
    private function orderId(array $dados): ?string
    {
        $id = $dados['id'] ?? null;

        if (is_string($id) && str_starts_with($id, 'ORDE_')) {
            return $id;
        }

        return $dados['orders'][0]['id'] ?? null;
    }
}
