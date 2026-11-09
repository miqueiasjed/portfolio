<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class LoginToken extends Model
{
    protected $fillable = ['user_id', 'token_hash', 'expires_at', 'used_at'];

    protected function casts(): array
    {
        return ['expires_at' => 'datetime', 'used_at' => 'datetime'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Cria um token de uso único e devolve o valor em claro (só ele vai no e-mail). */
    public static function emitir(User $user, int $minutos): string
    {
        $claro = Str::random(64);

        static::create([
            'user_id' => $user->id,
            'token_hash' => hash('sha256', $claro),
            'expires_at' => now()->addMinutes($minutos),
        ]);

        return $claro;
    }

    /** Consome o token se for válido. Devolve o usuário ou null. */
    public static function consumir(string $claro): ?User
    {
        $token = static::where('token_hash', hash('sha256', $claro))->first();

        if (! $token || $token->used_at || $token->expires_at->isPast()) {
            return null;
        }

        $token->update(['used_at' => now()]);

        return $token->user;
    }
}
