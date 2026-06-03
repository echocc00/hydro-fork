---
version: "1.0"
name: Hydro-OJ-design-system
description: |
  Hydro OJ design language — warm cream academic (light) + code-editor terminal (dark).
  Influenced by Claude, Replicate, VoltAgent, and xAI DESIGN.md patterns.
  Voice: "An online judge is a developer tool first — focused, calm, engineered."

colors:
  light:
    primary: "#e05a2d"
    primary-hover: "#c44d20"
    primary-active: "#a03d16"
    on-primary: "#ffffff"
    ink: "#1a1a1a"
    ink-strong: "#0d0d0d"
    body: "#4a4a4a"
    muted: "#8a8a8a"
    muted-soft: "#aaaaaa"
    canvas: "#faf8f3"
    surface: "#ffffff"
    surface-soft: "#f5f0e8"
    surface-hover: "#efe9de"
    hairline: "#e8e2d8"
    hairline-soft: "#f0ebe3"
    accent-teal: "#2b9a66"
    accent-amber: "#e8a020"
    success: "#2b9a66"
    warning: "#e8a020"
    error: "#d93025"
    code-bg: "#f5f2eb"
  dark:
    primary: "#00d992"
    primary-hover: "#00b87a"
    primary-active: "#009a64"
    on-primary: "#0d0d0d"
    ink: "#f0f0f0"
    ink-strong: "#ffffff"
    body: "#b0b0b0"
    muted: "#6b6b6b"
    muted-soft: "#4a4a4a"
    canvas: "#0d0d0d"
    surface: "#1a1a1a"
    surface-elevated: "#242424"
    surface-hover: "#2a2a2a"
    hairline: "#2a2a2a"
    hairline-soft: "#1f1f1f"
    success: "#30d158"
    warning: "#ff9f0a"
    error: "#ff453a"
    code-bg: "#141414"
  status:
    accepted: "#2b9a66"
    wrong_answer: "#d93025"
    time_limit: "#e8a020"
    memory_limit: "#e8a020"
    runtime_error: "#d93025"
    compile_error: "#e8a020"
    pending: "#8a8a8a"

rounded:
  none: 0px
  xs: 4px
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
  pill: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px

components:
  button-primary:
    borderRadius: 8px
    padding: "10px 20px"
    height: 40px
    fontWeight: 500
  card:
    borderRadius: 12px
    border: "1px solid var(--hairline)"
    shadow: none
  nav-bar:
    height: 56px
    borderBottom: "1px solid var(--hairline)"
  text-input:
    borderRadius: 8px
    padding: "8px 12px"
    border: "1px solid var(--hairline)"
