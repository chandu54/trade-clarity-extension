import { describe, it, vi, beforeEach, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from '../useTheme';

describe('useTheme', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reflect the provided theme', () => {
    const { result } = renderHook(() => useTheme('dark'));
    expect(result.current.theme).toBe('dark');

    const { result: result2 } = renderHook(() => useTheme('light'));
    expect(result2.current.theme).toBe('light');
  });

  it('should default to light if no theme is provided', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');
  });

  it('should call onThemeChange when toggling', () => {
    const onThemeChange = vi.fn();
    const { result } = renderHook(() => useTheme('light', onThemeChange));
    
    act(() => {
      result.current.toggleTheme();
    });
    
    expect(onThemeChange).toHaveBeenCalledWith('dark');
  });

  it('should update document attribute when theme changes', () => {
    const setAttributeSpy = vi.spyOn(document.documentElement, 'setAttribute');
    
    // Initial render with light
    const { rerender } = renderHook(({ t }) => useTheme(t), {
      initialProps: { t: 'light' }
    });
    expect(setAttributeSpy).toHaveBeenCalledWith('data-theme', 'light');

    // Rerender with dark
    rerender({ t: 'dark' });
    expect(setAttributeSpy).toHaveBeenCalledWith('data-theme', 'dark');
  });
});
