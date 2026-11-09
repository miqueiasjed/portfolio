<?php

namespace Tests\Feature;

use App\Models\LoginToken;
use App\Models\Product;
use App\Models\Purchase;
use App\Models\RotinaAparelho;
use App\Models\User;
use Database\Seeders\ProdutoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class RotinaAcessoTest extends TestCase
{
    use RefreshDatabase;

    private const SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

    private Product $rotina;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(ProdutoSeeder::class);
        $this->rotina = Product::where('slug', Product::ROTINA)->firstOrFail();
    }

    private function aluno(string $email = 'a@b.com', ?string $nome = 'Ana', ?string $status = Purchase::PAGA): User
    {
        $user = User::create(['email' => $email, 'name' => $nome]);

        if ($status) {
            Purchase::create([
                'product_id' => $this->rotina->id, 'reference' => (string) Str::uuid(),
                'valor_centavos' => $this->rotina->preco_centavos, 'email' => $email,
                'user_id' => $user->id, 'status' => $status,
                'paid_at' => $status === Purchase::PAGA ? now() : null,
            ]);
        }

        return $user;
    }

    /** Libera um aparelho pela rota real e devolve o token puro. */
    private function liberar(User $user): string
    {
        $puro = $this->actingAs($user)
            ->withHeader('User-Agent', self::SAFARI)
            ->postJson('/rotina/aparelho')
            ->assertCreated()
            ->json('token');

        // a próxima request começa sem sessão, como o app instalado
        auth()->logout();
        $this->app['auth']->forgetGuards();

        return $puro;
    }

    public function test_entrar_sem_sessao_passa_pelo_link_magico_e_volta_para_a_ferramenta(): void
    {
        $user = $this->aluno();

        $this->get('/rotina/entrar')->assertRedirect(route('entrar'));

        $token = LoginToken::emitir($user, 30);
        $this->get("/entrar/$token")->assertRedirect('/rotina/entrar');
        $this->assertAuthenticatedAs($user);

        $this->get('/rotina/entrar')->assertRedirect('/rotina');
    }

    public function test_entrar_com_sessao_redireciona_para_a_ferramenta(): void
    {
        $this->actingAs($this->aluno())->get('/rotina/entrar')->assertRedirect('/rotina');
    }

    public function test_aparelho_sem_sessao_401(): void
    {
        $this->postJson('/rotina/aparelho')->assertUnauthorized();
        $this->assertSame(0, RotinaAparelho::count());
    }

    public function test_aparelho_sem_compra_403(): void
    {
        $user = $this->aluno(status: null);

        $this->actingAs($user)->postJson('/rotina/aparelho')->assertForbidden();
        $this->assertSame(0, RotinaAparelho::count());
    }

    public function test_aparelho_com_compra_pendente_403(): void
    {
        $this->actingAs($this->aluno(status: Purchase::PENDENTE))->postJson('/rotina/aparelho')->assertForbidden();
    }

    public function test_aparelho_por_post_comum_sem_compra_responde_403_em_json(): void
    {
        $this->actingAs($this->aluno(status: null))->post('/rotina/aparelho')
            ->assertForbidden()
            ->assertHeader('Content-Type', 'application/json');
    }

    public function test_aparelho_com_compra_paga_201_e_guarda_so_o_hash(): void
    {
        $user = $this->aluno();

        $resposta = $this->actingAs($user)
            ->withHeader('User-Agent', self::SAFARI)
            ->postJson('/rotina/aparelho')
            ->assertCreated()
            ->assertJson(['nome' => 'Ana', 'email' => 'a@b.com']);

        $puro = $resposta->json('token');
        $this->assertSame(64, strlen($puro));
        $this->assertEqualsCanonicalizing(['token', 'nome', 'email'], array_keys($resposta->json()));

        $aparelho = RotinaAparelho::sole();
        $this->assertSame($user->id, $aparelho->user_id);
        $this->assertSame(hash('sha256', $puro), $aparelho->token_hash);
        $this->assertSame('iPhone, Safari', $aparelho->nome);
        $this->assertNull($aparelho->ultimo_uso_em);

        // o valor puro não fica em coluna nenhuma
        $linha = json_encode(RotinaAparelho::query()->toBase()->first());
        $this->assertStringNotContainsString($puro, $linha);
    }

    public function test_acesso_com_o_token_devolvido_200_e_marca_o_uso(): void
    {
        $this->freezeSecond();
        $puro = $this->liberar($this->aluno());

        $resposta = $this->withToken($puro)->getJson('/rotina/acesso')
            ->assertOk()
            ->assertExactJson(['nome' => 'Ana', 'email' => 'a@b.com', 'liberado' => true]);

        $this->assertStringNotContainsString($puro, $resposta->getContent());
        $this->assertEquals(now(), RotinaAparelho::sole()->ultimo_uso_em);
    }

    public function test_acesso_sem_accept_tambem_responde_json(): void
    {
        $puro = $this->liberar($this->aluno());

        $this->withToken($puro)->get('/rotina/acesso')
            ->assertOk()
            ->assertHeader('Content-Type', 'application/json')
            ->assertJson(['liberado' => true]);
    }

    public function test_usuario_sem_nome_recebe_nome_null(): void
    {
        $user = $this->aluno(nome: null);

        $this->actingAs($user)->postJson('/rotina/aparelho')
            ->assertCreated()
            ->assertJson(['nome' => null, 'email' => 'a@b.com']);

        auth()->logout();
        $this->app['auth']->forgetGuards();
        $puro = RotinaAparelho::emitir($user, null)[1];

        $this->withToken($puro)->getJson('/rotina/acesso')
            ->assertOk()
            ->assertExactJson(['nome' => null, 'email' => 'a@b.com', 'liberado' => true]);
    }

    public function test_acesso_com_aparelho_revogado_401(): void
    {
        $puro = $this->liberar($this->aluno());
        RotinaAparelho::query()->update(['revogado_em' => now()]);

        $this->withToken($puro)->getJson('/rotina/acesso')
            ->assertUnauthorized()
            ->assertExactJson(['liberado' => false, 'motivo' => 'aparelho']);
    }

    public function test_acesso_depois_do_reembolso_403(): void
    {
        $puro = $this->liberar($this->aluno());
        $this->withToken($puro)->getJson('/rotina/acesso')->assertOk();

        Purchase::query()->update(['status' => Purchase::REEMBOLSADA]);

        $resposta = $this->withToken($puro)->getJson('/rotina/acesso')
            ->assertForbidden()
            ->assertExactJson(['liberado' => false, 'motivo' => 'compra']);
        $this->assertStringNotContainsString($puro, $resposta->getContent());
    }

    public function test_acesso_sem_token_401(): void
    {
        $this->getJson('/rotina/acesso')->assertUnauthorized();
    }

    public function test_limite_do_acesso_conta_por_usuario_e_nao_por_ip(): void
    {
        $userAna = $this->aluno('ana@b.com');
        $ana = $this->liberar($userAna);
        $bia = $this->liberar($this->aluno('bia@b.com', 'Bia'));

        // as duas requests saem do mesmo IP; só a Ana estoura o limite
        for ($i = 0; $i < 60; $i++) {
            $this->withToken($ana)->getJson('/rotina/acesso')->assertOk();
        }
        $this->withToken($ana)->getJson('/rotina/acesso')->assertTooManyRequests();

        $this->withToken($bia)->getJson('/rotina/acesso')
            ->assertOk()
            ->assertJson(['email' => 'bia@b.com']);

        // cada rota tem o próprio contador: o acesso não gasta o limite do aparelho
        $this->app['auth']->forgetGuards();
        $this->withoutToken()->actingAs($userAna)->postJson('/rotina/aparelho')->assertCreated();
    }
}
