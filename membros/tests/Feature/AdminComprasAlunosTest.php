<?php

namespace Tests\Feature;

use App\Mail\LinkDeEntrada;
use App\Models\LessonProgress;
use App\Models\LoginToken;
use App\Models\Product;
use App\Models\Purchase;
use App\Models\User;
use Database\Seeders\ProdutoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AdminComprasAlunosTest extends TestCase
{
    use RefreshDatabase;

    private Product $kit;

    private Product $curso;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(ProdutoSeeder::class);
        Mail::fake();
        $this->kit = Product::where('slug', 'kit')->first();
        $this->curso = Product::create(['slug' => 'curso', 'nome' => 'Curso', 'preco_centavos' => 20000]);
    }

    private function admin(): User
    {
        $admin = User::create(['email' => 'admin@x.com', 'password' => 'segredo-123']);
        $admin->forceFill(['is_admin' => true])->save();

        return $admin;
    }

    private function compra(Product $p, array $dados = []): Purchase
    {
        return Purchase::create([
            'product_id' => $p->id,
            'reference' => (string) Str::uuid(),
            'valor_centavos' => $p->preco_centavos,
            ...$dados,
        ]);
    }

    public function test_visao_geral(): void
    {
        $aluno = User::create(['email' => 'a@b.com']);
        $this->compra($this->kit, ['status' => Purchase::PAGA, 'user_id' => $aluno->id, 'email' => 'a@b.com', 'paid_at' => now()]);
        $this->compra($this->curso);

        $this->actingAs($this->admin())->get('/admin')->assertOk()->assertInertia(fn (Assert $p) => $p
            ->component('Admin/VisaoGeral', false)
            ->where('numeros.vendas', 1)
            ->where('numeros.receita', 9700)
            ->where('numeros.alunos_ativos', 1)
            ->where('numeros.checkouts_abertos', 1)
            ->has('receita30', 30)
            ->where('receita30.29.centavos', 9700)
            ->has('porProduto', 3)
            ->has('ultimas', 2)
            ->has('adminProdutos', 3));
    }

    public function test_filtros_de_compras_e_csv(): void
    {
        $this->actingAs($this->admin());
        $paga = $this->compra($this->kit, ['status' => Purchase::PAGA, 'email' => 'paga@x.com', 'paid_at' => now()]);
        $this->compra($this->curso, ['email' => 'pendente@x.com']);
        $antiga = $this->compra($this->kit, ['email' => 'antiga@x.com', 'status' => Purchase::CANCELADA]);
        $antiga->forceFill(['created_at' => now()->subDays(40)])->save();

        $this->get('/admin/compras')->assertOk()->assertInertia(fn (Assert $p) => $p
            ->component('Admin/Compras', false)
            ->where('compras.total', 3)
            ->has('compras.data', 3)
            ->has('compras.links')
            ->where('compras.current_page', 1));

        $this->get('/admin/compras?status=paid')->assertInertia(fn (Assert $p) => $p
            ->where('compras.total', 1)
            ->where('compras.data.0.email', 'paga@x.com')
            ->where('compras.data.0.status_rotulo', 'Paga')
            ->where('compras.data.0.pode_revogar', true)
            ->where('filtros.status', 'paid'));

        $this->get('/admin/compras?produto=curso')->assertInertia(fn (Assert $p) => $p->where('compras.total', 1));
        $this->get('/admin/compras?busca='.substr($paga->reference, 0, 8))->assertInertia(fn (Assert $p) => $p->where('compras.data.0.id', $paga->id));
        $this->get('/admin/compras?de='.now()->subDays(45)->format('Y-m-d').'&ate='.now()->subDays(35)->format('Y-m-d'))
            ->assertInertia(fn (Assert $p) => $p->where('compras.total', 1)->where('compras.data.0.email', 'antiga@x.com'));
        $this->get('/admin/compras?status=xyz&de=31-12-2020')->assertInertia(fn (Assert $p) => $p
            ->where('compras.total', 3)->where('filtros.status', '')->where('filtros.de', ''));

        $csv = $this->get('/admin/compras/exportar?status=paid');
        $csv->assertOk()->assertHeader('content-type', 'text/csv; charset=UTF-8');
        $conteudo = $csv->streamedContent();
        $this->assertStringContainsString('paga@x.com', $conteudo);
        $this->assertStringContainsString('97,00', $conteudo);
        $this->assertStringNotContainsString('pendente@x.com', $conteudo);
        $this->assertStringContainsString('Referência', $conteudo);
    }

    public function test_lista_e_detalhe_de_alunos(): void
    {
        $this->actingAs($this->admin());
        $aluno = User::create(['email' => 'maria@x.com', 'name' => 'Maria']);
        User::create(['email' => 'joao@x.com', 'name' => 'João']);
        $compra = $this->compra($this->curso, ['status' => Purchase::PAGA, 'user_id' => $aluno->id, 'email' => 'maria@x.com', 'paid_at' => now()]);
        $modulo = $this->curso->modules()->create(['titulo' => 'M1', 'ordem' => 1]);
        $a1 = $modulo->lessons()->create(['titulo' => 'A1', 'ordem' => 1]);
        $modulo->lessons()->create(['titulo' => 'A2', 'ordem' => 2]);
        LessonProgress::create(['user_id' => $aluno->id, 'lesson_id' => $a1->id, 'concluida_em' => now()]);

        $this->get('/admin/alunos')->assertOk()->assertInertia(fn (Assert $p) => $p
            ->component('Admin/Alunos', false)
            ->where('alunos.total', 2));

        $this->get('/admin/alunos?busca=mar')->assertInertia(fn (Assert $p) => $p
            ->where('alunos.total', 1)
            ->where('alunos.data.0.nome', 'Maria')
            ->where('alunos.data.0.produtos', ['Curso'])
            ->where('alunos.data.0.total_pago', 20000));

        $this->get("/admin/alunos/{$aluno->id}")->assertOk()->assertInertia(fn (Assert $p) => $p
            ->component('Admin/Aluno', false)
            ->where('aluno.email', 'maria@x.com')
            ->where('acessos.0.compra_id', $compra->id)
            ->where('progresso.0.total', 2)
            ->where('progresso.0.concluidas', 1)
            ->where('progresso.0.percentual', 50)
            ->where('progresso.0.ultima_concluida.titulo', 'A1')
            ->has('compras', 1));

        $this->patch("/admin/alunos/{$aluno->id}", ['nome' => 'Maria Souza'])->assertRedirect();
        $this->assertSame('Maria Souza', $aluno->fresh()->name);

        $this->post("/admin/alunos/{$aluno->id}/link")->assertRedirect();
        Mail::assertSent(LinkDeEntrada::class, fn ($m) => $m->hasTo('maria@x.com'));

        $this->get('/admin/alunos/'.User::where('email', 'admin@x.com')->value('id'))->assertNotFound();
    }

    public function test_ultimo_acesso_registrado_no_link_magico(): void
    {
        $aluno = User::create(['email' => 'a@b.com']);
        $this->assertNull($aluno->last_login_at);

        $this->get('/entrar/'.LoginToken::emitir($aluno, 30));

        $this->assertNotNull($aluno->fresh()->last_login_at);
    }
}
