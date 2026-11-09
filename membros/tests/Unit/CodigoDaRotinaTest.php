<?php

namespace Tests\Unit;

use App\Mail\CodigoDaRotina as EmailDoCodigo;
use App\Models\Product;
use App\Models\Purchase;
use App\Models\User;
use App\Services\CodigoDaRotina;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Tests\TestCase;

class CodigoDaRotinaTest extends TestCase
{
    use RefreshDatabase;

    private const CHAVE = 'rotina-codigo:aluno@exemplo.com';

    private CodigoDaRotina $servico;

    private User $aluno;

    private Product $rotina;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();

        $this->servico = new CodigoDaRotina;
        $this->aluno = User::create(['email' => 'aluno@exemplo.com']);
        $this->rotina = Product::create(['slug' => Product::ROTINA, 'nome' => 'Rotina do Dia', 'preco_centavos' => 14700]);
        $this->comprar($this->aluno, $this->rotina, Purchase::PAGA);
    }

    private function comprar(User $user, Product $produto, string $status): Purchase
    {
        return Purchase::create([
            'product_id' => $produto->id,
            'user_id' => $user->id,
            'reference' => (string) Str::uuid(),
            'valor_centavos' => $produto->preco_centavos,
            'status' => $status,
        ]);
    }

    /** Pede um código e devolve o valor puro que foi no e-mail. */
    private function pedirCodigo(string $email = 'aluno@exemplo.com'): string
    {
        $this->servico->pedir($email);

        $codigo = null;
        Mail::assertSent(EmailDoCodigo::class, function (EmailDoCodigo $m) use (&$codigo) {
            $codigo = $m->codigo;

            return true;
        });

        return $codigo;
    }

    private function errado(string $certo): string
    {
        return CodigoDaRotina::formatar(((int) $certo + 1) % 1000000);
    }

    public function test_codigo_tem_sempre_seis_digitos_com_zero_a_esquerda(): void
    {
        $this->assertSame('000000', CodigoDaRotina::formatar(0));
        $this->assertSame('000042', CodigoDaRotina::formatar(42));
        $this->assertSame('999999', CodigoDaRotina::formatar(999999));

        $this->assertMatchesRegularExpression('/^\d{6}$/', $this->pedirCodigo());
    }

    public function test_cache_guarda_so_o_hash_e_o_prazo(): void
    {
        $this->freezeSecond();
        $codigo = $this->pedirCodigo();

        $dados = Cache::get(self::CHAVE);
        $this->assertSame([
            'hash' => CodigoDaRotina::hash($codigo),
            'erros' => 0,
            'expira_em' => now()->addMinutes(15)->getTimestamp(),
        ], $dados);
        $this->assertStringNotContainsString($codigo, serialize($dados));

        Mail::assertSent(EmailDoCodigo::class, fn ($m) => $m->hasTo('aluno@exemplo.com')
            && $m->envelope()->subject === 'Seu código da Rotina do Dia');

        $html = (new EmailDoCodigo($codigo))->render();
        $this->assertStringContainsString($codigo, $html);
        $this->assertStringContainsString('Digite este código no aplicativo. Ele vale por 15 minutos.', $html);
        $this->assertStringContainsString('Se não foi você, ignore este e-mail.', $html);
    }

    public function test_codigo_certo_devolve_o_usuario_e_apaga_a_chave(): void
    {
        $codigo = $this->pedirCodigo();

        $user = $this->servico->confirmar('aluno@exemplo.com', $codigo);

        $this->assertTrue($user->is($this->aluno));
        $this->assertNull(Cache::get(self::CHAVE));
        // não serve duas vezes
        $this->assertNull($this->servico->confirmar('aluno@exemplo.com', $codigo));
    }

    public function test_codigo_errado_soma_um_erro(): void
    {
        $codigo = $this->pedirCodigo();

        $this->assertNull($this->servico->confirmar('aluno@exemplo.com', $this->errado($codigo)));

        $this->assertSame(1, Cache::get(self::CHAVE)['erros']);
        $this->assertTrue($this->servico->confirmar('aluno@exemplo.com', $codigo)->is($this->aluno));
    }

    public function test_cinco_erros_invalidam_mesmo_com_o_sexto_certo(): void
    {
        $codigo = $this->pedirCodigo();

        for ($i = 0; $i < 5; $i++) {
            $this->assertNull($this->servico->confirmar('aluno@exemplo.com', $this->errado($codigo)));
        }

        $this->assertNull(Cache::get(self::CHAVE));
        $this->assertNull($this->servico->confirmar('aluno@exemplo.com', $codigo));
    }

    public function test_codigo_vencido_falha(): void
    {
        $codigo = $this->pedirCodigo();

        $this->travel(15)->minutes();
        $this->travel(1)->seconds();

        $this->assertNull($this->servico->confirmar('aluno@exemplo.com', $codigo));
    }

    public function test_erro_nao_renova_o_prazo(): void
    {
        $this->freezeSecond();
        $codigo = $this->pedirCodigo();
        $expira = Cache::get(self::CHAVE)['expira_em'];

        $this->travel(14)->minutes();
        $this->servico->confirmar('aluno@exemplo.com', $this->errado($codigo));
        $this->assertSame($expira, Cache::get(self::CHAVE)['expira_em']);

        $this->travel(61)->seconds();
        $this->assertNull($this->servico->confirmar('aluno@exemplo.com', $codigo));
    }

    public function test_pedido_novo_troca_o_codigo_e_mantem_os_erros(): void
    {
        $primeiro = $this->pedirCodigo();
        $this->servico->confirmar('aluno@exemplo.com', $this->errado($primeiro));
        $this->servico->confirmar('aluno@exemplo.com', $this->errado($primeiro));

        $this->servico->pedir('aluno@exemplo.com');
        $segundo = null;
        Mail::assertSent(EmailDoCodigo::class, 2);
        Mail::sent(EmailDoCodigo::class)->each(function ($m) use (&$segundo) {
            $segundo = $m->codigo;
        });

        $dados = Cache::get(self::CHAVE);
        $this->assertSame(2, $dados['erros']);
        $this->assertSame(CodigoDaRotina::hash($segundo), $dados['hash']);

        if ($primeiro !== $segundo) {
            $this->assertNull($this->servico->confirmar('aluno@exemplo.com', $primeiro));
        }
    }

    public function test_email_sem_compra_nao_gera_cache_nem_email(): void
    {
        $semCompra = User::create(['email' => 'outro@exemplo.com']);
        $this->comprar($semCompra, $this->rotina, Purchase::PENDENTE);
        $kit = Product::create(['slug' => 'kit', 'nome' => 'Kit', 'preco_centavos' => 9700]);
        $this->comprar($semCompra, $kit, Purchase::PAGA);

        $this->servico->pedir('outro@exemplo.com');
        $this->servico->pedir('ninguem@exemplo.com');

        Mail::assertNothingSent();
        $this->assertNull(Cache::get('rotina-codigo:outro@exemplo.com'));
        $this->assertNull(Cache::get('rotina-codigo:ninguem@exemplo.com'));
    }

    public function test_email_e_normalizado(): void
    {
        $codigo = $this->pedirCodigo('  Aluno@Exemplo.COM ');

        $this->assertNotNull(Cache::get(self::CHAVE));
        $this->assertTrue($this->servico->confirmar(' ALUNO@exemplo.com', $codigo)->is($this->aluno));
    }

    public function test_compra_reembolsada_depois_do_pedido_nao_entra(): void
    {
        $codigo = $this->pedirCodigo();
        Purchase::query()->update(['status' => Purchase::REEMBOLSADA]);

        $this->assertNull($this->servico->confirmar('aluno@exemplo.com', $codigo));
    }
}
