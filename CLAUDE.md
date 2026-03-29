# Race Tracker — CLAUDE.md

## Project Overview
Karting race management app. Single HTML file (`kart.html`) with Firebase Realtime DB.
Deployed on GitHub Pages. Firebase project: `karting-tools`.
Mobile-first, used trackside during race weekends by a videomaker/photographer.

## Architecture
- Single file: `kart.html` contains HTML + CSS + JS
- Firebase Realtime Database for all persistent data
- No build step — vanilla JS, no frameworks
- GitHub Pages deployment (push to main = deploy)

## CRITICAL CONSTRAINTS
1. **NEVER copy-paste code** — always provide complete file updates or surgical diffs
2. **CSS dashes get corrupted on mobile copy-paste** — always provide downloadable files
3. **Single file architecture** — all code lives in `kart.html`
4. JS string building: use `array.push()` + `.join('')` — ZERO string concatenation operators (`+`)
5. Mobile-first: every feature must work perfectly on phone screens
6. Outdoor readability: high contrast, large touch targets (min 44px)
7. Firebase listeners: minimize — each listener costs bandwidth and battery

## Agent Team File Ownership
When working as an agent team, respect these boundaries to avoid merge conflicts:

| Agent | Owns | Does NOT touch |
|-------|------|----------------|
| ARCHITECT | Firebase calls, data model, security rules, DB schema | CSS, navigation logic |
| DESIGNER | CSS variables, `<style>` block, visual components, animations | Firebase calls, business logic |
| UX_ENGINEER | Event handlers, navigation, scroll/gesture logic, DOM UX flows | CSS styling, Firebase schema |
| INTEGRATOR | Business logic functions, calculations, external API integrations | CSS, DB schema |
| GUARDIAN | Reviews all PRs, writes tests, performance audits | Does not write feature code |

⚠️ **TWO AGENTS MUST NEVER EDIT THE SAME SECTION SIMULTANEOUSLY.**
The team lead must coordinate sequential merges for overlapping sections.

## Code Style
- Vanilla JS — no jQuery, no React, no frameworks
- CSS custom properties (`var(--name)`) for all colors, spacing, typography
- Semantic HTML5 elements
- Comments: Italian for business logic, English for technical/structural
- Functions: descriptive camelCase names
- DOM building: template literals inside array.push(), joined with .join('')

## Data Model (Firebase Realtime DB)
```
karting-tools/
├── races/
│   ├── {raceId}/
│   │   ├── name, date, circuit, status
│   │   ├── sessions/
│   │   │   └── {sessionId}/ (qualifying, prefinal, final, etc.)
│   │   └── drivers/
│   │       └── {driverId}/ (name, number, team, results)
```

## Current Backlog (Priority Order)
1. Fix PC scroll in programma
2. Group assign by time+day
3. Auto-read WSK PDF
4. Auto-refresh time slot
5. Auto-select today
6. Hamburger post-scroll behavior
7. Tournament/circuit presets
8. Fix new race modal tap
9. Live timing iframe
10. Scroll-to-top button
11. Calendar slot accuracy
12. Podium/poleman alerts
13. Reel scuderia counting

## Design Direction (v5)
- Dark mode default (outdoor use, battery saving)
- Racing-inspired palette: carbon blacks, timing-screen greens/ambers, accent reds
- Monospace font for lap times and chronometric data
- Display font for headers (bold, impactful)
- Micro-animations for state changes (session transitions, alerts)
- Celebration animations for podium/poleman
- Progressive disclosure: show only what's needed in the current context
