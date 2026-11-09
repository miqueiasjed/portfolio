<?php

use App\Http\Controllers\Admin\AlunosController;
use App\Http\Controllers\Admin\AulasController;
use App\Http\Controllers\Admin\ComprasController;
use App\Http\Controllers\Admin\CursosController;
use App\Http\Controllers\Admin\ModulosController;
use App\Http\Controllers\Admin\SessaoController;
use App\Http\Controllers\Admin\VisaoGeralController;
use App\Http\Controllers\AreaController;
use App\Http\Controllers\CompraController;
use App\Http\Controllers\EntrarController;
use App\Http\Controllers\PagBankWebhookController;
use App\Http\Middleware\SomenteAdmin;
use Illuminate\Support\Facades\Route;

// compra (o botão do site aponta para /comprar/{slug})
Route::get('/comprar/{product}', [CompraController::class, 'iniciar'])->name('comprar')->middleware('throttle:20,1');
Route::get('/obrigado', [CompraController::class, 'obrigado'])->name('obrigado');
Route::post('/webhooks/pagbank', PagBankWebhookController::class)->name('webhooks.pagbank');

// entrada por link mágico
Route::middleware('guest')->group(function () {
    Route::get('/entrar', [EntrarController::class, 'form'])->name('entrar');
    Route::post('/entrar', [EntrarController::class, 'enviar'])->middleware('throttle:5,1');
});
Route::get('/entrar/{token}', [EntrarController::class, 'consumir'])->name('entrar.token');
Route::post('/sair', [EntrarController::class, 'sair'])->middleware('auth')->name('sair');

// área do aluno
Route::middleware('auth')->group(function () {
    Route::get('/', [AreaController::class, 'index'])->name('area');
    Route::get('/produtos/{product}', [AreaController::class, 'produto'])->name('produto');
    Route::get('/produtos/{product}/download', [AreaController::class, 'download'])->name('produto.download');
    Route::get('/produtos/{product}/aulas/{lesson}', [AreaController::class, 'aula'])->name('aula');
    Route::post('/produtos/{product}/aulas/{lesson}/concluir', [AreaController::class, 'concluir'])->name('aula.concluir');
    Route::get('/produtos/{product}/aulas/{lesson}/anexo', [AreaController::class, 'anexo'])->name('aula.anexo');
});

// administração (e-mail e senha, só para is_admin)
Route::prefix('admin')->name('admin.')->group(function () {
    Route::get('/entrar', [SessaoController::class, 'form'])->name('entrar');
    Route::post('/entrar', [SessaoController::class, 'entrar'])->middleware('throttle:5,1');

    Route::middleware(SomenteAdmin::class)->group(function () {
        Route::get('/', VisaoGeralController::class)->name('painel');
        Route::post('/sair', [SessaoController::class, 'sair'])->name('sair');

        // compras e acessos
        Route::get('/compras', [ComprasController::class, 'index'])->name('compras.index');
        Route::get('/compras/exportar', [ComprasController::class, 'exportar'])->name('compras.exportar');
        Route::post('/liberar', [ComprasController::class, 'liberar'])->name('liberar');
        Route::post('/compras/{purchase}/reenviar', [ComprasController::class, 'reenviar'])->name('reenviar');
        Route::post('/compras/{purchase}/revogar', [ComprasController::class, 'revogar'])->name('revogar');

        // alunos
        Route::get('/alunos', [AlunosController::class, 'index'])->name('alunos.index');
        Route::get('/alunos/{user}', [AlunosController::class, 'show'])->name('alunos.show');
        Route::patch('/alunos/{user}', [AlunosController::class, 'update'])->name('alunos.update');
        Route::post('/alunos/{user}/link', [AlunosController::class, 'enviarLink'])->name('alunos.link');

        // cursos
        Route::get('/cursos', [CursosController::class, 'index'])->name('cursos.index');
        Route::get('/cursos/novo', [CursosController::class, 'create'])->name('cursos.create');
        Route::post('/cursos', [CursosController::class, 'store'])->name('cursos.store');
        Route::get('/cursos/{product}', [CursosController::class, 'edit'])->name('cursos.edit');
        Route::put('/cursos/{product}', [CursosController::class, 'update'])->name('cursos.update');
        Route::delete('/cursos/{product}', [CursosController::class, 'destroy'])->name('cursos.destroy');
        Route::get('/cursos/{product}/arquivo', [CursosController::class, 'baixarArquivo'])->name('cursos.arquivo.baixar');
        Route::post('/cursos/{product}/arquivo', [CursosController::class, 'enviarArquivo'])->name('cursos.arquivo');
        Route::delete('/cursos/{product}/arquivo', [CursosController::class, 'removerArquivo'])->name('cursos.arquivo.remover');
        Route::post('/cursos/{product}/ordem', [CursosController::class, 'ordenar'])->name('cursos.ordem');

        // módulos e aulas
        Route::post('/cursos/{product}/modulos', [ModulosController::class, 'store'])->name('modulos.store');
        Route::put('/modulos/{module}', [ModulosController::class, 'update'])->name('modulos.update');
        Route::delete('/modulos/{module}', [ModulosController::class, 'destroy'])->name('modulos.destroy');
        Route::post('/modulos/{module}/aulas', [AulasController::class, 'store'])->name('aulas.store');
        Route::put('/aulas/{lesson}', [AulasController::class, 'update'])->name('aulas.update');
        Route::delete('/aulas/{lesson}', [AulasController::class, 'destroy'])->name('aulas.destroy');
        Route::get('/aulas/{lesson}/anexo', [AulasController::class, 'anexo'])->name('aulas.anexo');
    });
});
