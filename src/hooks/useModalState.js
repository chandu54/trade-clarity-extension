import { useState, useCallback } from "react";

/**
 * Custom hook for managing multiple modal visibility states.
 * Replaces multiple boolean states with a single activeModal hook to reduce boilerplate and re-renders.
 */
export function useModalState() {
  const [activeModal, setActiveModal] = useState(null);
  const [modalParams, setModalParams] = useState(null);

  const openModal = useCallback((modalName, params = null) => {
    setActiveModal(modalName);
    setModalParams(params);
  }, []);

  const closeModal = useCallback(() => {
    setActiveModal(null);
    setModalParams(null);
  }, []);

  return {
    activeModal,
    modalParams,
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
    showDataManagement: activeModal === 'data_management',
    showAnalytics: activeModal === 'analytics',
    showUserGuide: activeModal === 'guide',
    showWeeklyFeedback: activeModal === 'weekly_feedback',
    
    // Legacy setters for individual modals
    setShowManageParams: (val) => val ? openModal('params') : closeModal(),
    setShowFilterConfig: (val) => val ? openModal('filter') : closeModal(),
    setShowEditingRules: (val) => val ? openModal('rules') : closeModal(),
    setShowColumnConfig: (val) => val ? openModal('columns') : closeModal(),
    setShowManageSectors: (val) => val ? openModal('sectors') : closeModal(),
    setShowManageWatchlists: (val) => val ? openModal('watchlists') : closeModal(),
    setShowManageTags: (val) => val ? openModal('tags') : closeModal(),
    setShowAnalyze: (val) => val ? openModal('analyze') : closeModal(),
    setShowSettings: (val) => val ? openModal('settings') : closeModal(),
    setShowDataManagement: (val) => val ? openModal('data_management') : closeModal(),
    setShowAnalytics: (val) => val ? openModal('analytics') : closeModal(),
    setShowUserGuide: (val) => val ? openModal('guide') : closeModal(),
    setShowWeeklyFeedback: (val) => val ? openModal('weekly_feedback') : closeModal(),
  };
}
