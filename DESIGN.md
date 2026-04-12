# Radio - Design System

> Late-night radio in a friend's room. Warm. Intimate. Like a secret shared between close friends.

## Visual Theme

| Property | Value |
|----------|-------|
| **Mood** | Intimate, warm, personal - a digital living room |
| **Density** | Spacious - let music and messages breathe |
| **Motion** | Subtle, organic. Fade transitions, audio-reactive pulses |
| **Hierarchy** | Music first. Personal message. Everything else. |

## Color Palette

### Foundations (Dark Theme)
| Token | Hex | Role |
|-------|-----|------|
| `--void` | `#0A0A0B` | True black canvas |
| `--surface-1` | `#111113` | Elevated cards, modals |
| `--surface-2` | `#1A1A1D` | Secondary surfaces |
| `--surface-3` | `#232326` | Hover states, borders |

### Accent - Warm Ember
| Token | Hex | Role |
|-------|-----|------|
| `--ember` | `#FF6B35` | Primary accent - warm, inviting |
| `--ember-glow` | `#FF8A5B` | Hover state, highlights |
| `--ember-dim` | `#CC5529` | Pressed state |
| `--ember-subtle` | `rgba(255,107,53,0.15)` | Backgrounds, glows |

### Secondary - Twilight
| Token | Hex | Role |
|-------|-----|------|
| `--twilight` | `#7B68EE` | Secondary accent, online status |
| `--twilight-glow` | `#9D8FFF` | Hover |
| `--twilight-dim` | `#6354C7` | Pressed |

### Text
| Token | Hex | Role |
|-------|-----|------|
| `--text-primary` | `#FAFAFA` | Headlines, important |
| `--text-secondary` | `#A1A1AA` | Body text |
| `--text-tertiary` | `#71717A` | Captions, timestamps |
| `--text-muted` | `#52525B` | Disabled, placeholders |

### Semantic
| Token | Hex | Role |
|-------|-----|------|
| `--success` | `#22C55E` | Online, connected |
| `--warning` | `#F59E0B` | Sync drift |
| `--error` | `#EF4444` | Disconnected |

## Typography

| Role | Font | Size | Weight |
|------|------|------|--------|
| Display | Playfair Display | 48px | 600 |
| H1 | Playfair Display | 32px | 600 |
| H2 | Outfit | 24px | 600 |
| H3 | Outfit | 18px | 500 |
| Body | Outfit | 16px | 400 |
| Small | Outfit | 14px | 400 |
| Caption | Outfit | 12px | 400 |
| Personal | Caveat | 20px | 500 |

## Spacing Scale
`4, 8, 12, 16, 24, 32, 48, 64, 96`

## Elevation (Shadows)
| Level | Use | Shadow |
|-------|-----|--------|
| 1 | Cards | `0 4px 12px rgba(0,0,0,0.3)` |
| 2 | Dropdowns | `0 8px 24px rgba(0,0,0,0.4)` |
| 3 | Modals | `0 16px 48px rgba(0,0,0,0.5)` |
| 4 | Hero | `0 24px 64px rgba(0,0,0,0.6)` |

## Do's and Don'ts

| DO | DON'T |
|----|-------|
| Use Playfair for emotional headlines | Use Inter, Roboto, system fonts |
| Apply ember glow sparingly | Overuse gradients everywhere |
| Caveat font for personal messages | Make everything feel machine-generated |
| Show album art prominently | Hide or shrink album art |
| Animate audio elements | Use jarring transitions |
| Keep friend names large | Treat friends like database rows |

## Responsive Breakpoints
| Breakpoint | Name | Behavior |
|------------|------|----------|
| 0-640px | Mobile | Single column, bottom nav |
| 641-1024px | Tablet | Two columns possible |
| 1025px+ | Desktop | Full layout, side nav |

Touch targets: 44x44px minimum
