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
2. **Repositório:** `miqueiasjed/portfolio`, branch `kit-isso-nunca-deveria-ser-manual`. Este site não tem deploy automático: publica só pelo botão Deploy do Forge. O site principal (`miqueias.ia.br`) segue a branch `main` com deploy automático.
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

Painel em `membros.miqueias.ia.br/admin` (e-mail e senha, só para quem é `is_admin`): visão geral de vendas e receita, compras com filtros e exportação em CSV, alunos com acessos e progresso, liberar acesso na mão, revogar (reembolso) e cadastro de cursos (módulos, aulas com vídeo do YouTube ou Vimeo, material para baixar).

Arquivos enviados pelo admin ficam em `storage/app/private/uploads` (disco `uploads`, nunca servido direto), com até 50 MB cada. Para aceitar esse tamanho, o PHP do servidor precisa de `upload_max_filesize` e `post_max_size` de pelo menos 50M, e o Nginx de `client_max_body_size` igual ou maior.

Criar ou trocar a senha de um admin (a senha nunca vai em texto claro):

```bash
php artisan membros:admin email@x.com --hash="$(php -r 'echo password_hash("NOVA_SENHA", PASSWORD_BCRYPT);')"
```

## Comandos úteis

```bash
php artisan membros:compras            # últimas compras
php artisan membros:liberar email@x.com kit   # libera na mão e envia o link
php artisan membros:revogar email@x.com kit   # reembolso: tira o acesso
php artisan test                       # 177 testes: compra, aviso, link mágico, download, admin, cursos, aulas e Rotina do Dia
npm run test:js                        # 724 testes da ferramenta Rotina do Dia (vitest)
```

Nunca rode `php artisan test` com variáveis `DB_*` exportadas no shell: elas passam por cima do `phpunit.xml` e o `RefreshDatabase` zera o banco apontado. Confira antes com `env | grep DB_` (não deve imprimir nada).

## Produtos

O kit é criado por `database/seeders/ProdutoSeeder.php` só quando ainda não existe, então o deploy não desfaz o que foi editado no admin. O PDF do kit fica em `resources/produtos/` (nunca exposto direto) e os blocos da página dele em `database/data/kit-conteudo.json`. Cursos novos, módulos e aulas são cadastrados em `/admin/cursos`.

## Rotina do Dia

Ferramenta do dono do negócio: a lista do dia com as mensagens prontas de confirmação de horário (01), retomada de orçamento (04) e cobrança (05), abertas no WhatsApp pelo próprio dono. Mora dentro deste app, em `membros.miqueias.ia.br/rotina` (frontend em `resources/rotina/`, React puro, sem Inertia). A página de venda é `miqueias.ia.br/rotina-do-dia/` (arquivo `rotina-do-dia/index.html` na raiz do repositório, servido pelo site principal), com o botão apontando para `membros.miqueias.ia.br/comprar/rotina-do-dia`.

O produto tem slug `rotina-do-dia` e é criado pelo `ProdutoSeeder` a R$ 147 (14700 centavos) quando ainda não existe. Arquitetura e contratos: `.claude/prd/rotina-do-dia.md`.

### Rotas

| Rota | Proteção | O que faz |
|---|---|---|
| `GET /rotina` | pública | Casca da ferramenta, sem dado nenhum. |
| `GET /rotina/manifest.webmanifest` | pública | Manifest para instalar na tela inicial. |
| `GET /rotina/sw.js` | pública | Service worker montado a partir do build do Vite. Fora de local e testing, sem `public/build/manifest.json` responde 503 para o service worker antigo continuar no aparelho. |
| `GET /rotina/entrar` | `auth` | Só redireciona para `/rotina`. Serve de destino do link mágico. |
| `POST /rotina/aparelho` | `auth` (sessão e CSRF), `throttle:10,1` por usuário | Exige compra paga do `rotina-do-dia`. Cria o token do aparelho e devolve `{ token, nome, email }`. 403 sem compra. |
| `GET /rotina/acesso` | Bearer do aparelho: `LimiteDeFalhasDoAparelho`, `aparelho`, `throttle:60,1` por usuário | Checagem online. 200 liberado, 401 token desconhecido ou revogado, 403 compra revogada. |
| `POST /rotina/uso` | Bearer, mesma pilha do acesso, contador próprio | Recebe as contagens por dia. 204. |
| `POST /rotina/codigo` | pública, fora do CSRF, `throttle:5,1` por IP e 3 pedidos por e-mail a cada 15 min | Manda o código de 6 dígitos para quem tem compra paga. Sempre 204. |
| `POST /rotina/codigo/confirmar` | pública, fora do CSRF, `throttle:10,1` por IP e 10 tentativas por e-mail a cada 15 min | Código certo: 201 com o token, igual ao `POST /rotina/aparelho`. Errado ou vencido: 422. |

Limite de recusas: em `/rotina/acesso` e `/rotina/uso`, as respostas 401 e 403 contam por IP (120 por minuto, `AppServiceProvider::limitesDaRotina`). Passou disso, o IP inteiro recebe 429, inclusive quem tem compra paga atrás do mesmo IP. No aparelho o 429 vira carência, sem perda de dado.

### Liberar e revogar na mão

```bash
php artisan membros:liberar email@x.com rotina-do-dia   # cortesia: compra de valor 0, envia o link de acesso
php artisan membros:revogar email@x.com rotina-do-dia   # reembolso: marca as compras pagas como reembolsadas
```

O produto padrão dos dois comandos é `kit`: o slug `rotina-do-dia` precisa ir explícito. Pelo admin, o mesmo sai em "Liberar acesso" (escolhendo o produto Rotina do Dia) e no botão "Revogar" da compra, em Compras ou na ficha do aluno. Compra revogada derruba todos os aparelhos daquele usuário na próxima checagem online. O admin não apaga compra, só revoga.

### Medição

Página "Rotina do Dia" do admin (`/admin/rotina`). Conta só compradores não-admin com compra paga do `rotina-do-dia`; compra de valor 0 aparece como cortesia e fica fora do resumo.

- **Seguir ou parar:** Vendas (meta 10, mínimo 5); usaram 3 dias ou mais na semana 1, sobre as semanas 1 já fechadas (meta 6); primeiro envio em 24 h, sobre as vendas; sem primeiro envio há 7 dias; média de envios na semana 1.
- **Sem primeiro envio há 7 dias:** quem pagou e nunca mandou mensagem, com o botão "Enviar link de entrada".
- **Compradores**, uma linha por pessoa:
  - Comprador: nome, e-mail e a marca "cortesia" quando a compra foi de valor 0;
  - Compra: data da compra;
  - Primeiro envio: dia do primeiro envio, marcado "em 24 h" (dia da compra ou o seguinte) ou "depois de 24 h"; "nenhum" se nunca enviou;
  - Semana 1: envios e dias de uso nos 7 dias a partir da compra, com "em andamento" enquanto a semana não fechou;
  - Último uso: última checagem online de qualquer aparelho; "nunca abriu" se não houve;
  - Aparelhos: aparelhos ativos (não revogados).

O servidor nunca recebe dado de cliente do dono: nome, telefone, valor e texto de mensagem ficam só no aparelho. O que chega em `POST /rotina/uso` são contagens por dia e por aparelho (`enviados`, `respostas`, `resolvidos` e `por_processo`), gravadas em `rotina_uso`.

### Checklist do deploy da pré-venda

Pré-venda de 08/12 a 22/12/2026. O ensaio em celular de verdade segue o roteiro `docs/rotina-do-dia/ensaio.md`, que existe só na máquina do Miquéias: a pasta `docs/` fica fora do git de propósito, então o roteiro não está no repositório nem no servidor.

Antes do ensaio:

- [ ] `.env` do site de membros: a Rotina não pede variável nova. Usa as que já existem: `APP_URL`, `PAGBANK_TOKEN`, `PAGBANK_SANDBOX`, `RESEND_API`, `MAIL_FROM_ADDRESS` e `CACHE_STORE=database` (o código de entrada fica no cache). Conferir em Forge > site membros > Environment. Como o deploy roda `optimize`, mudança no Environment só vale depois de um Deploy.
- [ ] Deploy script (seção "Deploy no Forge") com `migrate --force` e `db:seed --class=ProdutoSeeder --force`. O seeder usa `firstOrCreate`: cria `rotina-do-dia` a R$ 147 só se ele não existe e nunca sobrescreve preço nem "Ativo para venda" editados no admin. Conferir em Forge > site membros > Deployments que o último deploy é do último commit da branch `kit-isso-nunca-deveria-ser-manual`.
- [ ] Rotina do Dia fora da venda até a janela do ensaio: admin > Cursos > Rotina do Dia > desligar "Ativo para venda" > Salvar. Conferir em aba anônima que `https://membros.miqueias.ia.br/comprar/rotina-do-dia` dá 404. Motivo: a página de venda já está no ar e, com `PAGBANK_SANDBOX=true`, qualquer visitante paga com cartão de teste e ganha acesso de verdade. O mesmo vale para o kit, porque a configuração do PagBank é uma só: o roteiro desliga o kit durante a janela também.
- [ ] Nginx do site principal: a regra `location ^~ /membros/ { deny all; return 404; }` continua e nenhuma regra bloqueia `/rotina-do-dia/`. Conferir com `curl -I https://miqueias.ia.br/rotina-do-dia/` (200).
- [ ] Nginx do site principal bloqueia `/docs/` e `/.claude/`, porque o site serve a raiz do repositório e essas pastas guardam briefing e planos. Hoje elas não estão no git e não chegam ao servidor; o bloqueio é para o dia em que entrarem. Acrescentar `location ^~ /docs/ { deny all; return 404; }` e o mesmo para `/.claude/`, se a regra de arquivos ocultos do Forge (`location ~ /\.(?!well-known).*`) não cobrir. Conferir com `curl -I https://miqueias.ia.br/docs/rotina-do-dia/briefing.md` e `curl -I https://miqueias.ia.br/.claude/rules.md` (403 ou 404).
- [ ] `sw.js`: `curl -I https://membros.miqueias.ia.br/rotina/sw.js` mostra 200, `Content-Type: application/javascript`, `Cache-Control: no-cache` e `Service-Worker-Allowed: /rotina`. Se vier sem esses headers, uma regra `location ~* \.js$` do Nginx do Forge está pegando a rota antes do PHP. Na mesma resposta, `cf-cache-status` da Cloudflare não pode ser `HIT`. Um 503 quer dizer build sem `public/build/manifest.json`: rodar o Deploy de novo.
- [ ] Manifest: `curl -I https://membros.miqueias.ia.br/rotina/manifest.webmanifest` responde 200 com `Content-Type: application/manifest+json`.
- [ ] Aula da pré-venda cadastrada: admin > Cursos > Rotina do Dia > módulo e aula. Conferir entrando na área com um e-mail de cortesia (`membros:liberar ... rotina-do-dia`).

Durante e depois do ensaio:

- [ ] Janela do ensaio: Forge > Environment com `PAGBANK_SANDBOX=true` e o token do sandbox, Deploy, ligar "Ativo para venda" da Rotina do Dia só agora. Anotar a hora de início.
- [ ] Ensaio do roteiro `docs/rotina-do-dia/ensaio.md` feito nos dois celulares (Android e iPhone), sem falha nos blocos de compra, entrada, envio e reembolso.
- [ ] Fechar a janela assim que as compras de teste estiverem Pagas: desligar "Ativo para venda" da Rotina do Dia, Forge > Environment com `PAGBANK_SANDBOX=false` e o token de produção, Deploy. Anotar a hora de fim.
- [ ] Compras de fora durante a janela: admin > Compras, filtrar pelo dia do ensaio, sem filtro de produto. Procurar compra que não seja dos e-mails do ensaio, entre o início e o fim da janela, da Rotina do Dia e também do kit (com o sandbox ligado, o kit também podia ser comprado com cartão de teste). Achou: revogar na hora e anotar o e-mail.
- [ ] Compras de teste revogadas: as do ensaio e as cortesias de teste ficam Reembolsadas, conferido em admin > Compras. Reembolsada fica fora das vendas, da receita e da medição.
- [ ] Preço conferido em admin > Cursos > Rotina do Dia (R$ 147,00), igual ao da página `miqueias.ia.br/rotina-do-dia/`.
- [ ] "Ativo para venda" da Rotina do Dia desligado até a abertura em 08/12. Na abertura, ligar só com o PagBank em produção.
