<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class CursoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->is_admin;
    }

    protected function prepareForValidation(): void
    {
        // slug em branco nasce do nome
        $slug = trim((string) $this->input('slug', ''));

        $this->merge([
            'slug' => Str::slug($slug !== '' ? $slug : (string) $this->input('nome', '')),
            'ativo' => $this->boolean('ativo'),
        ]);
    }

    public function rules(): array
    {
        return [
            'nome' => ['required', 'string', 'max:255'],
            'slug' => [
                'required', 'string', 'max:100', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/', 'not_in:novo',
                Rule::unique('products', 'slug')->ignore($this->route('product')?->id),
                // curso com compra mantém o endereço: o link de compra já está divulgado
                function (string $atributo, mixed $valor, \Closure $falha) {
                    $produto = $this->route('product');
                    if ($produto && $produto->slug !== $valor && $produto->purchases()->exists()) {
                        $falha('Este curso já tem compras. O endereço não pode mudar, senão o link de compra divulgado para de funcionar.');
                    }
                },
            ],
            'descricao' => ['nullable', 'string', 'max:255'],
            'preco_centavos' => ['required', 'integer', 'min:0', 'max:100000000'],
            'ativo' => ['boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'nome.required' => 'Informe o nome do curso.',
            'slug.required' => 'Informe o endereço (slug) do curso.',
            'slug.regex' => 'Use só letras minúsculas, números e hífen.',
            'slug.not_in' => 'Esse endereço é reservado. Escolha outro.',
            'slug.unique' => 'Já existe um curso com esse endereço.',
            'descricao.max' => 'A descrição pode ter até 255 caracteres.',
            'preco_centavos.required' => 'Informe o preço.',
            'preco_centavos.integer' => 'Preço inválido.',
            'preco_centavos.min' => 'O preço não pode ser negativo.',
        ];
    }
}
