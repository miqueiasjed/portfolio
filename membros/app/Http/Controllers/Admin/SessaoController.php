<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class SessaoController extends Controller
{
    public function form()
    {
        return Inertia::render('Admin/Entrar');
    }

    public function entrar(Request $request)
    {
        $dados = $request->validate([
            'email' => ['required', 'email'],
            'senha' => ['required', 'string'],
        ]);

        $ok = Auth::attempt(
            ['email' => mb_strtolower(trim($dados['email'])), 'password' => $dados['senha'], 'is_admin' => true],
            remember: true,
        );

        if (! $ok) {
            throw ValidationException::withMessages(['email' => 'E-mail ou senha incorretos.']);
        }

        $request->session()->regenerate();
        $request->user()->registrarEntrada();

        return redirect()->intended(route('admin.painel'));
    }

    public function sair(Request $request)
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('admin.entrar');
    }
}
