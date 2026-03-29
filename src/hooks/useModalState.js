import { useState } from "react";

/**
 * Custom hook for managing multiple modal visibility states
 * Reduces boilerplate for managing show/hide state for modals
 */
export function useModalState() {
  const [showManageParams, setShowManageParams] = useState(false);
  const [showFilterConfig, setShowFilterConfig] = useState(false);
  const [showEditingRules, setShowEditingRules] = useState(false);
  const [showColumnConfig, setShowColumnConfig] = useState(false);
  const [showManageSectors, setShowManageSectors] = useState(false);
  const [showManageWatchlists, setShowManageWatchlists] = useState(false);
  const [showManageTags, setShowManageTags] = useState(false);
  const [showAnalyze, setShowAnalyze] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showUserGuide, setShowUserGuide] = useState(false);

  const openModal = (modalName) => {
    const setters = {
      params: setShowManageParams,
      filter: setShowFilterConfig,
      rules: setShowEditingRules,
      columns: setShowColumnConfig,
      sectors: setShowManageSectors,
      watchlists: setShowManageWatchlists,
      tags: setShowManageTags,
      analyze: setShowAnalyze,
      settings: setShowSettings,
      analytics: setShowAnalytics,
      guide: setShowUserGuide,
    };
    setters[modalName]?.(true);
  };

  const closeModal = (modalName) => {
    const setters = {
      params: setShowManageParams,
      filter: setShowFilterConfig,
      rules: setShowEditingRules,
      columns: setShowColumnConfig,
      sectors: setShowManageSectors,
      watchlists: setShowManageWatchlists,
      tags: setShowManageTags,
      analyze: setShowAnalyze,
      settings: setShowSettings,
      analytics: setShowAnalytics,
      guide: setShowUserGuide,
    };
    setters[modalName]?.(false);
  };

  return {
    showManageParams,
    showFilterConfig,
    showEditingRules,
    showColumnConfig,
    showManageSectors,
    showManageWatchlists,
    showManageTags,
    showAnalyze,
    showSettings,
    showAnalytics,
    showUserGuide,
    openModal,
    closeModal,
    setShowManageParams,
    setShowFilterConfig,
    setShowEditingRules,
    setShowColumnConfig,
    setShowManageSectors,
    setShowManageWatchlists,
    setShowManageTags,
    setShowAnalyze,
    setShowSettings,
    setShowAnalytics,
    setShowUserGuide,
  };
}
