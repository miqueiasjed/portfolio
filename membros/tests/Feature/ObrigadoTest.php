<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\Purchase;
use Database\Seeders\ProdutoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ObrigadoTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(ProdutoSeeder::class);
    }

    private function compra(string $slug, string $status): Purchase
    {
        return Purchase::create([
            'product_id' => Product::where('slug', $slug)->value('id'),
            'reference' => (string) Str::uuid(),
            'email' => 'cliente@exemplo.com',
            'status' => $status,
            'valor_centavos' => 14700,
        ]);
    }

    /** Props próprias da página, sem as compartilhadas pelo middleware. */
    private function propsDaPagina(Assert $p): array
    {
        return array_keys(array_diff_key($p->toArray()['props'], array_flip(['usuario', 'site', 'aviso', 'errors'])));
    }

    public function test_compra_paga_da_rotina_manda_o_slug(): void
    {
        $compra = $this->compra(Product::ROTINA, Purchase::PAGA);

        $this->get("/obrigado?ref={$compra->reference}")->assertOk()->assertInertia(function (Assert $p) {
            $p->component('Obrigado')
                ->where('paga', true)
                ->where('slug', Product::ROTINA)
                ->where('produto', 'Rotina do Dia');
            $this->assertEqualsCanonicalizing(['paga', 'produto', 'slug'], $this->propsDaPagina($p));
        });
    }

    public function test_compra_pendente_do_kit(): void
    {
        $compra = $this->compra('kit', Purchase::PENDENTE);

        $this->get("/obrigado?ref={$compra->reference}")->assertOk()->assertInertia(function (Assert $p) {
            $p->component('Obrigado')
                ->where('paga', false)
                ->where('slug', 'kit');
            $this->assertEqualsCanonicalizing(['paga', 'produto', 'slug'], $this->propsDaPagina($p));
        });
    }

    public function test_referencia_inexistente_nao_quebra(): void
    {
        $this->get('/obrigado?ref='.Str::uuid())->assertOk()->assertInertia(fn (Assert $p) => $p
            ->component('Obrigado')
            ->where('paga', false)
            ->where('slug', null)
            ->where('produto', null));
    }
}
