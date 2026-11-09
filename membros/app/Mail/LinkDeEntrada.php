<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class LinkDeEntrada extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public string $token) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Seu link de entrada');
    }

    public function content(): Content
    {
        return new Content(view: 'emails.acesso', with: [
            'produto' => null,
            'link' => route('entrar.token', $this->token),
            'titulo' => 'Seu link de entrada.',
            'texto' => 'Clique no botão para entrar na sua área. O link vale por 30 minutos e funciona uma vez. Se não foi você que pediu, é só ignorar este e-mail.',
            'botao' => 'Entrar',
        ]);
    }
}
