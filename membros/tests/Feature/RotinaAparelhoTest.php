<?php

namespace Tests\Feature;

use App\Models\RotinaAparelho;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class RotinaAparelhoTest extends TestCase
{
    use RefreshDatabase;

    private const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

    private const ANDROID_CHROME = 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.122 Mobile Safari/537.36';

    private User $aluno;

    protected function setUp(): void
    {
        parent::setUp();
        $this->aluno = User::create(['email' => 'a@b.com']);
    }

    public function test_emitir_grava_so_o_hash(): void
    {
        [$aparelho, $puro] = RotinaAparelho::emitir($this->aluno, self::IPHONE_SAFARI);

        $this->assertSame(64, strlen($puro));
        $this->assertSame(64, strlen($aparelho->token_hash));
        $this->assertSame(hash('sha256', $puro), $aparelho->token_hash);
        $this->assertSame($this->aluno->id, $aparelho->user_id);
        $this->assertSame('iPhone, Safari', $aparelho->nome);

        // nenhuma coluna da linha guarda o valor puro
        $linha = (array) DB::table('rotina_aparelhos')->where('id', $aparelho->id)->first();
        $this->assertNotContains($puro, array_map('strval', $linha));
    }

    public function test_por_token_acha_o_aparelho_certo(): void
    {
        [$primeiro, $puro1] = RotinaAparelho::emitir($this->aluno, self::IPHONE_SAFARI);
        [$segundo, $puro2] = RotinaAparelho::emitir($this->aluno, self::ANDROID_CHROME);

        $this->assertTrue(RotinaAparelho::porToken($puro1)->is($primeiro));
        $this->assertTrue(RotinaAparelho::porToken($puro2)->is($segundo));
        $this->assertSame(2, RotinaAparelho::where('user_id', $this->aluno->id)->count());
    }

    public function test_revogado_vazio_e_desconhecido_devolvem_null(): void
    {
        [$aparelho, $puro] = RotinaAparelho::emitir($this->aluno, null);
        $aparelho->update(['revogado_em' => now()]);

        $this->assertNull(RotinaAparelho::porToken($puro));
        $this->assertNull(RotinaAparelho::porToken('nao-existe'));
        $this->assertNull(RotinaAparelho::porToken(''));
        $this->assertNull(RotinaAparelho::porToken(null));
    }

    public function test_apagar_usuario_apaga_os_aparelhos(): void
    {
        RotinaAparelho::emitir($this->aluno, self::IPHONE_SAFARI);
        RotinaAparelho::emitir($this->aluno, self::ANDROID_CHROME);

        $this->aluno->delete();

        $this->assertSame(0, RotinaAparelho::count());
    }

    public function test_nome_do_aparelho(): void
    {
        $this->assertSame('iPhone, Safari', RotinaAparelho::nomeDoAparelho(self::IPHONE_SAFARI));
        $this->assertSame('Android, Chrome', RotinaAparelho::nomeDoAparelho(self::ANDROID_CHROME));
        $this->assertSame('Computador, Firefox', RotinaAparelho::nomeDoAparelho(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0'
        ));
        $this->assertSame('Computador', RotinaAparelho::nomeDoAparelho('curl/8.4.0'));
        $this->assertNull(RotinaAparelho::nomeDoAparelho(null));
        $this->assertNull(RotinaAparelho::nomeDoAparelho('   '));
        $this->assertLessThanOrEqual(60, mb_strlen(RotinaAparelho::nomeDoAparelho(str_repeat('x', 500))));
    }
}
