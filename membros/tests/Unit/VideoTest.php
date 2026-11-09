<?php

namespace Tests\Unit;

use App\Support\Video;
use PHPUnit\Framework\TestCase;

class VideoTest extends TestCase
{
    public function test_converte_youtube_e_vimeo_para_embed(): void
    {
        $yt = 'https://www.youtube.com/embed/dQw4w9WgXcQ';

        $this->assertSame($yt, Video::embed('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s'));
        $this->assertSame($yt, Video::embed('https://m.youtube.com/watch?v=dQw4w9WgXcQ'));
        $this->assertSame($yt, Video::embed('https://youtu.be/dQw4w9WgXcQ?si=abc'));
        $this->assertSame($yt, Video::embed('https://youtube.com/shorts/dQw4w9WgXcQ'));
        $this->assertSame($yt, Video::embed('youtube.com/embed/dQw4w9WgXcQ'));
        $this->assertSame('https://player.vimeo.com/video/76979871', Video::embed('https://vimeo.com/76979871'));
        $this->assertSame('https://player.vimeo.com/video/76979871?h=8272103f6e', Video::embed('https://vimeo.com/76979871/8272103f6e'));
        $this->assertSame('https://player.vimeo.com/video/76979871?h=abc123', Video::embed('https://player.vimeo.com/video/76979871?h=abc123'));
    }

    public function test_outros_links_devolvem_null(): void
    {
        $this->assertNull(Video::embed(null));
        $this->assertNull(Video::embed(''));
        $this->assertNull(Video::embed('https://exemplo.com/video.mp4'));
        $this->assertNull(Video::embed('https://www.youtube.com/channel/abc'));
        $this->assertNull(Video::embed('https://vimeo.com/sobre'));
    }
}
