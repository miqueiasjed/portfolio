<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // aparelhos liberados na Rotina do Dia; o token fica só como hash SHA-256
        Schema::create('rotina_aparelhos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->char('token_hash', 64)->unique();
            // user agent resumido, ex.: "iPhone, Safari"
            $table->string('nome')->nullable();
            $table->timestamp('ultimo_uso_em')->nullable();
            $table->timestamp('revogado_em')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rotina_aparelhos');
    }
};
