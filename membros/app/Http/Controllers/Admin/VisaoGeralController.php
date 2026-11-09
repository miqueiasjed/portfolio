<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Purchase;
use App\Support\Formato;
use Inertia\Inertia;

class VisaoGeralController extends Controller
{
    public function __invoke()
    {
        $pagas = Purchase::where('status', Purchase::PAGA);
        $hoje = now(Formato::FUSO)->startOfDay();
        $inicio = $hoje->copy()->subDays(29);

        // receita por dia no fuso de Fortaleza (agrupada em PHP para não depender do banco)
        $porDia = (clone $pagas)
            ->where('paid_at', '>=', $inicio->copy()->utc())
            ->get(['paid_at', 'valor_centavos'])
            ->groupBy(fn ($c) => $c->paid_at->copy()->timezone(Formato::FUSO)->format('Y-m-d'))
            ->map(fn ($grupo) => (int) $grupo->sum('valor_centavos'));

        $receita30 = collect(range(0, 29))->map(function ($i) use ($inicio, $porDia) {
            $dia = $inicio->copy()->addDays($i);

            return [
                'dia' => $dia->format('Y-m-d'),
                'rotulo' => $dia->format('d/m'),
                'centavos' => $porDia[$dia->format('Y-m-d')] ?? 0,
            ];
        });

        $porProduto = Product::orderBy('nome')
            ->withCount(['purchases as vendas' => fn ($q) => $q->where('status', Purchase::PAGA)->where('valor_centavos', '>', 0)])
            ->withSum(['purchases as centavos' => fn ($q) => $q->where('status', Purchase::PAGA)], 'valor_centavos')
            ->get()
            ->map(fn ($p) => [
                'slug' => $p->slug,
                'nome' => $p->nome,
                'vendas' => (int) $p->vendas,
                'centavos' => (int) $p->centavos,
            ]);

        $ultimas = Purchase::with(['product:id,nome,slug', 'user:id,name,email'])
            ->latest()->latest('id')->limit(8)->get()
            ->map->paraAdmin();

        return Inertia::render('Admin/VisaoGeral', [
            'numeros' => [
                'vendas' => (clone $pagas)->where('valor_centavos', '>', 0)->count(),
                'receita' => (int) (clone $pagas)->sum('valor_centavos'),
                'mes' => (int) (clone $pagas)->where('paid_at', '>=', now(Formato::FUSO)->startOfMonth()->utc())->sum('valor_centavos'),
                'alunos_ativos' => (clone $pagas)->whereNotNull('user_id')->distinct()->count('user_id'),
                'checkouts_abertos' => Purchase::where('status', Purchase::PENDENTE)->count(),
            ],
            'receita30' => $receita30,
            'porProduto' => $porProduto,
            'ultimas' => $ultimas,
        ]);
    }
}
