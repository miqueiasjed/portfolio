<?php

namespace Tests\Feature;

use App\Mail\CodigoDaRotina as EmailDoCodigo;
use App\Models\Product;
use App\Models\Purchase;
use App\Models\RotinaAparelho;
use App\Models\User;
use Database\Seeders\ProdutoSeeder;
use Illuminate\Contracts\Http\Kernel as HttpKernel;
use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Exceptions;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use RuntimeException;
use Tests\TestCase;

class RotinaCodigoTest extends TestCase
{
    use RefreshDatabase;

    private const ERRO = 'Código errado ou vencido. Peça um novo.';

    private Product $rotina;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
        $this->seed(ProdutoSeeder::class);
        $this->rotina = Product::where('slug', Product::ROTINA)->firstOrFail();
    }

    private function aluno(string $email = 'a@b.com', ?string $status = Purchase::PAGA): User
    {
        $user = User::create(['email' => $email, 'name' => 'Ana']);

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

    private function pedir(string $email = 'a@b.com')
    {
        return $this->postJson('/rotina/codigo', ['email' => $email]);
    }

    private function confirmar(string $codigo, string $email = 'a@b.com')
    {
        return $this->postJson('/rotina/codigo/confirmar', ['email' => $email, 'codigo' => $codigo]);
    }

    /** Código do último e-mail enviado. */
    private function codigoEnviado(): string
    {
        return Mail::sent(EmailDoCodigo::class)->last()->codigo;
    }

    private function outroCodigo(string $codigo): string
    {
        return $codigo === '000000' ? '111111' : '000000';
    }

    public function test_comprador_recebe_o_codigo_e_entra_com_ele_uma_vez_so(): void
    {
        $user = $this->aluno();

        $this->pedir()->assertNoContent();
        Mail::assertSent(EmailDoCodigo::class, fn ($email) => $email->hasTo('a@b.com'));

        $codigo = $this->codigoEnviado();

        $resposta = $this->confirmar($codigo)
            ->assertCreated()
            ->assertJson(['nome' => 'Ana', 'email' => 'a@b.com']);

        $token = $resposta->json('token');
        $this->assertSame(64, strlen($token));
        $this->assertTrue(RotinaAparelho::porToken($token)->user->is($user));

        $this->confirmar($codigo)->assertStatus(422)->assertExactJson(['message' => self::ERRO]);
        $this->assertDatabaseCount('rotina_aparelhos', 1);
    }

    /** Headers que precisam sair iguais: todos menos Date e Set-Cookie, com nome e valor. */
    private function headersComparaveis($resposta): array
    {
        $headers = $resposta->headers->all();
        unset($headers['date'], $headers['set-cookie']);
        ksort($headers);

        return $headers;
    }

    /** Cada resposta comparada sai de um IP novo, para o throttle por IP marcar o mesmo número. */
    private function deOutroIp(string $ip)
    {
        return $this->withServerVariables(['REMOTE_ADDR' => $ip]);
    }

    public function test_sem_compra_a_resposta_e_a_mesma_e_nada_e_enviado(): void
    {
        $this->aluno('a@b.com');
        $this->aluno('pendente@b.com', Purchase::PENDENTE);
        $this->aluno('limite@b.com');

        // o e-mail alvo gasta os 3 pedidos a partir de outro IP
        for ($i = 0; $i < 3; $i++) {
            $this->deOutroIp('10.0.9.9')->pedir('limite@b.com')->assertNoContent();
        }
        Mail::assertSentCount(3);

        $comCompra = $this->deOutroIp('10.0.1.1')->pedir('a@b.com')->assertNoContent();
        Mail::assertSentCount(4);
        Mail::assertSent(EmailDoCodigo::class, fn ($email) => $email->hasTo('a@b.com'));

        $outras = [
            'compra pendente' => $this->deOutroIp('10.0.1.2')->pedir('pendente@b.com')->assertNoContent(),
            'e-mail desconhecido' => $this->deOutroIp('10.0.1.3')->pedir('ninguem@b.com')->assertNoContent(),
            'limite do e-mail estourado' => $this->deOutroIp('10.0.1.4')->pedir('limite@b.com')->assertNoContent(),
        ];

        Mail::assertSentCount(4);

        foreach ($outras as $caso => $resposta) {
            $this->assertSame($comCompra->getContent(), $resposta->getContent(), $caso);
            $this->assertSame($this->headersComparaveis($comCompra), $this->headersComparaveis($resposta), $caso);
        }
    }

    public function test_422_do_confirmar_e_igual_com_e_sem_codigo_ativo(): void
    {
        $this->aluno();
        $this->deOutroIp('10.0.9.9')->pedir()->assertNoContent();
        $errado = $this->outroCodigo($this->codigoEnviado());

        // o e-mail alvo já teve tentativas de outro IP
        $this->deOutroIp('10.0.9.9')->confirmar($errado)->assertStatus(422);

        $comCodigo = $this->deOutroIp('10.0.2.1')->confirmar($errado)->assertStatus(422);
        $semCodigo = $this->deOutroIp('10.0.2.2')->confirmar($errado, 'ninguem@b.com')->assertStatus(422);

        $this->assertSame($comCodigo->getContent(), $semCodigo->getContent());
        $this->assertSame($this->headersComparaveis($comCodigo), $this->headersComparaveis($semCodigo));
    }

    public function test_o_envio_roda_depois_da_resposta(): void
    {
        $this->aluno();
        $kernel = $this->app->make(HttpKernel::class);
        $request = Request::create('/rotina/codigo', 'POST', ['email' => 'a@b.com']);

        $resposta = $kernel->handle($request);

        $this->assertSame(204, $resposta->getStatusCode());
        Mail::assertNothingSent();

        $kernel->terminate($request, $resposta);

        Mail::assertSent(EmailDoCodigo::class, fn ($email) => $email->hasTo('a@b.com'));
    }

    public function test_falha_no_envio_vai_para_o_log_e_o_204_sai_igual(): void
    {
        $this->aluno();
        Exceptions::fake();
        Mail::shouldReceive('to')->once()->andThrow(new RuntimeException('Resend fora do ar'));

        $this->pedir()->assertNoContent();

        Exceptions::assertReported(RuntimeException::class);
    }

    public function test_validacao(): void
    {
        $this->postJson('/rotina/codigo', ['email' => 'nao-e-email'])->assertStatus(422)->assertJsonValidationErrors('email');
        $this->postJson('/rotina/codigo/confirmar', ['email' => 'a@b.com', 'codigo' => '12345'])
            ->assertStatus(422)->assertJsonValidationErrors('codigo');
        $this->postJson('/rotina/codigo/confirmar', ['email' => 'a@b.com', 'codigo' => 'abcdef'])
            ->assertStatus(422)->assertJsonValidationErrors('codigo');

        Mail::assertNothingSent();
    }

    public function test_codigo_errado_422(): void
    {
        $this->aluno();
        $this->pedir();

        $this->confirmar($this->outroCodigo($this->codigoEnviado()))
            ->assertStatus(422)
            ->assertExactJson(['message' => self::ERRO]);

        $this->assertDatabaseCount('rotina_aparelhos', 0);
    }

    public function test_cinco_erros_invalidam_o_codigo_certo(): void
    {
        $this->aluno();
        $this->pedir();
        $codigo = $this->codigoEnviado();

        for ($i = 0; $i < 5; $i++) {
            $this->confirmar($this->outroCodigo($codigo))->assertStatus(422);
        }

        $this->confirmar($codigo)->assertStatus(422)->assertExactJson(['message' => self::ERRO]);
        $this->assertDatabaseCount('rotina_aparelhos', 0);
    }

    public function test_codigo_vencido_422(): void
    {
        $this->aluno();
        $this->pedir();
        $codigo = $this->codigoEnviado();

        $this->travel(16)->minutes();

        $this->confirmar($codigo)->assertStatus(422)->assertExactJson(['message' => self::ERRO]);
    }

    public function test_post_sem_accept_responde_422_em_json(): void
    {
        $this->post('/rotina/codigo', ['email' => 'nao-e-email'])
            ->assertStatus(422)
            ->assertHeader('Content-Type', 'application/json')
            ->assertJsonValidationErrors('email');

        $this->post('/rotina/codigo/confirmar', ['email' => 'a@b.com', 'codigo' => '123456'])
            ->assertStatus(422)
            ->assertHeader('Content-Type', 'application/json')
            ->assertExactJson(['message' => self::ERRO]);
    }

    public function test_sem_token_csrf_nao_da_419(): void
    {
        // Nos testes o Laravel pula a checagem de CSRF. Aqui ela volta a valer.
        $this->app->bind(PreventRequestForgery::class, fn ($app) => new class($app, $app['encrypter']) extends PreventRequestForgery
        {
            protected function runningUnitTests()
            {
                return false;
            }
        });

        // controle: rota comum sem token dá 419
        $this->post('/entrar', ['email' => 'a@b.com'])->assertStatus(419);

        $this->aluno();
        $this->post('/rotina/codigo', ['email' => 'a@b.com'])->assertNoContent();
        $codigo = $this->codigoEnviado();
        $this->post('/rotina/codigo/confirmar', ['email' => 'a@b.com', 'codigo' => $codigo])->assertCreated();
    }

    public function test_tres_pedidos_por_email_a_cada_quinze_minutos(): void
    {
        $this->aluno();

        $this->pedir('a@b.com')->assertNoContent();
        $this->pedir('A@B.com')->assertNoContent();
        $this->pedir('a@b.com')->assertNoContent();
        Mail::assertSentCount(3);

        // estourou: mesma resposta, nenhum e-mail
        $this->pedir('A@b.COM')->assertNoContent();
        Mail::assertSentCount(3);

        $this->travel(16)->minutes();

        $this->pedir()->assertNoContent();
        Mail::assertSentCount(4);
    }

    public function test_cinco_pedidos_por_minuto_por_ip(): void
    {
        for ($i = 1; $i <= 5; $i++) {
            $this->pedir("pessoa$i@b.com")->assertNoContent();
        }

        $this->pedir('pessoa6@b.com')->assertStatus(429);
    }

    public function test_dez_confirmacoes_por_email_a_cada_quinze_minutos(): void
    {
        for ($i = 0; $i < 10; $i++) {
            $this->confirmar('123456')->assertStatus(422);
        }

        // passou a janela do IP; o limite do e-mail continua
        $this->travel(2)->minutes();

        $this->confirmar('123456', 'A@B.com')->assertStatus(429);
        $this->confirmar('123456', 'outra@b.com')->assertStatus(422);

        $this->travel(14)->minutes();

        $this->confirmar('123456')->assertStatus(422);
    }

    public function test_dez_confirmacoes_por_minuto_por_ip(): void
    {
        for ($i = 1; $i <= 10; $i++) {
            $this->confirmar('123456', "pessoa$i@b.com")->assertStatus(422);
        }

        $this->confirmar('123456', 'pessoa11@b.com')->assertStatus(429);
    }

    public function test_muitos_401_do_mesmo_ip_dao_429_e_token_valido_nao_conta(): void
    {
        [, $valido] = RotinaAparelho::emitir($this->aluno(), null);
        $falso = ['Authorization' => 'Bearer '.str_repeat('x', 64)];
        $bom = ['Authorization' => 'Bearer '.$valido];

        for ($i = 0; $i < 115; $i++) {
            $this->getJson('/rotina/acesso', $falso)->assertUnauthorized();
        }

        for ($i = 0; $i < 5; $i++) {
            $this->getJson('/rotina/acesso', $bom)->assertOk();
        }

        // os acessos válidos não contaram: ainda cabem mais 5 falhas
        for ($i = 0; $i < 5; $i++) {
            $this->getJson('/rotina/acesso', $falso)->assertUnauthorized();
        }

        $this->getJson('/rotina/acesso', $falso)->assertStatus(429);

        // outro IP segue com o próprio contador
        $this->withServerVariables(['REMOTE_ADDR' => '10.0.0.2'])
            ->getJson('/rotina/acesso', $falso)
            ->assertUnauthorized();
    }
}
