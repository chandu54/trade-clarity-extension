---
name: Code Review & Security
description: Standardized security and stability review for the TradeClarity codebase.
---

# Code Review & Security Skill

This skill defines the strict security and stability protocols implemented in the TradeClarity codebase. Every codebase modification must adhere to these criteria to ensure reliability and user trust.

## Security Protocols

### API Key Isolation
The most critical security requirement is the strict separation of AI API keys from data payloads.

### UI & Logic Preservation
Before any modification, identify all existing UI components and business logic in the target file. You MUST NOT remove functional UI elements (e.g., links, help text, status banners) or change established naming conventions (branding) unless explicitly instructed. Any enhancement must be additive and seamless, preserving the "Premium Institutional" user experience.

## Stability Standards

### Defensive Programming
Use mandatory **Optional Chaining** (`?.`) for all nested data structures, especially when dealing with AI-generated responses or saved state data from background tasks.

**Example:**
- `newData.weeks?.[country]?.[weekKey]`
- `savedAnalysis?.timestamp`

### Concurrent State Management
- Always use the functional form of `setData` when making updates based on previous state: `setData(prev => ({ ...prev, ...updates }))`.
- Use `isMounted` checks in `useEffect` when dealing with asynchronous operations to prevent memory leaks or "update on unmounted component" errors.

## Adherence Checklist

- Is the API key isolated from the research payload?
- Are nested data accesses protected by optional chaining?
- Does the UI handle "Analysis Failed" or "Loading" states gracefully?
- Are all constants and prompts moved to centralized files like `ai.js`?
