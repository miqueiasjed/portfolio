<?php

namespace App\Models;

use App\Support\Formato;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Purchase extends Model
{
    public const PENDENTE = 'pending';

    public const PAGA = 'paid';

    public const CANCELADA = 'canceled';

    public const REEMBOLSADA = 'refunded';

    public const ROTULOS = [
        self::PAGA => 'Paga',
        self::PENDENTE => 'Pendente',
        self::CANCELADA => 'Cancelada',
        self::REEMBOLSADA => 'Reembolsada',
    ];

    protected $fillable = [
        'user_id', 'product_id', 'reference', 'email', 'status', 'valor_centavos',
        'pagbank_checkout_id', 'pagbank_order_id', 'origem', 'paid_at',
    ];

    protected function casts(): array
    {
        return ['paid_at' => 'datetime'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function estaPaga(): bool
    {
        return $this->status === self::PAGA;
    }

    public function rotuloStatus(): string
    {
        return self::ROTULOS[$this->status] ?? $this->status;
    }

    /** Linha de compra para as telas do admin (espera product e user carregados). */
    public function paraAdmin(): array
    {
        return [
            'id' => $this->id,
            'reference' => $this->reference,
            'email' => $this->email,
            'status' => $this->status,
            'status_rotulo' => $this->rotuloStatus(),
            'valor' => (int) $this->valor_centavos,
            'produto' => $this->product ? ['slug' => $this->product->slug, 'nome' => $this->product->nome] : null,
            'origem' => $this->origem,
            'pagbank_checkout_id' => $this->pagbank_checkout_id,
            'pagbank_order_id' => $this->pagbank_order_id,
            'criada_em' => Formato::data($this->created_at),
            'paga_em' => Formato::data($this->paid_at),
            'aluno' => $this->user ? ['id' => $this->user->id, 'nome' => $this->user->name, 'email' => $this->user->email] : null,
            'pode_reenviar' => $this->estaPaga() && $this->user_id !== null,
            'pode_revogar' => $this->estaPaga(),
        ];
    }
}
