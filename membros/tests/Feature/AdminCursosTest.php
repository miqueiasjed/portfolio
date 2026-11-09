<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\Purchase;
use App\Models\User;
use Database\Seeders\ProdutoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AdminCursosTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(ProdutoSeeder::class);
        Storage::fake('uploads');
    }

    private function admin(): User
    {
        $admin = User::create(['email' => 'admin@x.com', 'password' => 'segredo-123']);
        $admin->forceFill(['is_admin' => true])->save();

        return $admin;
    }

    private function curso(string $slug = 'curso-a'): Product
    {
        return Product::create(['slug' => $slug, 'nome' => 'Curso '.$slug, 'preco_centavos' => 19700, 'arquivo_disco' => 'uploads']);
    }

    public function test_crud_de_curso(): void
    {
        $this->actingAs($this->admin());

        $this->get('/admin/cursos/novo')->assertOk()->assertInertia(fn (Assert $p) => $p->component('Admin/Curso', false)->where('produto', null));

        $this->post('/admin/cursos', ['nome' => 'Automação na Prática', 'slug' => '', 'preco_centavos' => 29700, 'ativo' => true])
            ->assertRedirect('/admin/cursos/automacao-na-pratica');
        $curso = Product::where('slug', 'automacao-na-pratica')->firstOrFail();
        $this->assertSame(29700, $curso->preco_centavos);

        $this->post('/admin/cursos', ['nome' => 'Outro', 'slug' => 'automacao-na-pratica', 'preco_centavos' => 1])->assertSessionHasErrors('slug');
        $this->post('/admin/cursos', ['nome' => 'Outro', 'slug' => 'novo', 'preco_centavos' => 1])->assertSessionHasErrors('slug');

        $this->get('/admin/cursos')->assertOk()->assertInertia(fn (Assert $p) => $p
            ->component('Admin/Cursos', false)
            ->has('cursos', 3)
            ->where('cursos.0.slug', 'automacao-na-pratica')
            ->where('cursos.0.link_compra', rtrim(config('app.url'), '/').'/comprar/automacao-na-pratica')
            ->has('adminProdutos', 3));

        $this->put('/admin/cursos/automacao-na-pratica', ['nome' => 'Automação', 'slug' => 'automacao', 'descricao' => 'Curso curto', 'preco_centavos' => 100, 'ativo' => false])
            ->assertRedirect('/admin/cursos/automacao');
        $curso->refresh();
        $this->assertSame('Automação', $curso->nome);
        $this->assertFalse($curso->ativo);

        $this->get('/admin/cursos/automacao')->assertOk()->assertInertia(fn (Assert $p) => $p
            ->component('Admin/Curso', false)
            ->where('produto.slug', 'automacao')
            ->where('produto.pode_excluir', true));

        $this->delete('/admin/cursos/automacao')->assertRedirect('/admin/cursos');
        $this->assertModelMissing($curso);
    }

    public function test_nao_exclui_curso_com_compras(): void
    {
        $this->actingAs($this->admin());
        $kit = Product::where('slug', 'kit')->first();
        Purchase::create(['product_id' => $kit->id, 'reference' => (string) Str::uuid(), 'valor_centavos' => 9700]);

        $this->from('/admin/cursos/kit')->delete('/admin/cursos/kit')
            ->assertRedirect('/admin/cursos/kit')
            ->assertSessionHasErrors('curso');
        $this->assertModelExists($kit);
    }

    public function test_crud_de_modulo_e_aula(): void
    {
        $this->actingAs($this->admin());
        $curso = $this->curso();

        $this->post("/admin/cursos/{$curso->slug}/modulos", ['titulo' => 'Começo'])->assertRedirect();
        $this->post("/admin/cursos/{$curso->slug}/modulos", ['titulo' => ''])->assertSessionHasErrors('titulo');
        $modulo = $curso->modules()->first();
        $this->assertSame(1, $modulo->ordem);

        $this->put("/admin/modulos/{$modulo->id}", ['titulo' => 'Primeiros passos'])->assertRedirect();
        $this->assertSame('Primeiros passos', $modulo->fresh()->titulo);

        $this->post("/admin/modulos/{$modulo->id}/aulas", [
            'titulo' => 'Boas-vindas',
            'descricao' => "Linha 1\nLinha 2",
            'video_url' => 'https://youtu.be/dQw4w9WgXcQ',
            'duracao_minutos' => 12,
        ])->assertRedirect()->assertSessionHasNoErrors();
        $this->post("/admin/modulos/{$modulo->id}/aulas", ['titulo' => 'X', 'video_url' => 'nao é link'])->assertSessionHasErrors('video_url');

        $aula = $modulo->lessons()->first();
        $this->assertTrue($aula->publicada);
        $this->assertSame(12, $aula->duracao_minutos);

        $this->get("/admin/cursos/{$curso->slug}")->assertInertia(fn (Assert $p) => $p
            ->where('modulos.0.aulas.0.video_embed', 'https://www.youtube.com/embed/dQw4w9WgXcQ')
            ->where('modulos.0.aulas.0.video_url', 'https://youtu.be/dQw4w9WgXcQ'));

        $this->put("/admin/aulas/{$aula->id}", ['titulo' => 'Boas-vindas!', 'publicada' => false])->assertRedirect();
        $aula->refresh();
        $this->assertSame('Boas-vindas!', $aula->titulo);
        $this->assertFalse($aula->publicada);

        $this->delete("/admin/aulas/{$aula->id}")->assertRedirect();
        $this->assertModelMissing($aula);

        $this->delete("/admin/modulos/{$modulo->id}")->assertRedirect();
        $this->assertModelMissing($modulo);
    }

    public function test_reordena_e_move_aula_entre_modulos(): void
    {
        $this->actingAs($this->admin());
        $curso = $this->curso();
        $m1 = $curso->modules()->create(['titulo' => 'M1', 'ordem' => 1]);
        $m2 = $curso->modules()->create(['titulo' => 'M2', 'ordem' => 2]);
        $a1 = $m1->lessons()->create(['titulo' => 'A1', 'ordem' => 1]);
        $a2 = $m1->lessons()->create(['titulo' => 'A2', 'ordem' => 2]);
        $a3 = $m2->lessons()->create(['titulo' => 'A3', 'ordem' => 1]);

        $this->postJson("/admin/cursos/{$curso->slug}/ordem", ['modulos' => [
            ['id' => $m2->id, 'aulas' => [$a3->id, $a1->id]],
            ['id' => $m1->id, 'aulas' => [$a2->id]],
        ]])->assertRedirect();

        $this->assertSame(1, $m2->fresh()->ordem);
        $this->assertSame(2, $m1->fresh()->ordem);
        $this->assertSame([$m2->id, 2], [$a1->fresh()->module_id, $a1->fresh()->ordem]);
        $this->assertSame(1, $a2->fresh()->ordem);
    }

    public function test_reordenacao_recusa_id_de_outro_curso_ou_incompleta(): void
    {
        $this->actingAs($this->admin());
        $curso = $this->curso();
        $outro = $this->curso('curso-b');
        $m1 = $curso->modules()->create(['titulo' => 'M1', 'ordem' => 1]);
        $a1 = $m1->lessons()->create(['titulo' => 'A1', 'ordem' => 1]);
        $mOutro = $outro->modules()->create(['titulo' => 'Fora', 'ordem' => 1]);
        $aOutra = $mOutro->lessons()->create(['titulo' => 'Fora', 'ordem' => 1]);

        // aula de outro curso
        $this->post("/admin/cursos/{$curso->slug}/ordem", ['modulos' => [
            ['id' => $m1->id, 'aulas' => [$a1->id, $aOutra->id]],
        ]])->assertSessionHasErrors('ordem');
        $this->assertSame($mOutro->id, $aOutra->fresh()->module_id);

        // módulo de outro curso
        $this->post("/admin/cursos/{$curso->slug}/ordem", ['modulos' => [
            ['id' => $m1->id, 'aulas' => [$a1->id]],
            ['id' => $mOutro->id, 'aulas' => []],
        ]])->assertSessionHasErrors('ordem');

        // ordem incompleta (faltou a aula)
        $this->post("/admin/cursos/{$curso->slug}/ordem", ['modulos' => [
            ['id' => $m1->id, 'aulas' => []],
        ]])->assertSessionHasErrors('ordem');
        $this->assertSame($m1->id, $a1->fresh()->module_id);
    }

    public function test_upload_troca_e_remocao_de_anexo_e_arquivo(): void
    {
        $this->actingAs($this->admin());
        $curso = $this->curso();
        $modulo = $curso->modules()->create(['titulo' => 'M1', 'ordem' => 1]);

        $this->post("/admin/modulos/{$modulo->id}/aulas", [
            'titulo' => 'Com material',
            'anexo' => UploadedFile::fake()->create('Planilha de custos.xlsx', 20),
        ])->assertSessionHasNoErrors();

        $aula = $modulo->lessons()->first();
        $this->assertSame('Planilha de custos.xlsx', $aula->anexo_nome);
        $this->assertNotSame('Planilha de custos.xlsx', basename($aula->anexo_path));
        Storage::disk('uploads')->assertExists($aula->anexo_path);
        $antigo = $aula->anexo_path;

        $this->get("/admin/aulas/{$aula->id}/anexo")->assertOk()->assertDownload('Planilha de custos.xlsx');

        // troca: apaga o antigo
        $this->post("/admin/aulas/{$aula->id}", [
            '_method' => 'PUT',
            'titulo' => 'Com material',
            'anexo' => UploadedFile::fake()->create('nova.pdf', 10),
        ])->assertSessionHasNoErrors();
        $aula->refresh();
        Storage::disk('uploads')->assertMissing($antigo);
        Storage::disk('uploads')->assertExists($aula->anexo_path);

        // remover
        $this->put("/admin/aulas/{$aula->id}", ['titulo' => 'Com material', 'remover_anexo' => true]);
        Storage::disk('uploads')->assertMissing($aula->anexo_path);
        $this->assertNull($aula->fresh()->anexo_path);

        // acima de 50 MB
        $this->post("/admin/modulos/{$modulo->id}/aulas", [
            'titulo' => 'Grande',
            'anexo' => UploadedFile::fake()->create('grande.zip', 51201),
        ])->assertSessionHasErrors('anexo');

        // arquivo principal
        $this->post("/admin/cursos/{$curso->slug}/arquivo", ['arquivo' => UploadedFile::fake()->create('Apostila.pdf', 30)])
            ->assertSessionHasNoErrors();
        $curso->refresh();
        $this->assertSame(['uploads', 'Apostila.pdf'], [$curso->arquivo_disco, $curso->arquivo_nome]);
        Storage::disk('uploads')->assertExists($curso->arquivo_path);
        $principal = $curso->arquivo_path;

        $this->delete("/admin/cursos/{$curso->slug}/arquivo")->assertRedirect();
        Storage::disk('uploads')->assertMissing($principal);
        $this->assertNull($curso->fresh()->arquivo_path);
    }

    public function test_seeder_nao_sobrescreve_edicao_do_admin(): void
    {
        Product::where('slug', 'kit')->update(['nome' => 'Kit editado', 'preco_centavos' => 4700]);

        $this->seed(ProdutoSeeder::class);

        $kit = Product::where('slug', 'kit')->first();
        $this->assertSame('Kit editado', $kit->nome);
        $this->assertSame(4700, $kit->preco_centavos);
        $this->assertSame(1, Product::where('slug', 'kit')->count());
    }

    public function test_seeder_cria_rotina_sem_sobrescrever(): void
    {
        $this->seed(ProdutoSeeder::class);

        $rotina = Product::where('slug', Product::ROTINA)->firstOrFail();
        $this->assertSame('rotina-do-dia', Product::ROTINA);
        $this->assertSame('Rotina do Dia', $rotina->nome);
        $this->assertSame(14700, $rotina->preco_centavos);

        $rotina->update(['nome' => 'Rotina editada', 'preco_centavos' => 19700]);

        $this->seed(ProdutoSeeder::class);

        $rotina = Product::where('slug', Product::ROTINA)->first();
        $this->assertSame('Rotina editada', $rotina->nome);
        $this->assertSame(19700, $rotina->preco_centavos);
        $this->assertSame(1, Product::where('slug', Product::ROTINA)->count());
    }

    public function test_comprado_por_so_com_compra_paga(): void
    {
        $rotina = Product::where('slug', Product::ROTINA)->firstOrFail();
        $kit = Product::where('slug', 'kit')->firstOrFail();
        $aluno = User::create(['email' => 'aluno@x.com']);
        $compra = fn (Product $p, string $status) => Purchase::create([
            'product_id' => $p->id, 'user_id' => $aluno->id, 'reference' => (string) Str::uuid(),
            'valor_centavos' => 14700, 'status' => $status,
        ]);

        $compra($rotina, Purchase::PENDENTE);
        $compra($rotina, Purchase::REEMBOLSADA);
        $compra($kit, Purchase::PAGA);
        $this->assertFalse($rotina->compradoPor($aluno));

        $compra($rotina, Purchase::PAGA);
        $this->assertTrue($rotina->compradoPor($aluno));
        $this->assertFalse($rotina->compradoPor(User::create(['email' => 'outro@x.com'])));
    }

    public function test_cliente_recebe_403_em_todas_as_rotas_novas_do_admin(): void
    {
        $cliente = User::create(['email' => 'c@d.com']);
        $curso = $this->curso();
        $modulo = $curso->modules()->create(['titulo' => 'M1', 'ordem' => 1]);
        $aula = $modulo->lessons()->create(['titulo' => 'A1', 'ordem' => 1]);
        $compra = Purchase::create(['product_id' => $curso->id, 'reference' => (string) Str::uuid(), 'valor_centavos' => 1]);

        $rotas = [
            ['get', '/admin'],
            ['get', '/admin/compras'],
            ['get', '/admin/compras/exportar'],
            ['post', '/admin/liberar'],
            ['post', "/admin/compras/{$compra->id}/reenviar"],
            ['post', "/admin/compras/{$compra->id}/revogar"],
            ['get', '/admin/alunos'],
            ['get', "/admin/alunos/{$cliente->id}"],
            ['patch', "/admin/alunos/{$cliente->id}"],
            ['post', "/admin/alunos/{$cliente->id}/link"],
            ['get', '/admin/cursos'],
            ['get', '/admin/cursos/novo'],
            ['post', '/admin/cursos'],
            ['get', "/admin/cursos/{$curso->slug}"],
            ['put', "/admin/cursos/{$curso->slug}"],
            ['delete', "/admin/cursos/{$curso->slug}"],
            ['get', "/admin/cursos/{$curso->slug}/arquivo"],
            ['post', "/admin/cursos/{$curso->slug}/arquivo"],
            ['delete', "/admin/cursos/{$curso->slug}/arquivo"],
            ['post', "/admin/cursos/{$curso->slug}/ordem"],
            ['post', "/admin/cursos/{$curso->slug}/modulos"],
            ['put', "/admin/modulos/{$modulo->id}"],
            ['delete', "/admin/modulos/{$modulo->id}"],
            ['post', "/admin/modulos/{$modulo->id}/aulas"],
            ['put', "/admin/aulas/{$aula->id}"],
            ['delete', "/admin/aulas/{$aula->id}"],
            ['get', "/admin/aulas/{$aula->id}/anexo"],
        ];

        foreach ($rotas as [$metodo, $url]) {
            $this->actingAs($cliente)->{$metodo}($url)->assertForbidden();
        }

        $this->assertModelExists($curso);
        $this->assertModelExists($modulo);
        $this->assertModelExists($aula);
    }
}
