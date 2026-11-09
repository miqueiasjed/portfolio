<?php

namespace Tests\Feature;

use App\Mail\CodigoDaRotina as EmailDoCodigo;
use App\Models\LoginToken;
use App\Models\Product;
use App\Models\Purchase;
use App\Models\RotinaAparelho;
use App\Models\User;
use Database\Seeders\ProdutoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Caminho inteiro do comprador da Rotina do Dia no servidor, só pelas rotas:
 * aviso do PagBank, link mágico, aparelho liberado, checagem, envio de uso,
 * números no admin, segundo aparelho pelo código do e-mail, reembolso e corte.
 */
class RotinaPontaAPontaTest extends TestCase
{
    use RefreshDatabase;

    private const EMAIL = 'cliente@exemplo.com';

    /** Hoje em Fortaleza: 09/11/2026, 15h (18h UTC). */
    private const HOJE = '2026-11-09';

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(ProdutoSeeder::class);
        config(['services.pagbank.token' => 'tok', 'services.pagbank.sandbox' => true]);
        Mail::fake();
        Carbon::setTestNow(Carbon::parse('2026-11-09 18:00:00', 'UTC'));
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function compraPendente(string $slug): Purchase
    {
        $produto = Product::where('slug', $slug)->firstOrFail();

        return Purchase::create([
            'product_id' => $produto->id,
            'reference' => (string) Str::uuid(),
            'valor_centavos' => $produto->preco_centavos,
        ]);
    }

    private function fakePedido(Purchase $compra, string $status): void
    {
        Http::fake([
            'sandbox.api.pagseguro.com/orders/*' => Http::response([
                'id' => 'ORDE_1',
                'reference_id' => $compra->reference,
                'customer' => ['email' => 'Cliente@Exemplo.com', 'name' => 'Cliente'],
                'charges' => [['status' => $status]],
            ]),
        ]);
    }

    /** Compra paga pelo aviso do PagBank; devolve a compra já atualizada. */
    private function comprarPeloPagBank(string $slug): Purchase
    {
        $compra = $this->compraPendente($slug);
        $this->fakePedido($compra, 'PAID');

        $this->postJson('/webhooks/pagbank', ['id' => 'ORDE_1', 'reference_id' => $compra->reference])
            ->assertNoContent();

        return $compra->refresh();
    }

    private function entrarPeloLink(User $user): void
    {
        $token = LoginToken::emitir($user, 30);
        $this->get("/entrar/$token")->assertRedirect();
        $this->assertAuthenticatedAs($user);
    }

    private function acesso(string $token): TestResponse
    {
        return $this->withToken($token)->getJson('/rotina/acesso');
    }

    private function uso(string $token, array $numeros): TestResponse
    {
        return $this->withToken($token)->postJson('/rotina/uso', ['dias' => [['dia' => self::HOJE, ...$numeros]]]);
    }

    public function test_compra_aparelho_uso_admin_reembolso_e_corte(): void
    {
        // 1 e 2: compra paga pelo aviso do PagBank, usuário criado pelo e-mail
        $compra = $this->comprarPeloPagBank(Product::ROTINA);
        $this->assertSame(Purchase::PAGA, $compra->status);
        $this->assertSame(14700, $compra->valor_centavos);
        $user = User::where('email', self::EMAIL)->firstOrFail();
        $this->assertTrue($compra->user->is($user));

        // 3: sessão pelo link mágico
        $this->entrarPeloLink($user);

        // 4: primeiro aparelho; no banco só o hash
        $resposta = $this->postJson('/rotina/aparelho')
            ->assertCreated()
            ->assertJson(['nome' => 'Cliente', 'email' => self::EMAIL]);
        $token = $resposta->json('token');
        $this->assertIsString($token);
        $aparelho = RotinaAparelho::where('user_id', $user->id)->sole();
        $this->assertSame(hash('sha256', $token), $aparelho->token_hash);
        $this->assertNotSame($token, $aparelho->token_hash);

        // 5: sem sessão daqui em diante, só o Bearer vale
        auth()->logout();
        $this->assertGuest();

        // 6: checagem online
        $this->assertNull($aparelho->ultimo_uso_em);
        $this->acesso($token)
            ->assertOk()
            ->assertExactJson(['nome' => 'Cliente', 'email' => self::EMAIL, 'liberado' => true]);
        $this->assertNotNull($aparelho->fresh()->ultimo_uso_em);

        // 7: uso do dia, só números; o reenvio do mesmo dia substitui
        $this->uso($token, ['enviados' => 4, 'respostas' => 2, 'resolvidos' => 1, 'por_processo' => ['01' => 3, '05' => 1]])
            ->assertNoContent();
        $this->uso($token, ['enviados' => 6, 'respostas' => 3, 'resolvidos' => 2, 'por_processo' => ['02' => 6]])
            ->assertNoContent();
        $this->assertDatabaseCount('rotina_uso', 1);
        $linha = DB::table('rotina_uso')->first();
        $this->assertSame($aparelho->id, (int) $linha->rotina_aparelho_id);
        $this->assertSame($user->id, (int) $linha->user_id);
        $this->assertSame(self::HOJE, (string) Str::of($linha->dia)->substr(0, 10));
        $this->assertSame([6, 3, 2], [(int) $linha->enviados, (int) $linha->respostas, (int) $linha->resolvidos]);
        $this->assertSame(['02' => 6], json_decode($linha->por_processo, true));

        // 7b: o admin vê na página da Rotina os números que chegaram por HTTP
        $admin = User::create(['email' => 'admin@x.com', 'password' => 'segredo-123']);
        $admin->forceFill(['is_admin' => true])->save();

        $pagina = $this->actingAs($admin)->get('/admin/rotina');
        $pagina->assertOk()->assertInertia(fn (Assert $p) => $p
            ->component('Admin/RotinaDoDia', false)
            ->where('compradores.total', 1)
            ->where('compradores.data.0.email', self::EMAIL)
            ->where('resumo.vendas', 1)
            ->where('resumo.com_primeiro_envio_24h', 1));
        $comprador = $pagina->inertiaProps()['compradores']['data'][0];
        $this->assertSame('Cliente', $comprador['nome']);
        $this->assertSame('09/11/2026', $comprador['primeiro_envio']);
        $this->assertTrue($comprador['primeiro_envio_24h']);
        $this->assertSame(6, $comprador['envios_semana1']);
        $this->assertSame(1, $comprador['dias_de_uso_semana1']);
        $this->assertSame(1, $comprador['aparelhos_ativos']);
        $this->assertSame('09/11/2026 15:00', $comprador['ultimo_uso']);
        $this->assertSame('09/11/2026 15:00', $comprador['comprado_em']);
        $this->assertFalse($comprador['cortesia']);
        auth()->logout();

        // 10 (antes do reembolso, porque o código só sai para compra paga):
        // segundo aparelho pelo código do e-mail, como no app instalado no iPhone
        $this->postJson('/rotina/codigo', ['email' => self::EMAIL])->assertNoContent();
        Mail::assertSent(EmailDoCodigo::class, fn ($email) => $email->hasTo(self::EMAIL));
        $codigo = Mail::sent(EmailDoCodigo::class)->last()->codigo;

        $segundo = $this->postJson('/rotina/codigo/confirmar', ['email' => self::EMAIL, 'codigo' => $codigo])
            ->assertCreated()
            ->assertJson(['nome' => 'Cliente', 'email' => self::EMAIL])
            ->json('token');
        $this->assertNotSame($token, $segundo);
        $this->assertSame(2, RotinaAparelho::where('user_id', $user->id)->count());
        $this->acesso($segundo)->assertOk()->assertJson(['liberado' => true]);

        // 8: reembolso pela rota do admin
        $this->actingAs($admin)->post("/admin/compras/{$compra->id}/revogar")->assertRedirect();
        $this->assertSame(Purchase::REEMBOLSADA, $compra->fresh()->status);
        auth()->logout();

        // 9: os dois aparelhos caem na próxima checagem e o uso deixa de entrar
        $corte = ['liberado' => false, 'motivo' => 'compra'];
        $this->acesso($token)->assertForbidden()->assertExactJson($corte);
        $this->acesso($segundo)->assertForbidden()->assertExactJson($corte);
        $this->uso($token, ['enviados' => 9, 'respostas' => 0, 'resolvidos' => 0, 'por_processo' => []])
            ->assertForbidden()
            ->assertExactJson($corte);
        $this->uso($segundo, ['enviados' => 9, 'respostas' => 0, 'resolvidos' => 0, 'por_processo' => []])
            ->assertForbidden();
        $this->assertSame(6, (int) DB::table('rotina_uso')->value('enviados'));
        $this->assertDatabaseCount('rotina_uso', 1);
    }

    public function test_bearer_desconhecido_recebe_401(): void
    {
        $falha = ['liberado' => false, 'motivo' => 'aparelho'];

        $this->acesso(Str::random(64))->assertUnauthorized()->assertExactJson($falha);
        $this->uso(Str::random(64), ['enviados' => 1, 'respostas' => 0, 'resolvidos' => 0, 'por_processo' => []])
            ->assertUnauthorized()
            ->assertExactJson($falha);
        $this->assertDatabaseCount('rotina_uso', 0);
    }

    public function test_quem_comprou_so_o_kit_nao_libera_aparelho(): void
    {
        $compra = $this->comprarPeloPagBank('kit');
        $this->assertSame(Purchase::PAGA, $compra->status);

        $this->entrarPeloLink($compra->user);

        $this->postJson('/rotina/aparelho')->assertForbidden();
        $this->assertDatabaseCount('rotina_aparelhos', 0);
    }
}
