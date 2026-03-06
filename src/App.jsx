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
import GlobalTooltip from "./components/GlobalTooltip";
import SettingsModal from "./components/SettingsModal";
import { ToastProvider } from "./components/ToastContext";
import { ConfirmProvider, useConfirm } from "./components/ConfirmContext";
import "./styles.css";

import { loadData, saveData } from "./services/storage";
import { useModalState } from "./hooks/useModalState";
import { useTheme } from "./hooks/useTheme";
import { EMPTY_DATA } from "./constants/app";
import { 
  getLatestWeekKey, 
  isWeekReadOnly 
} from "./utils/weekHelpers";

function AppContent() {
  const [data, setData] = useState(null);
  const [country, setCountry] = useState("IN");
  const [weekKey, setWeekKey] = useState(null);
  const [showManageTags, setShowManageTags] = useState(false);
  const [showAnalyze, setShowAnalyze] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const { theme, toggleTheme } = useTheme();
  const modals = useModalState();
  const hasLoaded = useRef(false);
  const { confirm } = useConfirm();

  /* =========================
     LOAD DATA ON MOUNT
  ========================= */
  useEffect(() => {
    async function init() {
      const stored = await loadData();
      setData(stored);

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
  // const sortedWeeks = data ? Object.keys(data.weeks?.[country] || {}).sort() : [];
  
  // Calculate current week key locally
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - (day === 0 ? 7 : day);
  const sunday = new Date(now.setDate(diff));
  const currentWeekKey = `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, "0")}-${String(sunday.getDate()).padStart(2, "0")}`;

  const isReadOnly = isWeekReadOnly(weekKey, currentWeekKey, data?.uiConfig);

  /* =========================
     CLEAR DATA HANDLERS
  ========================= */
  const clearWeekData = async () => {
    if (!weekKey) return;
    if (!await confirm("Clear all stocks for this week?")) return;

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
        onClearWeek={clearWeekData}
        onAnalyze={() => setShowAnalyze(true)}
      />

      <StockGrid
        data={data}
        setData={setData}
        country={country}
        weekKey={weekKey}
        isReadOnly={isReadOnly}
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
          onClose={() => modals.setShowFilterConfig(false)}
        />
      )}

      {modals.showColumnConfig && (
        <ColumnConfigModal
          isOpen={modals.showColumnConfig}
          data={data}
          setData={setData}
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

      {showAnalyze && (
        <AnalyzeModal
          isOpen={showAnalyze}
          data={data}
          setData={setData}
          country={country}
          weekKey={weekKey}
          onClose={() => setShowAnalyze(false)}
        />
      )}

      {showSettings && (
        <SettingsModal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
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
