import React, { useState, useRef, useMemo, useCallback } from 'react';
import Modal from './Modal';
import { autoDetectAndParseCSV, parseCSVToRows, sanitizeString, convertWorkbookToCSV } from '../utils/tradeImportParser';
import { matchExecutionsToPositions, isLiquidEtf } from '../utils/fifoPositionMatcher';
import { analyzeCSVWithAI, parseCSVWithAIMapping } from '../services/aiImportMapper';
import { useToast } from './ToastContext';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export default function ImportTradesModal({
  isOpen,
  onClose,
  _country = 'IN',
  existingJournals = [],
  onImportSuccess
}) {
  const { showToast } = useToast();
  const fileInputRef = useRef(null);

  // Form & Mode state
  const [importMode, setImportMode] = useState('zerodha_auto'); // 'zerodha_auto' | 'ai_auto' | 'generic'
  const [defaultRiskPct, setDefaultRiskPct] = useState(0.05); // 5% default
  const [defaultSetup, setDefaultSetup] = useState('Imported Trade');
  const [excludeEtfs, setExcludeEtfs] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);

  // File & Parsing state
  const [selectedFile, setSelectedFile] = useState(null);
  const [rawCsvText, setRawCsvText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [parseError, setParseError] = useState(null);

  // AI Schema mapping state
  const [aiMapping, setAiMapping] = useState(null);
  const [showAiConfirm, setShowAiConfirm] = useState(false);

  // Parsed Positions Preview State
  const [previewPositions, setPreviewPositions] = useState([]);
  const [selectedPositionIds, setSelectedPositionIds] = useState(new Set());

  // Reset state
  const handleReset = useCallback(() => {
    setSelectedFile(null);
    setRawCsvText('');
    setParseError(null);
    setAiMapping(null);
    setShowAiConfirm(false);
    setPreviewPositions([]);
    setSelectedPositionIds(new Set());
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleClose = () => {
    handleReset();
    onClose();
  };

  // Process uploaded CSV content
  const processCSVContent = useCallback((csvText, mode = importMode, riskPct = defaultRiskPct, setupTag = defaultSetup, skipEtfs = excludeEtfs) => {
    setParseError(null);
    setIsProcessing(true);

    try {
      if (mode === 'ai_auto') {
        // Send snippet to AI
        const snippet = csvText.split('\n').slice(0, 15).join('\n');
        analyzeCSVWithAI(snippet)
          .then(mapping => {
            setAiMapping(mapping);
            setShowAiConfirm(true);
            const rows = parseCSVToRows(csvText);
            const executions = parseCSVWithAIMapping(rows, 0, mapping);
            if (executions.length > 0) {
              const matched = matchExecutionsToPositions(executions, {
                defaultRiskPct: riskPct,
                defaultSetup: setupTag,
                excludeEtfs: skipEtfs
              });
              setPreviewPositions(matched);
              setSelectedPositionIds(new Set(matched.map(p => p.id)));
            } else {
              setParseError('AI could not parse any executions from the CSV. Check your file format.');
            }
          })
          .catch(err => {
            setParseError(`AI Schema Detection Error: ${err.message}`);
          })
          .finally(() => setIsProcessing(false));
        return;
      }

      // Auto-Detect Zerodha / Generic Parser
      const parseResult = autoDetectAndParseCSV(csvText);

      if (!parseResult) {
        setParseError('Unable to identify CSV format. Try using "AI Auto-Detect (Any Broker)".');
        setIsProcessing(false);
        return;
      }

      let matchedPositions = [];
      if (parseResult.type === 'positions') {
        // Pre-summarized P&L statement
        let rawData = parseResult.data;
        if (skipEtfs) {
          rawData = rawData.filter(p => !isLiquidEtf(p.symbol));
        }
        matchedPositions = rawData.map(p => ({
          ...p,
          id: `pos-imp-${p.symbol}-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 4)}`,
          setup: setupTag,
          initialStopLoss: riskPct > 0 && p.avgEntryPrice > 0 ? Number((p.avgEntryPrice * (1 - riskPct)).toFixed(2)) : null
        }));
      } else if (parseResult.type === 'executions') {
        // Execution log -> FIFO matcher
        matchedPositions = matchExecutionsToPositions(parseResult.data, {
          defaultRiskPct: riskPct,
          defaultSetup: setupTag,
          excludeEtfs: skipEtfs
        });
      } else {
        setParseError('Unrecognized CSV format. Try switching to "AI Auto-Detect".');
        setIsProcessing(false);
        return;
      }

      if (matchedPositions.length === 0) {
        setParseError('No valid trade positions found in the uploaded file.');
      } else {
        setPreviewPositions(matchedPositions);
        setSelectedPositionIds(new Set(matchedPositions.map(p => p.id)));
      }
    } catch (err) {
      console.error('CSV Parsing error:', err);
      setParseError(err.message || 'Error parsing CSV file.');
    } finally {
      setIsProcessing(false);
    }
  }, [importMode, defaultRiskPct, defaultSetup, excludeEtfs]);

  // Core file processing logic
  const handleFileSelected = (file) => {
    if (!file) return;

    // File Security Validation
    if (file.size > MAX_FILE_SIZE_BYTES) {
      showToast('File size exceeds the 10 MB limit.', 'error');
      return;
    }

    const fileName = file.name.toLowerCase();
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
    const isCsvOrTxt = fileName.endsWith('.csv') || fileName.endsWith('.txt');

    if (!isExcel && !isCsvOrTxt) {
      showToast('Only .xlsx, .xls, .csv, or .txt files are supported.', 'error');
      return;
    }

    setSelectedFile(file);

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const buffer = evt.target?.result;
          const csvText = convertWorkbookToCSV(buffer);
          if (!csvText) {
            showToast('Unable to extract data from Excel file.', 'error');
            return;
          }
          setRawCsvText(csvText);
          processCSVContent(csvText);
        } catch (err) {
          console.error('Excel parsing error:', err);
          showToast('Failed to parse Excel file. Ensure it is a valid .xlsx or .xls workbook.', 'error');
        }
      };
      reader.onerror = () => {
        showToast('Failed to read Excel file.', 'error');
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target?.result || '';
        setRawCsvText(text);
        processCSVContent(text);
      };
      reader.onerror = () => {
        showToast('Failed to read text/CSV file.', 'error');
      };
      reader.readAsText(file);
    }
  };

  // File Upload Handler with Security Validation (Supports CSV, XLSX, XLS, TXT)
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    handleFileSelected(file);
  };

  // HTML5 Drag and Drop Handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleFileSelected(file);
    }
  };

  // Re-run matching when settings change
  const handleSettingsChange = (newRiskPct, newSetup, newExcludeEtfs) => {
    setDefaultRiskPct(newRiskPct);
    setDefaultSetup(newSetup);
    setExcludeEtfs(newExcludeEtfs);
    if (rawCsvText) {
      processCSVContent(rawCsvText, importMode, newRiskPct, newSetup, newExcludeEtfs);
    }
  };

  // Toggle selection
  const toggleSelectPosition = (id) => {
    setSelectedPositionIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedPositionIds.size === previewPositions.length) {
      setSelectedPositionIds(new Set());
    } else {
      setSelectedPositionIds(new Set(previewPositions.map(p => p.id)));
    }
  };

  // Duplicate Check against existing journals
  const duplicateCheckMap = useMemo(() => {
    const map = new Set();
    existingJournals.forEach(trade => {
      trade.transactions?.forEach(tx => {
        map.add(`${trade.symbol.toUpperCase()}-${tx.date}-${tx.type}-${tx.qty}-${tx.price}`);
      });
    });
    return map;
  }, [existingJournals]);

  const isDuplicatePosition = useCallback((pos) => {
    return pos.transactions?.some(tx => {
      return duplicateCheckMap.has(`${pos.symbol.toUpperCase()}-${tx.date}-${tx.type}-${tx.qty}-${tx.price}`);
    });
  }, [duplicateCheckMap]);

  // Edit preview position field
  const updatePreviewPosition = (id, field, value) => {
    setPreviewPositions(prev => prev.map(p => {
      if (p.id !== id) return p;
      const updated = { ...p, [field]: value };
      if (field === 'initialStopLoss' && p.avgEntryPrice > 0 && value > 0) {
        const riskPerShare = p.avgEntryPrice - Number(value);
        const totalRisk = riskPerShare * (p.totalSold > 0 ? p.totalSold : p.totalBought);
        updated.rMultiple = totalRisk > 0 ? Number((p.realizedPnL / totalRisk).toFixed(2)) : 0;
      }
      return updated;
    }));
  };

  // Save selected positions to Journal
  const handleImportSave = () => {
    try {
      const toImport = previewPositions.filter(p => p && selectedPositionIds.has(p.id));
      if (toImport.length === 0) {
        showToast('Please select at least one trade to import.', 'warning');
        return;
      }

      const currentDate = new Date().toISOString().split('T')[0];

      // Convert preview positions to Journal schema with complete defensive type checking
      const newJournals = toImport.map(p => {
        const rawTxs = Array.isArray(p.transactions) && p.transactions.length > 0 ? p.transactions : [
          {
            id: `tx-imp-fallback-${Date.now().toString(36)}`,
            type: 'Buy',
            price: Number(p.avgEntryPrice || 0),
            qty: Number(p.totalBought || p.openQty || 1),
            date: currentDate,
            reason: 'Imported Entry'
          }
        ];

        const cleanTxs = rawTxs.map(tx => ({
          id: tx.id || `tx-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 4)}`,
          type: tx.type === 'Sell' ? 'Sell' : 'Buy',
          price: isNaN(Number(tx.price)) ? 0 : Number(tx.price),
          qty: isNaN(Number(tx.qty)) ? 0 : Number(tx.qty),
          date: tx.date || currentDate,
          reason: sanitizeString(tx.reason || 'Imported Execution')
        }));

        const cleanStop = (p.initialStopLoss !== null && p.initialStopLoss !== undefined && !isNaN(Number(p.initialStopLoss)) && Number(p.initialStopLoss) > 0)
          ? Number(p.initialStopLoss)
          : null;

        const cleanDays = (p.holdingDays !== null && p.holdingDays !== undefined && !isNaN(Number(p.holdingDays)) && Number(p.holdingDays) >= 0)
          ? Number(p.holdingDays)
          : null;

        return {
          id: `pos-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 4)}`,
          symbol: sanitizeString(p.symbol || 'UNKNOWN').toUpperCase(),
          setup: sanitizeString(p.setup || defaultSetup),
          initialStopLoss: cleanStop,
          currentStopLoss: null,
          notes: sanitizeString(p.notes || `Imported ${p.isClosed ? 'Closed' : 'Open'} position`),
          chartUrl: '',
          isScaling: Boolean(p.isScaling || cleanTxs.length > 2),
          isClosed: Boolean(p.isClosed),
          holdingDays: cleanDays,
          transactions: cleanTxs
        };
      });

      onImportSuccess(newJournals);
      showToast(`Successfully imported ${newJournals.length} trade position(s)!`, 'success');
      handleClose();
    } catch (err) {
      console.error('Import save error:', err);
      showToast(`Import failed: ${err.message || 'Error saving positions'}`, 'error');
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Import Trades (Beta) — India (IN)" maxWidth="modal-research !max-w-[1280px] !w-[94vw]">
      <div className="flex flex-col gap-5 p-1 text-slate-800 dark:text-slate-100">

        {/* Top Mode Selector & Settings Bar */}
        <div className="bg-slate-50 dark:bg-slate-900/70 p-4 rounded-xl border border-slate-200 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-wrap flex-1">
            <div className="flex flex-col gap-1 min-w-[220px]">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">Import Mode</label>
              <select
                value={importMode}
                onChange={(e) => {
                  const mode = e.target.value;
                  setImportMode(mode);
                  if (rawCsvText) processCSVContent(rawCsvText, mode);
                }}
                className="px-3 py-1.5 rounded-lg text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 shadow-sm"
              >
                <option value="zerodha_auto">Zerodha Tradebook / Tax P&L (Default)</option>
                <option value="ai_auto">AI Auto-Detect (Any Broker / Excel CSV)</option>
                <option value="generic">Generic TradeClarity CSV</option>
              </select>
            </div>

            <div className="flex flex-col gap-1 min-w-[180px]">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">Default Risk / Stop Loss %</label>
              <select
                value={defaultRiskPct}
                onChange={(e) => handleSettingsChange(Number(e.target.value), defaultSetup, excludeEtfs)}
                className="px-3 py-1.5 rounded-lg text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-200 shadow-sm"
              >
                <option value={0.05}>5% Risk Below Entry (Default)</option>
                <option value={0.08}>8% Risk Below Entry</option>
                <option value={0.03}>3% Risk Below Entry</option>
                <option value={0}>None / Manual Entry</option>
              </select>
            </div>

            <div className="flex flex-col gap-1 min-w-[150px]">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">Default Setup Tag</label>
              <input
                type="text"
                value={defaultSetup}
                onChange={(e) => handleSettingsChange(defaultRiskPct, e.target.value, excludeEtfs)}
                placeholder="e.g. Imported Trade"
                className="px-3 py-1.5 rounded-lg text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-semibold text-slate-800 dark:text-slate-200 shadow-sm"
              />
            </div>

            <div className="flex items-center gap-2 pt-5">
              <input
                type="checkbox"
                id="excludeEtfs"
                checked={excludeEtfs}
                onChange={(e) => handleSettingsChange(defaultRiskPct, defaultSetup, e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="excludeEtfs" className="text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer select-none">
                Exclude Liquid ETFs (<code className="text-[11px] font-mono text-blue-600 dark:text-blue-400 font-semibold">LIQUIDCASE</code>)
              </label>
            </div>
          </div>
        </div>

        {/* File Upload Drag and Drop Zone */}
        {!selectedFile && (
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all ${
              isDragOver
                ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 ring-4 ring-blue-500/20 scale-[1.01]'
                : 'border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 bg-slate-50/50 dark:bg-slate-900/30'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".csv,.xlsx,.xls,.txt"
              className="hidden"
            />
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 shadow-inner transition-colors ${
              isDragOver ? 'bg-blue-600 text-white shadow-blue-500/50' : 'bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400'
            }`}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-7 h-7">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </div>
            <p className="text-base font-bold text-slate-800 dark:text-slate-100">
              {isDragOver ? 'Drop file here to upload' : 'Click to upload or drag & drop Excel / CSV file'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Supports Zerodha Tradebooks, Zerodha Tax P&L Statements, and broker exports (.xlsx, .xls, .csv, .txt)
            </p>
          </div>
        )}

        {/* Processing Spinner & Parse Error */}
        {isProcessing && (
          <div className="flex items-center justify-center gap-3 p-8 text-blue-600 dark:text-blue-400 font-semibold text-sm">
            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            Analyzing CSV file and matching positions...
          </div>
        )}

        {parseError && (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-semibold">
            {parseError}
          </div>
        )}

        {/* AI Schema Detection Confirmation */}
        {showAiConfirm && aiMapping && (
          <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300 flex items-center justify-between">
            <div>
              <span className="font-bold">AI Schema Detected:</span> Symbol: <code>{aiMapping.symbolCol}</code> | Type: <code>{aiMapping.typeCol}</code> | Qty: <code>{aiMapping.qtyCol}</code> | Price: <code>{aiMapping.priceCol}</code>
            </div>
            <button
              onClick={() => setShowAiConfirm(false)}
              className="px-3 py-1 rounded-lg bg-blue-600 text-white font-bold text-xs"
            >
              Confirmed
            </button>
          </div>
        )}

        {/* Preview Table of Matched Positions */}
        {previewPositions.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800/60">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="selectAllPos"
                  checked={selectedPositionIds.size === previewPositions.length}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                />
                <label htmlFor="selectAllPos" className="text-xs font-bold text-slate-800 dark:text-slate-100 cursor-pointer flex items-center gap-2 select-none">
                  Select All ({selectedPositionIds.size} / {previewPositions.length} positions)
                  <span className="text-xs font-normal text-slate-500 dark:text-slate-400 flex items-center gap-1.5 ml-2">
                    <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-[10px]">
                      {previewPositions.filter(p => p.isClosed).length} Closed
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-semibold text-[10px]">
                      {previewPositions.filter(p => !p.isClosed).length} Active
                    </span>
                  </span>
                </label>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5 bg-slate-200/60 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-300/50 dark:border-slate-700/50">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="font-bold text-slate-700 dark:text-slate-200">{selectedFile?.name}</span>
                </div>
                <button
                  onClick={handleReset}
                  className="px-3 py-1.5 rounded-lg bg-blue-600/10 hover:bg-blue-600 text-blue-600 hover:text-white dark:bg-blue-500/20 dark:hover:bg-blue-600 dark:text-blue-400 dark:hover:text-white border border-blue-500/30 text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Change File
                </button>
              </div>
            </div>

            <div className="max-h-[380px] overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl shadow-inner">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800/90 font-bold text-xs text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700/80 backdrop-blur-md">
                  <tr>
                    <th className="p-3 w-10 text-center"></th>
                    <th className="p-3">Symbol</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Bought / Sold</th>
                    <th className="p-3 text-right">Avg Entry</th>
                    <th className="p-3 text-right">Avg Exit</th>
                    <th className="p-3 text-right">Realized PnL</th>
                    <th className="p-3 text-center">Holding Days</th>
                    <th className="p-3 text-center">Initial Stop Loss</th>
                    <th className="p-3">Setup Tag</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {previewPositions.map((pos) => {
                    const isSelected = selectedPositionIds.has(pos.id);
                    const isDup = isDuplicatePosition(pos);
                    const isWin = pos.realizedPnL > 0;

                    return (
                      <tr
                        key={pos.id}
                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors ${isSelected ? 'bg-blue-50/30 dark:bg-blue-950/20' : ''}`}
                      >
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectPosition(pos.id)}
                            className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                          />
                        </td>
                        <td className="p-3 font-bold font-mono text-slate-800 dark:text-slate-100">
                          <div className="flex items-center gap-1.5">
                            <span>{pos.symbol}</span>
                            {isDup && (
                              <span className="px-1.5 py-0.5 text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 rounded font-sans font-semibold">
                                Duplicate
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${pos.isClosed ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300' : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'}`}>
                            {pos.isClosed ? 'Closed' : 'Active'}
                          </span>
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                          {pos.totalBought} <span className="text-slate-400 font-normal">/</span> {pos.totalSold}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-slate-800 dark:text-slate-100">
                          ₹{pos.avgEntryPrice ? pos.avgEntryPrice.toFixed(2) : '0.00'}
                        </td>
                        <td className="p-3 text-right font-mono text-slate-500 font-semibold">
                          {pos.avgExitPrice > 0 ? `₹${pos.avgExitPrice.toFixed(2)}` : '—'}
                        </td>
                        <td className={`p-3 text-right font-mono font-bold ${isWin ? 'text-emerald-600 dark:text-emerald-400' : pos.realizedPnL < 0 ? 'text-rose-600 dark:text-rose-450' : 'text-slate-400'}`}>
                          {pos.realizedPnL !== 0 ? `₹${pos.realizedPnL.toFixed(2)} (${pos.pnlPct.toFixed(1)}%)` : '—'}
                        </td>
                        <td className="p-3 text-center font-mono text-slate-500 font-semibold">
                          {pos.holdingDays !== undefined && pos.holdingDays !== null && !isNaN(pos.holdingDays) && pos.holdingDays >= 0
                            ? `${pos.holdingDays} d`
                            : '—'}
                        </td>
                        <td className="p-3 text-center">
                          <input
                            type="number"
                            step="0.05"
                            value={pos.initialStopLoss || ''}
                            onChange={(e) => updatePreviewPosition(pos.id, 'initialStopLoss', Number(e.target.value))}
                            placeholder="Stop Loss"
                            className="w-24 px-2 py-1 text-center rounded-lg text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="text"
                            value={pos.setup || ''}
                            onChange={(e) => updatePreviewPosition(pos.id, 'setup', e.target.value)}
                            className="w-32 px-2 py-1 rounded-lg text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium text-slate-800 dark:text-slate-100"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setSelectedPositionIds(new Set())}
            disabled={selectedPositionIds.size === 0}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
          >
            Clear Selection
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleImportSave}
              disabled={selectedPositionIds.size === 0}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-blue-600/25 transition-all"
            >
              Import {selectedPositionIds.size} Position(s)
            </button>
          </div>
        </div>

      </div>
    </Modal>
  );
}
