<?php

namespace App\Services;

use App\Models\Product;
use App\Models\Purchase;
use App\Support\Formato;
use Carbon\CarbonImmutable;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Pagination\Paginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Medição da Rotina do Dia para o admin: por comprador, primeiro envio,
 * semana 1, último uso e aparelhos ativos, mais o resumo de seguir ou parar.
 *
 * Dias são comparados como texto Y-m-d no fuso de Fortaleza. O aparelho manda
 * só o dia, sem hora, e o cast date do model devolveria meia-noite UTC, que em
 * Fortaleza cai na véspera. Por isso a leitura aqui é crua.
 *
 * São três consultas, com 1 ou com 1000 compradores: compras, uso por dia e
 * aparelhos. A lista inteira é montada uma vez e paginada em memória.
 */
class MedicaoRotina
{
    public const POR_PAGINA = 25;

    private ?Collection $linhas = null;

    public function compradores(): LengthAwarePaginator
    {
        $linhas = $this->linhas();
        $pagina = Paginator::resolveCurrentPage();

        return (new LengthAwarePaginator(
            $linhas->forPage($pagina, self::POR_PAGINA)
                ->map(fn (array $l) => [
                    'user_id' => $l['user_id'],
                    'nome' => $l['nome'],
                    'email' => $l['email'],
                    'cortesia' => $l['cortesia'],
                    'comprado_em' => $l['comprado_em'],
                    'primeiro_envio' => self::diaExibido($l['primeiro_envio']),
                    'primeiro_envio_24h' => $l['primeiro_envio_24h'],
                    'envios_semana1' => $l['envios_semana1'],
                    'dias_de_uso_semana1' => $l['dias_de_uso_semana1'],
                    'semana1_completa' => $l['semana1_completa'],
                    'ultimo_uso' => $l['ultimo_uso'],
                    'aparelhos_ativos' => $l['aparelhos_ativos'],
                ])->values(),
            $linhas->count(),
            self::POR_PAGINA,
            $pagina,
            ['path' => Paginator::resolveCurrentPath()],
        ))->withQueryString();
    }

    /** Compradores pagantes com 7 dias ou mais desde a compra e nenhum envio. Cortesia fica de fora. */
    public function semPrimeiroEnvio(): array
    {
        return $this->linhas()
            ->filter(fn (array $l) => ! $l['cortesia'] && $l['sem_primeiro_envio_7_dias'])
            ->map(fn (array $l) => [
                'user_id' => $l['user_id'],
                'nome' => $l['nome'],
                'email' => $l['email'],
                'comprado_em' => $l['comprado_em'],
                'dias_desde_a_compra' => $l['dias_desde_a_compra'],
            ])
            ->values()
            ->all();
    }

    /** Números de seguir ou parar. Compra de valor zero (cortesia) não entra em nenhum deles. */
    public function resumo(): array
    {
        $pagantes = $this->linhas()->reject(fn (array $l) => $l['cortesia']);
        $fechadas = $pagantes->filter(fn (array $l) => $l['semana1_completa']);

        return [
            'vendas' => $pagantes->count(),
            'com_primeiro_envio_24h' => $pagantes->where('primeiro_envio_24h', true)->count(),
            'com_3_dias_de_uso_semana1' => $fechadas->filter(fn (array $l) => $l['dias_de_uso_semana1'] >= 3)->count(),
            'semana1_completa' => $fechadas->count(),
            'sem_primeiro_envio_7_dias' => $pagantes->where('sem_primeiro_envio_7_dias', true)->count(),
            'media_envios_semana1' => $fechadas->isEmpty() ? 0 : (int) round($fechadas->avg('envios_semana1')),
        ];
    }

    /** Uma linha por comprador, mais recente primeiro. Calculada uma vez por instância. */
    private function linhas(): Collection
    {
        if ($this->linhas !== null) {
            return $this->linhas;
        }

        $compras = DB::table('purchases')
            ->join('users', 'users.id', '=', 'purchases.user_id')
            ->join('products', 'products.id', '=', 'purchases.product_id')
            ->where('products.slug', Product::ROTINA)
            ->where('purchases.status', Purchase::PAGA)
            ->where('users.is_admin', false)
            ->get([
                'purchases.id', 'purchases.user_id', 'purchases.valor_centavos',
                'purchases.paid_at', 'purchases.created_at', 'users.name', 'users.email',
            ]);

        // usuário com mais de uma compra conta uma vez: a paga mais antiga, ou a cortesia mais antiga se só houver cortesia
        $porUsuario = $compras->groupBy('user_id')->map(fn (Collection $grupo) => $grupo
            ->sortBy(fn ($c) => [(int) $c->valor_centavos > 0 ? 0 : 1, $c->paid_at ?? $c->created_at, $c->id])
            ->first());

        $ids = $porUsuario->keys()->all();

        // envios somados por usuário e dia, juntando os aparelhos; o dia vem cru do banco
        $enviosPorDia = [];
        DB::table('rotina_uso')
            ->whereIn('user_id', $ids)
            ->where('enviados', '>', 0)
            ->get(['user_id', 'dia', 'enviados'])
            ->each(function ($u) use (&$enviosPorDia) {
                $dia = substr((string) $u->dia, 0, 10);
                $enviosPorDia[$u->user_id][$dia] = ($enviosPorDia[$u->user_id][$dia] ?? 0) + (int) $u->enviados;
            });

        $aparelhos = DB::table('rotina_aparelhos')
            ->whereIn('user_id', $ids)
            ->groupBy('user_id')
            ->selectRaw('user_id, max(ultimo_uso_em) as ultimo_uso_em, sum(case when revogado_em is null then 1 else 0 end) as ativos')
            ->get()
            ->keyBy('user_id');

        $hoje = now(Formato::FUSO)->format('Y-m-d');

        return $this->linhas = $porUsuario
            ->map(fn ($c) => $this->linha($c, $enviosPorDia[$c->user_id] ?? [], $aparelhos->get($c->user_id), $hoje))
            ->sortBy([['comprado_em_iso', 'desc'], ['user_id', 'desc']])
            ->values();
    }

    private function linha(object $compra, array $envios, ?object $aparelhos, string $hoje): array
    {
        $compradoEm = CarbonImmutable::parse($compra->paid_at ?? $compra->created_at);
        $d0 = $compradoEm->timezone(Formato::FUSO)->format('Y-m-d');
        $d1 = self::somarDias($d0, 1);
        $d6 = self::somarDias($d0, 6);

        ksort($envios);
        $primeiro = array_key_first($envios);

        $semana1 = array_filter($envios, fn ($dia) => $dia >= $d0 && $dia <= $d6, ARRAY_FILTER_USE_KEY);
        $diasDesde = (int) CarbonImmutable::parse($d0, 'UTC')->diffInDays(CarbonImmutable::parse($hoje, 'UTC'));

        return [
            'user_id' => (int) $compra->user_id,
            'nome' => $compra->name,
            'email' => $compra->email,
            'cortesia' => (int) $compra->valor_centavos === 0,
            'comprado_em_iso' => $compradoEm->utc()->format('Y-m-d H:i:s'),
            'comprado_em' => Formato::data($compradoEm),
            'primeiro_envio' => $primeiro,
            'primeiro_envio_24h' => $primeiro === null ? null : ($primeiro >= $d0 && $primeiro <= $d1),
            'envios_semana1' => array_sum($semana1),
            'dias_de_uso_semana1' => count($semana1),
            'semana1_completa' => $hoje > $d6,
            'ultimo_uso' => $aparelhos?->ultimo_uso_em ? Formato::data(CarbonImmutable::parse($aparelhos->ultimo_uso_em)) : null,
            'aparelhos_ativos' => (int) ($aparelhos->ativos ?? 0),
            'dias_desde_a_compra' => $diasDesde,
            'sem_primeiro_envio_7_dias' => $primeiro === null && $diasDesde >= 7,
        ];
    }

    /** Soma dias a uma data Y-m-d sem passar por fuso: meia-noite UTC só serve de apoio para a conta. */
    private static function somarDias(string $dia, int $dias): string
    {
        return CarbonImmutable::createFromFormat('!Y-m-d', $dia, 'UTC')->addDays($dias)->format('Y-m-d');
    }

    private static function diaExibido(?string $dia): ?string
    {
        return $dia === null ? null : CarbonImmutable::createFromFormat('!Y-m-d', $dia, 'UTC')->format('d/m/Y');
    }
}
