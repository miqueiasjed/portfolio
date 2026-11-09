<?php

namespace App\Http\Controllers;

use App\Http\Requests\RegistrarUsoRequest;
use App\Models\Product;
use App\Models\RotinaAparelho;
use App\Models\RotinaUso;
use App\Models\User;
use App\Services\CodigoDaRotina;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;

use function Illuminate\Support\defer;

/**
 * Entrada da ferramenta Rotina do Dia: volta do link mágico, liberação de um
 * aparelho pela sessão ou por código no e-mail, checagem online pelo token
 * do aparelho e medição de uso.
 */
class RotinaController extends Controller
{
    /** Janela dos limites por e-mail, em segundos. */
    private const JANELA_DO_EMAIL = 15 * 60;

    private const PEDIDOS_POR_EMAIL = 3;

    private const CONFIRMACOES_POR_EMAIL = 10;

    /**
     * Só existe para o auth guardar o destino. Depois do link mágico, o
     * redirect()->intended() volta para cá e daqui para a ferramenta.
     * URL literal: a rota /rotina só nasce no Plano 2.
     */
    public function entrar()
    {
        return redirect('/rotina');
    }

    /** Libera um aparelho para quem comprou. O token puro sai só nesta resposta. */
    public function aparelho(Request $request)
    {
        $user = $request->user();

        if (! Product::where('slug', Product::ROTINA)->first()?->compradoPor($user)) {
            abort(403);
        }

        return $this->liberar($user, $request);
    }

    /**
     * Pede o código de entrada. Responde 204 sempre, tenha o e-mail comprado ou não.
     * A busca da compra e o envio rodam depois da resposta: o 204 sai no mesmo
     * tempo nos dois casos, e uma falha no envio vai para o log sem virar erro
     * só para quem comprou.
     */
    public function pedirCodigo(Request $request, CodigoDaRotina $codigos)
    {
        $dados = $request->validate(['email' => 'required|email|max:255']);
        $chave = self::chaveDoEmail('rotina-codigo-email', $dados['email']);

        // Estourou: sai o mesmo 204, sem header de limite, e nenhum e-mail é enviado.
        if (RateLimiter::tooManyAttempts($chave, self::PEDIDOS_POR_EMAIL)) {
            return response()->noContent();
        }

        RateLimiter::hit($chave, self::JANELA_DO_EMAIL);

        defer(fn () => $codigos->pedir($dados['email']));

        return response()->noContent();
    }

    /** Troca o código do e-mail por um aparelho liberado, com a mesma resposta de aparelho(). */
    public function confirmarCodigo(Request $request, CodigoDaRotina $codigos)
    {
        $dados = $request->validate([
            'email' => 'required|email|max:255',
            'codigo' => 'required|digits:6',
        ]);

        // Sem este limite, o ciclo de pedir um código e dar cinco palpites se
        // repetiria à vontade trocando de IP.
        $chave = self::chaveDoEmail('rotina-confirmar-email', $dados['email']);

        if (RateLimiter::tooManyAttempts($chave, self::CONFIRMACOES_POR_EMAIL)) {
            return response()->json(['message' => 'Muitas tentativas. Peça um novo código daqui a pouco.'], 429);
        }

        RateLimiter::hit($chave, self::JANELA_DO_EMAIL);

        // Risco aceito: o ramo com código ativo grava no cache e o sem código só
        // lê, então o tempo de resposta difere. Com 10 tentativas por e-mail a
        // cada 15 minutos, medir essa diferença fica impraticável.
        $user = $codigos->confirmar($dados['email'], (string) $dados['codigo']);

        if (! $user) {
            return response()->json(['message' => 'Código errado ou vencido. Peça um novo.'], 422);
        }

        return $this->liberar($user, $request);
    }

    /** O middleware aparelho já conferiu o token e a compra. */
    public function acesso(Request $request)
    {
        $aparelho = $request->attributes->get('aparelho');
        $aparelho->update(['ultimo_uso_em' => now()]);

        $user = $request->user();

        return response()->json([
            'nome' => $user->name,
            'email' => $user->email,
            'liberado' => true,
        ]);
    }

    /**
     * Grava as contagens de uso que o aparelho mandou. O aparelho manda o
     * total do dia, então o upsert substitui os números. Usuário e aparelho
     * vêm do token, nunca do corpo; cada aparelho tem a própria linha por dia.
     */
    public function uso(RegistrarUsoRequest $request)
    {
        /** @var RotinaAparelho $aparelho */
        $aparelho = $request->attributes->get('aparelho');
        $agora = now();

        $linhas = array_map(fn (array $dia) => [
            'user_id' => $aparelho->user_id,
            'rotina_aparelho_id' => $aparelho->id,
            'dia' => $dia['dia'],
            'enviados' => $dia['enviados'],
            'respostas' => $dia['respostas'],
            'resolvidos' => $dia['resolvidos'],
            // Objeto sempre, inclusive vazio: {"01":3} ou {}.
            'por_processo' => json_encode((object) $dia['por_processo']),
            'created_at' => $agora,
            'updated_at' => $agora,
        ], $request->validated('dias'));

        RotinaUso::upsert(
            $linhas,
            ['rotina_aparelho_id', 'dia'],
            ['enviados', 'respostas', 'resolvidos', 'por_processo', 'updated_at'],
        );

        return response()->noContent();
    }

    /**
     * Contador por e-mail normalizado, feito aqui e não no throttle: o throttle
     * grava X-RateLimit-* na resposta e mostraria a qualquer um quantos pedidos
     * aquele e-mail teve, o que revela quem comprou.
     * Risco aceito: o limite não leva o IP em conta, então um terceiro pode
     * travar o código de um comprador por 15 minutos. O link mágico continua
     * como saída.
     */
    private static function chaveDoEmail(string $prefixo, string $email): string
    {
        return $prefixo.':'.mb_strtolower(trim($email));
    }

    private function liberar(User $user, Request $request)
    {
        [, $puro] = RotinaAparelho::emitir($user, $request->userAgent());

        return response()->json([
            'token' => $puro,
            'nome' => $user->name,
            'email' => $user->email,
        ], 201);
    }
}
