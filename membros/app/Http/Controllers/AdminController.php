<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\Purchase;
use App\Services\Acesso;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class AdminController extends Controller
{
    public function form()
    {
        return Inertia::render('Admin/Entrar');
    }

    public function entrar(Request $request)
    {
        $dados = $request->validate([
            'email' => ['required', 'email'],
            'senha' => ['required', 'string'],
        ]);

        $ok = Auth::attempt(
            ['email' => mb_strtolower(trim($dados['email'])), 'password' => $dados['senha'], 'is_admin' => true],
            remember: true,
        );

        if (! $ok) {
            throw ValidationException::withMessages(['email' => 'E-mail ou senha incorretos.']);
        }

        $request->session()->regenerate();

        return redirect()->intended(route('admin.painel'));
    }

    public function painel(Request $request)
    {
        $pagas = Purchase::where('status', Purchase::PAGA);

        $compras = Purchase::with('product:id,nome,slug')
            ->when($request->query('busca'), fn ($q, $b) => $q->where('email', 'like', '%'.$b.'%'))
            ->latest()
            ->limit(100)
            ->get()
            ->map(fn ($c) => [
                'id' => $c->id,
                'data' => $c->created_at->timezone('America/Fortaleza')->format('d/m/Y H:i'),
                'email' => $c->email,
                'produto' => $c->product->nome,
                'status' => $c->status,
                'valor' => $c->valor_centavos,
                'origem' => $c->origem,
            ]);

        return Inertia::render('Admin/Painel', [
            'resumo' => [
                'vendas' => (clone $pagas)->where('valor_centavos', '>', 0)->count(),
                'receita' => (clone $pagas)->sum('valor_centavos'),
                'mes' => (clone $pagas)->where('paid_at', '>=', now()->startOfMonth())->sum('valor_centavos'),
                'pendentes' => Purchase::where('status', Purchase::PENDENTE)->count(),
            ],
            'compras' => $compras,
            'produtos' => Product::orderBy('nome')->get(['slug', 'nome', 'preco_centavos', 'ativo']),
            'busca' => $request->query('busca', ''),
        ]);
    }

    /** Libera um produto na mão (cortesia, suporte, pagamento fora do PagBank). */
    public function liberar(Request $request, Acesso $acesso)
    {
        $dados = $request->validate([
            'email' => ['required', 'email'],
            'produto' => ['required', 'exists:products,slug'],
        ]);

        $compra = Purchase::create([
            'product_id' => Product::where('slug', $dados['produto'])->value('id'),
            'reference' => (string) Str::uuid(),
            'email' => $dados['email'],
            'valor_centavos' => 0,
            'origem' => 'manual',
        ]);

        $acesso->liberar($compra, $dados['email']);

        return back()->with('aviso', 'Acesso liberado e link enviado para '.$dados['email'].'.');
    }

    public function reenviar(Purchase $purchase, Acesso $acesso)
    {
        abort_unless($purchase->estaPaga() && $purchase->user, 422);
        $acesso->reenviarAcesso($purchase);

        return back()->with('aviso', 'Link de acesso reenviado para '.$purchase->email.'.');
    }

    /** Reembolso: tira o acesso daquela compra. */
    public function revogar(Purchase $purchase)
    {
        abort_unless($purchase->estaPaga(), 422);
        $purchase->update(['status' => Purchase::REEMBOLSADA]);

        return back()->with('aviso', 'Acesso removido de '.$purchase->email.'.');
    }

    public function sair(Request $request)
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('admin.entrar');
    }
}
