<?php

namespace Database\Seeders;

use App\Models\Product;
use Illuminate\Database\Seeder;

/** Cadastra (ou atualiza) os produtos à venda. Pode rodar a cada deploy. */
class ProdutoSeeder extends Seeder
{
    public function run(): void
    {
        Product::updateOrCreate(['slug' => 'kit'], [
            'nome' => 'Isso nunca deveria ser manual',
            'descricao' => '12 processos que todo negócio faz na mão, prontos para rodar com um assistente de IA.',
            'preco_centavos' => 9700,
            'arquivo_path' => 'Isso-nunca-deveria-ser-manual.pdf',
            'arquivo_nome' => 'Isso-nunca-deveria-ser-manual.pdf',
            'conteudo' => json_decode(file_get_contents(database_path('data/kit-conteudo.json')), true),
            'ativo' => true,
        ]);
    }
}
