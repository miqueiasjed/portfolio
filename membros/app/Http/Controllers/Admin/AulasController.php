<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\AulaRequest;
use App\Models\Lesson;
use App\Models\Module;
use Illuminate\Support\Facades\Storage;

class AulasController extends Controller
{
    public function store(AulaRequest $request, Module $module)
    {
        $aula = $module->lessons()->create([
            ...$this->campos($request),
            'ordem' => (int) $module->lessons()->max('ordem') + 1,
        ]);

        $this->guardarAnexo($request, $aula);

        return back()->with('aviso', 'Aula criada.');
    }

    /** Aceita multipart: com arquivo, mande POST com _method=PUT. */
    public function update(AulaRequest $request, Lesson $lesson)
    {
        $lesson->update($this->campos($request));

        if ($request->hasFile('anexo')) {
            $this->guardarAnexo($request, $lesson);
        } elseif ($request->boolean('remover_anexo') && $lesson->anexo_path) {
            $lesson->apagarAnexo();
            $lesson->update(['anexo_path' => null, 'anexo_nome' => null]);
        }

        return back()->with('aviso', 'Aula salva.');
    }

    public function destroy(Lesson $lesson)
    {
        $lesson->apagarAnexo();
        $lesson->delete();

        return back()->with('aviso', 'Aula excluída.');
    }

    public function anexo(Lesson $lesson)
    {
        abort_unless($lesson->anexo_path && Storage::disk(Lesson::DISCO)->exists($lesson->anexo_path), 404);

        return Storage::disk(Lesson::DISCO)->download($lesson->anexo_path, $lesson->anexo_nome ?: basename($lesson->anexo_path));
    }

    private function campos(AulaRequest $request): array
    {
        return collect($request->validated())
            ->only(['titulo', 'descricao', 'video_url', 'duracao_minutos', 'publicada'])
            ->all();
    }

    /** Salva o anexo com nome aleatório, guarda o nome original e apaga o anterior. */
    private function guardarAnexo(AulaRequest $request, Lesson $aula): void
    {
        if (! $request->hasFile('anexo')) {
            return;
        }

        $arquivo = $request->file('anexo');
        $caminho = $arquivo->store('cursos/'.$aula->module->product_id.'/aulas', Lesson::DISCO);

        $aula->apagarAnexo();
        $aula->update(['anexo_path' => $caminho, 'anexo_nome' => $arquivo->getClientOriginalName()]);
    }
}
