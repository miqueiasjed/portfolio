<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Purchase extends Model
{
    public const PENDENTE = 'pending';
    public const PAGA = 'paid';
    public const CANCELADA = 'canceled';
    public const REEMBOLSADA = 'refunded';

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
}
