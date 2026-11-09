<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            // disco do arquivo principal: "produtos" (PDF versionado) ou "uploads" (enviado pelo admin)
            $table->string('arquivo_disco')->default('produtos')->after('arquivo_nome');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('last_login_at')->nullable()->after('is_admin');
        });

        Schema::create('modules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->string('titulo');
            $table->unsignedInteger('ordem')->default(0);
            $table->timestamps();

            $table->index(['product_id', 'ordem']);
        });

        Schema::create('lessons', function (Blueprint $table) {
            $table->id();
            $table->foreignId('module_id')->constrained()->cascadeOnDelete();
            $table->string('titulo');
            $table->text('descricao')->nullable();
            $table->string('video_url', 500)->nullable();
            $table->unsignedSmallInteger('duracao_minutos')->nullable();
            $table->string('anexo_path')->nullable();
            $table->string('anexo_nome')->nullable();
            $table->boolean('publicada')->default(true);
            $table->unsignedInteger('ordem')->default(0);
            $table->timestamps();

            $table->index(['module_id', 'ordem']);
        });

        Schema::create('lesson_progress', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('lesson_id')->constrained()->cascadeOnDelete();
            $table->timestamp('concluida_em');

            $table->unique(['user_id', 'lesson_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lesson_progress');
        Schema::dropIfExists('lessons');
        Schema::dropIfExists('modules');

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('last_login_at');
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('arquivo_disco');
        });
    }
};
