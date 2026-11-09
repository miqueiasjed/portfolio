<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\Purchase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class AreaController extends Controller
{
    public function index(Request $request)
    {
        $produtos = Product::whereHas('purchases', fn ($q) => $q
            ->where('user_id', $request->user()->id)
            ->where('status', Purchase::PAGA))
            ->orderBy('nome')
            ->get(['id', 'slug', 'nome', 'descricao']);

        return Inertia::render('Area', [
            'produtos' => $produtos,
            'raioX' => config('membros.whatsapp_raio_x'),
        ]);
    }

    public function produto(Request $request, Product $product)
    {
        $this->exigirCompra($request, $product);

        return Inertia::render('Produto', [
            'produto' => $product->only(['slug', 'nome', 'descricao', 'conteudo']),
            'temArquivo' => (bool) $product->arquivo_path,
            'raioX' => config('membros.whatsapp_raio_x'),
        ]);
    }

    public function download(Request $request, Product $product)
    {
        $this->exigirCompra($request, $product);
        abort_unless($product->arquivo_path && Storage::disk('produtos')->exists($product->arquivo_path), 404);

        return Storage::disk('produtos')->download($product->arquivo_path, $product->arquivo_nome);
    }

    private function exigirCompra(Request $request, Product $product): void
    {
        $comprou = $product->purchases()
            ->where('user_id', $request->user()->id)
            ->where('status', Purchase::PAGA)
            ->exists();

        abort_unless($comprou, 403);
    }
}
