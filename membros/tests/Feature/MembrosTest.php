<?php

namespace Tests\Feature;

use App\Mail\AcessoLiberado;
use App\Mail\LinkDeEntrada;
use App\Models\LoginToken;
use App\Models\Product;
use App\Models\Purchase;
use App\Models\User;
use Database\Seeders\ProdutoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Tests\TestCase;

class MembrosTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(ProdutoSeeder::class);
        config(['services.pagbank.token' => 'tok', 'services.pagbank.sandbox' => true]);
        Mail::fake();
    }

    private function compraPendente(): Purchase
    {
        return Purchase::create([
            'product_id' => Product::first()->id,
            'reference' => (string) Str::uuid(),
            'valor_centavos' => 9700,
        ]);
    }

    private function fakePedido(Purchase $compra, string $status, string $email = 'Cliente@Exemplo.com'): void
    {
        Http::fake([
            'sandbox.api.pagseguro.com/orders/*' => Http::response([
                'id' => 'ORDE_1',
                'reference_id' => $compra->reference,
                'customer' => ['email' => $email, 'name' => 'Cliente'],
                'charges' => [['status' => $status]],
            ]),
        ]);
    }

    public function test_comprar_cria_checkout_e_redireciona_para_o_pagbank(): void
    {
        Http::fake(['sandbox.api.pagseguro.com/checkouts' => Http::response([
            'id' => 'CHEC_1',
            'links' => [['rel' => 'PAY', 'href' => 'https://pagamento.pagbank/abc']],
        ])]);

        $this->get('/comprar/kit?utm_source=instagram')->assertRedirect('https://pagamento.pagbank/abc');

        $compra = Purchase::first();
        $this->assertSame('CHEC_1', $compra->pagbank_checkout_id);
        $this->assertSame('utm_source=instagram', $compra->origem);
        Http::assertSent(fn ($r) => $r['items'][0]['unit_amount'] === 9700
            && $r['reference_id'] === $compra->reference
            && str_ends_with($r['notification_urls'][0], '/webhooks/pagbank'));
    }

    public function test_aviso_de_pagamento_libera_acesso_e_manda_email_uma_vez(): void
    {
        $compra = $this->compraPendente();
        $this->fakePedido($compra, 'PAID');

        $aviso = ['id' => 'ORDE_1', 'reference_id' => $compra->reference];
        $this->postJson('/webhooks/pagbank', $aviso)->assertNoContent();
        $this->postJson('/webhooks/pagbank', $aviso)->assertNoContent(); // reenvio

        $compra->refresh();
        $this->assertSame(Purchase::PAGA, $compra->status);
        $this->assertSame('cliente@exemplo.com', $compra->user->email);
        Mail::assertSent(AcessoLiberado::class, 1);
    }

    public function test_aviso_forjado_nao_libera_quando_pedido_nao_esta_pago(): void
    {
        $compra = $this->compraPendente();
        $this->fakePedido($compra, 'WAITING');

        $this->postJson('/webhooks/pagbank', ['id' => 'ORDE_1', 'reference_id' => $compra->reference, 'charges' => [['status' => 'PAID']]])
            ->assertNoContent();

        $this->assertSame(Purchase::PENDENTE, $compra->fresh()->status);
        Mail::assertNothingSent();
    }

    public function test_pedido_de_outra_compra_nao_libera(): void
    {
        $compra = $this->compraPendente();
        $outra = $this->compraPendente();
        $this->fakePedido($outra, 'PAID');

        $this->postJson('/webhooks/pagbank', ['id' => 'ORDE_1', 'reference_id' => $compra->reference]);

        $this->assertSame(Purchase::PENDENTE, $compra->fresh()->status);
    }

    public function test_link_magico_entra_uma_vez_so(): void
    {
        $user = User::create(['email' => 'a@b.com']);
        $token = LoginToken::emitir($user, 30);

        $this->get("/entrar/$token")->assertRedirect('/');
        $this->assertAuthenticatedAs($user);

        auth()->logout();
        $this->get("/entrar/$token")->assertOk();
        $this->assertGuest();
    }

    public function test_link_expirado_nao_entra(): void
    {
        $user = User::create(['email' => 'a@b.com']);
        $token = LoginToken::emitir($user, 30);
        $this->travel(31)->minutes();

        $this->get("/entrar/$token");
        $this->assertGuest();
    }

    public function test_pedir_link_so_envia_para_email_cadastrado_e_responde_igual(): void
    {
        User::create(['email' => 'a@b.com']);

        $this->post('/entrar', ['email' => 'A@b.com '])->assertRedirect();
        $this->post('/entrar', ['email' => 'ninguem@b.com'])->assertRedirect();

        Mail::assertSent(LinkDeEntrada::class, 1);
    }

    public function test_download_e_produto_so_para_quem_comprou(): void
    {
        $quemComprou = User::create(['email' => 'a@b.com']);
        $quemNao = User::create(['email' => 'c@d.com']);
        $compra = $this->compraPendente();
        $compra->update(['user_id' => $quemComprou->id, 'status' => Purchase::PAGA]);

        $this->get('/produtos/kit')->assertRedirect('/entrar');
        $this->actingAs($quemNao)->get('/produtos/kit')->assertForbidden();
        $this->actingAs($quemNao)->get('/produtos/kit/download')->assertForbidden();
        $this->actingAs($quemComprou)->get('/produtos/kit')->assertOk();
        $this->actingAs($quemComprou)->get('/produtos/kit/download')->assertOk()->assertDownload('Isso-nunca-deveria-ser-manual.pdf');
    }

    public function test_reembolso_tira_o_acesso(): void
    {
        $user = User::create(['email' => 'a@b.com']);
        $compra = $this->compraPendente();
        $compra->update(['user_id' => $user->id, 'status' => Purchase::PAGA]);

        $this->artisan('membros:revogar', ['email' => 'a@b.com'])->assertSuccessful();

        $this->actingAs($user)->get('/produtos/kit')->assertForbidden();
    }
}
