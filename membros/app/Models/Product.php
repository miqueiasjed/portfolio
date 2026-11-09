<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;
use Illuminate\Support\Facades\Storage;

class Product extends Model
{
    protected $fillable = [
        'slug', 'nome', 'descricao', 'preco_centavos',
        'arquivo_path', 'arquivo_nome', 'arquivo_disco', 'conteudo', 'ativo',
    ];

    protected $attributes = [
        'arquivo_disco' => 'produtos',
    ];

    protected function casts(): array
    {
        return [
            'conteudo' => 'array',
            'ativo' => 'boolean',
            'preco_centavos' => 'integer',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    public function purchases(): HasMany
    {
        return $this->hasMany(Purchase::class);
    }

    public function modules(): HasMany
    {
        return $this->hasMany(Module::class)->orderBy('ordem')->orderBy('id');
    }

    public function lessons(): HasManyThrough
    {
        return $this->hasManyThrough(Lesson::class, Module::class);
    }

    public function precoFormatado(): string
    {
        return 'R$ '.number_format($this->preco_centavos / 100, 2, ',', '.');
    }

    public function linkDeCompra(): string
    {
        return rtrim((string) config('app.url'), '/').'/comprar/'.$this->slug;
    }

    /** Disco onde está o arquivo principal (o PDF do kit fica em "produtos", uploads novos em "uploads"). */
    public function disco()
    {
        return Storage::disk($this->arquivo_disco ?: 'produtos');
    }

    /** Apaga o arquivo principal só quando ele veio de upload; o do disco "produtos" é versionado. */
    public function apagarArquivoEnviado(): void
    {
        if ($this->arquivo_path && $this->arquivo_disco === 'uploads') {
            Storage::disk('uploads')->delete($this->arquivo_path);
        }
    }
}
