<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class RotinaAparelho extends Model
{
    protected $table = 'rotina_aparelhos';

    protected $fillable = ['user_id', 'token_hash', 'nome', 'ultimo_uso_em', 'revogado_em'];

    protected $hidden = ['token_hash'];

    protected function casts(): array
    {
        return ['ultimo_uso_em' => 'datetime', 'revogado_em' => 'datetime'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Libera um aparelho para o usuário. Grava só o hash e devolve
     * [$aparelho, $puro]; o valor puro não aparece em mais nenhum lugar.
     */
    public static function emitir(User $user, ?string $userAgent): array
    {
        $puro = Str::random(64);

        $aparelho = static::create([
            'user_id' => $user->id,
            'token_hash' => hash('sha256', $puro),
            'nome' => static::nomeDoAparelho($userAgent),
        ]);

        return [$aparelho, $puro];
    }

    /** Acha o aparelho pelo valor puro. Vazio, desconhecido ou revogado devolve null. */
    public static function porToken(?string $puro): ?self
    {
        if ($puro === null || $puro === '') {
            return null;
        }

        return static::where('token_hash', hash('sha256', $puro))
            ->whereNull('revogado_em')
            ->first();
    }

    /**
     * Resume o user agent em "Aparelho, Navegador", com até 60 caracteres.
     * Aparelho: iPhone, iPad, Android ou Computador. Navegador só entra se for
     * reconhecido. A ordem das checagens importa: Edge, Opera e Samsung trazem
     * "Chrome" no texto, e Chrome traz "Safari".
     */
    public static function nomeDoAparelho(?string $userAgent): ?string
    {
        $ua = trim((string) $userAgent);

        if ($ua === '') {
            return null;
        }

        $aparelho = match (true) {
            str_contains($ua, 'iPhone') || str_contains($ua, 'iPod') => 'iPhone',
            str_contains($ua, 'iPad') => 'iPad',
            str_contains($ua, 'Android') => 'Android',
            default => 'Computador',
        };

        $navegador = match (true) {
            str_contains($ua, 'Edg/') || str_contains($ua, 'EdgA/') || str_contains($ua, 'EdgiOS/') => 'Edge',
            str_contains($ua, 'OPR/') || str_contains($ua, 'Opera') => 'Opera',
            str_contains($ua, 'SamsungBrowser/') => 'Samsung Internet',
            str_contains($ua, 'Firefox/') || str_contains($ua, 'FxiOS/') => 'Firefox',
            str_contains($ua, 'Chrome/') || str_contains($ua, 'CriOS/') => 'Chrome',
            str_contains($ua, 'Safari/') => 'Safari',
            default => null,
        };

        $nome = $navegador ? "{$aparelho}, {$navegador}" : $aparelho;

        return Str::limit($nome, 60, '');
    }
}
