import { useState, useEffect } from 'react';
import Modal from './Modal';
import { testConnection, PROMPT_TEMPLATES } from '../services/ai';

const KNOWN_MODELS = [
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash (Free Default)", isPremium: false },
  { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro (Premium)", isPremium: true },
];

const SettingsModal = ({ isOpen, onClose, data, setData }) => {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [isCustomModel, setIsCustomModel] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Prompts State
  const [customPromptsList, setCustomPromptsList] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('swing');
  const [promptText, setPromptText] = useState('');
  const [promptName, setPromptName] = useState('');

  useEffect(() => {
    if (isOpen && data?.aiSettings) {
      const storedIsPro = localStorage.getItem("tc_is_pro") === "true";
      setIsPro(storedIsPro);

      const { apiKey: savedKey, model: savedModel, systemPrompt: savedPrompt, customPrompts: cList } = data.aiSettings;
      
      if (savedKey) setApiKey(savedKey);
      
      if (savedModel) {
        setModel(savedModel);
        const isKnown = KNOWN_MODELS.some((m) => m.value === savedModel);
        setIsCustomModel(!isKnown);
      } else {
        setModel(storedIsPro ? "gemini-1.5-pro" : "gemini-2.5-flash");
        setIsCustomModel(false);
      }

      const finalCustomList = cList || [];
      setCustomPromptsList(finalCustomList);
      const combined = [...PROMPT_TEMPLATES, ...finalCustomList];

      if (savedPrompt) {
        const matchedTemplate = combined.find(t => t.text === savedPrompt);
        if (matchedTemplate) {
          setSelectedTemplate(matchedTemplate.value);
          setPromptText(matchedTemplate.text);
          setPromptName(matchedTemplate.label);
        } else {
          // Assume it's a legacy unsaved custom text, wrap it into a new custom prompt
          setPromptText(savedPrompt);
          setPromptName("Legacy Custom Prompt");
          setSelectedTemplate("legacy_custom");
        }
      } else {
        setPromptText(PROMPT_TEMPLATES[0].text);
        setPromptName(PROMPT_TEMPLATES[0].label);
        setSelectedTemplate(PROMPT_TEMPLATES[0].value);
      }
    }
  }, [isOpen, data]);

  // Clear test result when inputs change
  useEffect(() => {
    setTestResult(null);
  }, [apiKey, model]);

  const handleSave = () => {
    localStorage.setItem("tc_is_pro", isPro);
    
    // Handle dynamic custom prompts
    let textToSave = promptText.trim();
    const isPredefined = PROMPT_TEMPLATES.find(t => t.value === selectedTemplate);

    let updatedCustom = [...customPromptsList];
    if (!isPredefined) {
      const existingIdx = updatedCustom.findIndex(c => c.value === selectedTemplate);
      if (existingIdx >= 0) {
        updatedCustom[existingIdx] = { ...updatedCustom[existingIdx], text: textToSave, label: promptName.trim() || 'Untitled' };
      } else {
        updatedCustom.push({ value: selectedTemplate, text: textToSave, label: promptName.trim() || 'Untitled' });
      }
      setCustomPromptsList(updatedCustom);
    }

    // Mutate global data state directly
    setData(prev => ({
      ...prev,
      aiSettings: {
        ...prev.aiSettings,
        apiKey: apiKey,
        model: model.trim() ? model.trim() : "",
        systemPrompt: textToSave || "",
        customPrompts: updatedCustom
      }
    }));

    setSaveStatus('Saved!');
    setTimeout(() => setSaveStatus(''), 2000);
  };

  const handleTest = async () => {
    if (!apiKey) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      await testConnection(apiKey, model);
      setTestResult({ success: true, message: "Connection successful!" });
    } catch (e) {
      setTestResult({ success: false, message: "Connection failed: " + e.message });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="AI Configuration" subtitle="Configure API keys and AI model settings">
      <div className="modal-body settings-modal-body">
        
        {testResult && (
          <div className={`status-banner ${testResult.success ? 'success' : 'error'}`}>
            <span className="status-banner-icon">{testResult.success ? "✅" : "❌"}</span>
            <span className="status-banner-text">{testResult.message}</span>
          </div>
        )}

        <div className="settings-card">
          <div className="form-field">
            <label htmlFor="apiKey" className="settings-label-v2">
              API Key
              <span className="info-icon" title="Your API key is stored locally in your browser.">ℹ️</span>
            </label>
            <div className="settings-input-group">
              <input
                type="password"
                id="apiKey"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Paste your Gemini API key here..."
                className="settings-input-v2"
              />
              <button
                type="button"
                className="outline settings-btn-v2"
                onClick={handleTest}
                disabled={isTesting || !apiKey}
              >
                {isTesting ? <div className="spinner-small" /> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>}
                {isTesting ? "Testing..." : "Test Connection"}
              </button>
            </div>
          </div>

          <div className="form-field" style={{ marginTop: "16px" }}>
            <label htmlFor="model" className="settings-label-v2">
              AI Model
              <span className="info-icon" title="Select the model architecture.">ℹ️</span>
            </label>

            {!isCustomModel ? (
              <select
                className="select-control settings-select-v2"
                id="model"
                value={model}
                onChange={(e) => {
                  if (e.target.value === "custom_option") {
                    setIsCustomModel(true);
                  } else {
                    setModel(e.target.value);
                  }
                }}
              >
                {KNOWN_MODELS.map((m) => (
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
                  id="model"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="e.g. gemini-1.5-pro"
                  className="settings-input-v2"
                  autoFocus
                />
                <button
                  type="button"
                  className="outline settings-btn-v2"
                  onClick={() => setIsCustomModel(false)}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="settings-card">
          <label className="settings-label-v2" style={{ marginBottom: '12px' }}>
            Analysis Strategy
            <span className="info-icon" title="Select or create instructions for AI analysis.">ℹ️</span>
          </label>
          
          <div className="settings-strategy-row">
            <div className="settings-strategy-col">
              <select
                className="select-control settings-select-v2"
                value={selectedTemplate}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'create_new') {
                    const newId = 'custom_' + Date.now();
                    setSelectedTemplate(newId);
                    setPromptName("New Custom Strategy");
                    setPromptText("");
                  } else {
                    setSelectedTemplate(val);
                    const allList = [...PROMPT_TEMPLATES, ...customPromptsList];
                    const matched = allList.find(t => t.value === val);
                    if (matched) {
                      setPromptText(matched.text);
                      setPromptName(matched.label);
                    }
                  }
                }}
              >
                <optgroup label="Default Strategies">
                  {PROMPT_TEMPLATES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </optgroup>
                {customPromptsList.length > 0 && (
                  <optgroup label="My Custom Strategies">
                    {customPromptsList.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </optgroup>
                )}
                {selectedTemplate === 'legacy_custom' && <option value="legacy_custom">Legacy Custom Prompt</option>}
                <option value="create_new" style={{ fontWeight: 'bold', color: 'var(--primary)' }}>+ Create New Strategy</option>
              </select>
            </div>

            {!PROMPT_TEMPLATES.find(t => t.value === selectedTemplate) && selectedTemplate !== 'create_new' && (
              <button
                type="button"
                className="outline danger settings-btn-danger-v2"
                onClick={() => {
                  if (window.confirm("Are you sure you want to delete this custom strategy?")) {
                    const updated = customPromptsList.filter(c => c.value !== selectedTemplate);
                    setCustomPromptsList(updated);
                    setData(prev => ({
                      ...prev,
                      aiSettings: {
                        ...prev.aiSettings,
                        customPrompts: updated
                      }
                    }));
                    setSelectedTemplate('swing');
                    setPromptText(PROMPT_TEMPLATES[0].text);
                    setPromptName(PROMPT_TEMPLATES[0].label);
                  }
                }}
                title="Delete Strategy"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            )}
          </div>

          {!PROMPT_TEMPLATES.find(t => t.value === selectedTemplate) && (
            <div style={{ marginBottom: '12px' }}>
              <label className="settings-display-name-label">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                Strategy Display Name
              </label>
              <input
                type="text"
                value={promptName}
                onChange={e => setPromptName(e.target.value)}
                placeholder="e.g. My Conservative Swing"
                className="settings-display-name-input"
              />
            </div>
          )}

          <textarea
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            disabled={!!PROMPT_TEMPLATES.find(t => t.value === selectedTemplate)}
            placeholder="Tell the AI how to analyze your stocks..."
            className={`settings-textarea ${PROMPT_TEMPLATES.find(t => t.value === selectedTemplate) ? 'is-template' : ''}`}
          />
          
          <div className="settings-variables-wrapper">
            <span className="settings-variables-label">Variables:</span>
            {['{stocks}', '{sectors}', '{tickers}'].map(v => (
              <code key={v} className="settings-variable-tag">{v}</code>
            ))}
          </div>
        </div>

        <div className="api-portal-card">
          <div className="api-portal-row">
            <div className="api-portal-brand">
               <img src="https://www.gstatic.com/lamda/images/favicon_v1_150160cddff7f294ce30.svg" alt="Gemini" width="18" height="18" />
               <span className="api-portal-title">Google Gemini API Portal</span>
            </div>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="api-key-link"
            >
              Get API Key
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>
            </a>
          </div>
        </div>

        <div className="settings-footer-note">
          Institutional-grade AI analysis powered by Google Gemini.
        </div>
      </div>

      <div className="modal-actions settings-modal-actions">
        <button type="button" className="outline settings-btn-v2" onClick={onClose}>Close</button>
        <button type="button" className="settings-btn-v2" onClick={handleSave} style={{ padding: '0 24px', fontWeight: '700' }}>
          {saveStatus ? "✓ Saved" : "Save Changes"}
        </button>
      </div>
    </Modal>
  );
};

export default SettingsModal;
