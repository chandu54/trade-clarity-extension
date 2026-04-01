---
name: Unit Testing Strategy
description: Guidelines and patterns for maintaining the Vitest-based testing environment in TradeClarity.
---

# Unit Testing Strategy Skill

This skill defines the standardized approach for unit testing in TradeClarity. All tests should adhere to these practices to ensure reliability and consistent verification.

## Testing Framework & Environment

- **Framework**: Vitest (consistent with the modern ESM/Vite setup).
- **Environment**: JSDOM (browser API emulation).
- **Library**: `@testing-library/react` (for component-centric testing).

## Standardized Mocks

> [!TIP]
> Ensure any new global dependencies are added to `src/setupTests.js` to prevent repetitive mocking in individual test files.

### Global Setup (`setupTests.js`)
- **chrome**: Mocks for `runtime`, `storage`, and `onMessage`.
- **localStorage**: Polyfilled for the JSDOM environment.
- **ResizeObserver**: Mocked as `vi.fn()` with observe/unobserve stubs.
- **HTMLCanvasElement**: Vital for chart-based components (e.g., `lightweight-charts`).

## Asynchronous Testing Patterns

### `waitFor()` Protocol
Always use `waitFor()` from the testing library when asserting on state changes triggered by asynchronous calls (like AI analysis).

**Example:**
```javascript
await waitFor(() => {
  expect(screen.getByText('Analysis Completed')).toBeDefined();
}, { timeout: 3000 });
```

### Mocking Services
Mock the `ai.js` service layer specifically to control success and failure scenarios without real API calls.

```javascript
import * as aiService from '../../services/ai';
vi.mock('../../services/ai', () => ({
  getAiAnalysis: vi.fn(),
  PROMPT_TEMPLATES: []
}));

// In the test:
aiService.getAiAnalysis.mockResolvedValue({ rawText: 'Mock Response' });
```

## Maintenance & Coverage

- Ensure all new components that handle AI data or complex logic have corresponding `.test.jsx` files.
- Verify that `vi.clearAllMocks()` is called in `beforeEach` to prevent cross-test contamination.
