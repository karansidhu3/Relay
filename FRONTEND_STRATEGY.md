# FRONTEND_STRATEGY.md — Relay

## Frontend Architecture

### Stack
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS
- **Animation:** Framer Motion
- **Charts:** Recharts (lightweight, composable, React-native)
- **Deployment:** Vercel

### Application Structure

```
relay-dashboard/
├── app/
│   ├── layout.tsx              # Root layout: nav, theme provider
│   ├── page.tsx                # System overview (/)
│   ├── events/
│   │   ├── page.tsx            # Event stream (/events)
│   │   └── [event_id]/
│   │       └── page.tsx        # Execution detail (/events/:id)
│   ├── projects/
│   │   ├── page.tsx            # Project list (/projects)
│   │   └── [project_id]/
│   │       └── page.tsx        # Project detail (/projects/:id)
│   ├── dlq/
│   │   └── page.tsx            # Dead letter queue (/dlq)
│   └── analytics/
│       └── page.tsx            # Performance analytics (/analytics)
├── components/
│   ├── ui/                     # Primitive components (Button, Badge, Card)
│   ├── layout/                 # Nav, Sidebar, Header
│   ├── events/                 # EventRow, EventStream, ExecutionTimeline
│   ├── charts/                 # ThroughputChart, DurationChart, ErrorChart
│   ├── dlq/                    # DLQTable, RequeueButton, SnapshotViewer
│   └── shared/                 # StatusPill, ProjectBadge, TimestampDisplay
├── lib/
│   ├── api/                    # API client functions
│   ├── hooks/                  # Custom React hooks (useEvents, useExecution)
│   └── utils/                  # Formatters, classifiers, helpers
└── types/
    └── relay.ts                # TypeScript interfaces mirroring API response shapes
```

### Data Fetching Strategy

- **Server Components** for initial page load (events list, project list, overview stats)
- **Client Components** for interactive elements (filters, re-queue buttons, detail drawers)
- **SWR or React Query** for client-side polling (event stream auto-refresh every 30s)
- **No WebSockets** — polling is sufficient for an async infrastructure dashboard. Real-time WebSocket infrastructure adds complexity without meaningful UX benefit at this scale.

---

## Page Structure

### `/` — System Overview
**Purpose:** First-glance system health at any time of day.

**Layout:** Three rows
- Row 1: Key metric cards (Total Events, Success Rate, Active Executions, DLQ Count)
- Row 2: Events per hour sparkline + Failure rate sparkline (last 24h)
- Row 3: Recent events list (last 10) + Per-project breakdown table

### `/events` — Event Stream
**Purpose:** Navigable history of all events with filtering.

**Layout:** Filter bar + full-width table
- Filter controls: project, event_type, status, time range
- Sortable table: timestamp, project, event_type, status, duration, attempts
- Infinite scroll or pagination (50 rows/page)
- Row click → opens execution detail (route push or drawer)

### `/events/:id` — Execution Detail
**Purpose:** Complete forensic view of a single event.

**Layout:** Two columns
- Left: Event metadata (ID, type, project, status, times) + raw payload JSON viewer
- Right: Visual execution timeline + attempt history table + error details + CloudWatch log link

### `/dlq` — Dead Letter Queue
**Purpose:** Operational control surface for failed events.

**Layout:** Summary + table
- Summary bar: DLQ count, oldest entry age, most common failure type
- Table: all DLQ'd events with failure summary
- Expanded row: full error context + re-queue button
- Bulk re-queue by filter

### `/projects` — Projects
**Purpose:** Per-application health overview.

**Layout:** Card grid → drill-down
- Each card: project name, 24h event count, success rate, last event time, DLQ count
- Click → project detail with filtered event stream

### `/analytics` — Performance Analytics
**Purpose:** Trend visibility and performance profiling.

**Layout:** Chart-heavy
- Throughput over time (line chart) with project breakdown
- Execution duration by event type (horizontal bar chart, P50/P95)
- Error type distribution (donut chart)
- Retry rate heatmap by event type

---

## UX Goals

1. **Data density without clutter.** Infrastructure dashboards are used by engineers who want information density. Whitespace is not a virtue here — every pixel should serve information.

2. **Instant orientation.** Within 3 seconds of loading, the user should know: is the system healthy right now? The overview page answers this without scrolling.

3. **Drilldown without context loss.** Moving from overview → event stream → execution detail should feel like zooming in, not navigating away.

4. **Operational confidence.** The DLQ section should feel like a control panel, not a graveyard. Re-queue actions are prominent, one-click, and confirmed with clear feedback.

5. **Minimal chrome.** The UI serves the data. No decorative gradients, no hero images, no marketing language. The aesthetic should feel like the tool was built by engineers for engineers.

---

## Motion Philosophy

Animation in Relay is functional, not decorative. Motion serves three purposes:

**1. State transitions** — Status pills animate when status changes (`PROCESSING` → `COMPLETED`). This communicates that the data is live, not static.

**2. Load states** — Skeleton loaders use subtle pulse animation. Prevents layout shift on data load.

**3. Spatial orientation** — Drawer open/close and page transitions use short (150-200ms) ease-out animations. Helps users maintain spatial context when navigating.

**What is explicitly avoided:**
- Entrance animations on every list item
- Parallax or scroll-driven effects
- Long (> 300ms) transitions
- Animation that delays access to information
- Motion purely for visual interest

Framer Motion is used for these specific cases, not as a general animation layer applied everywhere.

---

## Information Hierarchy

```
Level 1: System Health (is everything working?)
    → Overview page: success rate, DLQ count, active executions

Level 2: Project Health (which application is having issues?)
    → Project breakdown: per-project success rate, DLQ count

Level 3: Event History (what happened recently?)
    → Event stream: filtered, sortable, paginated

Level 4: Execution Detail (what happened to this specific event?)
    → Execution timeline: full chronological trace

Level 5: Forensic Detail (why did this specific attempt fail?)
    → Error details: error type, message, stack trace, CloudWatch link
```

The navigation mirrors this hierarchy: breadcrumbs and back navigation preserve context at each level.

---

## Visual System: Three Directions

**⚠️ Design direction not yet selected. Review options below and choose before implementation.**

---

### Direction A: Infrastructure Terminal
**Concept:** The dashboard feels like it was built inside a terminal. Monospace typography, high contrast, minimal color — only green/amber/red for status signals.

**Aesthetic references:** Grafana dark mode, Tailscale admin, Vercel deployment log view.

**Color palette:**
- Background: `#0a0a0a` (near-black)
- Surface: `#111111`
- Border: `#1f1f1f`
- Text primary: `#e8e8e8`
- Text secondary: `#666666`
- Green (success): `#00d47e`
- Amber (warning): `#f5a623`
- Red (error): `#ff4242`
- Blue (info): `#4c9fff`

**Typography:**
- All text: `JetBrains Mono` or `IBM Plex Mono`
- No serif, no humanist sans-serif
- Tight line heights, compact spacing

**Layout:**
- Single-column, full-width layout
- Tables dominate — this is a data-dense, information-first interface
- Cards have sharp corners, thin borders
- Status indicators use colored dot prefixes (● COMPLETED)

**Strengths:**
- Maximum information density
- Extremely readable at a glance
- Immediately signals "this is infrastructure tooling"
- Easy to implement cleanly

**Tradeoffs:**
- Less visually distinctive in a portfolio context
- Can feel austere / monotonous
- Requires careful spacing to avoid wall-of-text feel

---

### Direction B: Modern Observability (Linear / Datadog inspired)
**Concept:** Clean, modern SaaS aesthetic. Inter or Geist typography, subtle gradients on metric cards, smooth transitions. Looks like a product a team would pay for.

**Aesthetic references:** Linear dashboard, Vercel analytics, PlanetScale dashboard, Resend dashboard.

**Color palette:**
- Background: `#09090b` (Zinc-950)
- Surface: `#18181b` (Zinc-900)
- Border: `#27272a` (Zinc-800)
- Text primary: `#fafafa` (Zinc-50)
- Text secondary: `#71717a` (Zinc-500)
- Green: `#22c55e`
- Red: `#ef4444`
- Amber: `#f59e0b`
- Blue: `#3b82f6`
- Accent: subtle violet gradient for key metric cards

**Typography:**
- Body: `Geist` or `Inter` (proportional sans-serif)
- Mono for IDs, event types, code: `Geist Mono`
- Mixed usage creates visual hierarchy

**Layout:**
- Card-based grid with subtle borders and rounded corners (4-8px radius)
- Metric cards with trend indicators (↑ ↓)
- Status pills with colored background tints (not just text color)
- Smooth sidebar navigation

**Strengths:**
- Portfolio-polished — looks like a real SaaS product
- Familiar to engineers who use modern tooling
- Better demonstrates frontend design skill
- More visually flexible

**Tradeoffs:**
- Harder to get right — easy to look generic
- Requires more careful component design
- Could resemble dozens of other dashboards without distinctive choices

---

### Direction C: Operational Control Room
**Concept:** Dark, precise, slightly cinematic. Feels like infrastructure engineers at a company like Stripe or Cloudflare actually use this to watch their systems. Subtle grid backgrounds, precise typography, status indicators that feel like actual system monitors.

**Aesthetic references:** Stripe Radar, Cloudflare dashboard, AWS CloudWatch (idealized version), Bloomberg terminal (adapted for web).

**Color palette:**
- Background: `#060810` (very dark navy-black)
- Surface: `#0c1021`
- Border: `#1a2035`
- Grid overlay: `rgba(255,255,255,0.02)` subtle dot grid
- Text primary: `#e2e8f0`
- Text secondary: `#64748b`
- Cyan (active/info): `#06b6d4`
- Green (success): `#10b981`
- Red (failure): `#f43f5e`
- Amber (warning): `#f59e0b`
- Accent: cool blue-violet for selected states

**Typography:**
- Headings: `DM Mono` or `Space Grono` — monospace with character
- Body: `Inter` — readable at data densities
- IDs/types: inline code-style backgrounds

**Layout:**
- Slightly more spatial — breathing room between sections
- Metric cards have a subtle glow effect on status color
- Timeline visualization has a visual track/rail aesthetic
- Status changes animate smoothly
- Execution timelines use a visual rail (like a Gantt or deployment timeline)

**Strengths:**
- Most visually distinctive direction
- Communicates "serious infrastructure" credibly
- Execution timeline shines in this aesthetic
- Good demonstration of design intentionality

**Tradeoffs:**
- Most complex to implement well
- Subtle grid/glow effects require careful execution to not look overdone
- Requires consistent design discipline across all components

---

## ⏸ DIRECTION SELECTION REQUIRED

Before any frontend implementation begins, select one of the three directions above.

The choice determines:
- Tailwind config (color palette, border radius, font families)
- Component primitives (Card, Badge, StatusPill, etc.)
- Animation approach and intensity
- Table vs card density preference
- Information hierarchy emphasis

**Recommendation:** Direction B (Modern Observability) is the lowest-risk choice for a strong portfolio outcome. Direction C (Control Room) is highest potential upside if executed with discipline. Direction A (Terminal) is most authentic to infrastructure tooling but requires the most careful execution to feel intentional rather than sparse.

**Make this decision before writing a single component.**
