<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

// Rotas públicas da Rotina do Dia: casca, manifest e service worker.
// O manifest do Vite é sempre falso e mora numa pasta temporária: nenhum
// teste depende do build nem escreve em public/build.
class RotinaCascaTest extends TestCase
{
    use RefreshDatabase;

    private string $publico;

    private string $envOriginal;

    protected function setUp(): void
    {
        parent::setUp();

        $this->envOriginal = $this->app->environment();
        $this->publico = storage_path('framework/testing/publico-'.uniqid('', true));
        File::ensureDirectoryExists($this->publico);
        $this->app->usePublicPath($this->publico);
    }

    protected function tearDown(): void
    {
        $this->app->detectEnvironment(fn () => $this->envOriginal);
        File::deleteDirectory($this->publico);

        parent::tearDown();
    }

    // Manifest no formato do Vite 8, com as duas entradas da ferramenta, um
    // chunk compartilhado com a área de membros, um chunk que importa o
    // app.jsx e as entradas da área de membros.
    private function manifest(string $mainJs = 'assets/main-r1.js', string $appJs = 'assets/app-a1.js'): array
    {
        return [
            'resources/rotina/main.jsx' => [
                'file' => $mainJs,
                'isEntry' => true,
                'css' => ['assets/rotina-r1.css'],
                'imports' => ['_comum-c1.js'],
                'dynamicImports' => ['_ponte-p1.js'],
            ],
            'resources/rotina/rotina.css' => [
                'file' => 'assets/rotina-r1.css',
                'isEntry' => true,
            ],
            '_comum-c1.js' => [
                'file' => 'assets/comum-c1.js',
            ],
            '_ponte-p1.js' => [
                'file' => 'assets/ponte-p1.js',
                'imports' => ['resources/js/app.jsx'],
            ],
            'resources/js/app.jsx' => [
                'file' => $appJs,
                'isEntry' => true,
                'css' => ['assets/app-a1.css'],
                'imports' => ['_comum-c1.js'],
            ],
            'resources/css/app.css' => [
                'file' => 'assets/app-a1.css',
                'isEntry' => true,
            ],
        ];
    }

    private function gravarManifest(array $manifest): void
    {
        File::ensureDirectoryExists($this->publico.'/build');
        file_put_contents($this->publico.'/build/manifest.json', json_encode($manifest));
    }

    private function versaoDoSw(string $conteudo): string
    {
        $this->assertSame(1, preg_match('/const VERSAO = "([^"]*)";/', $conteudo, $m));

        return $m[1];
    }

    private function arquivosDoSw(string $conteudo): array
    {
        $this->assertSame(1, preg_match('/const ARQUIVOS = (\[.*?\]);/', $conteudo, $m));

        return json_decode($m[1], true);
    }

    public function test_casca_e_publica_e_traz_manifest_e_csrf(): void
    {
        $this->get('/rotina')
            ->assertOk()
            ->assertSee('name="csrf-token"', false)
            ->assertSee('href="/rotina/manifest.webmanifest"', false)
            ->assertSee('id="rotina"', false);

        $user = User::create(['email' => 'dona@exemplo.com']);

        $this->actingAs($user)->get('/rotina')
            ->assertOk()
            ->assertDontSee('dona@exemplo.com');
    }

    public function test_casca_com_barra_final_tambem_responde(): void
    {
        $this->get('/rotina/')
            ->assertOk()
            ->assertSee('id="rotina"', false);
    }

    public function test_manifest_tem_os_campos_do_contrato(): void
    {
        $resposta = $this->get('/rotina/manifest.webmanifest')->assertOk();

        $this->assertStringContainsString('application/manifest+json', $resposta->headers->get('Content-Type'));

        $resposta->assertJsonPath('start_url', '/rotina#/hoje')
            ->assertJsonPath('scope', '/rotina')
            ->assertJsonPath('display', 'standalone')
            ->assertJsonCount(2, 'icons');
    }

    public function test_sw_lista_assets_da_rotina_e_nenhum_da_area_de_membros(): void
    {
        $this->gravarManifest($this->manifest());

        $resposta = $this->get('/rotina/sw.js')->assertOk();

        $this->assertStringContainsString('no-cache', $resposta->headers->get('Cache-Control'));
        $this->assertSame('/rotina', $resposta->headers->get('Service-Worker-Allowed'));
        $this->assertStringContainsString('javascript', $resposta->headers->get('Content-Type'));

        $arquivos = $this->arquivosDoSw($resposta->getContent());

        // arquivos da ferramenta e do chunk compartilhado
        foreach (['/build/assets/main-r1.js', '/build/assets/rotina-r1.css', '/build/assets/comum-c1.js'] as $esperado) {
            $this->assertContains($esperado, $arquivos);
        }

        // nada do app.jsx nem do app.css, nem repetido
        $this->assertNotContains('/build/assets/app-a1.js', $arquivos);
        $this->assertNotContains('/build/assets/app-a1.css', $arquivos);
        $this->assertSame($arquivos, array_values(array_unique($arquivos)));
    }

    public function test_versao_do_sw_muda_com_a_rotina_e_nao_muda_com_o_app(): void
    {
        $this->gravarManifest($this->manifest());
        $base = $this->versaoDoSw($this->get('/rotina/sw.js')->getContent());

        // só o app.jsx mudou: mesma versão
        $this->gravarManifest($this->manifest(appJs: 'assets/app-a2.js'));
        $this->assertSame($base, $this->versaoDoSw($this->get('/rotina/sw.js')->getContent()));

        // um arquivo da ferramenta mudou: versão nova
        $this->gravarManifest($this->manifest(mainJs: 'assets/main-r2.js'));
        $this->assertNotSame($base, $this->versaoDoSw($this->get('/rotina/sw.js')->getContent()));
    }

    public function test_sw_sem_manifest_em_testing_responde_com_lista_vazia_e_versao_dev(): void
    {
        $resposta = $this->get('/rotina/sw.js')->assertOk();
        $conteudo = $resposta->getContent();

        $this->assertSame('dev', $this->versaoDoSw($conteudo));
        $this->assertSame([], $this->arquivosDoSw($conteudo));
    }

    public function test_sw_sem_manifest_em_producao_responde_503(): void
    {
        $this->app->detectEnvironment(fn () => 'production');

        $resposta = $this->get('/rotina/sw.js')->assertStatus(503);

        $this->assertStringContainsString('no-store', $resposta->headers->get('Cache-Control'));
    }
}
