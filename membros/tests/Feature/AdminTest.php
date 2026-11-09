<?php

namespace Tests\Feature;

use App\Mail\AcessoLiberado;
use App\Models\Purchase;
use App\Models\User;
use Database\Seeders\ProdutoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class AdminTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(ProdutoSeeder::class);
        Mail::fake();
    }

    private function admin(): User
    {
        $this->artisan('membros:admin', ['email' => 'admin@x.com', '--hash' => password_hash('segredo-123', PASSWORD_BCRYPT)])
            ->assertSuccessful();

        return User::where('email', 'admin@x.com')->first();
    }

    public function test_admin_entra_com_email_e_senha(): void
    {
        $this->admin();

        $this->post('/admin/entrar', ['email' => 'admin@x.com', 'senha' => 'errada'])->assertSessionHasErrors('email');
        $this->assertGuest();

        $this->post('/admin/entrar', ['email' => 'Admin@x.com', 'senha' => 'segredo-123'])->assertRedirect('/admin');
        $this->get('/admin')->assertOk();
    }

    public function test_cliente_nao_entra_no_admin(): void
    {
        $cliente = User::create(['email' => 'c@d.com', 'password' => 'segredo-123']);

        $this->post('/admin/entrar', ['email' => 'c@d.com', 'senha' => 'segredo-123'])->assertSessionHasErrors('email');
        $this->actingAs($cliente)->get('/admin')->assertForbidden();
        auth()->logout();
        $this->get('/admin')->assertRedirect('/admin/entrar');
    }

    public function test_admin_libera_e_revoga_acesso(): void
    {
        $this->actingAs($this->admin());

        $this->post('/admin/liberar', ['email' => 'novo@cliente.com', 'produto' => 'kit'])->assertRedirect();
        $compra = Purchase::where('email', 'novo@cliente.com')->first();
        $this->assertTrue($compra->estaPaga());
        Mail::assertSent(AcessoLiberado::class);

        $this->post("/admin/compras/{$compra->id}/revogar")->assertRedirect();
        $this->assertSame(Purchase::REEMBOLSADA, $compra->fresh()->status);
    }

    public function test_comando_recusa_senha_em_texto_claro(): void
    {
        $this->artisan('membros:admin', ['email' => 'a@b.com', '--hash' => 'senha-em-claro'])->assertFailed();
        $this->assertDatabaseMissing('users', ['email' => 'a@b.com']);
    }
}
