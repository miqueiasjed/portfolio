<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\Purchase;
use App\Models\RotinaAparelho;
use App\Models\RotinaUso;
use App\Models\User;
use Database\Seeders\ProdutoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class RotinaUsoTest extends TestCase
{
    use RefreshDatabase;

    private Product $rotina;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(ProdutoSeeder::class);
        $this->rotina = Product::where('slug', Product::ROTINA)->firstOrFail();

        // 10/12/2026 12h em Fortaleza (15h UTC): o mesmo dia nos dois fusos.
        Carbon::setTestNow(Carbon::parse('2026-12-10 15:00:00', 'UTC'));
    }

    private function aluno(string $email = 'a@b.com', string $status = Purchase::PAGA): User
    {
        $user = User::create(['email' => $email, 'name' => 'Ana']);

        Purchase::create([
            'product_id' => $this->rotina->id, 'reference' => (string) Str::uuid(),
            'valor_centavos' => $this->rotina->preco_centavos, 'email' => $email,
            'user_id' => $user->id, 'status' => $status,
            'paid_at' => $status === Purchase::PAGA ? now() : null,
        ]);

        return $user;
    }

    /** Devolve [aparelho, token puro]. */
    private function aparelho(User $user): array
    {
        return RotinaAparelho::emitir($user, 'iPhone Safari/604.1');
    }

    private function dia(string $dia = '2026-12-09', array $extra = []): array
    {
        return array_merge([
            'dia' => $dia,
            'enviados' => 4,
            'respostas' => 2,
            'resolvidos' => 1,
            'por_processo' => ['01' => 3, '05' => 1],
        ], $extra);
    }

    private function enviar(string $token, mixed $corpo): TestResponse
    {
        return $this->withToken($token)->postJson('/rotina/uso', $corpo);
    }

    public function test_corpo_valido_grava_os_dias_e_devolve_204(): void
    {
        [$aparelho, $token] = $this->aparelho($user = $this->aluno());

        $this->enviar($token, ['dias' => [
            $this->dia('2026-12-09'),
            $this->dia('2026-12-10', ['enviados' => 7, 'por_processo' => []]),
        ]])->assertNoContent();

        $this->assertDatabaseCount('rotina_uso', 2);

        $ontem = DB::table('rotina_uso')->where('dia', '2026-12-09')->first();
        $this->assertSame($user->id, (int) $ontem->user_id);
        $this->assertSame($aparelho->id, (int) $ontem->rotina_aparelho_id);
        $this->assertSame(4, (int) $ontem->enviados);
        $this->assertSame(2, (int) $ontem->respostas);
        $this->assertSame(1, (int) $ontem->resolvidos);
        $this->assertSame(['01' => 3, '05' => 1], json_decode($ontem->por_processo, true));

        $hoje = RotinaUso::where('dia', '2026-12-10')->sole();
        $this->assertSame(7, $hoje->enviados);
        $this->assertSame([], $hoje->por_processo);
        $this->assertSame('{}', DB::table('rotina_uso')->where('dia', '2026-12-10')->value('por_processo'));
    }

    public function test_mesmo_dia_de_novo_substitui_os_numeros_sem_criar_linha(): void
    {
        [, $token] = $this->aparelho($this->aluno());

        $this->enviar($token, ['dias' => [$this->dia()]])->assertNoContent();
        $this->enviar($token, ['dias' => [$this->dia(extra: [
            'enviados' => 9, 'respostas' => 5, 'resolvidos' => 3, 'por_processo' => ['04' => 9],
        ])]])->assertNoContent();

        $uso = RotinaUso::sole();
        $this->assertSame('2026-12-09', $uso->dia->format('Y-m-d'));
        $this->assertSame(9, $uso->enviados);
        $this->assertSame(5, $uso->respostas);
        $this->assertSame(3, $uso->resolvidos);
        $this->assertSame(['04' => 9], $uso->por_processo);
    }

    public function test_31_dias_passam_e_32_sao_recusados(): void
    {
        [, $token] = $this->aparelho($this->aluno());
        $dias = fn (int $n) => array_map(
            fn (int $i) => $this->dia(Carbon::parse('2026-12-10')->subDays($i)->format('Y-m-d')),
            range(0, $n - 1),
        );

        $this->enviar($token, ['dias' => $dias(32)])->assertUnprocessable()->assertJsonValidationErrors('dias');
        $this->assertDatabaseCount('rotina_uso', 0);

        $this->enviar($token, ['dias' => $dias(31)])->assertNoContent();
        $this->assertDatabaseCount('rotina_uso', 31);
    }

    public function test_lista_vazia_e_corpo_sem_dias_sao_recusados(): void
    {
        [, $token] = $this->aparelho($this->aluno());

        $this->enviar($token, ['dias' => []])->assertUnprocessable();
        $this->enviar($token, [])->assertUnprocessable();
        $this->assertDatabaseCount('rotina_uso', 0);
    }

    public function test_dia_futuro_usa_o_fuso_de_fortaleza(): void
    {
        // 09/12/2026 23h50 em Fortaleza: em UTC já é 10/12 02h50.
        Carbon::setTestNow(Carbon::parse('2026-12-10 02:50:00', 'UTC'));
        [, $token] = $this->aparelho($this->aluno());

        $this->enviar($token, ['dias' => [$this->dia('2026-12-10')]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('dias.0.dia');
        $this->assertDatabaseCount('rotina_uso', 0);

        $this->enviar($token, ['dias' => [$this->dia('2026-12-09')]])->assertNoContent();
        $this->assertDatabaseCount('rotina_uso', 1);
    }

    public static function corposInvalidos(): array
    {
        $dia = [
            'dia' => '2026-12-09', 'enviados' => 4, 'respostas' => 2, 'resolvidos' => 1,
            'por_processo' => ['01' => 3],
        ];
        $com = fn (array $extra) => ['dias' => [array_merge($dia, $extra)]];
        $sem = function (string $chave) use ($dia) {
            unset($dia[$chave]);

            return ['dias' => [$dia]];
        };

        return [
            'data fora do formato' => [$com(['dia' => '09/12/2026'])],
            'data que não existe' => [$com(['dia' => '2026-02-30'])],
            'data com hora' => [$com(['dia' => '2026-12-09 10:00:00'])],
            'enviados como string' => [$com(['enviados' => '3'])],
            'respostas como string' => [$com(['respostas' => '2'])],
            'resolvidos como string' => [$com(['resolvidos' => '1'])],
            'enviados negativo' => [$com(['enviados' => -1])],
            'enviados acima do teto' => [$com(['enviados' => 10001])],
            'enviados com casa decimal' => [$com(['enviados' => 1.5])],
            'enviados booleano' => [$com(['enviados' => true])],
            'enviados nulo' => [$com(['enviados' => null])],
            'sem enviados' => [$sem('enviados')],
            'sem por_processo' => [$sem('por_processo')],
            'nome no dia' => [$com(['nome' => 'Maria'])],
            'telefone no dia' => [$com(['telefone' => '5585999998888'])],
            'texto no dia' => [$com(['texto' => 'Oi, Maria'])],
            'user_id no dia' => [$com(['user_id' => 1])],
            'rotina_aparelho_id no dia' => [$com(['rotina_aparelho_id' => 1])],
            'user_id na raiz' => [['dias' => [$dia], 'user_id' => 1]],
            'rotina_aparelho_id na raiz' => [['dias' => [$dia], 'rotina_aparelho_id' => 1]],
            'dias como objeto' => [['dias' => ['a' => $dia]]],
            'dias como número' => [['dias' => 1]],
            'dia que não é objeto' => [['dias' => [1]]],
            'dias misturados' => [['dias' => [1, 'x', $dia]]],
            'por_processo com chave abc' => [$com(['por_processo' => ['abc' => 1]])],
            'por_processo com chave de um dígito' => [$com(['por_processo' => ['1' => 1]])],
            'por_processo com chave de três dígitos' => [$com(['por_processo' => ['001' => 1]])],
            'por_processo com quebra de linha na chave' => [$com(['por_processo' => ["01\n" => 1]])],
            'por_processo como lista' => [$com(['por_processo' => [3, 1]])],
            'por_processo como string' => [$com(['por_processo' => 'x'])],
            'por_processo nulo' => [$com(['por_processo' => null])],
            'por_processo com valor string' => [$com(['por_processo' => ['01' => '3']])],
            'por_processo com valor booleano' => [$com(['por_processo' => ['01' => true]])],
            'por_processo com valor decimal' => [$com(['por_processo' => ['01' => 1.5]])],
            'por_processo com valor negativo' => [$com(['por_processo' => ['01' => -1]])],
            'por_processo com valor em lista' => [$com(['por_processo' => ['01' => [1]]])],
            'dia repetido no mesmo envio' => [['dias' => [$dia, array_merge($dia, ['enviados' => 9])]]],
        ];
    }

    #[DataProvider('corposInvalidos')]
    public function test_corpo_invalido_devolve_422_e_nao_grava(array $corpo): void
    {
        [, $token] = $this->aparelho($this->aluno());

        $this->enviar($token, $corpo)
            ->assertUnprocessable()
            ->assertHeader('Content-Type', 'application/json')
            ->assertJsonStructure(['message', 'errors']);

        $this->assertDatabaseCount('rotina_uso', 0);
    }

    public function test_chave_extra_aparece_no_erro_mesmo_com_o_resto_certo(): void
    {
        [, $token] = $this->aparelho($this->aluno());

        $this->enviar($token, ['dias' => [$this->dia(extra: ['nome' => 'Maria'])], 'user_id' => 99])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['user_id', 'dias.0.nome']);
    }

    public function test_sem_token_401(): void
    {
        $this->postJson('/rotina/uso', ['dias' => [$this->dia()]])
            ->assertUnauthorized()
            ->assertExactJson(['liberado' => false, 'motivo' => 'aparelho']);
        $this->assertDatabaseCount('rotina_uso', 0);
    }

    public function test_token_revogado_401(): void
    {
        [$aparelho, $token] = $this->aparelho($this->aluno());
        $aparelho->update(['revogado_em' => now()]);

        $this->enviar($token, ['dias' => [$this->dia()]])
            ->assertUnauthorized()
            ->assertExactJson(['liberado' => false, 'motivo' => 'aparelho']);
        $this->assertDatabaseCount('rotina_uso', 0);
    }

    public function test_compra_reembolsada_403(): void
    {
        [, $token] = $this->aparelho($this->aluno(status: Purchase::REEMBOLSADA));

        $this->enviar($token, ['dias' => [$this->dia()]])
            ->assertForbidden()
            ->assertExactJson(['liberado' => false, 'motivo' => 'compra']);
        $this->assertDatabaseCount('rotina_uso', 0);
    }

    public function test_cada_envio_grava_no_usuario_do_proprio_token(): void
    {
        $ana = $this->aluno('ana@b.com');
        $bia = $this->aluno('bia@b.com');
        [$aparelhoDaAna, $tokenDaAna] = $this->aparelho($ana);
        [$aparelhoDaBia, $tokenDaBia] = $this->aparelho($bia);

        $this->enviar($tokenDaAna, ['dias' => [$this->dia(extra: ['enviados' => 1])]])->assertNoContent();
        $this->enviar($tokenDaBia, ['dias' => [$this->dia(extra: ['enviados' => 2])]])->assertNoContent();

        $this->assertDatabaseCount('rotina_uso', 2);
        $daAna = RotinaUso::where('user_id', $ana->id)->sole();
        $daBia = RotinaUso::where('user_id', $bia->id)->sole();
        $this->assertSame($aparelhoDaAna->id, $daAna->rotina_aparelho_id);
        $this->assertSame(1, $daAna->enviados);
        $this->assertSame($aparelhoDaBia->id, $daBia->rotina_aparelho_id);
        $this->assertSame(2, $daBia->enviados);
    }

    public function test_dois_aparelhos_do_mesmo_usuario_tem_linhas_separadas(): void
    {
        $user = $this->aluno();
        [$safari, $tokenSafari] = $this->aparelho($user);
        [$instalado, $tokenInstalado] = $this->aparelho($user);

        $this->enviar($tokenSafari, ['dias' => [$this->dia(extra: ['enviados' => 5])]])->assertNoContent();
        $this->enviar($tokenInstalado, ['dias' => [$this->dia(extra: ['enviados' => 3])]])->assertNoContent();
        $this->assertDatabaseCount('rotina_uso', 2);

        // o reenvio do app instalado, mesmo com zero, não mexe no total do Safari
        $this->enviar($tokenInstalado, ['dias' => [$this->dia(extra: ['enviados' => 0])]])->assertNoContent();

        $this->assertDatabaseCount('rotina_uso', 2);
        $this->assertSame(5, RotinaUso::where('rotina_aparelho_id', $safari->id)->sole()->enviados);
        $this->assertSame(0, RotinaUso::where('rotina_aparelho_id', $instalado->id)->sole()->enviados);
        $this->assertSame(2, RotinaUso::where('user_id', $user->id)->count());
    }

    public function test_limite_do_uso_nao_gasta_o_limite_do_acesso(): void
    {
        [, $token] = $this->aparelho($this->aluno());

        for ($i = 0; $i < 60; $i++) {
            $this->enviar($token, ['dias' => [$this->dia()]])->assertNoContent();
        }
        $this->enviar($token, ['dias' => [$this->dia()]])->assertTooManyRequests();

        $this->withToken($token)->getJson('/rotina/acesso')->assertOk();
    }

    public function test_dia_com_mais_de_60_dias_e_recusado(): void
    {
        [, $token] = $this->aparelho($this->aluno());

        // hoje é 10/12/2026 em Fortaleza: 11/10 é o piso, 10/10 já passou dele
        $this->enviar($token, ['dias' => [$this->dia('2026-10-11')]])->assertNoContent();
        $this->enviar($token, ['dias' => [$this->dia('2026-10-10')]])->assertUnprocessable();
        $this->enviar($token, ['dias' => [$this->dia('0001-01-01')]])->assertUnprocessable();

        $this->assertDatabaseCount('rotina_uso', 1);
    }

    public function test_muitos_401_no_uso_contam_no_limite_de_falhas_do_ip(): void
    {
        [, $valido] = $this->aparelho($this->aluno());
        $falso = str_repeat('x', 64);

        for ($i = 0; $i < 120; $i++) {
            $this->enviar($falso, ['dias' => [$this->dia()]])->assertUnauthorized();
        }

        $this->enviar($falso, ['dias' => [$this->dia()]])->assertTooManyRequests();
        // o limite de falhas é por IP: o mesmo IP também fica de fora do acesso
        $this->withToken($valido)->getJson('/rotina/acesso')->assertTooManyRequests();
    }
}
