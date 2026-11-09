<?php

namespace App\Mail;

use App\Models\Purchase;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class AcessoLiberado extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public Purchase $compra, public string $token) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Seu acesso: '.$this->compra->product->nome);
    }

    public function content(): Content
    {
        return new Content(view: 'emails.acesso', with: [
            'produto' => $this->compra->product->nome,
            'link' => route('entrar.token', $this->token),
            'titulo' => 'Seu acesso está liberado.',
            'texto' => 'Obrigado pela compra. Clique no botão para entrar na sua área e baixar o que você comprou. O link vale por 7 dias e funciona uma vez. Depois disso, é só entrar com o seu e-mail em membros.miqueias.ia.br.',
            'botao' => 'Entrar na minha área',
        ]);
    }
}
