<?php

namespace Tests\Feature;

use App\Models\LoginToken;
use App\Models\Product;
use App\Models\Purchase;
use App\Models\RotinaAparelho;
use App\Models\User;
use Database\Seeders\ProdutoSeeder;
use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Tests\TestCase;

class TokenDoAparelhoTest extends TestCase
{
    use RefreshDatabase;

    private const ROTA = '/_teste/aparelho';

    private Product $rotina;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(ProdutoSeeder::class);
        $this->rotina = Product::where('slug', Product::ROTINA)->firstOrFail();

        // mesma pilha da produção: web antes de aparelho
        Route::middleware(['web', 'aparelho'])->get(self::ROTA, fn (Request $r) => [
            'id' => $r->user()->id,
            'aparelho' => $r->attributes->get('aparelho')->id,
        ]);
    }

    private function aluno(string $email = 'a@b.com', ?string $status = Purchase::PAGA, ?Product $produto = null): User
    {
        $user = User::create(['email' => $email]);

        if ($status) {
            $produto ??= $this->rotina;
            Purchase::create([
                'product_id' => $produto->id,
                'user_id' => $user->id,
                'email' => $email,
                'reference' => (string) Str::uuid(),
                'valor_centavos' => $produto->preco_centavos,
                'status' => $status,
                'paid_at' => $status === Purchase::PAGA ? now() : null,
            ]);
        }

        return $user;
    }

    private function token(User $user): string
    {
        return RotinaAparelho::emitir($user, null)[1];
    }

    public function test_sem_header_401(): void
    {
        $this->getJson(self::ROTA)
            ->assertStatus(401)
            ->assertExactJson(['liberado' => false, 'motivo' => 'aparelho']);
    }

    public function test_get_sem_accept_tambem_responde_json(): void
    {
        $this->get(self::ROTA)
            ->assertStatus(401)
            ->assertHeader('Content-Type', 'application/json')
            ->assertExactJson(['liberado' => false, 'motivo' => 'aparelho']);
    }

    public function test_token_desconhecido_401(): void
    {
        $this->token($this->aluno());

        $this->withToken('nao-existe')->getJson(self::ROTA)
            ->assertStatus(401)
            ->assertJson(['motivo' => 'aparelho']);
    }

    public function test_aparelho_revogado_401(): void
    {
        $puro = $this->token($this->aluno());
        RotinaAparelho::query()->update(['revogado_em' => now()]);

        $this->withToken($puro)->getJson(self::ROTA)
            ->assertStatus(401)
            ->assertJson(['motivo' => 'aparelho']);
    }

    public function test_compra_pendente_403(): void
    {
        $puro = $this->token($this->aluno(status: Purchase::PENDENTE));

        $this->withToken($puro)->getJson(self::ROTA)
            ->assertStatus(403)
            ->assertExactJson(['liberado' => false, 'motivo' => 'compra']);
    }

    public function test_compra_reembolsada_403(): void
    {
        $puro = $this->token($this->aluno(status: Purchase::REEMBOLSADA));

        $this->withToken($puro)->getJson(self::ROTA)
            ->assertStatus(403)
            ->assertJson(['motivo' => 'compra']);
    }

    public function test_compra_de_outro_produto_nao_libera(): void
    {
        $kit = Product::where('slug', 'kit')->firstOrFail();
        $puro = $this->token($this->aluno(produto: $kit));

        $this->withToken($puro)->getJson(self::ROTA)
            ->assertStatus(403)
            ->assertJson(['motivo' => 'compra']);
    }

    public function test_sem_o_produto_cadastrado_403(): void
    {
        $user = $this->aluno(status: null);
        $puro = $this->token($user);
        $this->rotina->delete();

        $this->withToken($puro)->getJson(self::ROTA)
            ->assertStatus(403)
            ->assertJson(['motivo' => 'compra']);
    }

    public function test_compra_paga_200_com_o_dono(): void
    {
        $user = $this->aluno();
        [$aparelho, $puro] = RotinaAparelho::emitir($user, null);

        $resposta = $this->withToken($puro)->get(self::ROTA)
            ->assertOk()
            ->assertExactJson(['id' => $user->id, 'aparelho' => $aparelho->id]);

        $this->assertStringNotContainsString($puro, $resposta->getContent());
        // o último uso é atualizado no acesso, não aqui
        $this->assertNull($aparelho->fresh()->ultimo_uso_em);
    }

    public function test_token_de_um_usuario_nunca_devolve_outro(): void
    {
        $ana = $this->aluno('ana@b.com');
        $bia = $this->aluno('bia@b.com');
        $puroAna = $this->token($ana);
        $puroBia = $this->token($bia);

        $this->withToken($puroAna)->getJson(self::ROTA)->assertOk()->assertJson(['id' => $ana->id]);
        $this->withToken($puroBia)->getJson(self::ROTA)->assertOk()->assertJson(['id' => $bia->id]);
    }

    /**
     * Fim de request de verdade: o guard e a sessão em memória somem e só o
     * cookie leva a sessão para a próxima, como num navegador.
     */
    private function novaRequest(): void
    {
        $this->app['auth']->forgetGuards();
        $this->app['session']->driver()->flush();
    }

    public function test_sessao_de_outra_pessoa_nao_muda_o_dono_nem_e_alterada(): void
    {
        $ana = $this->aluno('ana@b.com');
        $bia = $this->aluno('bia@b.com');
        $puroAna = $this->token($ana);
        $nome = config('session.cookie');

        // a Bia entra pelo link mágico neste navegador
        $sessao = $this->get('/entrar/'.LoginToken::emitir($bia, 30))
            ->assertRedirect('/')
            ->getCookie($nome)
            ->getValue();
        $this->novaRequest();

        // o mesmo navegador chama uma rota Bearer com o token da Ana; o fetch
        // no mesmo domínio leva o cookie junto
        $resposta = $this->withCredentials()->withCookie($nome, $sessao)->withToken($puroAna)->getJson(self::ROTA)
            ->assertOk()
            ->assertJson(['id' => $ana->id]);
        $this->assertSame($sessao, $resposta->getCookie($nome)->getValue());
        $this->novaRequest();

        // sem token, a sessão continua sendo da Bia
        $this->withoutToken()->withCookie($nome, $sessao)->get('/')->assertOk();
        $this->assertAuthenticatedAs($bia);
    }

    public function test_header_malformado_401(): void
    {
        $this->token($this->aluno());

        foreach (['Bearer ', 'Basic x'] as $header) {
            $this->withHeader('Authorization', $header)->getJson(self::ROTA)
                ->assertStatus(401)
                ->assertExactJson(['liberado' => false, 'motivo' => 'aparelho']);
        }
    }

    public function test_reembolso_derruba_todos_os_aparelhos_e_a_volta_libera_de_novo(): void
    {
        $user = $this->aluno();
        $tokens = [$this->token($user), $this->token($user)];

        Purchase::query()->update(['status' => Purchase::REEMBOLSADA]);
        foreach ($tokens as $puro) {
            $this->withToken($puro)->getJson(self::ROTA)->assertStatus(403);
        }

        // intencional: os tokens não são apagados
        Purchase::query()->update(['status' => Purchase::PAGA]);
        foreach ($tokens as $puro) {
            $this->withToken($puro)->getJson(self::ROTA)->assertOk()->assertJson(['id' => $user->id]);
        }
    }

    public function test_erros_em_rotina_saem_em_json_menos_entrar(): void
    {
        $this->get('/rotina/nao-existe')
            ->assertNotFound()
            ->assertHeader('Content-Type', 'application/json');

        $this->get('/rotina/entrar')->assertRedirect(route('entrar'));
    }

    public function test_erro_na_casca_sai_em_html(): void
    {
        // Método errado na casca (POST /rotina) dá 405: o erro tem de sair em HTML.
        $resposta = $this->post('/rotina')->assertStatus(405);

        $this->assertStringStartsWith('text/html', $resposta->headers->get('Content-Type'));
    }

    public function test_csrf_so_libera_as_rotas_previstas(): void
    {
        $excluidas = app(PreventRequestForgery::class)->getExcludedPaths();

        $this->assertEqualsCanonicalizing(
            ['webhooks/pagbank', 'rotina/uso', 'rotina/codigo', 'rotina/codigo/confirmar'],
            $excluidas,
        );
    }
}
