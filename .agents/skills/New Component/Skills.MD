---
name: New Component Development
description: Patterns and standards for creating and styling React components in TradeClarity.
---

# New Component Development Skill

This skill defines the architectural, styling, and quality standards for all new components in the TradeClarity ecosystem. Adherence to these rules is mandatory to maintain the project's "Premium Institutional" look and feel.

## Styling Standards

> [!IMPORTANT]
> **NO INLINE STYLES ALLOWED.** 
> All styling must be defined in `src/styles.css` or component-specific CSS modules (if implemented later). For now, `src/styles.css` is the primary source of truth.

### Design Tokens (CSS Variables)
Always use the following variables from [styles.css](file:///d:/react-extension/trade-clarity-plugin/src/styles.css) to ensure theme compatibility (Dark/Light mode):

- **Backgrounds**: `--bg`, `--panel`, `--filter-bg`, `--table-header-bg`
- **Typography**: `--text`, `--muted`, `--header-text`
- **Accents**: `--primary`, `--danger`, `--success`, `--info`
- **Borders**: `--border`

### Modern Aesthetic Principles
- **Glassmorphism**: Use `backdrop-filter: blur(16px)` and semi-transparent backgrounds for high-level UI elements like headers and modals.
- **Micro-Animations**: Add subtle transitions (`transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1)`) to interactive elements like buttons and rows.
- **Dynamic Feedback**: Implement hover and active states that provide immediate visual confirmation of user actions.

## Quality & Compliance

- **No Lint Errors**: Code must pass all project linting rules before submission.
- **No Compilation Errors**: All components must verify correctly in the build process.
- **Extensibility**: Structure components using composition and logical separation of concerns. Avoid "prop drilling"; use Context or local state management where appropriate.

## Implementation Workflow

1.  **Analyze**: Identify existing components or styles in `styles.css` that can be reused.
2.  **Logic**: Implement component logic using React hooks (`useState`, `useEffect`, `useMemo`).
3.  **Style**: Add necessary CSS to `styles.css` at the end of the file, ensuring you **do not disturb** existing styles.
4.  **Verify**: Perform manual and automated verification to ensure zero regressions in layout or functionality.

## Documentation Guidelines

- **Code Comments**: Keep comments simple, clear, and concise. 
- **Requirement**: Comments are only required for complex logic or non-obvious business rules. Avoid commenting on "what" the code is doing (if it's self-explanatory); focus on "why" for complex segments.
- **Language**: Use professional and objective language in all documentation.
