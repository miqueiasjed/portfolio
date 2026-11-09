<?php

namespace App\Http\Requests;

use App\Support\Formato;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Validator;

/**
 * Contagens de uso que o aparelho manda por dia. Só números e datas entram:
 * qualquer chave fora do contrato é recusada, e é isso que barra nome,
 * telefone, texto de mensagem ou user_id no corpo.
 */
class RegistrarUsoRequest extends FormRequest
{
    public const CHAVES_DA_RAIZ = ['dias'];

    public const CHAVES_DO_DIA = ['dia', 'enviados', 'respostas', 'resolvidos', 'por_processo'];

    /** Chave de processo: dois dígitos e nada depois (o $ aceitaria "01\n"). */
    public const CHAVE_DE_PROCESSO = '/^\d{2}\z/';

    /** O middleware aparelho já conferiu o token e a compra. */
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        // Integer estrito: só número JSON de verdade; a string "3" é recusada.
        $contagem = ['required', 'integer:strict', 'min:0', 'max:10000'];

        return [
            'dias' => ['required', 'list', 'min:1', 'max:31'],
            'dias.*' => ['required', 'array'],
            'dias.*.dia' => [
                'required',
                'date_format:Y-m-d',
                'distinct',
                // O dia de hoje é o de Fortaleza, não o do servidor (UTC).
                'before_or_equal:'.Carbon::now(Formato::FUSO)->format('Y-m-d'),
                // Piso de 60 dias: o aparelho poda a fila com 40, e um relógio errado
                // não pode criar um primeiro envio de antes da compra no admin.
                'after_or_equal:'.Carbon::now(Formato::FUSO)->subDays(60)->format('Y-m-d'),
            ],
            'dias.*.enviados' => $contagem,
            'dias.*.respostas' => $contagem,
            'dias.*.resolvidos' => $contagem,
            'dias.*.por_processo' => ['present', 'array'],
            'dias.*.por_processo.*' => ['integer:strict', 'min:0', 'max:10000'],
        ];
    }

    public function messages(): array
    {
        return [
            'dias.*.dia.before_or_equal' => 'O dia não pode ser depois de hoje.',
            'dias.*.dia.distinct' => 'O mesmo dia veio mais de uma vez.',
            'dias.*.dia.after_or_equal' => 'O dia é antigo demais.',
        ];
    }

    /**
     * Roda mesmo quando alguma regra falhou, então nada aqui pode supor o
     * formato do corpo. As chaves são conferidas no corpo cru: validated()
     * já viria sem as chaves extras.
     */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                $corpo = $this->all();

                foreach (array_diff(array_map('strval', array_keys($corpo)), self::CHAVES_DA_RAIZ) as $chave) {
                    $validator->errors()->add($chave, 'Campo não permitido.');
                }

                $dias = $corpo['dias'] ?? null;

                if (! is_array($dias)) {
                    return;
                }

                foreach ($dias as $i => $dia) {
                    if (! is_array($dia)) {
                        continue;
                    }

                    foreach (array_diff(array_map('strval', array_keys($dia)), self::CHAVES_DO_DIA) as $chave) {
                        $validator->errors()->add("dias.$i.$chave", 'Campo não permitido.');
                    }

                    $processos = $dia['por_processo'] ?? null;

                    if (! is_array($processos)) {
                        continue;
                    }

                    // O json_decode transforma a chave "10" em inteiro; a regex olha o texto.
                    foreach (array_keys($processos) as $chave) {
                        if (! preg_match(self::CHAVE_DE_PROCESSO, (string) $chave)) {
                            $validator->errors()->add("dias.$i.por_processo", 'Processo inválido.');
                        }
                    }
                }
            },
        ];
    }
}
