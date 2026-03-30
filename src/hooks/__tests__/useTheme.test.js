import { describe, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from '../useTheme';

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should initialize theme from localStorage or default to light', () => {
    localStorage.setItem('theme', 'dark');
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('dark');

    localStorage.clear();
    const { result: result2 } = renderHook(() => useTheme());
    expect(result2.current.theme).toBe('light');
  });

  it('should toggle theme correctly', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');

    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.theme).toBe('dark');

    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.theme).toBe('light');
  });

  it('should update document attribute and localStorage on theme change', () => {
    const setAttributeSpy = vi.spyOn(document.documentElement, 'setAttribute');
    const { result } = renderHook(() => useTheme());

    expect(setAttributeSpy).toHaveBeenCalledWith('data-theme', 'light');
    expect(localStorage.getItem('theme')).toBe('light');

    act(() => {
      result.current.setTheme('dark');
    });

    expect(setAttributeSpy).toHaveBeenCalledWith('data-theme', 'dark');
    expect(localStorage.getItem('theme')).toBe('dark');
  });
});
