<?php

use App\Models\Product;
use App\Models\Purchase;
use App\Models\User;
use App\Services\Acesso;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

// Libera um produto na mão (cortesia, pagamento fora do PagBank, suporte) e manda o link de acesso.
Artisan::command('membros:liberar {email} {produto=kit}', function (Acesso $acesso) {
    $produto = Product::where('slug', $this->argument('produto'))->firstOrFail();

    $compra = Purchase::create([
        'product_id' => $produto->id,
        'reference' => (string) Str::uuid(),
        'email' => $this->argument('email'),
        'valor_centavos' => 0,
        'origem' => 'manual',
    ]);

    $acesso->liberar($compra, $this->argument('email'));
    $this->info("Acesso a \"{$produto->nome}\" liberado para {$this->argument('email')}. Link enviado por e-mail.");
})->purpose('Libera um produto para um e-mail e envia o link de acesso');

// Tira o acesso (reembolso).
Artisan::command('membros:revogar {email} {produto=kit}', function () {
    $usuario = User::where('email', mb_strtolower($this->argument('email')))->firstOrFail();
    $produto = Product::where('slug', $this->argument('produto'))->firstOrFail();

    $n = Purchase::where('user_id', $usuario->id)->where('product_id', $produto->id)
        ->where('status', Purchase::PAGA)->update(['status' => Purchase::REEMBOLSADA]);

    $this->info("{$n} compra(s) marcada(s) como reembolsada(s).");
})->purpose('Remove o acesso de um e-mail a um produto (reembolso)');

// Lista as últimas compras.
Artisan::command('membros:compras {--limite=20}', function () {
    $this->table(['Data', 'E-mail', 'Produto', 'Status', 'Valor', 'Origem'],
        Purchase::with('product')->latest()->limit((int) $this->option('limite'))->get()
            ->map(fn ($c) => [
                $c->created_at->timezone('America/Fortaleza')->format('d/m H:i'),
                $c->email ?? '—', $c->product->slug, $c->status,
                number_format($c->valor_centavos / 100, 2, ',', '.'), $c->origem ?? '—',
            ]));
})->purpose('Lista as últimas compras');

// Cria ou atualiza o acesso de administrador. A senha chega já como hash (bcrypt),
// para nunca ficar em texto claro em log de servidor ou no repositório.
Artisan::command('membros:admin {email} {--hash= : hash bcrypt da senha}', function () {
    $hash = (string) $this->option('hash');

    if (! str_starts_with($hash, '$2y$')) {
        $this->error('Passe --hash com um hash bcrypt ($2y$...). Gere com: php -r "echo password_hash(\'SENHA\', PASSWORD_BCRYPT);"');

        return 1;
    }

    $usuario = User::firstOrNew(['email' => mb_strtolower($this->argument('email'))]);
    $usuario->forceFill(['is_admin' => true, 'email_verified_at' => now()])->save();
    // grava o hash direto, sem passar pelo cast "hashed"
    DB::table('users')->where('id', $usuario->id)->update(['password' => $hash]);

    $this->info("Administrador {$usuario->email} pronto.");
})->purpose('Cria ou atualiza um administrador da área de membros');
