import { useState, useCallback } from "react";

/**
 * Custom hook for managing multiple modal visibility states.
 * Replaces multiple boolean states with a single activeModal hook to reduce boilerplate and re-renders.
 */
export function useModalState() {
  const [activeModal, setActiveModal] = useState(null);

  const openModal = useCallback((modalName) => {
    setActiveModal(modalName);
  }, []);

  const closeModal = useCallback(() => {
    setActiveModal(null);
  }, []);

  return {
    activeModal,
    openModal,
    closeModal,
    
    // Legacy support for boolean flags to avoid breaking other components immediately
    showManageParams: activeModal === 'params',
    showFilterConfig: activeModal === 'filter',
    showEditingRules: activeModal === 'rules',
    showColumnConfig: activeModal === 'columns',
    showManageSectors: activeModal === 'sectors',
    showManageWatchlists: activeModal === 'watchlists',
    showManageTags: activeModal === 'tags',
    showAnalyze: activeModal === 'analyze',
    showSettings: activeModal === 'settings',
    showAnalytics: activeModal === 'analytics',
    showUserGuide: activeModal === 'guide',
    
    // Legacy setters for individual modals
    setShowManageParams: (val) => val ? setActiveModal('params') : setActiveModal(null),
    setShowFilterConfig: (val) => val ? setActiveModal('filter') : setActiveModal(null),
    setShowEditingRules: (val) => val ? setActiveModal('rules') : setActiveModal(null),
    setShowColumnConfig: (val) => val ? setActiveModal('columns') : setActiveModal(null),
    setShowManageSectors: (val) => val ? setActiveModal('sectors') : setActiveModal(null),
    setShowManageWatchlists: (val) => val ? setActiveModal('watchlists') : setActiveModal(null),
    setShowManageTags: (val) => val ? setActiveModal('tags') : setActiveModal(null),
    setShowAnalyze: (val) => val ? setActiveModal('analyze') : setActiveModal(null),
    setShowSettings: (val) => val ? setActiveModal('settings') : setActiveModal(null),
    setShowAnalytics: (val) => val ? setActiveModal('analytics') : setActiveModal(null),
    setShowUserGuide: (val) => val ? setActiveModal('guide') : setActiveModal(null),
  };
}
