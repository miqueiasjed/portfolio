<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Purchase;
use App\Services\Acesso;
use App\Support\Formato;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Throwable;

class ComprasController extends Controller
{
    public function index(Request $request)
    {
        $filtros = $this->filtros($request);
        $consulta = $this->consulta($filtros);

        $resumo = [
            'quantidade' => (clone $consulta)->count(),
            'pagas_centavos' => (int) (clone $consulta)->where('status', Purchase::PAGA)->sum('valor_centavos'),
        ];

        $compras = $consulta
            ->with(['product:id,nome,slug', 'user:id,name,email'])
            ->latest()->latest('id')
            ->paginate(25)
            ->withQueryString()
            ->through(fn (Purchase $c) => $c->paraAdmin());

        return Inertia::render('Admin/Compras', [
            'compras' => $compras,
            'filtros' => $filtros,
            'resumo' => $resumo,
            'statusOpcoes' => collect(Purchase::ROTULOS)->map(fn ($rotulo, $valor) => ['valor' => $valor, 'rotulo' => $rotulo])->values(),
        ]);
    }

    /** CSV com os mesmos filtros da lista (separador ";" e BOM para abrir certo no Excel). */
    public function exportar(Request $request)
    {
        $consulta = $this->consulta($this->filtros($request))
            ->with(['product:id,nome,slug', 'user:id,name,email'])
            ->latest()->latest('id');

        $nome = 'compras-'.now(Formato::FUSO)->format('Y-m-d').'.csv';

        return response()->streamDownload(function () use ($consulta) {
            $saida = fopen('php://output', 'w');
            fwrite($saida, "\xEF\xBB\xBF");
            fputcsv($saida, ['Criada em', 'Paga em', 'E-mail', 'Nome', 'Produto', 'Status', 'Valor (R$)', 'Origem', 'Referência', 'Checkout PagBank', 'Pedido PagBank'], ';', escape: '');

            // texto vindo de fora (utm, e-mail) não pode virar fórmula na planilha
            $seguro = fn (?string $v) => preg_match('/^[=+\-@\t\r]/', (string) $v) ? "'".$v : (string) $v;

            foreach ($consulta->lazy(500) as $c) {
                fputcsv($saida, array_map($seguro, [
                    Formato::data($c->created_at),
                    Formato::data($c->paid_at) ?? '',
                    $c->email ?? '',
                    $c->user?->name ?? '',
                    $c->product?->nome ?? '',
                    $c->rotuloStatus(),
                    Formato::decimal((int) $c->valor_centavos),
                    $c->origem ?? '',
                    $c->reference,
                    $c->pagbank_checkout_id ?? '',
                    $c->pagbank_order_id ?? '',
                ]), ';', escape: '');
            }

            fclose($saida);
        }, $nome, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /** Libera um produto na mão (cortesia, suporte, pagamento fora do PagBank). */
    public function liberar(Request $request, Acesso $acesso)
    {
        $dados = $request->validate([
            'email' => ['required', 'email', 'max:255'],
            'produto' => ['required', 'exists:products,slug'],
        ], [
            'produto.required' => 'Escolha o produto.',
            'produto.exists' => 'Produto não encontrado.',
        ]);

        $email = mb_strtolower(trim($dados['email']));

        $compra = Purchase::create([
            'product_id' => Product::where('slug', $dados['produto'])->value('id'),
            'reference' => (string) Str::uuid(),
            'email' => $email,
            'valor_centavos' => 0,
            'origem' => 'manual',
        ]);

        $acesso->liberar($compra, $email);

        return back()->with('aviso', 'Acesso liberado e link enviado para '.$email.'.');
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

    /** Filtros saneados: valor inválido vira vazio em vez de erro. */
    private function filtros(Request $request): array
    {
        $data = function (?string $v): string {
            if (! $v || ! preg_match('/^\d{4}-\d{2}-\d{2}$/', $v)) {
                return '';
            }
            try {
                return Carbon::createFromFormat('!Y-m-d', $v, Formato::FUSO)->format('Y-m-d') === $v ? $v : '';
            } catch (Throwable) {
                return '';
            }
        };

        $status = (string) $request->query('status', '');
        $produto = trim((string) $request->query('produto', ''));

        return [
            'busca' => trim((string) $request->query('busca', '')),
            'status' => array_key_exists($status, Purchase::ROTULOS) ? $status : '',
            'produto' => $produto !== '' && Product::where('slug', $produto)->exists() ? $produto : '',
            'de' => $data($request->query('de')),
            'ate' => $data($request->query('ate')),
        ];
    }

    private function consulta(array $f): Builder
    {
        return Purchase::query()
            ->when($f['busca'] !== '', fn ($q) => $q->where(fn ($q) => $q
                ->where('email', 'like', '%'.$f['busca'].'%')
                ->orWhere('reference', 'like', '%'.$f['busca'].'%')))
            ->when($f['status'] !== '', fn ($q) => $q->where('status', $f['status']))
            ->when($f['produto'] !== '', fn ($q) => $q->whereHas('product', fn ($q) => $q->where('slug', $f['produto'])))
            ->when($f['de'] !== '', fn ($q) => $q->where('created_at', '>=', Carbon::createFromFormat('!Y-m-d', $f['de'], Formato::FUSO)->startOfDay()->utc()))
            ->when($f['ate'] !== '', fn ($q) => $q->where('created_at', '<=', Carbon::createFromFormat('!Y-m-d', $f['ate'], Formato::FUSO)->endOfDay()->utc()));
    }
}
