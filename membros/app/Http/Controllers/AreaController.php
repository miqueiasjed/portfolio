<?php

namespace App\Http\Controllers;

use App\Models\Lesson;
use App\Models\LessonProgress;
use App\Models\Product;
use App\Models\Purchase;
use App\Services\Progresso;
use App\Support\Formato;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class AreaController extends Controller
{
    public function index(Request $request, Progresso $progresso)
    {
        $produtos = Product::whereHas('purchases', fn ($q) => $q
            ->where('user_id', $request->user()->id)
            ->where('status', Purchase::PAGA))
            ->orderBy('nome')
            ->get(['id', 'slug', 'nome', 'descricao'])
            ->map(fn (Product $p) => [
                'id' => $p->id,
                'slug' => $p->slug,
                'nome' => $p->nome,
                'descricao' => $p->descricao,
                'curso' => $this->semDetalhe($progresso->resumo($request->user(), $p)),
            ]);

        return Inertia::render('Area', [
            'produtos' => $produtos,
            'raioX' => config('membros.whatsapp_raio_x'),
        ]);
    }

    public function produto(Request $request, Product $product, Progresso $progresso)
    {
        $this->exigirCompra($request, $product);

        return Inertia::render('Produto', [
            'produto' => $product->only(['slug', 'nome', 'descricao', 'conteudo']),
            'temArquivo' => (bool) $product->arquivo_path,
            'curso' => $progresso->resumo($request->user(), $product, detalhado: true),
            'raioX' => config('membros.whatsapp_raio_x'),
        ]);
    }

    public function aula(Request $request, Product $product, Lesson $lesson, Progresso $progresso)
    {
        $this->exigirCompra($request, $product);
        $this->exigirAulaDoProduto($product, $lesson);

        $modulos = $progresso->modulosPublicados($product);
        $aulas = $modulos->flatMap->lessons->values();
        $posicao = $aulas->search(fn ($a) => $a->id === $lesson->id);
        $vizinha = fn ($a) => $a ? ['id' => $a->id, 'titulo' => $a->titulo] : null;

        $feita = LessonProgress::where('user_id', $request->user()->id)->where('lesson_id', $lesson->id)->first();

        return Inertia::render('Aula', [
            'produto' => ['slug' => $product->slug, 'nome' => $product->nome],
            'aula' => [
                'id' => $lesson->id,
                'titulo' => $lesson->titulo,
                'descricao' => $lesson->descricao,
                'video_url' => $lesson->video_url,
                'video_embed' => $lesson->videoEmbed(),
                'duracao_minutos' => $lesson->duracao_minutos,
                'concluida' => (bool) $feita,
                'concluida_em' => Formato::data($feita?->concluida_em),
                'tem_anexo' => (bool) $lesson->anexo_path,
                'anexo_nome' => $lesson->anexo_path ? ($lesson->anexo_nome ?: basename($lesson->anexo_path)) : null,
                'modulo' => ['id' => $lesson->module->id, 'titulo' => $lesson->module->titulo],
            ],
            'anterior' => $vizinha($posicao > 0 ? $aulas[$posicao - 1] : null),
            'proxima' => $vizinha($aulas[$posicao + 1] ?? null),
            'curso' => $progresso->resumo($request->user(), $product, detalhado: true, modulos: $modulos),
        ]);
    }

    /** Marca ou desmarca a aula como concluída. */
    public function concluir(Request $request, Product $product, Lesson $lesson)
    {
        $this->exigirCompra($request, $product);
        $this->exigirAulaDoProduto($product, $lesson);

        $chave = ['user_id' => $request->user()->id, 'lesson_id' => $lesson->id];

        // o player manda o estado desejado, então clique repetido não duplica nem desfaz;
        // sem o campo, alterna
        $concluir = $request->has('concluida')
            ? $request->boolean('concluida')
            : ! LessonProgress::where($chave)->exists();

        if ($concluir) {
            LessonProgress::firstOrCreate($chave, ['concluida_em' => now()]);
        } else {
            LessonProgress::where($chave)->delete();
        }

        return back();
    }

    public function anexo(Request $request, Product $product, Lesson $lesson)
    {
        $this->exigirCompra($request, $product);
        $this->exigirAulaDoProduto($product, $lesson);

        $disco = Storage::disk(Lesson::DISCO);
        abort_unless($lesson->anexo_path && $disco->exists($lesson->anexo_path), 404);

        return $disco->download($lesson->anexo_path, $lesson->anexo_nome ?: basename($lesson->anexo_path));
    }

    public function download(Request $request, Product $product)
    {
        $this->exigirCompra($request, $product);
        abort_unless($product->arquivo_path && $product->disco()->exists($product->arquivo_path), 404);

        return $product->disco()->download($product->arquivo_path, $product->arquivo_nome ?: basename($product->arquivo_path));
    }

    private function exigirCompra(Request $request, Product $product): void
    {
        $comprou = $product->purchases()
            ->where('user_id', $request->user()->id)
            ->where('status', Purchase::PAGA)
            ->exists();

        abort_unless($comprou, 403);
    }

    /** A aula precisa ser deste produto e estar publicada. */
    private function exigirAulaDoProduto(Product $product, Lesson $lesson): void
    {
        abort_unless($lesson->publicada && $lesson->module?->product_id === $product->id, 404);
    }

    private function semDetalhe(?array $resumo): ?array
    {
        return $resumo ? collect($resumo)->only(['total', 'concluidas', 'percentual', 'proxima'])->all() : null;
    }
}
