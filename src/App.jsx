import { useEffect, useState, useRef } from "react";

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

function AppContent() {
  const [data, setData] = useState(null);
  const [country, setCountry] = useState("IN");
  const [weekKey, setWeekKey] = useState(null);
  const [selectedWatchlistId, setSelectedWatchlistId] = useState("all");

  const { theme, toggleTheme } = useTheme();
  const modals = useModalState();
  const hasLoaded = useRef(false);
  const { confirm } = useConfirm();
  const { showToast } = useToast();

  useEffect(() => {
    async function init() {
      const stored = await loadData();
      setData(stored);

      const defaultList = stored.watchlists?.find((w) => w.isDefault);
      if (defaultList) {
        setSelectedWatchlistId(defaultList.id);
      }

      // Default to US weeks for initial load
      const latestWeek = getLatestWeekKey(stored.weeks?.US || {});
      if (latestWeek) {
        handleSetWeekKey(latestWeek);
      }

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
            
            // Shallow compare weeks for high-level changes before committing to a merge
            // This is significantly faster than JSON.stringify for large datasets
            if (currentData.weeks === newData.weeks) {
              return currentData;
            }

            return {
              ...currentData,
              weeks: newData.weeks, // Background only touches weeks/stocks
              aiSettings: newData.aiSettings || currentData.aiSettings
            };
          });
        }
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);


  /**
   * Safe setter for weekKey that ensures the target week exists in data.
   * Prevents expensive reactive clones.
   */
  const handleSetWeekKey = (newKey) => {
    if (!newKey || !data) return;
    
    setWeekKey(newKey);

    const countryWeeks = data.weeks[country] || {};
    if (!countryWeeks[newKey]) {
      setData(prev => {
        const newData = { ...prev };
        if (!newData.weeks[country]) newData.weeks[country] = {};
        newData.weeks[country][newKey] = { stocks: {} };
        return newData;
      });
    }
  };

  /* =========================
     DERIVED STATE
  ========================= */

  // Calculate current week key locally using consistent utility
  const todayStr = getLocalDateString(new Date());
  const currentWeekKey = getSundayOfWeek(todayStr);

  const isReadOnly = isWeekReadOnly(weekKey, currentWeekKey, data?.uiConfig);


  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // Ignore shortcuts if the user is actively typing inside an input/textarea
      const activeTag = document.activeElement?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') {
        return;
      }

      if (e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        setShowSettings(true);
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

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const clearWeekData = async () => {
    if (!weekKey) return;
    if (!(await confirm("Clear all stocks for this week?"))) return;

    const newData = structuredClone(data);
    newData.weeks[country][weekKey].stocks = {};
    setData(newData);
  };

  const clearAllData = async () => {
    // Header handles the confirmation for this action usually, but if called directly:
    setData(structuredClone(EMPTY_DATA));
    handleSetWeekKey(null);
  };

  const createCurrentWeek = () => {
    const key = currentWeekKey;
    const newData = structuredClone(data);
    if (!newData.weeks[country]) newData.weeks[country] = {};
    newData.weeks[country][key] = { stocks: {} };
    setData(newData);
    handleSetWeekKey(key);
  };


  const exportAllData = () => {
    if (!data || !data.weeks || !data.paramDefinitions) {
      showToast(
        "Cannot export: Application data is incomplete or corrupted.",
        "error",
      );
      return;
    }

    const exportData = structuredClone(data);
    if (exportData.aiSettings?.apiKey) {
      exportData.aiSettings.apiKey = ""; // Scrub API key before export
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
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
    const isValid =
      importedData &&
      typeof importedData === "object" &&
      importedData.weeks &&
      importedData.paramDefinitions;

    if (!isValid) {
      const exampleFormat = {
        weeks: { US: { "2024-01-01": { stocks: {} } } },
        paramDefinitions: { exampleParam: { label: "Example", type: "text" } },
        uiConfig: {},
      };
      alert(
        `Invalid Backup File.\n\nThe file is missing required 'weeks' or 'paramDefinitions' structures.\n\nExpected Format:\n${JSON.stringify(exampleFormat, null, 2)}`,
      );
      return;
    }

    if (
      await confirm(
        "⚠️ Restoring a backup will replace ALL current data. This cannot be undone. Are you sure?",
      )
    ) {
      setData(importedData);
      const latestWeek = getLatestWeekKey(importedData.weeks?.[country] || {});
      handleSetWeekKey(latestWeek || null);
      showToast("Full backup restored successfully", "success");
    }
  };


  if (!data) return null;

  if (!weekKey && Object.keys(data.weeks?.[country] || {}).length === 0) {
    return (
      <div style={{ padding: 20 }}>
        <h3>No weeks available</h3>
        <button onClick={createCurrentWeek}>Create Current Week</button>
      </div>
    );
  }


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
        setCountry={setCountry}
      />

      <WeekSelector
        data={data}
        setData={setData}
        country={country}
        weekKey={weekKey}
        setWeekKey={handleSetWeekKey}
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
          selectedWatchlistId={selectedWatchlistId}
          onClose={() => modals.setShowFilterConfig(false)}
        />
      )}

      {modals.showColumnConfig && (
        <ColumnConfigModal
          isOpen={modals.showColumnConfig}
          data={data}
          setData={setData}
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
          parameters={Object.entries(data.paramDefinitions).map(
            ([key, def]) => ({
              ...def,
              id: key,
            }),
          )}
          weekKey={weekKey}
          selectedWatchlistId={selectedWatchlistId}
          watchlists={data.watchlists || []}
          onClose={() => modals.setShowAnalytics(false)}
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
