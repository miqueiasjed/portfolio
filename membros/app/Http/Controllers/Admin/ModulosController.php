<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Module;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ModulosController extends Controller
{
    public function store(Request $request, Product $product)
    {
        $dados = $this->validar($request);

        $product->modules()->create([
            'titulo' => $dados['titulo'],
            'ordem' => (int) $product->modules()->max('ordem') + 1,
        ]);

        return back()->with('aviso', 'Módulo criado.');
    }

    public function update(Request $request, Module $module)
    {
        $module->update($this->validar($request));

        return back()->with('aviso', 'Módulo salvo.');
    }

    /** Exclui o módulo com as aulas dele (e os anexos). */
    public function destroy(Module $module)
    {
        DB::transaction(function () use ($module) {
            $module->lessons()->get()->each->apagarAnexo();
            $module->delete();
        });

        return back()->with('aviso', 'Módulo excluído.');
    }

    private function validar(Request $request): array
    {
        return $request->validate(
            ['titulo' => ['required', 'string', 'max:255']],
            ['titulo.required' => 'Informe o título do módulo.', 'titulo.max' => 'O título pode ter até 255 caracteres.'],
        );
    }
}
