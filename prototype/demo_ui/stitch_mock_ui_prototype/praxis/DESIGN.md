---
name: Praxis
colors:
  surface: '#faf9f7'
  surface-dim: '#dadad8'
  surface-bright: '#faf9f7'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f3f1'
  surface-container: '#efeeec'
  surface-container-high: '#e9e8e6'
  surface-container-highest: '#e3e2e0'
  on-surface: '#1a1c1b'
  on-surface-variant: '#444748'
  inverse-surface: '#2f3130'
  inverse-on-surface: '#f1f1ef'
  outline: '#747878'
  outline-variant: '#c4c7c7'
  surface-tint: '#5f5e5e'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#1c1b1b'
  on-primary-container: '#858383'
  inverse-primary: '#c9c6c5'
  secondary: '#5e5e5e'
  on-secondary: '#ffffff'
  secondary-container: '#e3e2e2'
  on-secondary-container: '#646464'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#1a1c1c'
  on-tertiary-container: '#838484'
  error: '#DC2626'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e5e2e1'
  primary-fixed-dim: '#c9c6c5'
  on-primary-fixed: '#1c1b1b'
  on-primary-fixed-variant: '#474646'
  secondary-fixed: '#e3e2e2'
  secondary-fixed-dim: '#c7c6c6'
  on-secondary-fixed: '#1b1c1c'
  on-secondary-fixed-variant: '#464747'
  tertiary-fixed: '#e3e2e2'
  tertiary-fixed-dim: '#c7c6c6'
  on-tertiary-fixed: '#1a1c1c'
  on-tertiary-fixed-variant: '#464747'
  background: '#faf9f7'
  on-background: '#1a1c1b'
  surface-variant: '#e3e2e0'
  background-dark: '#0A0A0A'
  background-light: '#F9F8F6'
  success: '#16A34A'
  pending: '#2563EB'
  warning: '#D97706'
  wallet-locked: '#991B1B'
  wallet-unlocked: '#166534'
  captcha-amber: '#F59E0B'
  session-orange: '#EA580C'
typography:
  display:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  page-title:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
  section-title:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  card-title:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  caption:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  status:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 12px
    letterSpacing: 0.05em
  button-label:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  technical-data:
    fontFamily: jetbrainsMono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  xxl: 48px
  sidebar-expanded: 260px
  sidebar-collapsed: 72px
  drawer-width: 420px
---

## Brand & Style

The design system is anchored in the principles of **Professional Sovereignty** and **Extreme Transparency**. It is built for a professional financial context, prioritizing utility, security, and enterprise-grade reliability over decorative trends. The aesthetic is a refined interpretation of **Minimalism** blended with **Corporate Modernism**, designed to feel like a premium banking institution rather than a volatile crypto platform.

The visual narrative focuses on:
- **Financial Familiarity:** Utilizing a monochrome-leaning palette to evoke stability.
- **Progressive Disclosure:** Layering information to prevent cognitive overload while maintaining access to deep technical metadata.
- **Trust through Precision:** A rigid grid strategy and consistent placement of global elements (breadcrumbs, wallet status) to ensure predictability.
- **Security UX:** High-risk zones are clearly demarcated through specific elevation and color tokens, treating the interface as a digital vault.

## Colors

The color strategy uses a **Monochrome Base** to establish a "Financial Familiarity" profile. 

- **Primary Surfaces:** In light mode, a warm off-white (#F9F8F6) is used to reduce eye strain and feel more sophisticated than pure white. In dark mode, a near-black (#0A0A0A) is utilized.
- **Semantic Logic:** High-saturation colors are reserved strictly for status and security signaling. 
- **Security Tones:** Specific muted shades of red and green are used for wallet states to indicate safety without being visually aggressive.
- **Borders & Inputs:** Use low-contrast grays to maintain a clean, "quiet" interface that directs focus toward data and actionable items.

## Typography

Typography is the primary tool for hierarchy. The system uses **Inter** for all UI elements to ensure maximum legibility across resolutions. 

- **Technical Contexts:** A strict rule applies for Wallet Addresses, Hashes, and API Keys—these must use **JetBrains Mono** to distinguish machine-readable data from human-readable text.
- **Weights:** Scale from Regular (400) for body text to Bold (700) for large displays. SemiBold (600) is the standard for titles and section headers.
- **Mobile Adaptivity:** For small screens, the `page-title` scales down to 28px to ensure clear visibility without excessive wrapping.

## Layout & Spacing

This design system employs a **Fixed-Fluid Hybrid** grid based on a strict 4px/8px rhythm.

- **Grid Strategy:**
  - **12-Column (Fluid):** Primary layout for Dashboards and Analytics (Min 1280px / Max 1600px).
  - **8-Column (Centered):** Dedicated to complex forms and settings.
  - **4-Column (Centered):** Reserved for Authentication and high-focus security tasks.
- **Spacing Philosophy:** Generous whitespace is used to separate concerns. Content padding is fixed at 24px (`lg`), while section gaps use 40px (`xl`) to create distinct visual breaks without the need for heavy lines.
- **Breakpoints:**
  - **Mobile (<768px):** Single column, 16px margins, hidden sidebar (drawer-based).
  - **Tablet (768px - 1279px):** 8-column fluid grid, collapsed sidebar (72px).
  - **Desktop (>1280px):** 12-column grid, expanded sidebar (260px).

## Elevation & Depth

Hierarchy is established through **Tonal Layering** and **Ambient Shadows**. The system forbids "hard black" shadows, opting instead for extra-diffused, low-opacity shadows that feel integrated into the surface.

- **L0 (Background):** Flat, the base canvas.
- **L1 (Cards):** Subtle shadow to lift transaction or data modules.
- **L2 (Interactive):** Hover states use a slight increase in shadow spread to indicate clickability.
- **L3 (Overlays):** Dropdowns and menus use a standard menu shadow for clear separation.
- **L4 (Dialogs):** Stronger shadows paired with a backdrop blur (Glassmorphism) to focus user attention.
- **L5 (Security Modals):** Maximum shadow density and a dark backdrop tint to signal a "high-risk" vault state.

**Dark Mode Note:** In dark mode, elevation is communicated primarily through increasing the lightness of the surface color rather than increasing shadow density.

## Shapes

The shape language reflects the system's professional nature, moving from geometric precision to softer indicators:

- **Inputs (Extra Small):** 4px radius for a sharp, technical feel.
- **Buttons (Small):** 6px radius to provide a subtle target hint.
- **Cards (Medium):** 8px radius for standard layout containers.
- **Dialogs (Large):** 12px radius to soften high-priority interactions.
- **Badges/Status (Full/Pill):** Fully rounded to distinguish metadata from structural UI elements.
- **Borders:** Use 1px as the standard. 2px is reserved for focus states, and 4px is used exclusively for high-priority accessibility and warning indicators.

## Components

- **Buttons:** Use a solid primary-color fill for main actions. Secondary actions use low-contrast gray borders. All buttons must include a "subtle scale reduction" (active state) on click for tactile feedback.
- **Input Fields:** 1px low-contrast gray borders that transition to a 2px medium-gray ring on focus. Use placeholder text sparingly; prefer persistent labels.
- **Cards:** White or very light gray backgrounds (in light mode) with L1 elevation. Padding is strictly 24px.
- **Chips & Badges:** Use the "Pill" shape. Use semantic background colors with high-contrast text for status (e.g., "Verified", "Pending").
- **Lists & Tables:** Use generous row heights (48px+) and 1px horizontal dividers. Technical data within tables must use the Monospace font token.
- **Security Indicators:** Components like "Wallet Locked" should be accompanied by a lock icon (Lucide library) and use the dedicated `wallet-locked` color token.
- **Feedback:** All interactions must result in a state change. Errors use a horizontal shake; success states utilize checkmark transitions.