import { useState, useEffect } from 'react';
import Modal from './Modal';
import { setStoredApiKey, getStoredApiKey, setStoredModel, getStoredModel } from '../services/storage';
import { testConnection } from '../services/ai';

const KNOWN_MODELS = [
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash (Free Default)", isPremium: false },
];

const SettingsModal = ({ isOpen, onClose }) => {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [isCustomModel, setIsCustomModel] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    if (isOpen) {
      const storedIsPro = localStorage.getItem("tc_is_pro") === "true";
      setIsPro(storedIsPro);

      Promise.all([getStoredApiKey(), getStoredModel()]).then(([key, savedModel]) => {
        if (key) setApiKey(key);
        if (savedModel) {
          setModel(savedModel);
          const isKnown = KNOWN_MODELS.some((m) => m.value === savedModel);
          setIsCustomModel(!isKnown);
        } else {
          setModel(storedIsPro ? "gemini-2.0-pro" : "gemini-2.5-flash");
          setIsCustomModel(false);
        }
      });
    }
  }, [isOpen]);

  // Clear test result when inputs change
  useEffect(() => {
    setTestResult(null);
  }, [apiKey, model]);

  const handleSave = async () => {
    localStorage.setItem("tc_is_pro", isPro);
    await setStoredApiKey(apiKey);
    
    // Only save model if it's not empty, otherwise we'll let the app use the default
    if (model.trim()) {
      await setStoredModel(model.trim());
    } else {
      await setStoredModel(""); // Clear it to use default
    }
    
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
      <div className="modal-body">
        {testResult && (
          <div style={{ 
            marginBottom: "16px", 
            padding: "8px 12px", 
            borderRadius: "6px", 
            fontSize: "13px",
            backgroundColor: testResult.success ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
            color: testResult.success ? "#059669" : "#dc2626",
            border: `1px solid ${testResult.success ? "#10b981" : "#ef4444"}`
          }}>
            {testResult.success ? "✅ " : "❌ "}
            {testResult.message}
          </div>
        )}
        <div className="form-field">
          <label htmlFor="apiKey">
            API Key
            <span className="info-icon" title="Your API key is stored locally in your browser and sent directly to the AI provider.">ℹ️</span>
          </label>
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              type="password"
              id="apiKey"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              autoFocus
              style={{ flex: 1 }}
            />
            <button 
              className="outline"
              onClick={handleTest} 
              disabled={isTesting || !apiKey} 
              title="Verify API Key"
              style={{ padding: "0 16px", whiteSpace: "nowrap" }}
            >
              {isTesting ? "Verifying..." : "Verify Key"}
            </button>
          </div>
          {saveStatus && (
            <div style={{ color: "var(--success)", fontSize: "12px", marginTop: "6px", fontWeight: "600" }}>
              {saveStatus}
            </div>
          )}
        </div>
        <div className="form-field" style={{ marginTop: "16px" }}>
          <label htmlFor="model">
            AI Model
            <span className="info-icon" title="The specific AI model to use. Leave empty to use the default.">ℹ️</span>
          </label>

          {!isCustomModel ? (
            <div style={{ display: "flex", gap: "8px" }}>
              <select
                className="select-control"
                id="model"
                value={model}
                onChange={(e) => {
                  if (e.target.value === "custom_option") {
                    setIsCustomModel(true);
                  } else {
                    setModel(e.target.value);
                  }
                }}
                style={{ flex: 1 }}
              >
                {KNOWN_MODELS.map((m) => (
                  <option key={m.value} value={m.value} disabled={m.isPremium && !isPro}>
                    {m.label} {m.isPremium ? "(Premium)" : ""}
                  </option>
                ))}
                <option value="custom_option">Custom...</option>
              </select>
            </div>
          ) : (
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                id="model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. gemini-1.5-pro"
                style={{ flex: 1 }}
                autoFocus
              />
              <button
                className="outline"
                onClick={() => {
                  setIsCustomModel(false);
                  const isKnown = KNOWN_MODELS.some((m) => m.value === model);
                  if (!isKnown) setModel("");
                }}
                title="Back to list"
              >
                Cancel
              </button>
            </div>
          )}

          {model && isCustomModel && (
            <div className="muted small" style={{ marginTop: "4px" }}>
              Using custom model: <strong>{model}</strong>
            </div>
          )}
        </div>

        <div style={{ marginTop: "20px", padding: "14px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "8px" }}>
          <h4 style={{ margin: "0 0 10px", fontSize: "13px", fontWeight: "600" }}>Get your API Key</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Google Gemini</span>
              <a 
                href="https://aistudio.google.com/app/apikey" 
                target="_blank" 
                rel="noreferrer" 
                className="primary-btn"
                style={{ padding: "4px 10px", fontSize: "12px", textDecoration: "none" }}
              >
                Get Key ↗
              </a>
            </div>
            <div style={{ height: "1px", background: "var(--border)" }} />
            {/* <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>OpenAI</span>
              <a 
                href="https://platform.openai.com/api-keys" 
                target="_blank" 
                rel="noreferrer" 
                className="primary-btn"
                style={{ padding: "4px 10px", fontSize: "12px", textDecoration: "none" }}
              >
                Get Key ↗
              </a>
            </div> */}
          </div>
        </div>

        <div className="muted small" style={{ marginTop: "16px", lineHeight: "1.4" }}>
          <strong>Note:</strong> The provider (Google/OpenAI) is automatically detected based on your API key format.
        </div>
      </div>

      <div className="modal-actions">
        <button className="outline" onClick={onClose}>Close</button>
        <button onClick={handleSave}>Save Settings</button>
      </div>
    </Modal>
  );
};

export default SettingsModal;
