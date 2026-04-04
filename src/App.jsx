import React, { useEffect, useState, useRef, useMemo } from "react";

import Header from "./components/Header";
import WeekSelector from "./components/WeekSelector";
import StockGrid from "./components/StockGrid";
import EditingRulesModal from "./components/EditingRulesModal";
import ManageParamsModal from "./components/ManageParamsModal";
import FilterConfigModal from "./components/FilterConfigModal";
import ColumnConfigModal from "./components/ColumnConfigModal";
import ManageSectorsModal from "./components/ManageSectorsModal";
import ManageTagsModal from "./components/ManageTagsModal";
import AnalyzeModal from "./components/AnalyzeModal";
import ManageWatchlistsModal from "./components/ManageWatchlistsModal";
import GlobalTooltip from "./components/GlobalTooltip";
import SettingsModal from "./components/SettingsModal";
import AnalyticsDashboard from "./components/AnalyticsDashboard";
import UserGuideModal from "./components/UserGuideModal";
import { ToastProvider, useToast } from "./components/ToastContext";
import { ConfirmProvider, useConfirm } from "./components/ConfirmContext";
import "./styles.css";

import { loadData, saveData } from "./services/storage";
import { useModalState } from "./hooks/useModalState";
import { useTheme } from "./hooks/useTheme";
import { EMPTY_DATA } from "./constants/app";
import { getLatestWeekKey, isWeekReadOnly, getLocalDateString, getSundayOfWeek } from "./utils/weekHelpers";
import { isParamRelevantForCountry, scrubParamDefinitions } from "./utils/paramUtils";

function AppContent() {
  /* =========================
     HOOKS (Must be at the TOP)
  ========================= */
  const [data, setData] = useState(null);
  const [country, setCountry] = useState("IN");
  const [weekKey, setWeekKey] = useState(null);
  const [selectedWatchlistId, setSelectedWatchlistId] = useState("all");

  const { theme, toggleTheme } = useTheme();
  const modals = useModalState();
  const hasLoaded = useRef(false);
  const { confirm } = useConfirm();
  const { showToast } = useToast();

  // Country-aware sector filtering (safe-guarded for null data)
  const filteredSectors = useMemo(() => {
    const rawSectors = data?.uiConfig?.sectors || [];
    return rawSectors
      .filter(s => {
        if (typeof s === 'string') return true;
        if (!s.countries || s.countries.length === 0) return true;
        return s.countries.includes(country);
      })
      .map(s => typeof s === 'string' ? s : s.name)
      .sort((a, b) => a.localeCompare(b));
  }, [data?.uiConfig?.sectors, country]);

  useEffect(() => {
    async function init() {
      const stored = await loadData();
      let finalData = { ...stored };

      const defaultList = stored.watchlists?.find((w) => w.isDefault);
      if (defaultList) {
        setSelectedWatchlistId(defaultList.id);
      }

      const initialCountry = "IN";
      let latestWeek = getLatestWeekKey(finalData.weeks?.[initialCountry] || {});

      if (!latestWeek) {
        const todayStr = getLocalDateString(new Date());
        latestWeek = getSundayOfWeek(todayStr);

        if (!finalData.weeks) finalData.weeks = {};
        if (!finalData.weeks[initialCountry]) finalData.weeks[initialCountry] = {};
        finalData.weeks[initialCountry][latestWeek] = { stocks: {} };
      }

      finalData = scrubParamDefinitions(finalData);

      setData(finalData);
      setWeekKey(latestWeek);

      hasLoaded.current = true;
    }

    init();
  }, []);

  useEffect(() => {
    if (!hasLoaded.current || !data) return;
    saveData(data);
  }, [data]);

  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.storage?.onChanged) return;

    const handleStorageChange = (changes, namespace) => {
      if (namespace === "local" && changes["trading_app_data"]) {
        const newData = changes["trading_app_data"].newValue;
        if (newData && hasLoaded.current) {
          setData((currentData) => {
            if (!currentData) return newData;

            if (currentData.weeks === newData.weeks) {
              return currentData;
            }

            return {
              ...currentData,
              weeks: newData.weeks,
              aiSettings: newData.aiSettings || currentData.aiSettings
            };
          });
        }
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      const activeTag = document.activeElement?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') {
        return;
      }

      if (e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        modals.setShowSettings(true);
      }
      if (e.altKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        modals.setShowAnalytics(true);
      }
      if (e.altKey && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        modals.setShowAnalyze(true);
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [modals]);

  /* =========================
     HANDLERS
  ========================= */

  const handleCountryChange = (newCountry) => {
    setCountry(newCountry);
    const countryWeeks = data?.weeks?.[newCountry] || {};
    
    let targetWeek = weekKey;
    if (!countryWeeks[weekKey]) {
      const latestWeek = getLatestWeekKey(countryWeeks);
      if (latestWeek) {
        targetWeek = latestWeek;
      } else {
        const todayStr = getLocalDateString(new Date());
        targetWeek = getSundayOfWeek(todayStr);
        
        setData(prev => {
          const newData = structuredClone(prev);
          if (!newData.weeks) newData.weeks = {};
          if (!newData.weeks[newCountry]) newData.weeks[newCountry] = {};
          newData.weeks[newCountry][targetWeek] = { stocks: {} };
          return newData;
        });
      }
      setWeekKey(targetWeek);
    }
  };

  const clearWeekData = async () => {
    if (!weekKey) return;
    if (!(await confirm("Clear all stocks for this week?"))) return;

    const newData = structuredClone(data);
    if (newData.weeks?.[country]?.[weekKey]) {
      newData.weeks[country][weekKey].stocks = {};
      setData(newData);
    }
  };

  const clearAllData = async () => {
    const todayStr = getLocalDateString(new Date());
    const currentWk = getSundayOfWeek(todayStr);
    
    const initialData = structuredClone(EMPTY_DATA);
    if (!initialData.weeks) initialData.weeks = {};
    if (!initialData.weeks[country]) initialData.weeks[country] = {};
    initialData.weeks[country][currentWk] = { stocks: {} };
    
    setData(initialData);
    setWeekKey(currentWk);
  };

  const exportAllData = () => {
    if (!data || !data.weeks || !data.paramDefinitions) {
      showToast("Cannot export: Application data is incomplete or corrupted.", "error");
      return;
    }

    const exportData = structuredClone(data);
    if (exportData.aiSettings?.apiKey) {
      exportData.aiSettings.apiKey = ""; // Scrub API key before export
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const date = new Date().toISOString().split("T")[0];
    link.setAttribute("download", `trade_clarity_backup_${date}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Full backup exported successfully", "success");
  };

  const importAllData = async (importedData) => {
    const isValid = importedData && typeof importedData === "object" && importedData.weeks && importedData.paramDefinitions;

    if (!isValid) {
      const exampleFormat = {
        weeks: { US: { "2024-01-01": { stocks: {} } }, IN: { "2024-01-01": { stocks: {} } } },
        paramDefinitions: { exampleParam: { label: "Example", type: "text" } },
        uiConfig: {},
      };
      alert(`Invalid Backup File.\n\nThe file is missing required 'weeks' or 'paramDefinitions' structures.\n\nExpected Format:\n${JSON.stringify(exampleFormat, null, 2)}`);
      return;
    }

    if (await confirm("⚠️ Restoring a backup will replace ALL current data. This cannot be undone. Are you sure?")) {
      let finalData = importedData;
      let latestWeek = getLatestWeekKey(finalData.weeks?.[country] || {});
      
      if (!latestWeek) {
        const todayStr = getLocalDateString(new Date());
        latestWeek = getSundayOfWeek(todayStr);
        
        finalData = structuredClone(importedData);
        if (!finalData.weeks) finalData.weeks = {};
        if (!finalData.weeks[country]) finalData.weeks[country] = {};
        finalData.weeks[country][latestWeek] = { stocks: {} };
      }
      
      setData(finalData);
      setWeekKey(latestWeek);
      showToast("Full backup restored successfully", "success");
    }
  };

  const handleUpdateStock = (updatedStock) => {
    if (!weekKey || !updatedStock) return;

    setData(prev => {
      const newData = structuredClone(prev);
      const weekStocks = newData.weeks[country][weekKey].stocks;
      if (weekStocks[updatedStock.symbol]) {
        weekStocks[updatedStock.symbol] = updatedStock;
        showToast(`Updated ${updatedStock.symbol}`, "success");
      }
      return newData;
    });
  };

  /* =========================
     CONDITIONAL RENDERING (Late Exit)
  ========================= */
  if (!data) return null;

  const currentWeekStocks = Object.values(data.weeks?.[country]?.[weekKey]?.stocks || {});
  const tagsSet = new Set(data.uiConfig?.tags || []);
  currentWeekStocks.forEach((s) => {
    if (Array.isArray(s.tags)) s.tags.forEach((t) => tagsSet.add(t));
  });
  const availableTags = Array.from(tagsSet).sort();

  // Calculate read-only status
  const todayStr = getLocalDateString(new Date());
  const currentWeekKey = getSundayOfWeek(todayStr);
  const isReadOnly = isWeekReadOnly(weekKey, currentWeekKey, data?.uiConfig);

  return (
    <>
      <GlobalTooltip />

      <Header
        onOpenModal={modals.openModal}
        onClearAll={clearAllData}
        onManageTags={() => modals.setShowManageTags(true)}
        onShowSettings={() => modals.setShowSettings(true)}
        onShowUserGuide={() => modals.setShowUserGuide(true)}
        onManageWatchlists={() => modals.setShowManageWatchlists(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
        country={country}
        setCountry={handleCountryChange}
      />

      <WeekSelector
        data={data}
        setData={setData}
        country={country}
        weekKey={weekKey}
        setWeekKey={setWeekKey}
        selectedWatchlistId={selectedWatchlistId}
        setSelectedWatchlistId={setSelectedWatchlistId}
        onClearWeek={clearWeekData}
        onAnalyze={() => modals.setShowAnalyze(true)}
        onShowAnalytics={() => modals.setShowAnalytics(true)}
      />

      <StockGrid
        data={data}
        setData={setData}
        country={country}
        weekKey={weekKey}
        selectedWatchlistId={selectedWatchlistId}
        isReadOnly={isReadOnly}
        onExportAll={exportAllData}
        onImportAll={importAllData}
        availableTags={availableTags}
        aiSettings={data.aiSettings}
      />

      {modals.showManageParams && (
        <ManageParamsModal
          isOpen={modals.showManageParams}
          data={data}
          setData={setData}
          onClose={() => modals.setShowManageParams(false)}
        />
      )}

      {modals.showFilterConfig && (
        <FilterConfigModal
          isOpen={modals.showFilterConfig}
          data={data}
          setData={setData}
          country={country}
          selectedWatchlistId={selectedWatchlistId}
          onClose={() => modals.setShowFilterConfig(false)}
        />
      )}

      {modals.showColumnConfig && (
        <ColumnConfigModal
          isOpen={modals.showColumnConfig}
          data={data}
          setData={setData}
          country={country}
          selectedWatchlistId={selectedWatchlistId}
          onClose={() => modals.setShowColumnConfig(false)}
        />
      )}

      {modals.showManageSectors && (
        <ManageSectorsModal
          isOpen={modals.showManageSectors}
          data={data}
          setData={setData}
          onClose={() => modals.setShowManageSectors(false)}
        />
      )}

      {modals.showEditingRules && (
        <EditingRulesModal
          isOpen={modals.showEditingRules}
          data={data}
          setData={setData}
          onClose={() => modals.setShowEditingRules(false)}
        />
      )}

      {modals.showManageTags && (
        <ManageTagsModal
          isOpen={modals.showManageTags}
          data={data}
          setData={setData}
          onClose={() => modals.setShowManageTags(false)}
        />
      )}

      {modals.showManageWatchlists && (
        <ManageWatchlistsModal
          isOpen={modals.showManageWatchlists}
          data={data}
          setData={setData}
          selectedWatchlistId={selectedWatchlistId}
          setSelectedWatchlistId={setSelectedWatchlistId}
          onClose={() => modals.setShowManageWatchlists(false)}
        />
      )}

      {modals.showAnalyze && (
        <AnalyzeModal
          isOpen={modals.showAnalyze}
          data={data}
          setData={setData}
          country={country}
          weekKey={weekKey}
          selectedWatchlistId={selectedWatchlistId}
          onClose={() => modals.setShowAnalyze(false)}
        />
      )}

      {modals.showSettings && (
        <SettingsModal
          isOpen={modals.showSettings}
          data={data}
          setData={setData}
          onClose={() => modals.setShowSettings(false)}
        />
      )}

      {modals.showAnalytics && (
        <AnalyticsDashboard
          country={country}
          stocks={Object.values(data.weeks?.[country]?.[weekKey]?.stocks || {})}
          allWeeksData={data.weeks?.[country] || {}}
          aiSettings={data.aiSettings}
          parameters={Object.entries(data.paramDefinitions)
            .filter(([, def]) => isParamRelevantForCountry(def, country))
            .map(([key, def]) => ({
              ...def,
              id: key,
            }))}
          weekKey={weekKey}
          selectedWatchlistId={selectedWatchlistId}
          watchlists={data.watchlists || []}
          onClose={() => modals.setShowAnalytics(false)}
          sectors={filteredSectors}
          availableTags={availableTags}
          paramDefinitions={Object.fromEntries(
            Object.entries(data.paramDefinitions || {}).filter(([, def]) => isParamRelevantForCountry(def, country))
          )}
          onUpdateStock={handleUpdateStock}
        />
      )}

      {modals.showUserGuide && (
        <UserGuideModal
          isOpen={modals.showUserGuide}
          onClose={() => modals.setShowUserGuide(false)}
          onOpenModal={modals.openModal}
        />
      )}
    </>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <AppContent />
      </ConfirmProvider>
    </ToastProvider>
  );
}
