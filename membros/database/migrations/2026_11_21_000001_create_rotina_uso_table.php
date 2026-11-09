<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // contagens de uso da Rotina do Dia, uma linha por aparelho e dia; só números e data
        Schema::create('rotina_uso', function (Blueprint $table) {
            $table->id();
            // fica para a consulta do admin e para apagar junto com o usuário
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('rotina_aparelho_id')->constrained('rotina_aparelhos')->cascadeOnDelete();
            // gravado como string Y-m-d, sem hora
            $table->date('dia');
            $table->unsignedInteger('enviados')->default(0);
            $table->unsignedInteger('respostas')->default(0);
            $table->unsignedInteger('resolvidos')->default(0);
            // contagem por processo, ex.: {"01":3,"04":1,"05":2}
            $table->json('por_processo');
            $table->timestamps();

            // Safari e app instalado no mesmo iPhone são aparelhos diferentes; o admin soma os dois
            $table->unique(['rotina_aparelho_id', 'dia']);
            $table->index(['user_id', 'dia']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rotina_uso');
    }
};
