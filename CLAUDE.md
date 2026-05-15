# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Visão Geral

**GTec** é uma aplicação web de gestão técnica para engenharia, construída com Next.js 14 (App Router). Permite que diretores, coordenadores e supervisores acompanhem relatórios de área, demandas, contratos, pautas de reunião e evidências. A UI e toda a documentação estão em português (pt-BR).

## Comandos Principais

```bash
# Desenvolvimento
npm run dev          # Inicia o servidor de desenvolvimento em http://localhost:3000

# Banco de dados (Prisma)
npm run db:generate  # Gera o cliente Prisma após alterar o schema
npm run db:migrate   # Aplica migrações pendentes (desenvolvimento)
npm run db:push      # Sincroniza o schema sem criar migration (prototipagem rápida)
npm run db:studio    # Abre o Prisma Studio (GUI do banco)
npm run db:seed      # Popula o banco com dados de exemplo
npm run db:reset     # Reseta e re-seed o banco (DESTRÓI dados locais)

# Build e qualidade
npm run build        # Build de produção
npm run lint         # ESLint
```

**Variáveis de ambiente obrigatórias** (copiar de `.env.example` para `.env.local`):
- `DATABASE_URL` — PostgreSQL (Supabase ou Railway)
- `NEXTAUTH_SECRET` — string aleatória para JWT
- `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` — para storage de arquivos
- `CRON_SECRET` — protege o endpoint de cron

## Arquitetura

### Stack
- **Framework**: Next.js 14 com App Router e React Server Components
- **Banco de dados**: PostgreSQL via **Prisma ORM** (`prisma/schema.prisma`)
- **Autenticação**: NextAuth.js v5 (beta) com JWT de 8 horas, provedor de credenciais
- **Storage**: Supabase Storage (limite de 50 MB por arquivo)
- **Estado cliente**: React Query (cache de dados do servidor) + Zustand (estado UI)
- **UI**: Radix UI + Tailwind CSS com tema customizado (ver `tailwind.config.ts`)
- **Validação**: Zod schemas em `src/schemas/`

### Estrutura de pastas relevante

```
src/
├── app/
│   ├── (auth)/login/         # Rota pública de login
│   ├── (app)/                # Rotas protegidas (requerem sessão)
│   │   ├── dashboard/
│   │   ├── areas/[areaId]/
│   │   ├── reports/          # Relatórios de área
│   │   ├── demandas/         # Demandas/tarefas
│   │   ├── contratos/
│   │   ├── pauta/            # Pautas de reunião
│   │   ├── calendario/
│   │   ├── evidencias/
│   │   ├── notificacoes/
│   │   └── admin/            # Usuários e auditoria (master/admin apenas)
│   └── api/                  # Route Handlers (API REST interna)
├── components/
│   ├── AppShell.tsx          # Layout principal com sidebar
│   ├── reports/
│   ├── demands/
│   └── contracts/
├── lib/
│   ├── auth.ts               # Configuração NextAuth + callbacks de sessão
│   ├── permissions.ts        # RBAC: funções de verificação de permissão
│   ├── prisma.ts             # Singleton do cliente Prisma
│   ├── storage.ts            # Supabase Storage (upload, URLs assinadas, delete)
│   ├── notifications.ts      # Criação de notificações no banco
│   └── audit.ts              # Audit log com IP e constantes de ação
├── schemas/                  # Zod: report, demand, comment
└── types/
    ├── enums.ts              # Todos os enums do domínio (Role, Status, Priority…)
    └── next-auth.d.ts        # Extensão do tipo Session do NextAuth
```

### Controle de acesso por papel (RBAC)

Os papéis estão em `src/types/enums.ts` e a lógica em `src/lib/permissions.ts`. Hierarquia:

| Papel | Acesso |
|-------|--------|
| `master` | Tudo, incluindo impersonação e auditoria global |
| `admin` | Gestão de usuários e todas as áreas |
| `director` | Leitura de todas as áreas, aprovação de relatórios |
| `manager` | Gerencia áreas atribuídas (escrita) |
| `supervisor` | Cria/edita dentro das áreas atribuídas |
| `viewer` | Somente leitura |

A associação usuário-área fica em `UserAreaScope` (Prisma) com flag `canWrite`. Rotas sensíveis verificam permissões tanto no middleware (`src/middleware.ts`) quanto nos Route Handlers da API.

### Fluxo de dados

1. **Server Components** buscam dados diretamente via Prisma (sem fetch HTTP)
2. **Route Handlers** (`src/app/api/`) servem como API para mutações do cliente
3. **React Query** gerencia cache e revalidação no cliente
4. Uploads de arquivo vão direto ao Supabase Storage; o banco armazena apenas metadados em `Attachment`

### Cron job

`vercel.json` agenda `POST /api/demands/overdue` às 1h UTC diariamente para marcar demandas vencidas. O header `x-cron-secret` deve bater com `CRON_SECRET`.

### Modelos Prisma principais

`User`, `Area`, `UserAreaScope`, `Report`, `ReportVersion`, `Demand`, `DemandUpdate`, `Contract`, `Comment`, `EvidenceRequest`, `Attachment`, `MeetingAgenda`, `AgendaItem`, `Notification`, `AuditLog`, `Project`, `ProjectMilestone`.

Sempre rodar `npm run db:generate` após editar `prisma/schema.prisma`.

## Convenções do projeto

- **Idioma**: todo texto de UI, comentários de código e mensagens de commit em **português (pt-BR)**
- **Alias de importação**: usar `@/` para importar de `src/` (ex: `import { prisma } from '@/lib/prisma'`)
- **Cores do tema**: usar as classes semânticas do Tailwind (`brand-*`, `cdg-blue`, `cdg-gold`, `critical`, `attention`, `success`, `blocked`) definidas em `tailwind.config.ts`
- **Validação**: usar Zod schemas de `src/schemas/` antes de persistir dados
- **Audit log**: chamar funções de `src/lib/audit.ts` em todas as operações de escrita sensíveis
