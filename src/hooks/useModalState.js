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

  const openModal = (modalName) => {
    const setters = {
      params: setShowManageParams,
      filter: setShowFilterConfig,
      rules: setShowEditingRules,
      columns: setShowColumnConfig,
      sectors: setShowManageSectors,
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
    };
    setters[modalName]?.(false);
  };

  return {
    showManageParams,
    showFilterConfig,
    showEditingRules,
    showColumnConfig,
    showManageSectors,
    openModal,
    closeModal,
    setShowManageParams,
    setShowFilterConfig,
    setShowEditingRules,
    setShowColumnConfig,
    setShowManageSectors,
  };
}
