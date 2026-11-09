<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\MedicaoRotina;
use Inertia\Inertia;

class RotinaDoDiaController extends Controller
{
    /** Metas da pré-venda (briefing, seção 6): seguir com 10 vendas, ou 6 com 3 dias de uso na semana 1; parar abaixo de 5. */
    private const METAS = ['vendas' => 10, 'vendas_com_uso' => 6, 'usos_semana1' => 3, 'minimo_vendas' => 5];

    public function __invoke(MedicaoRotina $medicao)
    {
        return Inertia::render('Admin/RotinaDoDia', [
            'resumo' => $medicao->resumo(),
            'compradores' => $medicao->compradores(),
            'semPrimeiroEnvio' => $medicao->semPrimeiroEnvio(),
            'metas' => self::METAS,
        ]);
    }
}
