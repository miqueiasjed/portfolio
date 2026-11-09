<?php

namespace Tests\Feature;

use App\Mail\LinkDeEntrada;
use App\Models\Product;
use App\Models\Purchase;
use App\Models\RotinaAparelho;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\ProdutoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AdminRotinaTest extends TestCase
{
    use RefreshDatabase;

    private Product $rotina;

    private Product $kit;

    /** Hoje em Fortaleza: 09/11/2026, 15h (18h UTC). */
    private CarbonImmutable $agora;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(ProdutoSeeder::class);
        Mail::fake();
        $this->agora = CarbonImmutable::parse('2026-11-09 18:00:00', 'UTC');
        Carbon::setTestNow($this->agora);
        $this->rotina = Product::where('slug', Product::ROTINA)->first();
        $this->kit = Product::where('slug', 'kit')->first();
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function admin(): User
    {
        $admin = User::create(['email' => 'admin@x.com', 'password' => 'segredo-123']);
        $admin->forceFill(['is_admin' => true])->save();

        return $admin;
    }

    private function compra(User $user, Product $produto, $pagaEm, array $dados = []): Purchase
    {
        return Purchase::create([
            'user_id' => $user->id,
            'product_id' => $produto->id,
            'reference' => (string) Str::uuid(),
            'email' => $user->email,
            'status' => Purchase::PAGA,
            'valor_centavos' => 14700,
            'paid_at' => $pagaEm,
            ...$dados,
        ]);
    }

    private function comprador(string $nome, $pagaEm, array $dados = []): User
    {
        $user = User::create(['email' => Str::lower($nome).'@x.com', 'name' => $nome]);
        $this->compra($user, $this->rotina, $pagaEm, $dados);

        return $user;
    }

    private function aparelho(User $user, array $dados = []): RotinaAparelho
    {
        return RotinaAparelho::create([
            'user_id' => $user->id,
            'token_hash' => hash('sha256', Str::random(40)),
            ...$dados,
        ]);
    }

    /** Grava como o POST /rotina/uso grava: dia em texto Y-m-d, uma linha por aparelho e dia. */
    private function uso(RotinaAparelho $aparelho, string $dia, int $enviados, int $resolvidos = 0): void
    {
        DB::table('rotina_uso')->insert([
            'user_id' => $aparelho->user_id,
            'rotina_aparelho_id' => $aparelho->id,
            'dia' => $dia,
            'enviados' => $enviados,
            'respostas' => 0,
            'resolvidos' => $resolvidos,
            'por_processo' => '{}',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /** Dia local (Fortaleza) n dias antes de hoje, em Y-m-d. */
    private function diaLocal(int $diasAtras): string
    {
        return $this->agora->timezone('America/Fortaleza')->subDays($diasAtras)->format('Y-m-d');
    }

    private function linhaDe(array $props, string $email): array
    {
        return collect($props['compradores']['data'])->firstWhere('email', $email);
    }

    private function cenario(): array
    {
        // Ana: compra há 10 dias (D0 = 30/10), envios em D0, D2, D4 e D8; D2 dividido entre dois aparelhos
        $ana = $this->comprador('Ana', $this->agora->subDays(10));
        $revogado = $this->aparelho($ana, ['revogado_em' => $this->agora->subDays(3), 'ultimo_uso_em' => $this->agora->subDays(4)]);
        $ativo = $this->aparelho($ana, ['ultimo_uso_em' => $this->agora->subHour()]);
        $this->uso($revogado, $this->diaLocal(10), 2);
        $this->uso($revogado, $this->diaLocal(8), 1);
        $this->uso($ativo, $this->diaLocal(8), 2);
        $this->uso($ativo, $this->diaLocal(6), 1);
        $this->uso($ativo, $this->diaLocal(2), 5);

        // Bruno: compra há 9 dias, primeiro envio em D+2
        $bruno = $this->comprador('Bruno', $this->agora->subDays(9));
        $this->uso($this->aparelho($bruno), $this->diaLocal(7), 4);

        // Carla: compra há 8 dias, só uma linha sem envio
        $carla = $this->comprador('Carla', $this->agora->subDays(8));
        $this->uso($this->aparelho($carla), $this->diaLocal(5), 0, 1);

        // Davi: compra há 3 dias, nada ainda
        $davi = $this->comprador('Davi', $this->agora->subDays(3));

        // Eva comprou o kit; Fábio pediu reembolso do Rotina
        $eva = User::create(['email' => 'eva@x.com', 'name' => 'Eva']);
        $this->compra($eva, $this->kit, $this->agora->subDays(9), ['valor_centavos' => 9700]);
        $this->comprador('Fabio', $this->agora->subDays(9), ['status' => Purchase::REEMBOLSADA]);

        return compact('ana', 'bruno', 'carla', 'davi');
    }

    public function test_calcula_primeiro_envio_semana1_e_lista_sem_envio(): void
    {
        $this->cenario();

        $resposta = $this->actingAs($this->admin())->get('/admin/rotina');
        $resposta->assertOk()->assertInertia(fn (Assert $p) => $p
            ->component('Admin/RotinaDoDia', false)
            ->where('compradores.total', 4)
            ->has('compradores.data', 4)
            ->has('compradores.links')
            ->where('compradores.data.0.email', 'davi@x.com')
            ->where('compradores.data.3.email', 'ana@x.com')
            ->where('metas', ['vendas' => 10, 'vendas_com_uso' => 6, 'usos_semana1' => 3, 'minimo_vendas' => 5])
            ->where('resumo', [
                'vendas' => 4,
                'com_primeiro_envio_24h' => 1,
                'com_3_dias_de_uso_semana1' => 1,
                'semana1_completa' => 3,
                'sem_primeiro_envio_7_dias' => 1,
                'media_envios_semana1' => 3,
            ]));

        $props = $resposta->inertiaProps();

        $ana = $this->linhaDe($props, 'ana@x.com');
        $this->assertTrue($ana['primeiro_envio_24h']);
        $this->assertSame('30/10/2026', $ana['primeiro_envio']);
        $this->assertSame(6, $ana['envios_semana1']);
        $this->assertSame(3, $ana['dias_de_uso_semana1']);
        $this->assertTrue($ana['semana1_completa']);
        $this->assertSame(1, $ana['aparelhos_ativos']);
        $this->assertSame('09/11/2026 14:00', $ana['ultimo_uso']);
        $this->assertSame('30/10/2026 15:00', $ana['comprado_em']);
        $this->assertFalse($ana['cortesia']);

        $bruno = $this->linhaDe($props, 'bruno@x.com');
        $this->assertFalse($bruno['primeiro_envio_24h']);
        $this->assertSame('02/11/2026', $bruno['primeiro_envio']);
        $this->assertSame(4, $bruno['envios_semana1']);

        foreach (['carla@x.com', 'davi@x.com'] as $email) {
            $linha = $this->linhaDe($props, $email);
            $this->assertNull($linha['primeiro_envio']);
            $this->assertNull($linha['primeiro_envio_24h']);
            $this->assertSame(0, $linha['envios_semana1']);
            $this->assertNull($linha['ultimo_uso']);
        }
        $this->assertFalse($this->linhaDe($props, 'davi@x.com')['semana1_completa']);
        $this->assertSame(0, $this->linhaDe($props, 'davi@x.com')['aparelhos_ativos']);

        $this->assertCount(1, $props['semPrimeiroEnvio']);
        $this->assertSame('carla@x.com', $props['semPrimeiroEnvio'][0]['email']);
        $this->assertSame(8, $props['semPrimeiroEnvio'][0]['dias_desde_a_compra']);
    }

    public function test_dia_da_compra_e_a_data_local_de_fortaleza(): void
    {
        // 23h50 de 01/11 em Fortaleza já é 02/11 em UTC; D0 continua 01/11
        $pagaEm = CarbonImmutable::parse('2026-11-01 23:50:00', 'America/Fortaleza')->utc();
        $noDiaSeguinte = $this->comprador('Ivo', $pagaEm);
        $doisDiasDepois = $this->comprador('Juca', $pagaEm);
        $this->uso($this->aparelho($noDiaSeguinte), '2026-11-02', 1);
        $this->uso($this->aparelho($doisDiasDepois), '2026-11-03', 1);

        $props = $this->actingAs($this->admin())->get('/admin/rotina')->inertiaProps();

        $this->assertTrue($this->linhaDe($props, 'ivo@x.com')['primeiro_envio_24h']);
        $this->assertFalse($this->linhaDe($props, 'juca@x.com')['primeiro_envio_24h']);
        $this->assertSame('01/11/2026 23:50', $this->linhaDe($props, 'ivo@x.com')['comprado_em']);
        // semana 1 vai de 01/11 a 07/11; hoje (09/11) já fechou
        $this->assertTrue($this->linhaDe($props, 'ivo@x.com')['semana1_completa']);
    }

    public function test_sete_dias_contam_pelo_dia_local(): void
    {
        // compra às 23h de 02/11 em Fortaleza: em horas são menos de 7 dias, em dias locais são 7
        $this->comprador('Lia', CarbonImmutable::parse('2026-11-02 23:00:00', 'America/Fortaleza')->utc());
        // 03/11 local: 6 dias, ainda fora da lista
        $this->comprador('Mel', CarbonImmutable::parse('2026-11-03 08:00:00', 'America/Fortaleza')->utc());

        $props = $this->actingAs($this->admin())->get('/admin/rotina')->inertiaProps();

        $this->assertSame(['lia@x.com'], array_column($props['semPrimeiroEnvio'], 'email'));
        $this->assertSame(7, $props['semPrimeiroEnvio'][0]['dias_desde_a_compra']);
        $this->assertSame(1, $props['resumo']['sem_primeiro_envio_7_dias']);
    }

    public function test_duas_compras_cortesia_e_admin(): void
    {
        // duas compras pagas: aparece uma vez, com a mais antiga
        $gil = $this->comprador('Gil', $this->agora->subDays(5));
        $this->compra($gil, $this->rotina, $this->agora->subDays(2));

        // liberação manual de valor zero: na tabela, fora do resumo e da lista
        $this->comprador('Hugo', $this->agora->subDays(9), ['valor_centavos' => 0, 'origem' => 'manual']);

        // cortesia antes, paga depois: vale a paga
        $iara = $this->comprador('Iara', $this->agora->subDays(6), ['valor_centavos' => 0]);
        $this->compra($iara, $this->rotina, $this->agora->subDays(4));

        $admin = $this->admin();
        $this->compra($admin, $this->rotina, $this->agora->subDays(9));

        $props = $this->actingAs($admin)->get('/admin/rotina')->assertOk()->inertiaProps();
        $emails = array_column($props['compradores']['data'], 'email');

        $this->assertSame(3, $props['compradores']['total']);
        $this->assertSame(['iara@x.com', 'gil@x.com', 'hugo@x.com'], $emails);
        $this->assertSame(
            Carbon::parse($this->agora->subDays(5))->timezone('America/Fortaleza')->format('d/m/Y H:i'),
            $this->linhaDe($props, 'gil@x.com')['comprado_em'],
        );
        $this->assertTrue($this->linhaDe($props, 'hugo@x.com')['cortesia']);
        $this->assertFalse($this->linhaDe($props, 'iara@x.com')['cortesia']);
        $this->assertSame(2, $props['resumo']['vendas']);
        $this->assertSame(0, $props['resumo']['sem_primeiro_envio_7_dias']);
        $this->assertSame([], $props['semPrimeiroEnvio']);
    }

    public function test_cliente_nao_acessa_e_visitante_vai_para_o_login(): void
    {
        $cliente = $this->comprador('Nina', $this->agora->subDays(1));

        $this->actingAs($cliente)->get('/admin/rotina')->assertForbidden();
        auth()->logout();
        $this->get('/admin/rotina')->assertRedirect('/admin/entrar');
    }

    public function test_botao_da_lista_manda_o_link_de_entrada(): void
    {
        $carla = $this->cenario()['carla'];

        $this->actingAs($this->admin())->post("/admin/alunos/{$carla->id}/link")->assertRedirect();

        Mail::assertSent(LinkDeEntrada::class, fn ($m) => $m->hasTo('carla@x.com'));
    }

    public function test_consultas_nao_crescem_com_os_compradores_e_pagina_em_memoria(): void
    {
        $this->actingAs($this->admin());
        $semear = function (int $de, int $ate) {
            foreach (range($de, $ate) as $i) {
                $user = $this->comprador("Pessoa{$i}", $this->agora->subDays($i % 12)->subMinutes($i));
                $aparelho = $this->aparelho($user, ['ultimo_uso_em' => $this->agora->subHours($i)]);
                $this->uso($aparelho, $this->diaLocal($i % 12), $i);
            }
        };
        $contar = function () {
            DB::flushQueryLog();
            DB::enableQueryLog();
            $this->get('/admin/rotina')->assertOk();
            DB::disableQueryLog();

            return count(DB::getQueryLog());
        };

        $semear(1, 4);
        $com4 = $contar();
        $semear(5, 30);
        $com30 = $contar();

        $this->assertSame($com4, $com30);

        $this->get('/admin/rotina')->assertInertia(fn (Assert $p) => $p
            ->where('compradores.total', 30)
            ->has('compradores.data', 25)
            ->where('resumo.vendas', 30));
        $this->get('/admin/rotina?page=2')->assertInertia(fn (Assert $p) => $p
            ->where('compradores.current_page', 2)
            ->has('compradores.data', 5));
    }
}
