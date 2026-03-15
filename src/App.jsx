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
  const [showManageTags, setShowManageTags] = useState(false);
  const [showAnalyze, setShowAnalyze] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showUserGuide, setShowUserGuide] = useState(false);
  const [selectedWatchlistId, setSelectedWatchlistId] = useState("all");
  const [showManageWatchlists, setShowManageWatchlists] = useState(false);

  const { theme, toggleTheme } = useTheme();
  const modals = useModalState();
  const hasLoaded = useRef(false);
  const { confirm } = useConfirm();
  const { showToast } = useToast();

  /* =========================
     LOAD DATA ON MOUNT
  ========================= */
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
        setWeekKey(latestWeek);
      }

      hasLoaded.current = true;
    }

    init();
  }, []);

  /* =========================
     PERSIST DATA TO STORAGE
  ========================= */
  useEffect(() => {
    if (!hasLoaded.current || !data) return;
    saveData(data);
  }, [data]);

  /* =========================
     SYNC WITH BACKGROUND UPDATES
  ========================= */
  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.storage?.onChanged) return;

    const handleStorageChange = (changes, namespace) => {
      if (namespace === "local" && changes["trading_app_data"]) {
        const newData = changes["trading_app_data"].newValue;
        if (newData && hasLoaded.current) {
           setData((currentData) => {
              if (!currentData) return newData;
              
              // To prevent infinite loop with saveData:
              // Check if the actual stocks data has changed (which is what background script mutates)
              const currentStr = JSON.stringify(currentData.weeks);
              const newStr = JSON.stringify(newData.weeks);
              
              if (currentStr !== newStr) {
                  return newData;
              }
              return currentData;
           });
        }
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  /* =========================
     ENSURE WEEK EXISTS
  ========================= */
  useEffect(() => {
    if (!weekKey || !data) return;
    const countryWeeks = data.weeks[country] || {};
    if (!countryWeeks[weekKey]) {
      const newData = structuredClone(data);
      if (!newData.weeks[country]) newData.weeks[country] = {};
      newData.weeks[country][weekKey] = { stocks: {} };
      setData(newData);
    }
  }, [weekKey, data, country]);

  /* =========================
     DERIVED STATE
  ========================= */

  // Calculate current week key locally using consistent utility
  const todayStr = getLocalDateString(new Date());
  const currentWeekKey = getSundayOfWeek(todayStr);

  const isReadOnly = isWeekReadOnly(weekKey, currentWeekKey, data?.uiConfig);

  /* =========================
     CLEAR DATA HANDLERS
  ========================= */
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
    setWeekKey(null);
  };

  const createCurrentWeek = () => {
    const key = currentWeekKey;
    const newData = structuredClone(data);
    if (!newData.weeks[country]) newData.weeks[country] = {};
    newData.weeks[country][key] = { stocks: {} };
    setData(newData);
    setWeekKey(key);
  };

  /* =========================
     EXPORT ALL DATA
  ========================= */
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

  /* =========================
     IMPORT ALL DATA
  ========================= */
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
      setWeekKey(latestWeek || null);
      showToast("Full backup restored successfully", "success");
    }
  };

  /* =========================
     INITIAL STATE
  ========================= */
  if (!data) return null;

  if (!weekKey && Object.keys(data.weeks?.[country] || {}).length === 0) {
    return (
      <div style={{ padding: 20 }}>
        <h3>No weeks available</h3>
        <button onClick={createCurrentWeek}>Create Current Week</button>
      </div>
    );
  }

  /* =========================
     RENDER
  ========================= */
  return (
    <>
      <GlobalTooltip />

      <Header
        onOpenModal={modals.openModal}
        onClearAll={clearAllData}
        onManageTags={() => setShowManageTags(true)}
        onShowSettings={() => setShowSettings(true)}
        onShowUserGuide={() => setShowUserGuide(true)}
        onManageWatchlists={() => setShowManageWatchlists(true)}
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
        setWeekKey={setWeekKey}
        selectedWatchlistId={selectedWatchlistId}
        setSelectedWatchlistId={setSelectedWatchlistId}
        onClearWeek={clearWeekData}
        onAnalyze={() => setShowAnalyze(true)}
        onShowAnalytics={() => setShowAnalytics(true)}
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

      {showManageTags && (
        <ManageTagsModal
          isOpen={showManageTags}
          data={data}
          setData={setData}
          onClose={() => setShowManageTags(false)}
        />
      )}

      {showManageWatchlists && (
        <ManageWatchlistsModal
          isOpen={showManageWatchlists}
          data={data}
          setData={setData}
          selectedWatchlistId={selectedWatchlistId}
          setSelectedWatchlistId={setSelectedWatchlistId}
          onClose={() => setShowManageWatchlists(false)}
        />
      )}

      {showAnalyze && (
        <AnalyzeModal
          isOpen={showAnalyze}
          data={data}
          setData={setData}
          country={country}
          weekKey={weekKey}
          selectedWatchlistId={selectedWatchlistId}
          onClose={() => setShowAnalyze(false)}
        />
      )}

      {showSettings && (
        <SettingsModal
          isOpen={showSettings}
          data={data}
          setData={setData}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showAnalytics && (
        <AnalyticsDashboard
          stocks={Object.values(data.weeks?.[country]?.[weekKey]?.stocks || {})}
          allWeeksData={data.weeks?.[country] || {}}
          parameters={Object.entries(data.paramDefinitions).map(
            ([key, def]) => ({
              ...def,
              id: key,
            }),
          )}
          weekKey={weekKey}
          selectedWatchlistId={selectedWatchlistId}
          watchlists={data.watchlists || []}
          onClose={() => setShowAnalytics(false)}
        />
      )}

      {showUserGuide && (
        <UserGuideModal
          isOpen={showUserGuide}
          onClose={() => setShowUserGuide(false)}
          // Add these two lines:
          onOpenModal={modals.openModal}
          onShowSettings={() => setShowSettings(true)}
          onManageTags={() => setShowManageTags(true)}
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
