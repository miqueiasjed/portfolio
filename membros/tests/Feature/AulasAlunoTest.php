<?php

namespace Tests\Feature;

use App\Models\LessonProgress;
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

class AulasAlunoTest extends TestCase
{
    use RefreshDatabase;

    private Product $curso;

    private User $aluno;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(ProdutoSeeder::class);
        Storage::fake('uploads');

        $this->curso = Product::create(['slug' => 'curso', 'nome' => 'Curso', 'preco_centavos' => 100, 'arquivo_disco' => 'uploads']);
        $this->aluno = User::create(['email' => 'a@b.com']);
        Purchase::create([
            'product_id' => $this->curso->id, 'reference' => (string) Str::uuid(), 'valor_centavos' => 100,
            'user_id' => $this->aluno->id, 'status' => Purchase::PAGA,
        ]);
    }

    private function aulas(): array
    {
        $m1 = $this->curso->modules()->create(['titulo' => 'M1', 'ordem' => 1]);
        $m2 = $this->curso->modules()->create(['titulo' => 'M2', 'ordem' => 2]);

        return [
            $m1->lessons()->create(['titulo' => 'A1', 'ordem' => 1, 'video_url' => 'https://vimeo.com/76979871']),
            $m1->lessons()->create(['titulo' => 'Rascunho', 'ordem' => 2, 'publicada' => false]),
            $m2->lessons()->create(['titulo' => 'A2', 'ordem' => 1, 'video_url' => 'https://exemplo.com/video']),
        ];
    }

    public function test_aula_abre_para_quem_comprou_com_progresso_e_vizinhas(): void
    {
        [$a1, , $a2] = $this->aulas();

        $this->actingAs($this->aluno)->get("/produtos/curso/aulas/{$a1->id}")->assertOk()->assertInertia(fn (Assert $p) => $p
            ->component('Aula', false)
            ->where('aula.video_embed', 'https://player.vimeo.com/video/76979871')
            ->where('aula.concluida', false)
            ->where('anterior', null)
            ->where('proxima.id', $a2->id)
            ->where('curso.total', 2)
            ->where('curso.proxima.id', $a1->id)
            ->has('curso.modulos', 2));

        $this->get("/produtos/curso/aulas/{$a2->id}")->assertInertia(fn (Assert $p) => $p
            ->where('aula.video_embed', null)
            ->where('aula.video_url', 'https://exemplo.com/video')
            ->where('anterior.id', $a1->id)
            ->where('proxima', null));

        $this->get('/produtos/curso')->assertOk()->assertInertia(fn (Assert $p) => $p
            ->component('Produto', false)
            ->where('curso.total', 2)
            ->where('curso.modulos.0.aulas.0.concluida', false));
    }

    public function test_concluir_alterna_e_atualiza_progresso(): void
    {
        [$a1, , $a2] = $this->aulas();
        $this->actingAs($this->aluno);

        $this->from("/produtos/curso/aulas/{$a1->id}")->post("/produtos/curso/aulas/{$a1->id}/concluir")
            ->assertRedirect("/produtos/curso/aulas/{$a1->id}");
        $this->assertDatabaseHas('lesson_progress', ['user_id' => $this->aluno->id, 'lesson_id' => $a1->id]);

        $this->get('/')->assertInertia(fn (Assert $p) => $p
            ->component('Area', false)
            ->where('produtos.0.slug', 'curso')
            ->where('produtos.0.curso.concluidas', 1)
            ->where('produtos.0.curso.percentual', 50)
            ->where('produtos.0.curso.proxima.id', $a2->id));

        $this->post("/produtos/curso/aulas/{$a1->id}/concluir");
        $this->assertSame(0, LessonProgress::count());
    }

    public function test_concluir_com_estado_desejado_e_idempotente(): void
    {
        [$a1] = $this->aulas();
        $this->actingAs($this->aluno);

        $this->post("/produtos/curso/aulas/{$a1->id}/concluir", ['concluida' => true]);
        $this->post("/produtos/curso/aulas/{$a1->id}/concluir", ['concluida' => true]);
        $this->assertSame(1, LessonProgress::count());

        $this->post("/produtos/curso/aulas/{$a1->id}/concluir", ['concluida' => false]);
        $this->post("/produtos/curso/aulas/{$a1->id}/concluir", ['concluida' => false]);
        $this->assertSame(0, LessonProgress::count());
    }

    public function test_sem_compra_403_outro_produto_404_e_nao_publicada_404(): void
    {
        [$a1, $rascunho] = $this->aulas();
        $semCompra = User::create(['email' => 'c@d.com']);

        $this->actingAs($semCompra)->get("/produtos/curso/aulas/{$a1->id}")->assertForbidden();
        $this->actingAs($semCompra)->post("/produtos/curso/aulas/{$a1->id}/concluir")->assertForbidden();
        $this->actingAs($semCompra)->get("/produtos/curso/aulas/{$a1->id}/anexo")->assertForbidden();

        // aula de outro produto, pela URL do produto comprado
        $outro = Product::create(['slug' => 'outro', 'nome' => 'Outro', 'preco_centavos' => 1]);
        $aulaDeFora = $outro->modules()->create(['titulo' => 'X', 'ordem' => 1])->lessons()->create(['titulo' => 'X', 'ordem' => 1]);
        $this->actingAs($this->aluno)->get("/produtos/curso/aulas/{$aulaDeFora->id}")->assertNotFound();
        $this->actingAs($this->aluno)->post("/produtos/curso/aulas/{$aulaDeFora->id}/concluir")->assertNotFound();

        $this->actingAs($this->aluno)->get("/produtos/curso/aulas/{$rascunho->id}")->assertNotFound();
        $this->actingAs($this->aluno)->post("/produtos/curso/aulas/{$rascunho->id}/concluir")->assertNotFound();
        $this->assertSame(0, LessonProgress::count());
    }

    public function test_download_de_anexo_e_arquivo_enviado(): void
    {
        [$a1] = $this->aulas();
        $caminho = UploadedFile::fake()->create('Material.pdf', 5)->store('cursos/1/aulas', 'uploads');
        $a1->update(['anexo_path' => $caminho, 'anexo_nome' => 'Material.pdf']);

        $this->actingAs($this->aluno)->get("/produtos/curso/aulas/{$a1->id}/anexo")->assertOk()->assertDownload('Material.pdf');

        $principal = UploadedFile::fake()->create('Apostila.pdf', 5)->store('cursos/1', 'uploads');
        $this->curso->update(['arquivo_path' => $principal, 'arquivo_nome' => 'Apostila.pdf']);
        $this->get('/produtos/curso/download')->assertOk()->assertDownload('Apostila.pdf');
    }
}
