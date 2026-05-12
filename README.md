# GTec — Gestão Técnica

Plataforma web de acompanhamento gerencial e executivo para diretoria técnica de empresas de engenharia.

---

## Pré-requisitos

| Ferramenta | Versão mínima |
|------------|---------------|
| Node.js | 18+ |
| npm | 9+ |
| PostgreSQL | 15+ (local ou Supabase) |

---

## Setup em 5 passos

### 1. Clonar e instalar dependências

```bash
cd gtec
npm install
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env.local
```

Edite `.env.local` com suas credenciais:

```env
# Banco de dados local
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/gtec_db"

# NextAuth — gere o secret com: openssl rand -base64 32
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="sua-chave-de-no-minimo-32-caracteres"

# Supabase Storage (ou use Mock para dev)
SUPABASE_URL="https://xxx.supabase.co"
SUPABASE_ANON_KEY="eyJ..."
SUPABASE_SERVICE_ROLE_KEY="eyJ..."
SUPABASE_STORAGE_BUCKET="gtec-attachments"

# Cron
CRON_SECRET="qualquer-string-segura"
```

> **Sem Supabase?** Para desenvolvimento, você pode mockar o storage.
> O sistema funciona completamente para todas as features exceto upload de arquivos.

### 3. Criar o banco e rodar migrations

```bash
# Cria o banco (se local)
createdb gtec_db

# Gera o Prisma Client + aplica schema
npm run db:migrate
```

Em produção (sem migrations interativas):
```bash
npx prisma migrate deploy
```

### 4. Popular com dados de exemplo

```bash
npm run db:seed
```

Isso cria:
- 5 áreas configuradas
- 7 usuários com escopos
- 4 contratos (2 em risco)
- 5 reports (4 publicados)
- 8 demandas (1 vencida)
- Comentários da diretoria
- Solicitações de evidência pendentes
- 1 pauta de reunião montada

### 5. Rodar em desenvolvimento

```bash
npm run dev
```

Acesse: **http://localhost:3000**

---

## Usuários de acesso (todos com senha `gtec@2026`)

| E-mail | Papel | Área |
|--------|-------|------|
| ridsonlima@gmail.com | **Diretor Técnico** | Global |
| joao.ferreira@empresa.com | Gestor | Obras Próprias |
| ana.costa@empresa.com | Gestora | Obras Terceirizadas |
| carlos.silva@empresa.com | Supervisor | SESMT |
| marcos.pereira@empresa.com | Gestor | Planejamento |
| lucia.ramos@empresa.com | Supervisora | Equipamentos |
| admin@empresa.com | **Admin** | Global |

---

## Comandos úteis

```bash
npm run dev              # Desenvolvimento com hot-reload
npm run build            # Build de produção
npm run start            # Inicia build de produção

npm run db:migrate       # Aplica migrations pendentes
npm run db:seed          # Popula banco com dados de exemplo
npm run db:reset         # Limpa e re-popula (CUIDADO: apaga dados)
npm run db:studio        # Abre Prisma Studio (GUI do banco)
npm run db:generate      # Regenera Prisma Client após mudança no schema

npm run lint             # Verifica erros de lint
```

---

## Estrutura do projeto

```
src/
├── app/
│   ├── (auth)/          # Telas sem autenticação (login)
│   ├── (app)/           # Telas autenticadas (com sidebar)
│   │   ├── dashboard/   # Dashboard executivo
│   │   ├── areas/       # Painéis por área
│   │   ├── reports/     # Reports
│   │   ├── demandas/    # Gestão de demandas
│   │   ├── contratos/   # Visão por contrato
│   │   ├── evidencias/  # Central de evidências
│   │   ├── interacoes/  # Centro de interações
│   │   └── pauta/       # Pautas de reunião
│   └── api/             # Route Handlers (backend)
├── components/          # Componentes React reutilizáveis
├── lib/                 # Utilitários (prisma, auth, permissions...)
├── schemas/             # Validações Zod
└── types/               # Tipos TypeScript globais
prisma/
├── schema.prisma        # Schema completo do banco
└── seed.ts              # Dados de exemplo
```

---

## Deploy em produção

### Vercel (recomendado)

1. Faça push do projeto para um repositório Git
2. Importe no [Vercel](https://vercel.com)
3. Configure as variáveis de ambiente no painel
4. O deploy acontece automaticamente a cada push

### Banco de dados

**Supabase (recomendado para MVP):**
- Crie um projeto em [supabase.com](https://supabase.com)
- Use a connection string do painel em `DATABASE_URL`
- Crie o bucket `gtec-attachments` em Storage → New Bucket (privado)

**Railway:**
- Alternativa simples para PostgreSQL gerenciado

### Cron job (demandas vencidas)

Configure no `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/demands/overdue",
    "schedule": "0 1 * * *"
  }]
}
```

Adicione o header `x-cron-secret` com o valor do `CRON_SECRET` no painel do Vercel.

---

## Custo estimado de infraestrutura

| Serviço | Plano | Custo/mês |
|---------|-------|-----------|
| Vercel | Pro | US$ 20 |
| Supabase | Pro | US$ 25 |
| **Total** | | **~US$ 45 / R$ 250** |

---

## Próximas etapas (V2)

- [ ] Projetos Estratégicos (schema já preparado)
- [ ] Notificações por e-mail
- [ ] Dashboard com gráficos analíticos
- [ ] Calendário consolidado de prazos
- [ ] Indicadores de SLA de resposta
- [ ] Templates de report por área
- [ ] Relatórios exportáveis

---

## Arquitetura resumida

```
Next.js 14 (App Router)
├── React Server Components → renderização no servidor
├── Route Handlers → API REST
├── NextAuth.js → autenticação JWT
└── Middleware → guard de rotas

PostgreSQL (Supabase/Railway)
└── Prisma ORM → migrations + type safety

Supabase Storage
└── Anexos com URLs pré-assinadas

Vercel
└── Deploy automático + Cron Jobs
```

---

*GTec v0.1 — Gestão Técnica Interna*
