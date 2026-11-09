<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class AulaRequest extends FormRequest
{
    public const LIMITE_KB = 51200; // 50 MB

    public function authorize(): bool
    {
        return (bool) $this->user()?->is_admin;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'publicada' => $this->has('publicada') ? $this->boolean('publicada') : true,
            'remover_anexo' => $this->boolean('remover_anexo'),
            'video_url' => trim((string) $this->input('video_url', '')) ?: null,
            'duracao_minutos' => $this->filled('duracao_minutos') ? $this->input('duracao_minutos') : null,
        ]);
    }

    public function rules(): array
    {
        return [
            'titulo' => ['required', 'string', 'max:255'],
            'descricao' => ['nullable', 'string', 'max:20000'],
            'video_url' => ['nullable', 'url:http,https', 'max:500'],
            'duracao_minutos' => ['nullable', 'integer', 'min:1', 'max:1440'],
            'publicada' => ['boolean'],
            'anexo' => ['nullable', 'file', 'max:'.self::LIMITE_KB],
            'remover_anexo' => ['boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'titulo.required' => 'Informe o título da aula.',
            'video_url.url' => 'Informe um link válido, começando com https://.',
            'duracao_minutos.integer' => 'Duração em minutos, só números.',
            'duracao_minutos.min' => 'Duração em minutos, só números.',
            'duracao_minutos.max' => 'Duração máxima de 1440 minutos.',
            'anexo.max' => 'O arquivo pode ter até 50 MB.',
            'anexo.uploaded' => 'O arquivo não chegou. Ele pode ter mais de 50 MB.',
        ];
    }
}
