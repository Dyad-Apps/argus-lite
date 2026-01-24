# ArgusIQ Theming System

This document describes the theming and styling architecture for the ArgusIQ web application.

## Overview

The application uses:
- **Tailwind CSS v4** for utility-first styling
- **CSS Custom Properties** for theming (colors, dimensions)
- **shadcn/ui patterns** for component architecture
- **ThemeProvider context** for dark/light mode switching

## Color System

Colors are based on the Viaanix design system and defined in `src/index.css`:

### Primary Colors
- `--color-primary`: Main brand color (blue #1890FF)
- `--color-primary-foreground`: Text on primary backgrounds

### Semantic Colors
- `--color-success`: Success states (green)
- `--color-warning`: Warning states (amber)
- `--color-destructive`: Error/danger states (red)
- `--color-info`: Informational states (blue)

### Neutral Colors
- `--color-background`: Page background
- `--color-foreground`: Primary text
- `--color-muted`: Muted backgrounds
- `--color-muted-foreground`: Secondary text
- `--color-border`: Border color

### Sidebar Colors
- `--color-sidebar`: Sidebar background
- `--color-sidebar-foreground`: Sidebar text
- `--color-sidebar-primary`: Active item background
- `--color-sidebar-accent`: Hover state background

## Layout Variables

Sidebar dimensions are defined as CSS variables for flexibility:

```css
--sidebar-width: 16rem;      /* Expanded sidebar width */
--sidebar-width-icon: 3rem;  /* Collapsed sidebar width */
```

These can be customized per-tenant or adjusted via media queries for responsive design.

## Dark Mode

Dark mode is implemented via:
1. `.dark` class on the `<html>` element
2. CSS variable overrides in the `.dark` selector
3. `ThemeProvider` context for state management

Toggle dark mode:
```tsx
import { useTheme } from '@/components/theme-provider';

const { mode, toggleTheme } = useTheme();
```

## Component Patterns

### StatCard Variants

The `StatCard` component supports colored border variants:

```tsx
<StatCard variant="green" />  // Green left border
<StatCard variant="blue" />   // Blue left border
<StatCard variant="purple" /> // Purple left border
<StatCard variant="info" />   // Blue background tint
```

### Sidebar

The sidebar uses CSS variables via inline styles to support dynamic theming:

```tsx
style={{ width: 'var(--sidebar-width, 16rem)' }}
```

This allows:
- Runtime theme changes
- Tenant-specific customization
- Responsive adjustments via CSS

## File Structure

```
src/
├── index.css                    # Theme variables & base styles
├── types/theme.ts               # Theme type definitions
├── lib/
│   ├── theme-defaults.ts        # Default color palettes
│   └── theme-utils.ts           # Hex to HSL conversion
├── components/
│   ├── theme-provider.tsx       # Theme context
│   ├── theme-toggle.tsx         # Dark/light toggle button
│   └── ui/
│       └── sidebar.tsx          # Sidebar with CSS variable widths
```

## Customization

### Adding New Theme Colors

1. Add the color to `@theme` block in `index.css`
2. Add dark mode override in `.dark` selector
3. Optionally add to `theme-defaults.ts` for programmatic access

### Changing Sidebar Width

Update CSS variables in `index.css`:

```css
@theme {
  --sidebar-width: 18rem;      /* Wider sidebar */
  --sidebar-width-icon: 4rem;  /* Wider collapsed state */
}
```

Or override per-breakpoint:

```css
@media (max-width: 1024px) {
  :root {
    --sidebar-width: 14rem;
  }
}
```
