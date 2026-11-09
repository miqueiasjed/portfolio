<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\AulaRequest;
use App\Http\Requests\CursoRequest;
use App\Models\Lesson;
use App\Models\Module;
use App\Models\Product;
use App\Models\Purchase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class CursosController extends Controller
{
    public function index()
    {
        $alunos = Purchase::where('status', Purchase::PAGA)->whereNotNull('user_id')
            ->groupBy('product_id')
            ->selectRaw('product_id, count(distinct user_id) as total')
            ->pluck('total', 'product_id');

        $cursos = Product::orderBy('nome')
            ->withCount(['modules as modulos', 'lessons as aulas'])
            ->get()
            ->map(fn (Product $p) => [
                'id' => $p->id,
                'slug' => $p->slug,
                'nome' => $p->nome,
                'descricao' => $p->descricao,
                'preco_centavos' => (int) $p->preco_centavos,
                'ativo' => $p->ativo,
                'alunos' => (int) ($alunos[$p->id] ?? 0),
                'modulos' => (int) $p->modulos,
                'aulas' => (int) $p->aulas,
                'link_compra' => $p->linkDeCompra(),
            ]);

        return Inertia::render('Admin/Cursos', ['cursos' => $cursos]);
    }

    public function create()
    {
        return Inertia::render('Admin/Curso', [
            'produto' => null,
            'modulos' => [],
            'limiteUploadMb' => AulaRequest::LIMITE_KB / 1024,
        ]);
    }

    public function store(CursoRequest $request)
    {
        $produto = Product::create([...$request->validated(), 'arquivo_disco' => 'uploads']);

        return redirect()->route('admin.cursos.edit', $produto)->with('aviso', 'Curso criado. Agora monte os módulos e as aulas.');
    }

    public function edit(Product $product)
    {
        $product->loadCount('purchases');
        $modulos = $product->modules()->with('lessons')->get();

        return Inertia::render('Admin/Curso', [
            'produto' => [
                'id' => $product->id,
                'slug' => $product->slug,
                'nome' => $product->nome,
                'descricao' => $product->descricao,
                'preco_centavos' => (int) $product->preco_centavos,
                'ativo' => $product->ativo,
                'link_compra' => $product->linkDeCompra(),
                'tem_conteudo_blocos' => ! empty($product->conteudo),
                'arquivo' => $product->arquivo_path ? [
                    'nome' => $product->arquivo_nome ?: basename($product->arquivo_path),
                    'disco' => $product->arquivo_disco,
                    'url' => route('admin.cursos.arquivo.baixar', $product),
                ] : null,
                'compras' => (int) $product->purchases_count,
                'pode_excluir' => $product->purchases_count === 0,
            ],
            'modulos' => $modulos->map(fn (Module $m) => [
                'id' => $m->id,
                'titulo' => $m->titulo,
                'ordem' => $m->ordem,
                'aulas' => $m->lessons->map(fn (Lesson $a) => [
                    'id' => $a->id,
                    'titulo' => $a->titulo,
                    'descricao' => $a->descricao,
                    'video_url' => $a->video_url,
                    'video_embed' => $a->videoEmbed(),
                    'duracao_minutos' => $a->duracao_minutos,
                    'publicada' => $a->publicada,
                    'ordem' => $a->ordem,
                    'anexo' => $a->anexo_path ? [
                        'nome' => $a->anexo_nome ?: basename($a->anexo_path),
                        'url' => route('admin.aulas.anexo', $a),
                    ] : null,
                ])->values(),
            ])->values(),
            'limiteUploadMb' => AulaRequest::LIMITE_KB / 1024,
        ]);
    }

    public function update(CursoRequest $request, Product $product)
    {
        $product->update($request->validated());

        return redirect()->route('admin.cursos.edit', $product)->with('aviso', 'Curso salvo.');
    }

    public function destroy(Product $product)
    {
        if ($product->purchases()->exists()) {
            throw ValidationException::withMessages([
                'curso' => 'Este curso tem compras registradas e não pode ser excluído. Para tirar da venda, desmarque "Ativo".',
            ]);
        }

        DB::transaction(function () use ($product) {
            $product->lessons()->get()->each->apagarAnexo();
            $product->apagarArquivoEnviado();
            $product->delete();
        });

        return redirect()->route('admin.cursos.index')->with('aviso', 'Curso excluído.');
    }

    public function enviarArquivo(Request $request, Product $product)
    {
        $request->validate([
            'arquivo' => ['required', 'file', 'max:'.AulaRequest::LIMITE_KB],
        ], [
            'arquivo.required' => 'Escolha o arquivo.',
            'arquivo.max' => 'O arquivo pode ter até 50 MB.',
            'arquivo.uploaded' => 'O arquivo não chegou. Ele pode ter mais de 50 MB.',
        ]);

        $arquivo = $request->file('arquivo');
        $caminho = $arquivo->store("cursos/{$product->id}", 'uploads');

        $product->apagarArquivoEnviado();
        $product->update([
            'arquivo_path' => $caminho,
            'arquivo_nome' => $arquivo->getClientOriginalName(),
            'arquivo_disco' => 'uploads',
        ]);

        return back()->with('aviso', 'Arquivo enviado.');
    }

    public function removerArquivo(Product $product)
    {
        $product->apagarArquivoEnviado();
        $product->update(['arquivo_path' => null, 'arquivo_nome' => null, 'arquivo_disco' => 'uploads']);

        return back()->with('aviso', 'Arquivo removido.');
    }

    public function baixarArquivo(Product $product)
    {
        abort_unless($product->arquivo_path && $product->disco()->exists($product->arquivo_path), 404);

        return $product->disco()->download($product->arquivo_path, $product->arquivo_nome ?: basename($product->arquivo_path));
    }

    /** Recebe a ordem completa do curso: {modulos: [{id, aulas: [ids]}]}. */
    public function ordenar(Request $request, Product $product)
    {
        $dados = $request->validate([
            'modulos' => ['present', 'array'],
            'modulos.*.id' => ['required', 'integer'],
            'modulos.*.aulas' => ['present', 'array'],
            'modulos.*.aulas.*' => ['integer'],
        ]);

        $modulosEnviados = collect($dados['modulos'])->pluck('id')->map(fn ($id) => (int) $id);
        $aulasEnviadas = collect($dados['modulos'])->flatMap(fn ($m) => $m['aulas'])->map(fn ($id) => (int) $id);

        $modulosDoCurso = $product->modules()->pluck('id');
        $aulasDoCurso = $product->lessons()->pluck('lessons.id');

        $confere = fn ($enviados, $doCurso) => $enviados->count() === $enviados->unique()->count()
            && $enviados->sort()->values()->all() === $doCurso->map(fn ($id) => (int) $id)->sort()->values()->all();

        if (! $confere($modulosEnviados, $modulosDoCurso) || ! $confere($aulasEnviadas, $aulasDoCurso)) {
            throw ValidationException::withMessages([
                'ordem' => 'A ordem enviada não confere com o conteúdo do curso. Recarregue a página e tente de novo.',
            ]);
        }

        DB::transaction(function () use ($dados) {
            foreach (array_values($dados['modulos']) as $i => $m) {
                Module::whereKey($m['id'])->update(['ordem' => $i + 1]);

                foreach (array_values($m['aulas']) as $j => $aulaId) {
                    Lesson::whereKey($aulaId)->update(['module_id' => $m['id'], 'ordem' => $j + 1]);
                }
            }
        });

        return back()->with('aviso', 'Ordem salva.');
    }
}
