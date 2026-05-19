# Prestadores — Deploy

Dashboard de prestadores com sincronização entre dispositivos via Supabase.

## Passo a passo (caminho mais simples, sem Node.js local)

### 1. Backup dos dados atuais

No dashboard que você está usando, role até o final e clique em **"Exportar dados (JSON)"**. Guarde o arquivo `prestadores_AAAA-MM-DD.json` — você vai importá-lo depois.

### 2. Criar projeto no Supabase

1. Acesse https://supabase.com e crie uma conta (pode usar GitHub login)
2. Clique em **New Project**
3. Escolha:
   - **Name**: `prestadores` (qualquer nome)
   - **Database Password**: gere uma forte e guarde (você não vai precisar usar agora, mas anote)
   - **Region**: **South America (São Paulo)** — mais perto, mais rápido
4. Espere ~2 minutos o projeto ficar pronto

### 3. Criar a tabela

1. No menu lateral, vá em **SQL Editor → New query**
2. Cole o conteúdo do arquivo `supabase-schema.sql` deste projeto
3. Clique em **Run** (canto inferior direito)
4. Deve aparecer "Success. No rows returned"

### 4. Pegar as chaves de API

1. No menu lateral, vá em **Project Settings (engrenagem) → API**
2. Copie dois valores e guarde num bloco de notas:
   - **Project URL** (algo como `https://xxxxx.supabase.co`)
   - **anon public key** (uma chave longa começando com `eyJ...`)

### 5. Subir o código no GitHub

1. Crie uma conta no GitHub se não tiver: https://github.com/signup
2. Vá em https://github.com/new e crie um repositório novo:
   - **Repository name**: `prestadores-reforma`
   - Deixe como **Public** (ou Private se preferir — Vercel free aceita ambos)
   - **NÃO** marque "Initialize with README"
3. No GitHub, clique em **uploading an existing file**
4. Arraste TODOS os arquivos desta pasta (`prestadores-app`) para a página
5. Clique em **Commit changes**

### 6. Deploy no Vercel

1. Acesse https://vercel.com/signup e faça login com a conta do GitHub
2. Clique em **Add New → Project**
3. Encontre seu repositório `prestadores-reforma` e clique em **Import**
4. Em **Environment Variables**, adicione duas variáveis:
   - Nome: `VITE_SUPABASE_URL` — Valor: a URL do seu Supabase
   - Nome: `VITE_SUPABASE_ANON_KEY` — Valor: a anon key do Supabase
5. Clique em **Deploy**
6. Espere ~1 minuto

Pronto! Você verá uma URL tipo `prestadores-reforma-lucas.vercel.app`. Acesse de qualquer dispositivo.

### 7. Importar seus dados antigos

1. Abra a URL do Vercel no navegador
2. Role até o final do dashboard
3. Clique em **"Importar"**
4. Selecione o arquivo JSON que você exportou no passo 1
5. Aguarde alguns segundos — todos os prestadores aparecerão

## Atualizar o app no futuro

Edições no código → commit/push no GitHub → Vercel re-deploya automático.

## Trocar de dispositivo

Acesse a mesma URL. Os dados estão no Supabase, não no navegador, então tudo aparece igual.

## Observações de segurança

Esta configuração não tem autenticação — qualquer pessoa com a URL pode acessar e editar. Como a URL do Vercel é única e não-publicada, isso funciona como "segurança por obscuridade".

Se quiser autenticação por email/senha depois, dá pra adicionar usando o Supabase Auth (~30 min de trabalho). Me chama que adapto.

## Custos

Tudo em nível gratuito:
- **Supabase free**: 500 MB de banco, 50K usuários autenticados, 5 GB de tráfego/mês
- **Vercel free**: 100 GB de tráfego/mês, builds ilimitados em projetos pessoais

Para uso pessoal de cadastro de prestadores, você nunca chega perto desses limites.
