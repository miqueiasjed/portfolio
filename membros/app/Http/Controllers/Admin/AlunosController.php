<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Purchase;
use App\Models\User;
use App\Services\Acesso;
use App\Services\Progresso;
use App\Support\Formato;
use Illuminate\Http\Request;
use Inertia\Inertia;

class AlunosController extends Controller
{
    public function index(Request $request)
    {
        $busca = trim((string) $request->query('busca', ''));

        $alunos = User::where('is_admin', false)
            ->when($busca !== '', fn ($q) => $q->where(fn ($q) => $q
                ->where('email', 'like', '%'.$busca.'%')
                ->orWhere('name', 'like', '%'.$busca.'%')))
            ->with(['purchases' => fn ($q) => $q->where('status', Purchase::PAGA)->with('product:id,nome,slug')])
            ->latest()->latest('id')
            ->paginate(25)
            ->withQueryString()
            ->through(fn (User $u) => [
                'id' => $u->id,
                'nome' => $u->name,
                'email' => $u->email,
                'produtos' => $u->purchases->pluck('product.nome')->filter()->unique()->sort()->values(),
                'total_pago' => (int) $u->purchases->sum('valor_centavos'),
                'ultimo_acesso' => Formato::data($u->last_login_at),
                'cadastrado_em' => Formato::data($u->created_at),
            ]);

        return Inertia::render('Admin/Alunos', [
            'alunos' => $alunos,
            'filtros' => ['busca' => $busca],
        ]);
    }

    public function show(User $user, Progresso $progresso)
    {
        abort_if($user->is_admin, 404);

        $compras = Purchase::with(['product', 'user:id,name,email'])
            ->where(fn ($q) => $q->where('user_id', $user->id)->orWhere('email', $user->email))
            ->latest()->latest('id')
            ->get();

        $pagas = $compras->filter(fn ($c) => $c->estaPaga() && $c->user_id === $user->id);

        $acessos = $pagas->map(fn ($c) => [
            'compra_id' => $c->id,
            'produto' => ['slug' => $c->product->slug, 'nome' => $c->product->nome],
            'desde' => Formato::data($c->paid_at ?? $c->created_at),
            'origem' => $c->origem,
            'valor' => (int) $c->valor_centavos,
            'pode_reenviar' => true,
        ])->values();

        $cursos = $pagas->pluck('product')->unique('id')->sortBy('nome')->map(function ($produto) use ($user, $progresso) {
            $resumo = $progresso->resumo($user, $produto);

            return [
                'produto' => ['slug' => $produto->slug, 'nome' => $produto->nome],
                'total' => $resumo['total'] ?? 0,
                'concluidas' => $resumo['concluidas'] ?? 0,
                'percentual' => $resumo['percentual'] ?? 0,
                'ultima_concluida' => $resumo['ultima_concluida'] ?? null,
            ];
        })->values();

        return Inertia::render('Admin/Aluno', [
            'aluno' => [
                'id' => $user->id,
                'nome' => $user->name,
                'email' => $user->email,
                'email_verificado' => (bool) $user->email_verified_at,
                'ultimo_acesso' => Formato::data($user->last_login_at),
                'cadastrado_em' => Formato::data($user->created_at),
                'total_pago' => (int) $pagas->sum('valor_centavos'),
            ],
            'acessos' => $acessos,
            'progresso' => $cursos,
            'compras' => $compras->map->paraAdmin()->values(),
        ]);
    }

    public function update(Request $request, User $user)
    {
        abort_if($user->is_admin, 404);

        $dados = $request->validate([
            'nome' => ['nullable', 'string', 'max:255'],
        ]);

        $user->forceFill(['name' => trim((string) ($dados['nome'] ?? '')) ?: null])->save();

        return back()->with('aviso', 'Nome atualizado.');
    }

    public function enviarLink(User $user, Acesso $acesso)
    {
        abort_if($user->is_admin, 404);
        $acesso->enviarLink($user);

        return back()->with('aviso', 'Link de entrada enviado para '.$user->email.'.');
    }
}
