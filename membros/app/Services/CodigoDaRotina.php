<?php

namespace App\Services;

use App\Mail\CodigoDaRotina as EmailDoCodigo;
use App\Models\Product;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Mail;

/**
 * Código de 6 dígitos que deixa o app instalado no iPhone entrar sem a sessão
 * do Safari. No cache fica só o hash, com o contador de erros e o fim da janela:
 * ['hash' => HMAC-SHA256 com a APP_KEY, 'erros' => int, 'expira_em' => timestamp unix].
 * O HMAC impede que quem leia a tabela de cache teste o milhão de códigos possíveis.
 */
class CodigoDaRotina
{
    public const MINUTOS = 15;

    public const MAX_ERROS = 5;

    /**
     * Manda um código novo se o e-mail tem compra paga da Rotina do Dia.
     * Sem compra, não faz nada e não diz nada (quem chama responde igual nos dois casos).
     * Pedido novo troca o código, mas dentro de uma janela válida mantém os erros dela.
     */
    public function pedir(string $email): void
    {
        $email = $this->normalizar($email);
        $usuario = $this->comprador($email);

        if (! $usuario) {
            return;
        }

        $codigo = self::formatar(random_int(0, 999999));
        $anterior = $this->ler($email);
        $expiraEm = now()->addMinutes(self::MINUTOS);

        Cache::put($this->chave($email), [
            'hash' => self::hash($codigo),
            'erros' => $anterior['erros'] ?? 0,
            'expira_em' => $expiraEm->getTimestamp(),
        ], $expiraEm);

        Mail::to($usuario->email)->send(new EmailDoCodigo($codigo));
    }

    /**
     * Confere o código. Certo: apaga a chave e devolve o usuário. Errado soma um
     * erro sem renovar o prazo; no quinto erro a chave some. Ausente, vencido ou
     * compra que deixou de estar paga devolvem null.
     */
    public function confirmar(string $email, string $codigo): ?User
    {
        $email = $this->normalizar($email);

        // A trava impede que palpites simultâneos leiam o mesmo contador e furem os cinco erros.
        return Cache::lock('rotina-codigo-trava:'.$email, 10)
            ->block(5, fn () => $this->conferir($email, $codigo));
    }

    private function conferir(string $email, string $codigo): ?User
    {
        $chave = $this->chave($email);
        $dados = $this->ler($email);

        if (! $dados) {
            return null;
        }

        if (! hash_equals($dados['hash'], self::hash(trim($codigo)))) {
            $dados['erros']++;

            if ($dados['erros'] >= self::MAX_ERROS) {
                Cache::forget($chave);
            } else {
                Cache::put($chave, $dados, Carbon::createFromTimestamp($dados['expira_em']));
            }

            return null;
        }

        Cache::forget($chave);

        return $this->comprador($email);
    }

    /** HMAC com a chave do app: sem ela, o hash guardado não serve para testar códigos. */
    public static function hash(string $codigo): string
    {
        return hash_hmac('sha256', $codigo, (string) config('app.key'));
    }

    /** Sempre 6 dígitos, com zeros à esquerda. */
    public static function formatar(int $numero): string
    {
        return str_pad((string) $numero, 6, '0', STR_PAD_LEFT);
    }

    private function normalizar(string $email): string
    {
        return mb_strtolower(trim($email));
    }

    private function chave(string $email): string
    {
        return 'rotina-codigo:'.$email;
    }

    /** Payload válido e dentro do prazo, ou null (vencido é apagado). */
    private function ler(string $email): ?array
    {
        $dados = Cache::get($this->chave($email));

        if (! is_array($dados) || ! isset($dados['hash'], $dados['erros'], $dados['expira_em'])) {
            return null;
        }

        if ($dados['expira_em'] <= now()->getTimestamp()) {
            Cache::forget($this->chave($email));

            return null;
        }

        return $dados;
    }

    private function comprador(string $email): ?User
    {
        $usuario = User::where('email', $email)->first();
        $produto = Product::where('slug', Product::ROTINA)->first();

        if (! $usuario || ! $produto || ! $produto->compradoPor($usuario)) {
            return null;
        }

        return $usuario;
    }
}
