---
name: Institutional Academic Framework
colors:
  surface: '#f9f9f9'
  surface-dim: '#dadada'
  surface-bright: '#f9f9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f3'
  surface-container: '#eeeeee'
  surface-container-high: '#e8e8e8'
  surface-container-highest: '#e2e2e2'
  on-surface: '#1a1c1c'
  on-surface-variant: '#44474e'
  inverse-surface: '#2f3131'
  inverse-on-surface: '#f1f1f1'
  outline: '#74777f'
  outline-variant: '#c4c6cf'
  surface-tint: '#465f88'
  primary: '#000a1e'
  on-primary: '#ffffff'
  primary-container: '#002147'
  on-primary-container: '#708ab5'
  inverse-primary: '#aec7f6'
  secondary: '#006d36'
  on-secondary: '#ffffff'
  secondary-container: '#8df9a9'
  on-secondary-container: '#00743a'
  tertiary: '#180500'
  on-tertiary: '#ffffff'
  tertiary-container: '#3d1500'
  on-tertiary-container: '#b97958'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d6e3ff'
  primary-fixed-dim: '#aec7f6'
  on-primary-fixed: '#001b3d'
  on-primary-fixed-variant: '#2d476f'
  secondary-fixed: '#8df9a9'
  secondary-fixed-dim: '#71dc8f'
  on-secondary-fixed: '#00210c'
  on-secondary-fixed-variant: '#005227'
  tertiary-fixed: '#ffdbcb'
  tertiary-fixed-dim: '#ffb691'
  on-tertiary-fixed: '#341100'
  on-tertiary-fixed-variant: '#6c391d'
  background: '#f9f9f9'
  on-background: '#1a1c1c'
  surface-variant: '#e2e2e2'
  nit-gold: '#D4AF37'
  institutional-navy: '#002147'
  success-emerald: '#008543'
  border-subtle: '#E0E0E0'
  text-main: '#212529'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-bold:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  container-max: 1280px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 48px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style

The design system is engineered for the **Academic Timetable Studio at NIT Hamirpur**. It embodies an institutional, official, and authoritative personality. The target audience—faculty, administrators, and students—requires a UI that prioritizes information density, clarity, and structural reliability over aesthetic trends.

The visual direction follows a **Corporate / Modern** style with a focus on accessibility and institutional heritage. It draws inspiration from the UX4G (User Experience for Government) framework, emphasizing high-contrast readability, clear navigation paths, and a "function-first" philosophy. The aesthetic is characterized by sharp edges, a restrained color palette, and a rigid grid that reflects the logistical nature of academic scheduling. It avoids any "startup" tropes, opting instead for a timeless, dependable academic aesthetic.

## Colors

This design system utilizes a palette rooted in institutional tradition. 

- **Primary (Institutional Navy):** Used for headers, primary buttons, and critical branding elements to convey trust and authority.
- **Secondary (Success Emerald):** A professional green used as a restrained accent for positive actions, status indicators, and subtle highlights.
- **Background & Neutrals:** A crisp white (#FFFFFF) is the primary surface color to maximize readability. A light gray (#F5F5F5) is used for container backgrounds and section dividers to maintain a structured visual hierarchy without heavy lines.
- **Named Colors:** The 'NIT Gold' is reserved for high-level institutional branding (like the seal) or very specific honorary accents, used sparingly to maintain the "official" feel.

## Typography

The typography is built entirely on **Inter** to ensure maximum legibility and a contemporary but professional feel. 

- **Hierarchy:** Strong contrast between weights is used to denote information importance. Headlines use Bold (700) or SemiBold (600) weights. 
- **Scale:** Sizes are optimized for information-dense layouts. Large headlines are reserved for page titles, while most UI interactions occur at the 14px and 16px levels.
- **Labels:** Uppercase styles with increased letter spacing are used for small labels and status indicators to ensure they remain readable even at small sizes.

## Layout & Spacing

The layout utilizes a **fixed grid** system for desktop to maintain the "studio" feel, centering the content and providing clear margins. 

- **Grid:** A 12-column grid is standard for desktop views. Timetable views may use a specialized 5 or 7 column sub-grid to represent days of the week.
- **Density:** The system uses "Compact" spacing for data tables and schedule views to allow more information to be visible without scrolling. Functional forms and landing areas use "Standard" spacing (stack-md) for better focus.
- **Breakpoints:** 
    - Desktop: 1280px+ (Full 12 columns)
    - Tablet: 768px - 1279px (8 columns, margins reduced to 24px)
    - Mobile: <768px (Fluid 4 columns, margins 16px, stacked components)

## Elevation & Depth

This design system avoids heavy drop shadows and floating effects in favor of **Tonal Layers** and **Low-contrast Outlines**.

- **Surfaces:** Depth is created by placing white "cards" or containers on a light gray (#F5F5F5) background. 
- **Borders:** 1px solid borders using `#E0E0E0` define the structure of the UI. 
- **Shadows:** Only one subtle shadow level is permitted, reserved exclusively for temporary overlays like dropdown menus or modal dialogs. This shadow should be highly diffused: `0 4px 12px rgba(0, 33, 71, 0.08)`.
- **Grid Lines:** For the timetable itself, use subtle 1px lines in `#F0F0F0` to create a spreadsheet-like clarity without visual clutter.

## Shapes

The shape language is **Soft (0.25rem)**. This slight rounding provides a modern touch to an otherwise rigid institutional layout without appearing "bubbly" or informal.

- **Standard Elements:** Buttons, input fields, and small cards use the base 4px (0.25rem) radius.
- **Large Containers:** Dashboard widgets or main content sections use `rounded-lg` (8px).
- **Status Labels:** High-contrast status labels (e.g., "Active", "Pending") may use a pill-shape to distinguish them from functional buttons.

## Components

- **Buttons:** Primary buttons are Solid Institutional Navy with White text. Secondary buttons use an Outline style with Primary color borders and text. Action-oriented "Success" buttons use the Emerald accent.
- **Input Fields:** Use 1px #E0E0E0 borders, white background, and 4px border-radius. Active/Focus states should use a 2px border in Primary Navy.
- **Cards:** White background, 1px subtle border, no shadow. Used to group scheduling blocks or faculty profiles.
- **Timetable Slots:** Highly structured rectangles with clear typography. Use high-contrast top-borders (2px) to color-code different course types (e.g., Lecture vs. Lab).
- **Navigation:** The top header follows the NIT Hamirpur style—a dark navy bar with white links, providing high contrast and an immediate sense of "Official Site" status.
- **Status Chips:** Small, high-contrast badges with background tints derived from the status color (e.g., Light Green background with Dark Green text for "Confirmed").