<?php

namespace App\Services;

use App\Mail\AcessoLiberado;
use App\Mail\LinkDeEntrada;
use App\Models\LoginToken;
use App\Models\Purchase;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;

class Acesso
{
    /**
     * Marca a compra como paga, cria (ou acha) o usuário pelo e-mail e manda o link de acesso.
     * Idempotente: um segundo aviso de pagamento da mesma compra não manda outro e-mail.
     */
    public function liberar(Purchase $compra, string $email, ?string $nome = null): User
    {
        $email = mb_strtolower(trim($email));

        [$usuario, $acabouDeLiberar] = DB::transaction(function () use ($compra, $email, $nome) {
            $compra = Purchase::lockForUpdate()->find($compra->id);

            $usuario = User::firstOrCreate(['email' => $email], ['name' => $nome]);

            if ($compra->estaPaga()) {
                return [$usuario, false];
            }

            $compra->update([
                'user_id' => $usuario->id,
                'email' => $email,
                'status' => Purchase::PAGA,
                'paid_at' => now(),
            ]);

            return [$usuario, true];
        });

        if ($acabouDeLiberar) {
            $token = LoginToken::emitir($usuario, config('membros.link_compra_minutos'));
            Mail::to($usuario->email)->send(new AcessoLiberado($compra->fresh('product'), $token));
        }

        return $usuario;
    }

    /** Manda um link de entrada novo para quem já tem cadastro. */
    public function enviarLink(User $usuario): void
    {
        $token = LoginToken::emitir($usuario, config('membros.link_entrada_minutos'));
        Mail::to($usuario->email)->send(new LinkDeEntrada($token));
    }
}
