<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Product extends Model
{
    protected $fillable = [
        'slug', 'nome', 'descricao', 'preco_centavos',
        'arquivo_path', 'arquivo_nome', 'conteudo', 'ativo',
    ];

    protected function casts(): array
    {
        return [
            'conteudo' => 'array',
            'ativo' => 'boolean',
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

    public function precoFormatado(): string
    {
        return 'R$ '.number_format($this->preco_centavos / 100, 2, ',', '.');
    }
}
