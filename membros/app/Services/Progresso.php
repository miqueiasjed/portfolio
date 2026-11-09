<?php

namespace App\Services;

use App\Models\LessonProgress;
use App\Models\Product;
use App\Models\User;
use App\Support\Formato;
use Illuminate\Support\Collection;

/** Progresso de um aluno num curso. Só contam aulas publicadas, na ordem de módulo e aula. */
class Progresso
{
    /** Módulos com as aulas publicadas, na ordem do curso. Módulo sem aula publicada fica de fora. */
    public function modulosPublicados(Product $product): Collection
    {
        return $product->modules()
            ->with(['lessons' => fn ($q) => $q->where('publicada', true)])
            ->get()
            ->filter(fn ($m) => $m->lessons->isNotEmpty())
            ->values();
    }

    /**
     * Resumo do curso para o aluno, ou null quando o produto não tem aulas publicadas.
     * Com $detalhado, inclui os módulos e as aulas com a marca de concluída.
     */
    public function resumo(User $user, Product $product, bool $detalhado = false, ?Collection $modulos = null): ?array
    {
        $modulos ??= $this->modulosPublicados($product);
        $aulas = $modulos->flatMap->lessons->values();

        if ($aulas->isEmpty()) {
            return null;
        }

        $feitas = LessonProgress::where('user_id', $user->id)
            ->whereIn('lesson_id', $aulas->pluck('id'))
            ->pluck('concluida_em', 'lesson_id');

        $concluidas = $aulas->filter(fn ($a) => $feitas->has($a->id))->count();
        $proxima = $aulas->first(fn ($a) => ! $feitas->has($a->id));

        $ultimaId = $feitas->sortDesc()->keys()->first();
        $ultima = $ultimaId ? $aulas->firstWhere('id', $ultimaId) : null;

        $resumo = [
            'total' => $aulas->count(),
            'concluidas' => $concluidas,
            'percentual' => (int) floor($concluidas * 100 / $aulas->count()),
            'proxima' => $proxima ? ['id' => $proxima->id, 'titulo' => $proxima->titulo] : null,
            'ultima_concluida' => $ultima ? [
                'id' => $ultima->id,
                'titulo' => $ultima->titulo,
                'em' => Formato::data($feitas[$ultima->id]),
            ] : null,
        ];

        if ($detalhado) {
            $resumo['modulos'] = $modulos->map(fn ($m) => [
                'id' => $m->id,
                'titulo' => $m->titulo,
                'aulas' => $m->lessons->map(fn ($a) => [
                    'id' => $a->id,
                    'titulo' => $a->titulo,
                    'duracao_minutos' => $a->duracao_minutos,
                    'concluida' => $feitas->has($a->id),
                    'tem_anexo' => (bool) $a->anexo_path,
                ])->values(),
            ])->values();
        }

        return $resumo;
    }
}
