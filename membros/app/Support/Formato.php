<?php

namespace App\Support;

use Carbon\CarbonInterface;

class Formato
{
    public const FUSO = 'America/Fortaleza';

    /** Data para exibir: d/m/Y H:i no fuso de Fortaleza. */
    public static function data(?CarbonInterface $data): ?string
    {
        return $data?->copy()->timezone(self::FUSO)->format('d/m/Y H:i');
    }

    /** Valor em centavos como texto para planilha: 97,00 */
    public static function decimal(int $centavos): string
    {
        return number_format($centavos / 100, 2, ',', '');
    }
}
