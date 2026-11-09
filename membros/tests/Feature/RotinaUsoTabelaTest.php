<?php

namespace Tests\Feature;

use App\Models\RotinaAparelho;
use App\Models\RotinaUso;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class RotinaUsoTabelaTest extends TestCase
{
    use RefreshDatabase;

    private User $aluno;

    private RotinaAparelho $safari;

    private RotinaAparelho $instalado;

    protected function setUp(): void
    {
        parent::setUp();
        $this->aluno = User::create(['email' => 'a@b.com']);
        [$this->safari] = RotinaAparelho::emitir($this->aluno, 'iPhone Safari/604.1');
        [$this->instalado] = RotinaAparelho::emitir($this->aluno, 'iPhone Safari/604.1');
    }

    /** Linha crua, gravada como a task 6.2 grava: dia em string Y-m-d. */
    private function linhaCrua(RotinaAparelho $aparelho, string $dia): array
    {
        return [
            'user_id' => $this->aluno->id,
            'rotina_aparelho_id' => $aparelho->id,
            'dia' => $dia,
            'enviados' => 1,
            'respostas' => 0,
            'resolvidos' => 0,
            'por_processo' => json_encode(['01' => 1]),
            'created_at' => now(),
            'updated_at' => now(),
        ];
    }

    public function test_mesmo_usuario_e_dia_em_aparelhos_diferentes_sao_aceitos(): void
    {
        DB::table('rotina_uso')->insert($this->linhaCrua($this->safari, '2026-12-09'));
        DB::table('rotina_uso')->insert($this->linhaCrua($this->instalado, '2026-12-09'));

        $this->assertSame(2, RotinaUso::where('user_id', $this->aluno->id)->count());
    }

    public function test_mesmo_aparelho_e_dia_falha_pela_chave_unica(): void
    {
        DB::table('rotina_uso')->insert($this->linhaCrua($this->safari, '2026-12-09'));

        $this->expectException(QueryException::class);
        DB::table('rotina_uso')->insert($this->linhaCrua($this->safari, '2026-12-09'));
    }

    public function test_model_e_linha_crua_do_mesmo_dia_batem_na_chave_unica(): void
    {
        DB::table('rotina_uso')->insert($this->linhaCrua($this->safari, '2026-12-09'));

        $this->expectException(QueryException::class);
        RotinaUso::create([
            'user_id' => $this->aluno->id,
            'rotina_aparelho_id' => $this->safari->id,
            'dia' => Carbon::parse('2026-12-09 15:30:00'),
            'por_processo' => [],
        ]);
    }

    public function test_dia_fica_gravado_como_y_m_d_sem_hora(): void
    {
        // por string crua (forma do upsert da 6.2)
        DB::table('rotina_uso')->insert($this->linhaCrua($this->safari, '2026-12-09'));
        // pelo model, com Carbon e com string
        RotinaUso::create([
            'user_id' => $this->aluno->id,
            'rotina_aparelho_id' => $this->instalado->id,
            'dia' => Carbon::parse('2026-12-10 15:30:00'),
            'por_processo' => [],
        ]);
        RotinaUso::create([
            'user_id' => $this->aluno->id,
            'rotina_aparelho_id' => $this->instalado->id,
            'dia' => '2026-12-11',
            'por_processo' => [],
        ]);

        $gravados = DB::table('rotina_uso')->orderBy('dia')->pluck('dia')->all();
        $this->assertSame(['2026-12-09', '2026-12-10', '2026-12-11'], $gravados);

        // whereBetween com strings Y-m-d pega as três linhas
        $this->assertSame(3, RotinaUso::whereBetween('dia', ['2026-12-09', '2026-12-11'])->count());

        // a leitura pelo cast devolve Carbon e serializa como Y-m-d
        $uso = RotinaUso::where('rotina_aparelho_id', $this->safari->id)->first();
        $this->assertInstanceOf(CarbonInterface::class, $uso->dia);
        $this->assertSame('2026-12-09', $uso->toArray()['dia']);
    }

    public function test_por_processo_volta_como_array_e_contadores_como_inteiro(): void
    {
        DB::table('rotina_uso')->insert($this->linhaCrua($this->safari, '2026-12-09'));

        $uso = RotinaUso::first();
        $this->assertSame(['01' => 1], $uso->por_processo);
        $this->assertSame(1, $uso->enviados);
        $this->assertSame(0, $uso->respostas);
        $this->assertSame(0, $uso->resolvidos);
        $this->assertTrue($uso->user->is($this->aluno));
        $this->assertTrue($uso->aparelho->is($this->safari));
    }

    public function test_contadores_comecam_em_zero(): void
    {
        $uso = RotinaUso::create([
            'user_id' => $this->aluno->id,
            'rotina_aparelho_id' => $this->safari->id,
            'dia' => '2026-12-09',
            'por_processo' => [],
        ])->fresh();

        $this->assertSame(0, $uso->enviados);
        $this->assertSame(0, $uso->respostas);
        $this->assertSame(0, $uso->resolvidos);
    }

    public function test_apagar_o_aparelho_apaga_as_linhas_dele(): void
    {
        DB::table('rotina_uso')->insert($this->linhaCrua($this->safari, '2026-12-09'));
        DB::table('rotina_uso')->insert($this->linhaCrua($this->instalado, '2026-12-09'));

        $this->safari->delete();

        $this->assertSame(0, RotinaUso::where('rotina_aparelho_id', $this->safari->id)->count());
        $this->assertSame(1, RotinaUso::where('rotina_aparelho_id', $this->instalado->id)->count());
    }

    public function test_apagar_o_usuario_apaga_as_linhas_dele(): void
    {
        DB::table('rotina_uso')->insert($this->linhaCrua($this->safari, '2026-12-09'));
        DB::table('rotina_uso')->insert($this->linhaCrua($this->instalado, '2026-12-10'));

        $this->aluno->delete();

        $this->assertSame(0, DB::table('rotina_uso')->count());
    }
}
