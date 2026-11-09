<?php

namespace App\Support;

/** Converte links de YouTube e Vimeo na URL do player embutido. Outros links devolvem null. */
class Video
{
    public static function embed(?string $url): ?string
    {
        $url = trim((string) $url);

        if ($url === '') {
            return null;
        }

        if (! preg_match('#^https?://#i', $url)) {
            $url = 'https://'.$url;
        }

        $partes = parse_url($url);

        if (! $partes || empty($partes['host'])) {
            return null;
        }

        $host = preg_replace('/^(www\.|m\.)/', '', mb_strtolower($partes['host']));
        $segmentos = array_values(array_filter(explode('/', $partes['path'] ?? '')));
        parse_str($partes['query'] ?? '', $query);

        $youtube = match (true) {
            $host === 'youtu.be' => $segmentos[0] ?? null,
            in_array($host, ['youtube.com', 'music.youtube.com', 'youtube-nocookie.com'], true) => match ($segmentos[0] ?? null) {
                'watch' => $query['v'] ?? null,
                'shorts', 'embed', 'live', 'v' => $segmentos[1] ?? null,
                default => null,
            },
            default => null,
        };

        if (is_string($youtube) && preg_match('/^[A-Za-z0-9_-]{6,20}$/', $youtube)) {
            return 'https://www.youtube.com/embed/'.$youtube;
        }

        if ($host === 'vimeo.com' || $host === 'player.vimeo.com') {
            $id = null;
            $hash = $query['h'] ?? null;

            foreach ($segmentos as $i => $segmento) {
                if (ctype_digit($segmento)) {
                    $id = $segmento;
                    // vídeo não listado: vimeo.com/ID/HASH
                    $seguinte = $segmentos[$i + 1] ?? null;
                    if (! $hash && $seguinte && preg_match('/^[a-f0-9]{6,}$/i', $seguinte)) {
                        $hash = $seguinte;
                    }
                }
            }

            if ($id) {
                return 'https://player.vimeo.com/video/'.$id
                    .($hash && preg_match('/^[a-f0-9]+$/i', (string) $hash) ? '?h='.$hash : '');
            }
        }

        return null;
    }
}
