<!doctype html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:#F5F2EC;font-family:Poppins,Helvetica,Arial,sans-serif;color:#1C1E24">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F2EC;padding:32px 16px">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#1C1D20;color:#F2EFE9">
<tr><td style="padding:40px 36px 8px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#92959D">
@if($produto){{ $produto }}@else Área de membros @endif
</td></tr>
<tr><td style="padding:8px 36px 0;font-size:28px;line-height:1.2;font-weight:500">
{{ $titulo }}
</td></tr>
<tr><td style="padding:20px 36px 0;font-size:15px;line-height:1.6;color:#C9C6BF">
{{ $texto }}
</td></tr>
<tr><td style="padding:32px 36px 40px">
<a href="{{ $link }}" style="display:inline-block;background:#F2EFE9;color:#1C1D20;padding:16px 28px;text-decoration:none;font-weight:500;font-size:15px">{{ $botao }}</a>
<p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#92959D">Se o botão não abrir, copie este endereço no navegador:<br><span style="color:#C9C6BF;word-break:break-all">{{ $link }}</span></p>
</td></tr>
<tr><td style="padding:20px 36px;border-top:1px solid #3E4046;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#92959D">
Miquéias Mesquita · Engenheiro de Operações Digitais
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>
