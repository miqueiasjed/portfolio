<?php

namespace App\Models;

use App\Support\Video;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;

class Lesson extends Model
{
    public const DISCO = 'uploads';

    protected $fillable = [
        'module_id', 'titulo', 'descricao', 'video_url', 'duracao_minutos',
        'anexo_path', 'anexo_nome', 'publicada', 'ordem',
    ];

    protected function casts(): array
    {
        return [
            'publicada' => 'boolean',
            'ordem' => 'integer',
            'duracao_minutos' => 'integer',
        ];
    }

    public function module(): BelongsTo
    {
        return $this->belongsTo(Module::class);
    }

    public function progress(): HasMany
    {
        return $this->hasMany(LessonProgress::class);
    }

    public function videoEmbed(): ?string
    {
        return Video::embed($this->video_url);
    }

    public function apagarAnexo(): void
    {
        if ($this->anexo_path) {
            Storage::disk(self::DISCO)->delete($this->anexo_path);
        }
    }
}
