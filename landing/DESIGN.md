# Design

## Theme & Mood
A high-end, bold, editorial aesthetic. It should feel like a premium architectural or medical journal, not a cheap SaaS template. The mood is "midnight jazz club meets modern clinic" — dark, rich, and highly intentional.

## Color Strategy
**Committed**: A deep, saturated Forest Green (`oklch(0.35 0.12 160)`) dominates the surface and actions, anchored against a Pure White (`oklch(1 0 0)`) background to ensure stark contrast and an editorial feel.

## Colors (OKLCH)
- **bg**: `oklch(1 0 0)` (Pure White) - Used for the main body background.
- **surface**: `oklch(0.98 0 0)` (Off-White) - Used for structural panels or secondary sections.
- **primary**: `oklch(0.35 0.12 160)` (Deep Forest Green) - BOLD and authoritative. Used for primary buttons and major structural accents.
- **ink**: `oklch(0.15 0.02 160)` (Near Black with a hint of green) - High contrast text.
- **accent**: `oklch(0.70 0.15 60)` (Golden Amber) - Used sparingly for status pills, highlights, or secondary buttons to contrast the green.
- **muted**: `oklch(0.55 0.01 160)` - Secondary text, borders, dividers.

## Typography
- **Headings**: Plus Jakarta Sans (or Inter Display), heavy weights, tight tracking (`-0.04em`), `text-wrap: balance`. Max size clamped to `6rem`.
- **Body**: Inter, clean, readable, max width `65ch`.

## Layout & Motion
- Strict grid alignments. Thin, 1px solid dividers (`border-muted`).
- No generic glassmorphism or floating identical card grids.
- Spring-based motion (`type: "spring", stiffness: 260, damping: 20`).
- No `<img>` hover animations. Hover states apply to backgrounds/borders.
