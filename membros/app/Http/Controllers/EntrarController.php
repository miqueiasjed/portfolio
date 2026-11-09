<?php

namespace App\Http\Controllers;

use App\Models\LoginToken;
use App\Models\User;
use App\Services\Acesso;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class EntrarController extends Controller
{
    public function form()
    {
        return Inertia::render('Entrar', ['enviado' => session('enviado', false)]);
    }

    /** Manda o link se o e-mail existir; a resposta é a mesma nos dois casos. */
    public function enviar(Request $request, Acesso $acesso)
    {
        $dados = $request->validate(['email' => ['required', 'email']]);

        $usuario = User::where('email', mb_strtolower(trim($dados['email'])))->first();

        if ($usuario) {
            $acesso->enviarLink($usuario);
        }

        return back()->with('enviado', true);
    }

    public function consumir(Request $request, string $token)
    {
        $usuario = LoginToken::consumir($token);

        if (! $usuario) {
            return Inertia::render('Entrar', ['expirado' => true]);
        }

        if (! $usuario->email_verified_at) {
            $usuario->forceFill(['email_verified_at' => now()])->save();
        }

        Auth::login($usuario, remember: true);
        $request->session()->regenerate();
        $usuario->registrarEntrada();

        return redirect()->intended(route('area'));
    }

    public function sair(Request $request)
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('entrar');
    }
}
