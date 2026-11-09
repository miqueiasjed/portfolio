<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('nome');
            $table->string('descricao')->nullable();
            $table->unsignedInteger('preco_centavos');
            // caminho do arquivo no disco privado (storage/app/private)
            $table->string('arquivo_path')->nullable();
            $table->string('arquivo_nome')->nullable();
            // conteúdo exibido na área do aluno (blocos), até existir o CMS de curso
            $table->json('conteudo')->nullable();
            $table->boolean('ativo')->default(true);
            $table->timestamps();
        });

        Schema::create('purchases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('product_id')->constrained();
            $table->uuid('reference')->unique();
            $table->string('email')->nullable();
            $table->string('status')->default('pending'); // pending, paid, canceled, refunded
            $table->unsignedInteger('valor_centavos');
            $table->string('pagbank_checkout_id')->nullable()->index();
            $table->string('pagbank_order_id')->nullable()->index();
            $table->string('origem')->nullable(); // utm_source/utm_campaign da página de venda
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'product_id', 'status']);
        });

        Schema::create('login_tokens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('token_hash', 64)->unique();
            $table->timestamp('expires_at');
            $table->timestamp('used_at')->nullable();
            $table->timestamps();
        });

        Schema::table('users', function (Blueprint $table) {
            $table->string('name')->nullable()->change();
            $table->string('password')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('login_tokens');
        Schema::dropIfExists('purchases');
        Schema::dropIfExists('products');
    }
};
