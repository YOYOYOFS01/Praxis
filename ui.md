Let me do a thorough extraction of all the UI patterns, design system, and visual decisions across the entire frontend.

Now I have everything. Here's the complete extraction:

---

# KeilHQ UI — Complete Design System Reference

---

## 1. Tech Stack

| Layer | Library |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite 7 |
| Styling | Tailwind CSS v4 (CSS-native, no `tailwind.config.ts`) |
| Components | shadcn/ui **New York** style — Radix UI primitives via `radix-ui` monorepo |
| Animations | `tw-animate-css`, `motion` (Framer), custom keyframes in SCSS + CSS |
| Icons | `lucide-react@0.575` |
| Theming | `next-themes` (dark/light toggle) |
| Fonts | **Inter** (body), Geist Sans + Geist Mono (via `@fontsource`) |
| Charts | `recharts` |
| Calendar | FullCalendar v6 |
| Rich text | TipTap v3 |
| Toasts | `sonner` v2 |
| Routing | React Router v7 |
| State | Zustand v5 + TanStack Query v5 |

---

## 2. Color System

### Design Philosophy
*"Clean · Minimal · Premium Workspace"*

The palette is **achromatic-first**. Primary is `#191919` (near-black) in light mode and `#f3f3f3` (near-white) in dark mode. There is no blue/purple accent — the entire brand color is grayscale. Color only enters through semantic tokens for status, priority, and calendar events.

### Light Mode Tokens

```css
--background:  #f6f6f4   /* warm off-white, not pure white */
--foreground:  #171717

--card:        #ffffff
--primary:     #191919   /* near-black */
--primary-foreground: #fafafa

--secondary:   #f1f1ef
--muted:       #f4f4f2
--muted-foreground: #737373

--accent:      #ececea
--border:      #e7e5e4
--input:       #eceae8
--ring:        #a1a1aa

--destructive: #b04d4d
```

### Dark Mode Tokens

```css
--background:  #0d0d0d   /* very deep black */
--foreground:  #f5f5f5

--card:        #151515
--primary:     #f3f3f3   /* near-white */
--primary-foreground: #111111

--secondary:   #1b1b1b
--muted:       #171717
--muted-foreground: #8b8b8b

--accent:      #202020
--border:      rgba(255,255,255,0.08)   /* alpha border, NOT a solid color */
--input:       rgba(255,255,255,0.09)
```

**Key insight:** Dark mode borders are `rgba` alpha values, not solid hex. This gives a more refined, glass-like feel.

### Semantic Calendar Tokens

Every event type gets its own `bg/text/border` triple. Light mode uses pastel washes; dark mode uses translucent overlays (all `rgba`):

```css
/* Light */
--event-meeting-bg:   #f0fdf4    text: #16a34a   border: rgba(22,163,74,0.12)
--event-task-bg:      #f2f2f7    text: #535370   border: rgba(83,83,112,0.08)
--event-deadline-bg:  #fdf2f8    text: #db2777   border: rgba(219,39,119,0.08)
--event-focus-bg:     #f0fdfa    text: #0d9488   border: rgba(13,148,136,0.08)
--event-reminder-bg:  #fff1f2    text: #e11d48   border: rgba(225,29,72,0.08)
--event-generic-bg:   #faf5ff    text: #9333ea   border: rgba(147,51,234,0.12)

/* Priority system */
--priority-urgent:   red tones    (#fff1f2 / #e11d48)
--priority-high:     amber tones  (#fffbeb / #ea580c)
--priority-medium:   blue tones   (#eff6ff / #2563eb)
--priority-low:      gray tones   (#f9fafb / #4b5563)
--priority-done:     green tones  (#f0fdf4 / #166534)
```

### Shadow Scale

```css
--shadow-xs:  0 1px 2px rgba(0,0,0,0.03)
--shadow-sm:  0 2px 8px rgba(0,0,0,0.04)
--shadow-md:  0 8px 24px rgba(0,0,0,0.05)
--shadow-lg:  0 20px 48px rgba(0,0,0,0.08)
```

Dark mode multiplies these by ~8–10x (0.03 → 0.25, 0.08 → 0.45).

### TipTap Editor Colors

The TipTap rich text editor has its own parallel token system for text colors, highlight backgrounds, and alpha borders — fully themed for light and dark mode. 9 text color options (gray, brown, orange, yellow, green, blue, purple, pink, red), each with a `*-contrast` paired color.

---

## 3. Typography

**Font stack (body):** `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`

Base settings:
```css
font-weight: 450          /* slightly heavier than normal */
line-height: 1.5
font-synthesis: none
text-rendering: optimizeLegibility
-webkit-font-smoothing: antialiased
-moz-osx-font-smoothing: grayscale
```

**Size patterns used across the codebase:**

| Usage | Classes |
|---|---|
| Section labels / eyebrow text | `text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground` |
| Micro labels | `text-[9px] uppercase tracking-wider` |
| Card body copy | `text-[10px] text-muted-foreground/80 leading-relaxed` |
| Small UI copy | `text-xs text-muted-foreground` |
| Standard body | `text-sm` |
| Item titles | `text-[12.5px] font-bold` or `text-[13px] font-medium` |
| Section headers | `text-sm font-semibold` |
| Page titles | `text-xl font-semibold` or `text-2xl font-semibold` |
| Sidebar brand | `text-[15px] font-bold tracking-tight` |
| Numbers / tabular | `tabular-nums` |

**Letter spacing patterns:** `tracking-tight` (`-0.03em`) for headings, `tracking-[0.2em]` for ALL CAPS labels, `tracking-[0.25em]` for ultra-micro labels.

---

## 4. Border Radius System

```css
--radius: 0.375rem   /* base = 6px */

--radius-sm:  2px   (radius - 4px)
--radius-md:  4px   (radius - 2px)
--radius-lg:  6px   (= radius)
--radius-xl:  10px  (radius + 4px)
--radius-2xl: 14px
--radius-3xl: 18px
--radius-4xl: 22px
```

In practice, components use:
- `rounded-md` — inputs, small buttons
- `rounded-lg` — dropdowns, dialog inners
- `rounded-xl` — sidebar items (`h-9 rounded-xl`), small cards, tab triggers
- `rounded-2xl` — upload cards, large analytics cards
- `rounded-full` — avatars, notification badges, icon containers

---

## 5. Component Patterns

### Sidebar (`AppSidebar`)

```
Width (expanded): 16rem
Width (collapsed): 3rem (icon-only)
Transition: 200ms cubic-bezier(0.23,1,0.32,1)
```

Key patterns:
- `border-r border-border/70 bg-sidebar/95` — transparent-tinted background
- Collapsible via `collapsible="icon"` prop — auto-collapses on `/motion` routes
- State persisted in `sessionStorage`
- Nav items: `h-9 rounded-xl px-3 text-[13px] font-medium`
- Active state: `bg-background shadow-sm ring-1 ring-border/60` (elevated card effect)
- Keyboard shortcut: `⌘B` to toggle

### Button (`cva`)

```
Variants: default, destructive, outline, secondary, ghost, link
Sizes: default(h-9), xs(h-6), sm(h-8), lg(h-10), icon(size-9), icon-xs/sm/lg

All buttons: active:scale-[0.98]   ← micro press animation
Focus: focus-visible:ring-[3px] focus-visible:ring-ring/50
```

### Card

Base: `bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm`

In practice, cards are heavily customized per usage:
- Dashboard cards: `bg-card/90 border border-border/60 rounded-xl`
- Upload zone: `border-2 border-dashed rounded-2xl`
- Hover state on interactive cards: `hover:border-muted-foreground/30 active:scale-[0.98]`

### Input

`h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs`
Focus: `focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]`
Dark: `dark:bg-input/30` — alpha background

### Badge

Fully rounded: `rounded-full px-2 py-0.5 text-xs font-medium`

### Skeleton

`bg-accent animate-pulse rounded-md` — uses `accent` color, not `muted`

### Tabs (two variants)

`default` — pill tabs in `bg-muted` container with `data-[state=active]:bg-background shadow-sm`
`line` — underline tabs with `after:` pseudo-element line indicator

### Toast (Sonner)

Styled to use CSS variables: `--normal-bg: var(--popover)`, `--normal-border: var(--border)`. Custom icons per type (CircleCheck, Info, TriangleAlert, OctagonX, Loader2).

---

## 6. Animation System

### SCSS Keyframes (`_keyframe-animations.scss`)
```
fadeIn / fadeOut
zoomIn / zoomOut (scale 0.95 → 1)
zoom (combined opacity + scale)
slideFromTop/Right/Left/Bottom (0.5rem offset)
spin
```

### CSS Keyframes in `index.css`

**AI Assistant animations:**
```
ai-fab-pop     — spring bounce (0.5s cubic-bezier(0.34,1.56,0.64,1)) for FAB button
ai-panel-pop   — scale+translate (0.3s cubic-bezier(0.22,1,0.36,1))
ai-sidebar-slide — slide from right (0.35s cubic-bezier(0.22,1,0.36,1))
ai-fullscreen-fade — scale 0.98→1 (0.3s)
ai-msg-in      — translateY(8px)→0 (0.25s) per message
ai-dot-bounce  — typing indicator dots (1.4s infinite)
ai-mascot-idle — 4px vertical float (3s infinite)
```

**Task marquee:** Long task names scroll on hover using CSS container queries (`100cqw`) and a marquee animation.

**Motion block highlight:** `flash-highlight` — `rgba(234,179,8,0.25)` → transparent in 2s for Notion-style block focus.

**Stagger system (MobileBlocker):**
```
animate-stagger-1: 0ms delay
animate-stagger-2: 50ms
animate-stagger-3: 100ms
animate-stagger-4: 150ms
all use cubic-bezier(0.23,1,0.32,1) — fast out easing
```

**Page fade-in:**
```css
.fade-in { animation: auth-fade-in 250ms ease-out }
/* translateY(8px) → 0 + opacity 0→1 */
```

### TipTap Transition Variables

```
--tt-transition-duration-short:   0.1s
--tt-transition-duration-default: 0.2s
--tt-transition-duration-long:    0.64s
--tt-transition-easing-default:   cubic-bezier(0.46, 0.03, 0.52, 0.96)
--tt-transition-easing-cubic:     cubic-bezier(0.65, 0.05, 0.36, 1)
--tt-transition-easing-quart:     cubic-bezier(0.77, 0, 0.18, 1)
--tt-transition-easing-circ:      cubic-bezier(0.79, 0.14, 0.15, 0.86)
--tt-transition-easing-back:      cubic-bezier(0.68, -0.55, 0.27, 1.55) ← overshoot spring
```

---

## 7. Layout Architecture

```
MobileBlocker (≥1024px gate)
└── App (Routes)
    └── ProtectedRoute
        └── Layout
            ├── LockoutOverlay (z-[9999], full screen when locked)
            ├── TrialBanner (top, conditional)
            └── SidebarProvider
                ├── AppSidebar (left, collapsible icon)
                └── SidebarInset
                    ├── GlobalSearchDialog (⌘K)
                    ├── <main> (pr-[400px] when chat/notif open)
                    │   └── <Outlet /> (page content)
                    ├── AiAssistant (excluded on dashboard)
                    ├── ChatDrawer (right, 400px)
                    ├── NotificationDrawer (right, 400px)
                    ├── ChatDialog (modal)
                    ├── MeetingDialog (global)
                    ├── CreateTaskDialog (global ⌘⇧X)
                    ├── TemplatesDialog (global)
                    └── ChatSocketManager
```

**Full screen:** `h-screen w-screen overflow-hidden` — no scroll on the root, each panel manages its own scroll.

**Drawer push:** When chat or notifications open, `<main>` gets `pr-[400px]` with `transition-all duration-300`. This is the "push" pattern, not overlay.

**AI sidebar push:** Uses `body.ai-sidebar-open` class + CSS attribute selector to add `padding-right: 400px` to `SidebarInset > main`.

---

## 8. Global Utilities

```css
.glass-card       — backdrop-filter: blur(20px) + gradient-card + shadow-md
.soft-border      — border: 1px solid var(--border)
.premium-shadow   — shadow-lg
.hover-lift       — translateY(-2px) + shadow-lg on hover (220ms ease)
.no-scrollbar     — hides scrollbar cross-browser
.touch-target-expand — ::after min 44×44px hit area
.motion-block-highlight — flash yellow highlight 2s
```

---

## 9. Keyboard Shortcut System

All shortcuts wired in `Layout.tsx`:

| Shortcut | Action |
|---|---|
| `⌘K` | Command palette (context-aware: tasks/motion/default) |
| `⌘,` | Settings |
| `⌘G` | Dashboard |
| `⌘M` | Meeting Studio (or restore if minimized) |
| `⌘J` | Toggle Chat |
| `⌘L` | Notification drawer |
| `⌘Q` | Tasks |
| `⌘/` | Keyboard shortcuts settings |
| `⌘⇧X` | Create task/event |
| `⌘⇧C` | Chat full dialog |
| `⌘P` | Motion (pages) |
| `⌘D` | Toggle dark/light theme |
| `⌘⌥N` | New note page |
| `⌘B` | Toggle sidebar (native SidebarProvider) |

---

## 10. Meeting Studio — Visual State in Sidebar

The Meetings button in the sidebar has a special "recording active" visual state:

```tsx
// When recording is minimized:
className="bg-violet-500/10 border border-violet-500/30 
           shadow-[0_0_10px_2px_rgba(139,92,246,0.2)]
           hover:bg-violet-500/15"

// Icon:
className="text-violet-500 dark:text-violet-400 animate-pulse 
           drop-shadow-[0_0_4px_rgba(139,92,246,0.8)]"
```

A live timer (`HH:MM:SS`) and status label (`Recording / Uploading / Processing`) replace the static "Meetings" label.

---

## 11. Billing UI Components

**LockoutOverlay** — `fixed inset-0 z-[9999] bg-background/95 backdrop-blur-sm` — full blocking overlay with a `Lock` icon in `red-500/10` circle.

**TrialBanner** — slim top bar, `bg-blue-500/10` normally, `bg-red-500/10` when ≤3 days left.

**UpgradePrompt** — `fixed inset-0 z-[9998]` custom modal with `bg-amber-500/10` Zap icon.

**PlanLimitsDialog** — shadcn `Dialog`, amber `ShieldAlert` icon, two limit rows with `HardDrive` / `TableProperties` icons, full-width Accept button, "Never ask again" checkbox.

---

## 12. Logo Loader

A Lottie animation (`Scene-1.json`) that's programmatically re-colored on mount to match the active theme — white bg → `#0d0d0d`, black fg → `#f5f5f5` in dark mode by traversing the animation JSON tree.

---

## 13. Mobile Blocker

A full-screen gate at `<1024px` with staggered entry animations using `cubic-bezier(0.23,1,0.32,1)`. Shows a "Laptop + Smartphone" device graphic, brand chip, and instructions. Reduced-motion support included.

---

## 14. Patterns Used Everywhere

**Alpha-based borders in dark mode:**
```css
border border-border/60    /* 60% opacity border */
ring-1 ring-border/60      /* ring instead of border for active states */
```

**Translucent backgrounds:**
```css
bg-card/90    bg-card/60    bg-muted/40    bg-primary/10
```

**Icon containers:**
```css
size-12 rounded-full bg-amber-500/10 flex items-center justify-center
/* icon: size-6 text-amber-500 */
```

**Active nav items (sidebar):**
```css
bg-background shadow-sm ring-1 ring-border/60
/* Elevated off the sidebar background, not just color change */
```

**Small action buttons (in cards):**
```css
text-[9px] px-2 py-1 rounded bg-muted text-muted-foreground hover:bg-muted/80
```

**Section eyebrow labels:**
```css
text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-bold
```

**Pill tags / badges in cards:**
```css
inline-flex items-center gap-1 px-1.5 py-0.5 rounded 
text-[9px] font-bold bg-primary/10 text-primary border border-primary/20
```

**Full-width CTA pattern:**
```css
w-full inline-flex items-center justify-center gap-2 
rounded-lg bg-primary px-5 py-3 text-sm font-medium 
text-primary-foreground hover:bg-primary/90 disabled:opacity-50
```

**Org avatar initials:**
```css
size-6 rounded bg-primary/20 flex items-center justify-center 
text-xs font-medium text-primary shrink-0
```

**Tab switcher (custom, not shadcn):**
```css
flex rounded-lg border border-border p-0.5 bg-muted/40 gap-0.5
/* Active: */   bg-background shadow-sm text-foreground
/* Inactive: */ text-muted-foreground hover:text-foreground
```