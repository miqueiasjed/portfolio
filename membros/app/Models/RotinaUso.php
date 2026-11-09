<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

class RotinaUso extends Model
{
    protected $table = 'rotina_uso';

    protected $fillable = [
        'user_id',
        'rotina_aparelho_id',
        'dia',
        'enviados',
        'respostas',
        'resolvidos',
        'por_processo',
    ];

    protected function casts(): array
    {
        return [
            'dia' => 'date:Y-m-d',
            'por_processo' => 'array',
            'enviados' => 'integer',
            'respostas' => 'integer',
            'resolvidos' => 'integer',
        ];
    }

    /**
     * Grava o dia sempre como Y-m-d. Sem isso o cast date grava
     * "Y-m-d 00:00:00" no sqlite, diferente do upsert cru da medição,
     * e a chave única e o whereBetween passam a tratar o mesmo dia como dois.
     * A leitura continua pelo cast (Carbon).
     */
    protected function dia(): Attribute
    {
        return Attribute::make(
            set: fn ($valor) => $valor === null ? null : Carbon::parse($valor)->format('Y-m-d'),
        );
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function aparelho(): BelongsTo
    {
        return $this->belongsTo(RotinaAparelho::class, 'rotina_aparelho_id');
    }
}
