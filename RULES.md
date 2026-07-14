Create a file named RULES.md in the project root with EXACTLY the content below.
Do not change wording. Do not summarize. Do not add extra files.

===== BEGIN RULES.md =====
# PROJECT RULES — World-Class Geospatial Analytics Platform (Version 1)

You are building a premium geospatial visualization app (not a Kepler.gl clone).
Quality bar: Apple craftsmanship + Kepler usability + Notion cleanliness + Linear consistency + Mapbox performance + Figma polish.
No AI-generated look.

## Non-negotiable stack
- React 18.3+ + TypeScript 5.4+ (strict)
- Vite 5+
- Tailwind CSS 3.4+
- Zustand 4+
- MapLibre GL 4+
- Deck.gl 9+
- Lucide React
- Papaparse
- d3-scale + d3-scale-chromatic
- Turf.js
- Sonner
- Inter font
- Optional: @dnd-kit for layer reorder

## Explicitly forbidden stack
- Redux / RTK
- styled-components / Emotion
- Next.js
- Mapbox proprietary GL JS requirement
- Random CSS-in-JS
- Default exports (use named exports)
- any in TypeScript

## Architecture laws
src/
  app/
  core/            # pure TS only — NO React, NO DOM, NO components imports
  stores/          # Zustand domain stores only — no store imports another store
  components/      # React UI only
    ui/            # design system primitives only
    layout/
    map/
    datasets/
    layers/
    filters/
    command-palette/
    common/
  hooks/           # bridge stores + components
  types/           # single source of truth
  constants/
  styles/

Dependency direction ONLY:
components → hooks → stores → core
core never imports upward.

## UI laws
- Dark mode only
- Dense but uncluttered
- No glassmorphism
- No neon
- No decorative gradients
- No oversized shadows
- No random animations
- No raw <button>, <input>, <select> outside components/ui/
- Design tokens only (no hardcoded hex in components)
- One component per file
- Named exports only
- Subtle transitions 150–200ms max

## Design tokens (must use)
Backgrounds:
--color-bg-primary: #0F1117
--color-bg-secondary: #161922
--color-bg-tertiary: #1E2130
--color-bg-hover: #252836
--color-bg-active: #2E3348
--color-bg-elevated: #1A1D2B

Borders:
--color-border-primary: #2A2D3E
--color-border-secondary: #353849
--color-border-focus: #4C8BF5

Text:
--color-text-primary: #E6E8F0
--color-text-secondary: #959BAD
--color-text-tertiary: #5F6578
--color-text-inverse: #0F1117

Accent:
--color-accent: #4C8BF5
--color-accent-hover: #3B7AE4
--color-accent-muted: rgba(76, 139, 245, 0.15)

Status:
--color-success: #34D399
--color-warning: #FBBF24
--color-error: #F87171
--color-info: #60A5FA

Typography:
- Inter
- Base ~13px
- Dense professional UI
- Panel section headers: 11px, semibold, uppercase, tracking wide, text-tertiary

Spacing:
- 4px rhythm only
- radii: 4 / 6 / 8 / 12

## Version 1 scope only
Must have:
- CSV + GeoJSON
- 3 sample datasets (earthquakes, nyc-taxi, urban-trees)
- 4 base map styles (3 dark, 1 light)
- 5 layers: Scatterplot, Hexagon, Arc, Heatmap, GeoJSON/Polygon
- opacity/radius/stroke/elevation/color palette
- fixed vs data-mapped color/size
- legends
- hover tooltips
- range + categorical filters
- left structure panel, right properties panel, bottom data drawer, toolbar
- command palette Cmd/Ctrl+K

Must NOT build in V1:
- AI
- digital twin
- trips/icon/text/grid layers
- brushing/lasso
- time playback
- export/share systems
- plugin marketplace

## Work style for every task
1. Do ONLY the requested task
2. Do not invent features
3. Do not refactor unrelated files
4. Do not rename existing public types/fields unless asked
5. Prefer small clean files
6. After finishing, report:
   - files created/changed
   - commands to run
   - exact verification steps
===== END RULES.md =====