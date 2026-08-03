import { useState, useRef } from "react";
import Modal from "./Modal";
import { testConnection, PROMPT_TEMPLATES } from "../services/ai";
import { CONFIG } from "../constants/config";
import { useConfirm } from "./ConfirmContext";

const KNOWN_MODELS = CONFIG.MODELS;

const SettingsModal = ({ isOpen, onClose, data, setData, onOpenModal }) => {
  const [activeTab, setActiveTab] = useState("general");
  const [libraryCategory, setLibraryCategory] = useState("watchlist");
  const [apiKey, setApiKey] = useState(() => data?.aiSettings?.apiKey || "");
  const [model, setModel] = useState(() => data?.aiSettings?.model || CONFIG.DEFAULT_AI_MODEL);
  const [isCustomModel, setIsCustomModel] = useState(() => {
    const savedModel = data?.aiSettings?.model;
    if (savedModel) {
      return !KNOWN_MODELS.some((m) => m.value === savedModel);
    }
    return false;
  });
  const [isPro, setIsPro] = useState(() => data?.isPro || false);
  const [saveStatus, setSaveStatus] = useState("");
  const textareaRef = useRef(null);
  const { confirm } = useConfirm();
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Library State
  const [library, setLibrary] = useState(() => {
    const promptLibrary = data?.aiSettings?.promptLibrary;
    if (promptLibrary) {
      return structuredClone(promptLibrary);
    }
    return { watchlist: [], phenomena: [], stock: [] };
  });
  const [editingPromptId, setEditingPromptId] = useState(null);
  const [tempPrompt, setTempPrompt] = useState({ label: "", text: "" });

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [prevData, setPrevData] = useState(data);

  if (isOpen !== prevIsOpen || data !== prevData) {
    setPrevIsOpen(isOpen);
    setPrevData(data);
    if (isOpen && data?.aiSettings) {
      setIsPro(data.isPro || false);
      const { apiKey: savedKey, model: savedModel, promptLibrary } = data.aiSettings;

      setApiKey(savedKey || "");
      
      if (savedModel) {
        setModel(savedModel);
        const isKnown = KNOWN_MODELS.some((m) => m.value === savedModel);
        setIsCustomModel(!isKnown);
      } else {
        setModel(CONFIG.DEFAULT_AI_MODEL);
        setIsCustomModel(false);
      }

      if (promptLibrary) {
        setLibrary(structuredClone(promptLibrary));
      } else {
        setLibrary({ watchlist: [], phenomena: [], stock: [] });
      }
    }
  }

  const handleSave = () => {
    const apiKeyChanged = apiKey !== data?.aiSettings?.apiKey;
    setData((prev) => {
      const nextAiSettings = {
        ...prev.aiSettings,
        apiKey: apiKey,
        model: (model || "").trim(),
        promptLibrary: library,
      };
      if (apiKeyChanged) {
        nextAiSettings.aiState = { continuousFailures: 0, blockedUntil: 0 };
      }
      return {
        ...prev,
        isPro: isPro,
        aiSettings: nextAiSettings,
      };
    });
    setSaveStatus("Saved!");
    setTimeout(() => setSaveStatus(""), 2000);
  };

  const handleAddToLibrary = () => {
    if (!tempPrompt.label.trim() || !tempPrompt.text.trim()) return;
    
    const newPrompt = {
      id: "p_" + Date.now(),
      label: tempPrompt.label.trim(),
      text: tempPrompt.text.trim()
    };

    setLibrary(prev => ({
      ...prev,
      [libraryCategory]: [...(prev[libraryCategory] || []), newPrompt]
    }));
    setTempPrompt({ label: "", text: "" });
    setEditingPromptId(null);
  };

  const handleUpdatePrompt = () => {
    if (!tempPrompt.label.trim() || !tempPrompt.text.trim()) return;
    
    if (editingPromptId && String(editingPromptId).startsWith("system_")) {
      const newPrompt = {
        id: "p_" + Date.now(),
        label: tempPrompt.label.trim(),
        text: tempPrompt.text.trim()
      };
      setLibrary(prev => ({
        ...prev,
        [libraryCategory]: [...(prev[libraryCategory] || []), newPrompt]
      }));
    } else {
      setLibrary(prev => ({
        ...prev,
        [libraryCategory]: (prev[libraryCategory] || []).map(p => 
          p.id === editingPromptId ? { ...p, label: tempPrompt.label, text: tempPrompt.text } : p
        )
      }));
    }
    setTempPrompt({ label: "", text: "" });
    setEditingPromptId(null);
  };

  const handleSetDefault = (id) => {
    setLibrary(prev => ({
      ...prev,
      defaults: {
        ...(prev.defaults || {}),
        [libraryCategory]: id
      }
    }));
  };

  const handleClonePrompt = (prompt) => {
    const cloned = {
      ...prompt,
      id: "p_" + Date.now(),
      label: prompt.label + " (Copy)"
    };
    setLibrary(prev => ({
      ...prev,
      [libraryCategory]: [...(prev[libraryCategory] || []), cloned]
    }));
  };

  const handleDeletePrompt = async (id) => {
    if (await confirm("Delete this strategy from your library? This action cannot be undone.")) {
      setLibrary(prev => {
        const nextDefaults = { ...(prev.defaults || {}) };
        if (nextDefaults[libraryCategory] === id) {
          nextDefaults[libraryCategory] = "system";
        }
        return {
          ...prev,
          [libraryCategory]: (prev[libraryCategory] || []).filter(p => p.id !== id),
          defaults: nextDefaults
        };
      });
    }
  };

  const getSystemDefaults = (cat) => {
    if (cat === "watchlist") return PROMPT_TEMPLATES.filter(t => t.value === "swing" || t.value === "momentum");
    if (cat === "bulk") return PROMPT_TEMPLATES.filter(t => t.value === "bulk_analysis");
    if (cat === "phenomena") return [PROMPT_TEMPLATES.find(t => t.value === "phenomena")].filter(Boolean);
    if (cat === "stock") {
      return PROMPT_TEMPLATES.filter(t => t.value === "deep_view" || t.value === "daily_move");
    }
    return [];
  };

  const startEdit = (prompt) => {
    setEditingPromptId(prompt.id);
    setTempPrompt({ label: prompt.label, text: prompt.text });
  };

  const handleOpenGuide = (e) => {
    e.preventDefault();
    onClose();
    setTimeout(() => {
      if (onOpenModal) onOpenModal("guide", { initialTab: "ai_settings" });
    }, 100);
  };

  const getVariableHints = (cat) => {
    if (cat === "watchlist") return ["{stocks}", "{sectors}", "{tickers}"];
    if (cat === "phenomena") return ["{category}", "{tickers}"];
    return ["{symbol}", "{name}", "{price}", "{sector}", "{notes}"];
  };

  const insertVariable = (variable) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setTempPrompt(prev => ({ ...prev, text: prev.text + variable }));
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = tempPrompt.text;
    const before = text.substring(0, start);
    const after = text.substring(end);

    setTempPrompt(prev => ({
      ...prev,
      text: before + variable + after
    }));

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length, start + variable.length);
    }, 0);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="AI configuration"
      subtitle="Configure AI models and proprietary strategy libraries"
      className="modal-wide"
    >
      <div className="modal-tabs">
        <button className={`tab-btn ${activeTab === "general" ? "active" : ""}`} onClick={() => setActiveTab("general")}>General</button>
        <button className={`tab-btn ${activeTab === "library" ? "active" : ""}`} onClick={() => setActiveTab("library")}>Prompt Library</button>
      </div>

      <div className="modal-body settings-modal-body themed-scroll">
        {testResult && (
          <div className={`status-banner ${testResult.success ? "success" : "error"}`}>
            <span className="status-banner-icon">{testResult.success ? "✅" : "❌"}</span>
            <span className="status-banner-text">{testResult.message}</span>
          </div>
        )}

        {activeTab === "general" && (
          <div className="p-2">
              <div className="form-field">
                <label htmlFor="apiKey" className="settings-label-v2">
                  API Key
                  <span className="info-icon" title="Your API key is stored locally in your browser." />
                </label>
                <div className="settings-input-group">
                  <input id="apiKey" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Paste your Gemini API key here..." className="settings-input-v2" />
                  <button type="button" className="outline settings-btn-v2" onClick={async () => {
                    setIsTesting(true);
                    try { await testConnection(apiKey, model); setTestResult({ success: true, message: "Connection successful!" }); }
                    catch (e) { setTestResult({ success: false, message: e.message }); }
                    finally { setIsTesting(false); }
                  }}>
                    {isTesting ? "Testing..." : "Test Connection"}
                  </button>
                </div>
              </div>
              <div className="form-field mt-4">
                <label htmlFor="modelSelect" className="settings-label-v2">
                  AI Model
                  <span className="info-icon" title="Select the model architecture. Gemini 1.5 Pro is recommended for complex reasoning." />
                </label>
                
                {!isCustomModel ? (
                  <select 
                    id="modelSelect" 
                    className="select-control settings-select-v2" 
                    value={model} 
                    onChange={(e) => {
                      if (e.target.value === "custom_option") {
                        setIsCustomModel(true);
                        setModel("");
                      } else {
                        setModel(e.target.value);
                      }
                    }}
                  >
                    {KNOWN_MODELS.map(m => (
                      <option key={m.value} value={m.value} disabled={m.isPremium && !isPro}>
                        {m.label} {m.isPremium ? "(Premium)" : ""}
                      </option>
                    ))}
                    <option value="custom_option">Custom Model ID...</option>
                  </select>
                ) : (
                  <div className="settings-input-group">
                    <input
                      type="text"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder="e.g. gemini-1.5-pro"
                      className="settings-input-v2"
                      autoFocus
                    />
                    <button type="button" className="outline settings-btn-v2" onClick={() => {
                      setIsCustomModel(false);
                      setModel(CONFIG.DEFAULT_AI_MODEL);
                    }}>Cancel</button>
                  </div>
                )}
              </div>

              <div className="form-field mt-4 flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="isPro" 
                  checked={isPro} 
                  onChange={(e) => setIsPro(e.target.checked)} 
                  className="checkbox-control"
                />
                <label htmlFor="isPro" className="settings-label-v2 no-margin">
                  Enable Premium Features (Pro Mode)
                </label>
              </div>

              <div className="form-field mt-4">
                <label htmlFor="rsBenchmarkSetting" className="settings-label-v2">
                  Relative Strength (RS) Calculation Benchmark
                  <span className="info-icon" title="Choose the index preference used for auto-populating Relative Strength categories." />
                </label>
                <select
                  id="rsBenchmarkSetting"
                  className="select-control settings-select-v2"
                  value={data?.uiConfig?.rsBenchmarkSetting || 'auto'}
                  onChange={(e) => {
                    const val = e.target.value;
                    setData(prev => ({
                      ...prev,
                      uiConfig: {
                        ...(prev.uiConfig || {}),
                        rsBenchmarkSetting: val
                      }
                    }));
                  }}
                >
                  <option value="auto">Smart Auto (Nifty Smallcap for IN, Nasdaq/S&P by sector for US)</option>
                  <option value="main">Main Market Index (Nifty 50 for IN, S&P 500 for US)</option>
                  <option value="smallcap">Smallcap / Midcap Index (Nifty Mid/Smallcap for IN, Russell 2000 for US)</option>
                </select>
              </div>

              <div className="api-portal-card mt-6">
                <div className="api-portal-row">
                  <div className="api-portal-brand">
                    <img src="gemini_logo.svg" alt="Gemini" width="18" height="18" />
                    <span className="api-portal-title">Google Gemini API Portal</span>
                  </div>
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="api-key-link flex items-center gap-1">
                    Get API Key
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="7" y1="17" x2="17" y2="7"></line>
                      <polyline points="7 7 17 7 17 17"></polyline>
                    </svg>
                  </a>
                </div>
              </div>
          </div>
        )}

        {activeTab === "library" && (
          <div className="library-container">
            <div className="library-sidebar-tabs">
              <button className={`lib-cat-btn ${libraryCategory === "watchlist" ? "active" : ""}`} onClick={() => { setLibraryCategory("watchlist"); setEditingPromptId(null); }}>Watchlist Summary</button>
              <button className={`lib-cat-btn ${libraryCategory === "bulk" ? "active" : ""}`} onClick={() => { setLibraryCategory("bulk"); setEditingPromptId(null); }}>Background Bulk AI</button>
              <button className={`lib-cat-btn ${libraryCategory === "phenomena" ? "active" : ""}`} onClick={() => { setLibraryCategory("phenomena"); setEditingPromptId(null); }}>Phenomena</button>
              <button className={`lib-cat-btn ${libraryCategory === "stock" ? "active" : ""}`} onClick={() => { setLibraryCategory("stock"); setEditingPromptId(null); }}>Single Stock</button>
            </div>

            <div className="library-content">
              <div className="prompt-editor-mini">
                <div className="form-field">
                  <input 
                    type="text" 
                    placeholder="Strategy Name (e.g. VCP Breakout)" 
                    value={tempPrompt.label} 
                    onChange={e => setTempPrompt(prev => ({ ...prev, label: e.target.value }))}
                  />
                </div>
                <div className="textarea-wrapper">
                  <textarea 
                    ref={textareaRef}
                    className="settings-textarea mt-2 prompt-mini-textarea" 
                    placeholder="Enter AI instructions..."
                    value={tempPrompt.text}
                    onChange={e => setTempPrompt(prev => ({ ...prev, text: e.target.value }))}
                  />
                  <div className="textarea-footer">
                    <span className="char-count">{tempPrompt.text.length} characters</span>
                  </div>
                </div>
                <div className="flex justify-between items-center mt-2">
                   <div className="settings-variables-wrapper no-margin">
                    {getVariableHints(libraryCategory).map(v => (
                      <code 
                        key={v} 
                        className="settings-variable-tag clickable-var" 
                        onClick={() => insertVariable(v)}
                        title={`Click to insert ${v}`}
                      >
                        {v}
                      </code>
                    ))}
                  </div>
                  <button className="small" onClick={editingPromptId ? handleUpdatePrompt : handleAddToLibrary}>
                    {editingPromptId 
                       ? (String(editingPromptId).startsWith("system_") ? "+ Add to Library" : "Update Prompt") 
                       : "+ Add to Library"
                     }
                  </button>
                </div>
              </div>

              <div className="library-list mt-4">
                <div className="flex justify-between items-end mb-2">
                   <h4 className="section-title-small no-margin">Strategy library</h4>
                   <span className="text-xs text-muted">{(library[libraryCategory]?.length || 0) + getSystemDefaults(libraryCategory).length} Available</span>
                </div>

                {/* System Default Items */}
                {getSystemDefaults(libraryCategory).map((sys) => {
                  const currentDefault = library.defaults?.[libraryCategory] || "system";
                  const isPrimaryDefault = sys.value === "deep_view" || sys.value === "swing" || sys.value === "bulk_analysis" || sys.value === "phenomena";
                  const isDefault = (isPrimaryDefault && (currentDefault === "system" || currentDefault === "default" || currentDefault === sys.value)) || (currentDefault === sys.value);
                  const defaultValueToSet = isPrimaryDefault ? "system" : sys.value;
                  return (
                    <div key={sys.value} className={`library-item-card system-default ${isDefault ? "is-active-default" : ""}`}>
                      <div className="lib-item-info">
                        <div className="flex items-center gap-2">
                          <strong>{sys.label}</strong>
                          <span className="badge-system">System default</span>
                          {isDefault && <span className="badge-active-default">Active default</span>}
                        </div>
                        <p className="lib-item-preview">{sys.text.substring(0, 100)}...</p>
                      </div>
                      <div className="lib-item-actions">
                        {!isDefault && (
                          <button className="outline btn-tiny" onClick={() => handleSetDefault(defaultValueToSet)}>
                            Set as Default
                          </button>
                        )}
                        <button className="outline icon-btn" onClick={() => {
                          setEditingPromptId(`system_${sys.value}`);
                          setTempPrompt({ label: sys.label, text: sys.text });
                        }} title="View/Copy">
                           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Custom User Prompts */}
                {(library[libraryCategory] || []).map(p => {
                  const isDefault = library.defaults?.[libraryCategory] === p.id;
                  return (
                    <div key={p.id} className={`library-item-card ${isDefault ? "is-active-default" : ""}`}>
                      <div className="lib-item-info">
                        <div className="flex items-center gap-2">
                          <strong>{p.label}</strong>
                          {isDefault && <span className="badge-active-default">Active default</span>}
                        </div>
                        <p className="lib-item-preview">{p.text.substring(0, 100)}...</p>
                      </div>
                      <div className="lib-item-actions">
                        {!isDefault && (
                          <button className="outline btn-tiny" onClick={() => handleSetDefault(p.id)}>
                            Set as Default
                          </button>
                        )}
                        <button className="outline icon-btn" onClick={() => handleClonePrompt(p)} title="Clone/Duplicate">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        </button>
                        <button className="outline icon-btn" onClick={() => startEdit(p)} title="Edit">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                        </button>
                        <button className="outline danger icon-btn" onClick={() => handleDeletePrompt(p.id)} title="Delete">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div className="settings-footer-note mt-4 flex justify-between items-center text-xs text-muted">
          <span>AI strategies define your analytical edge. Be specific in your instructions.</span>
          <span>
            Need help?{" "}
            <a
              href="#"
              onClick={handleOpenGuide}
              className="text-primary underline hover:text-primary-light"
              style={{ cursor: "pointer" }}
            >
              Read Prompt Guide
            </a>
          </span>
        </div>
      </div>

      <div className="modal-actions settings-modal-actions">
        <button
          type="button"
          className="outline settings-btn-v2"
          onClick={onClose}
        >
          Close
        </button>
        <button
          type="button"
          className="settings-btn-v2 settings-save-btn"
          onClick={handleSave}
        >
          {saveStatus ? "✓ Saved" : "Save Changes"}
        </button>
      </div>
    </Modal>
  );
};

export default SettingsModal;
