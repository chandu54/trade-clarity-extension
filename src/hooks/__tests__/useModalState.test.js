import { describe, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useModalState } from '../useModalState';

describe('useModalState', () => {
  it('should initialize all modal states to false', () => {
    const { result } = renderHook(() => useModalState());
    
    expect(result.current.showManageParams).toBe(false);
    expect(result.current.showFilterConfig).toBe(false);
    expect(result.current.showEditingRules).toBe(false);
    expect(result.current.showColumnConfig).toBe(false);
    expect(result.current.showManageSectors).toBe(false);
    expect(result.current.showManageWatchlists).toBe(false);
    expect(result.current.showManageTags).toBe(false);
    expect(result.current.showAnalyze).toBe(false);
    expect(result.current.showSettings).toBe(false);
    expect(result.current.showAnalytics).toBe(false);
    expect(result.current.showUserGuide).toBe(false);
  });

  it('should open and close specific modals using openModal and closeModal', () => {
    const { result } = renderHook(() => useModalState());

    act(() => {
      result.current.openModal('params');
    });
    expect(result.current.showManageParams).toBe(true);

    act(() => {
      result.current.closeModal('params');
    });
    expect(result.current.showManageParams).toBe(false);

    act(() => {
      result.current.openModal('analytics');
    });
    expect(result.current.showAnalytics).toBe(true);
  });

  it('should allow setting specific modal state directly', () => {
    const { result } = renderHook(() => useModalState());

    act(() => {
      result.current.setShowManageWatchlists(true);
    });
    expect(result.current.showManageWatchlists).toBe(true);
  });
});
