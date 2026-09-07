# Replai — Web Panel

![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-087EA4?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)

**The operator console for an AI-powered WhatsApp automation platform — where a bot hands the conversation back to a human, and a human needs to know which customer has been waiting the longest.**

---

## Overview

**Replai** is a multi-tenant SaaS that automates WhatsApp conversations for small and mid-sized businesses. An AI assistant answers incoming messages using a business-specific context (services, pricing, hours, FAQ) and captures qualified leads along the way.

This repository contains the **web panel**: the interface business owners and agents use to supervise those conversations, take over from the bot when a human is needed, and work the resulting lead pipeline.

The panel is a standalone Next.js application. It holds no database and no business rules of its own — it consumes a **separate Express REST API** (a different repository) over HTTP, and that API remains the sole authority for authentication, authorization and tenant isolation.

There is no public sign-up flow: a **PLATFORM_ADMIN** provisions new businesses (and their first `OWNER`), and each `OWNER` provisions the agents on their own team. This mirrors how the product is actually sold and onboarded — as a managed SaaS, not a self-serve app.

```
┌──────────────────────┐        HTTPS / JSON         ┌──────────────────────┐        ┌──────────────┐
│   Replai Web Panel   │  ─────────────────────────▶ │   Express REST API   │ ─────▶ │   WhatsApp   │
│  (this repository)   │   Bearer JWT + httpOnly     │  auth · tenants · AI │        │ Business API │
│  Next.js 16 · React  │   refresh cookie            │  persistence         │        └──────────────┘
└──────────────────────┘ ◀───────────────────────── └──────────────────────┘
```

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Routes](#routes)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Scripts](#scripts)
- [Project structure](#project-structure)
- [Roadmap](#roadmap)
- [License](#license)

---

## Features

### Conversation inbox
- Single list of every WhatsApp conversation for the signed-in business, **sorted by who is actually waiting**, not merely by recency.
- Each conversation is classified by *who spoke last* — customer, bot, or human agent — which drives a live "needs a reply" counter.
- Waiting time is escalated into three urgency tiers (`normal` under 15 min, `high` from 15 min, `critical` from 60 min) and surfaced as a compact badge (`12m`, `3h`).
- Full message history per conversation, with the agent able to reply directly from the panel.
- Conversation state can be switched between **Active** and **Closed** (the `Bot` state is read-only, owned by the backend).
- Responsive master/detail layout: side-by-side on desktop, list-then-chat with a back affordance on mobile, including safe-area insets for notched devices.

### Lead pipeline
- CRM-style view over the leads the assistant captured, across a `NEW → CONTACTED → QUALIFIED → CLOSED` pipeline.
- Headline metrics (total, new, in follow-up, qualified), full-text search, category filter, and a "pending only" toggle.
- Leads can be advanced through the pipeline from either the leads board or directly from the chat header, and renamed inline.
- A "captured info" panel renders the structured data the assistant extracted during the conversation.
- Pipeline changes are applied **optimistically and rolled back** if the API rejects them, so the UI never quietly lies about persisted state.

### Bot context editor
- Form-based editor for the assistant's knowledge: assistant name, business description, services and pricing, hours and contact details, FAQ, and free-form instructions.
- Incoming payloads are normalized field by field, so a partial or unexpected response from the API degrades into empty fields rather than a crash.

### Users and roles
- Every user manages their own profile and password, with live password-rule feedback shared across all three password screens.
- **OWNER** additionally manages the business team: create agents, activate and deactivate users.
- **PLATFORM_ADMIN** gets a dedicated administration area: platform-wide metrics, business CRUD, per-business user management, and a bot-context editor scoped to any tenant. Destructive actions (deleting a business) require password confirmation.

---

## Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 16** (App Router) | Route groups, server and client components |
| UI runtime | **React 19** | |
| Language | **TypeScript 5** | `strict: true`, path alias `@/*` |
| Styling | **Tailwind CSS 4** | CSS-first config via `@theme inline`, `oklch` token palette; no `tailwind.config` file |
| Components | **shadcn/ui** (Radix-based scaffolding), **lucide-react** icons | |
| Data fetching | Native `fetch` behind a single in-house HTTP client | No data-fetching library |
| Linting | **ESLint 9** flat config + `eslint-config-next` | `core-web-vitals` and `typescript` presets |

The dependency surface is deliberately small: there is no state-management library, no HTTP client dependency and no form library. Application state lives in composed React hooks, and the network boundary is one file.

---

## Architecture

Four decisions define this codebase.

### 1. Route groups separate the two shells

The App Router is organized so that layout concerns never leak between authenticated and unauthenticated surfaces:

- `app/(auth)/` — no shared layout; the sign-in screen owns its full-page presentation.
- `app/(dashboard)/` — one client layout providing the collapsible sidebar (collapse state persisted in `localStorage`), the header with role badge and sign-out, the session guard, and the redirect that sends platform administrators to their own area.
- `app/privacy/` — outside both groups, a plain server-rendered page (a standing requirement for WhatsApp Business API review).

Route groups mean the URL structure stays flat (`/conversations`, `/leads`) while the component tree reflects the real trust boundary.

### 2. `useConversations` is a composition root, not a god hook

The conversations screen is the most stateful part of the product: a polled list, a polled message thread, optimistic sends, conversation status changes and lead status changes — all reconciling against the same objects. Rather than growing one large hook, it is split by *responsibility* and composed:

```
useConversations                        ← composition root: owns shared state, wires the parts
├── useConversationMessages             ← message thread, optimistic send, per-thread polling
├── internal/useConversationDataLoader  ← fetch + reconcile conversations against leads
├── internal/useConversationActions     ← selection, send, conversation status transitions
├── internal/useConversationLeadActions ← lead status transitions from the chat (optimistic + rollback)
└── internal/useConversationPresentation← derives view-models for the list and the chat header
```

The boundaries are enforced by naming and location: anything under `hooks/internal/` is an implementation detail of the composition root and is never imported by a page. Pages consume the barrel in `hooks/index.ts` and receive ready-to-render view-models — no page recomputes urgency, sorting or badge classes.

### 3. Domain logic is pure and isolated from React

The rules that decide *what the operator sees first* live in `lib/utils/shared/` as plain functions with no React and no I/O:

| Module | Responsibility |
|---|---|
| `shared/attention.ts` | `classifyLastMessageActor` — resolves whether the customer, the bot or an agent spoke last, from a cascade of sender type → status prefix → direction. `requiresAttentionFromLastMessage` builds on it. |
| `shared/time.ts` | `toTimestamp` (invalid-date safe) and `formatShortWaitTime` (`12m` / `3h`). |
| `shared/sorting.ts` | `getUrgencyLevel` and `getUrgencyRank` — the 15-minute / 60-minute escalation ladder. |

`lib/utils/conversation.ts` and `lib/utils/leads.ts` re-export these and add only presentation on top (labels, badge classes, formatting). Sorting comparators are **total and deterministic**: after urgency and timestamp, ties break on `id.localeCompare`, so the list never reshuffles between two equally urgent conversations on re-render.

`lib/utils/conversationData.ts` handles the messy reality of joining two backend collections: it normalizes phone numbers (including the Mexican `521…` → `52…` mobile-prefix rule) into a lookup key, joins conversations to leads by phone, parses a `notes` payload that may arrive as an object *or* as a JSON string, and — importantly — merges polled results while **keeping last-message metadata already known**, so a thinner response from a later poll cannot erase information the UI is already showing.

Because these functions are pure and side-effect free, the interesting behaviour of the product is reasonable to reason about in isolation from the rendering layer.

### 4. One HTTP layer, one session policy

`lib/api/apiClient.ts` is the only place the application talks to the backend. It centralizes:

- **Base URL resolution.** `NEXT_PUBLIC_API_URL` is inlined at build time, then adjusted at runtime for two real deployment hazards: a stale local build pointing at the frontend's own port, and the panel being opened from a phone over a LAN IP (where `localhost` would resolve to the phone itself, so the current host is reused while the API port is preserved).
- **Authorization.** The JWT is read from a module-level accessor exported by the auth context and attached as `Authorization: Bearer …`.
- **Error mapping.** Non-OK responses are normalized into `Error` instances carrying the API's own `message`/`error`; a non-JSON response raises an explicit, actionable message naming the misconfigured environment variable instead of a `SyntaxError` deep in a component.
- **Expiry.** A `401` on any non-login endpoint clears every auth artifact and redirects to `/login`, in exactly one place.

Session handling in `lib/auth/AuthContext.tsx` is deliberately conservative. The access token is kept in `sessionStorage` (it dies with the tab) alongside a session flag, and restoration **never trusts the stored token**:

```
mount
 └─ session flag present?           no → signed out
     └─ token in sessionStorage?    no → POST /auth/refresh   (httpOnly cookie, credentials: 'include')
         └─ still no token?             → signed out
     └─ GET /auth/me with that token
         └─ response shape valid?   no → signed out   (userId and email must be strings)
         └─ yes                         → session restored
```

Two properties fall out of this: a revoked or expired token can never produce a half-authenticated UI, because the profile is always re-fetched and shape-checked before the session is considered valid; and a user whose access token is gone still gets a silent recovery via the refresh cookie rather than a surprise sign-in prompt.

**On route protection — stated precisely:** the panel's route guard is **client-side only**. The dashboard layout redirects unauthenticated visitors, and admin pages redirect non-administrators. This gates the *interface*, not the *data*: every request carries the JWT and the backend independently enforces authentication, role and tenant scoping. The panel is a client of an authorization boundary, not the boundary itself.

### Data freshness

There is no WebSocket or SSE channel. The panel keeps state current by polling on a 5-second interval — conversations and leads from the list hooks, and messages for the selected thread. Writes do not wait for the next tick: sends and status changes update local state immediately and reconcile (or roll back) against the response.

---

## Routes

| Route | Rendering | Purpose |
|---|---|---|
| `/login` | Client | Email/password sign-in; redirects by role after success |
| `/privacy` | Server | Static privacy policy |
| `/` | Server | Redirects to `/conversations` |
| `/conversations` | Client | Inbox and chat panel |
| `/leads` | Client | Lead pipeline board |
| `/settings/bot` | Client | Bot context editor (also reachable at `/settings`; accepts `?businessId=` for platform administrators) |
| `/users` | Client | Own profile and password; team management for `OWNER` |
| `/admin` | Client | Platform metrics and business list (`PLATFORM_ADMIN`) |
| `/admin/businesses/[businessId]` | Client | Business detail, users and configuration summary (`PLATFORM_ADMIN`) |

---

## Getting started

### Prerequisites

- **Node.js 20.9+** (required by Next.js 16)
- **npm**
- A running instance of the **Replai backend API** (separate repository), reachable over HTTP

### Installation

```bash
git clone <this-repository>
cd frontend
npm install
```

### Configuration

Create a `.env.local` file at the project root:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### Run

```bash
npm run dev
```

The panel starts on **http://localhost:3001** and expects the backend on **port 3000**. The two ports are distinct on purpose: `NEXT_PUBLIC_API_URL` must point at the API, never at the panel itself.

---

## Environment variables

| Variable | Scope | Required | Default | Purpose |
|---|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | Client and server | Yes in any non-local deployment | `http://localhost:3000` | Base URL of the Replai REST API. Read by the HTTP client and the auth context. |

This is the only environment variable the application reads. It is intentionally a public (`NEXT_PUBLIC_`) value — a base URL, never a secret. No credentials are exposed to the browser bundle.

Because the value is inlined at build time, a change requires a rebuild, not just a restart.

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Development server on port **3001** |
| `npm run build` | Production build |
| `npm start` | Production server. **Note:** `next start` defaults to port 3000, which collides with the backend — run `npx next start -p 3001` (or set `PORT=3001`) when both run on the same host. |
| `npm run lint` | ESLint across the project |

---

## Project structure

```
.
├── app/
│   ├── (auth)/
│   │   └── login/                    Sign-in screen, redirects by role
│   ├── (dashboard)/                  Authenticated shell: sidebar, header, client session guard
│   │   ├── conversations/            Inbox + chat (master/detail, responsive)
│   │   ├── leads/                    Lead pipeline board
│   │   ├── settings/bot/             Bot context editor
│   │   ├── users/                    Profile, password, team management
│   │   ├── admin/                    Platform administration
│   │   └── layout.tsx                Guard, sidebar, role-based redirect
│   ├── privacy/                      Static privacy policy
│   ├── layout.tsx                    Root layout, global styles
│   ├── providers.tsx                 AuthProvider boundary
│   └── globals.css                   Tailwind 4 entry + design tokens
│
├── components/
│   ├── conversations/                ChatHeader, ConversationList, ConversationItem
│   ├── leads/                        Lead list presentation
│   ├── navigation/                   PanelSidebar (collapsible, persisted)
│   ├── security/                     PasswordRequirementsHint (live rule feedback)
│   └── ui/                           shadcn/ui primitives
│
├── hooks/
│   ├── index.ts                      Public barrel consumed by pages
│   ├── useAuth.ts                    Auth context accessor
│   ├── useConversations.ts           Composition root for the conversations screen
│   ├── useConversationMessages.ts    Thread state, optimistic send, polling
│   ├── useLeads.ts                   Leads board state, filters, optimistic patches
│   └── internal/                     Private units composed by useConversations
│
├── lib/
│   ├── api/apiClient.ts              Single HTTP boundary: base URL, auth header, errors, 401
│   ├── auth/AuthContext.tsx          Session lifecycle, token storage, restore/refresh
│   ├── security/passwordRules.ts     Shared password policy evaluation
│   ├── utils/
│   │   ├── shared/                   Pure domain logic: attention, time, urgency, ranking
│   │   ├── conversation.ts           Conversation presentation on top of shared/
│   │   ├── conversationData.ts       Phone normalization, lead join, poll-safe merging
│   │   └── leads.ts                  Lead statuses, transitions, presentation
│   └── utils.ts                      cn() — clsx + tailwind-merge
│
└── types/                            Shared type declarations
```

---

## Roadmap

The sidebar already reserves navigation slots for two areas surfaced as "coming soon" in the product itself: an **Analytics** view and a **Campaigns** view. Neither has a backing screen yet — they are shown here only because they are visible in the running application, not as a claim of hidden functionality.

---

## License

This repository is published as a portfolio and demonstration project. No `LICENSE` file is included; treat the source as all-rights-reserved unless a license is added.
