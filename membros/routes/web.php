<?php

use App\Http\Controllers\AdminController;
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
});

// administração (e-mail e senha, só para is_admin)
Route::prefix('admin')->name('admin.')->group(function () {
    Route::get('/entrar', [AdminController::class, 'form'])->name('entrar');
    Route::post('/entrar', [AdminController::class, 'entrar'])->middleware('throttle:5,1');

    Route::middleware(SomenteAdmin::class)->group(function () {
        Route::get('/', [AdminController::class, 'painel'])->name('painel');
        Route::post('/liberar', [AdminController::class, 'liberar'])->name('liberar');
        Route::post('/compras/{purchase}/reenviar', [AdminController::class, 'reenviar'])->name('reenviar');
        Route::post('/compras/{purchase}/revogar', [AdminController::class, 'revogar'])->name('revogar');
        Route::post('/sair', [AdminController::class, 'sair'])->name('sair');
    });
});
