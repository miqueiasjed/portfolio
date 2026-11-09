# Área de membros · membros.miqueias.ia.br

Laravel + React (Inertia). Vende produtos digitais pelo PagBank, libera o acesso sozinho quando o pagamento é aprovado e entrega por uma área logada com link mágico por e-mail (sem senha).

## Como funciona

1. O botão "Quero o kit" do site (`/kit`) aponta para `membros.miqueias.ia.br/comprar/kit`.
2. A área cria a compra e um checkout no PagBank (Pix e cartão) e manda a pessoa para lá.
3. O PagBank avisa `/webhooks/pagbank`. A área **reconsulta o pedido na API do PagBank** antes de liberar, então um aviso falso não libera nada.
4. Pedido pago: cria o usuário pelo e-mail da compra, marca a compra como paga e envia pelo Resend o e-mail com o link de entrada (vale 7 dias, uso único).
5. Na área, a pessoa vê as compras, baixa o PDF (arquivo protegido, só para quem comprou) e copia as instruções.
6. Para voltar depois: `/entrar`, digita o e-mail e recebe um link novo (30 min).

## Deploy no Forge

O código mora na pasta `membros/` do repositório do site.

1. **Novo site** no mesmo servidor: domínio `membros.miqueias.ia.br`, projeto Laravel, PHP 8.3+.
2. **Repositório:** `miqueiasjed/portfolio`, branch `main`.
3. **Web Directory:** `/membros/public`.
4. **Banco:** MySQL do próprio servidor, banco e usuário `membros`.
5. **Environment** (`.env` do site): copie do `.env.example` e preencha `APP_KEY` (o Forge gera), `APP_URL=https://membros.miqueias.ia.br`, `APP_LOCALE=pt_BR`, banco, `PAGBANK_TOKEN`, `PAGBANK_SANDBOX` e `RESEND_API`.
   Como o Forge grava o `.env` na raiz do site e o Laravel lê em `membros/`, crie o link uma vez:
   `ln -sfn /home/forge/membros.miqueias.ia.br/.env /home/forge/membros.miqueias.ia.br/membros/.env`
6. **Deploy script:**

```bash
cd /home/forge/membros.miqueias.ia.br
git pull origin $FORGE_SITE_BRANCH
cd membros
$FORGE_COMPOSER install --no-dev --no-interaction --prefer-dist --optimize-autoloader
npm ci && npm run build
$FORGE_PHP artisan migrate --force
$FORGE_PHP artisan db:seed --class=ProdutoSeeder --force
$FORGE_PHP artisan optimize
( flock -w 10 9 || exit 1; echo 'Restarting FPM...'; sudo -S service $FORGE_PHP_FPM reload ) 9>/tmp/fpmlock
```

7. **SSL:** Let's Encrypt no Forge. Na Cloudflare, registro `membros` apontando para o IP do servidor, SSL em **Full (strict)**.
8. **Site principal (miqueias.ia.br):** como ele serve a raiz do mesmo repositório, bloqueie a pasta do código no Nginx dele:

```nginx
location ^~ /membros/ { deny all; return 404; }
```

## Resend

Envio pela API do Resend (`MAIL_MAILER=resend`), com a chave em `RESEND_API` (ou `RESEND_API_KEY`). O domínio `miqueias.ia.br` precisa estar verificado no Resend para enviar de `acesso@miqueias.ia.br`.

## PagBank

1. Gere o token do **sandbox** e teste uma compra de ponta a ponta.
2. Faça a **homologação** pedida pelo PagBank.
3. Troque para o token de produção e `PAGBANK_SANDBOX=false`.

A URL de aviso é enviada em cada checkout (`notification_urls`), não precisa configurar no painel.

## Administração

Painel em `membros.miqueias.ia.br/admin` (e-mail e senha, só para quem é `is_admin`): vendas, receita, compras com busca, liberar acesso na mão e revogar (reembolso).

Criar ou trocar a senha de um admin (a senha nunca vai em texto claro):

```bash
php artisan membros:admin email@x.com --hash="$(php -r 'echo password_hash("NOVA_SENHA", PASSWORD_BCRYPT);')"
```

## Comandos úteis

```bash
php artisan membros:compras            # últimas compras
php artisan membros:liberar email@x.com kit   # libera na mão e envia o link
php artisan membros:revogar email@x.com kit   # reembolso: tira o acesso
php artisan test                       # 14 testes: compra, aviso, link mágico, download e admin
```

## Produtos

Cadastrados em `database/seeders/ProdutoSeeder.php`. O PDF fica em `resources/produtos/` (nunca exposto direto) e o conteúdo da página do produto em `database/data/*.json`. O CMS de curso entra na fase 2.
