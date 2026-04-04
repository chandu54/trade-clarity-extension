import { describe, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import SettingsModal from '../SettingsModal';
import * as aiService from '../../services/ai';

// Mock AI service
vi.mock('../../services/ai', () => ({
  testConnection: vi.fn(),
  PROMPT_TEMPLATES: [
    { value: 'swing', label: 'Swing Trading', text: 'Swing prompt' }
  ]
}));

describe('SettingsModal', () => {
  const mockData = {
    aiSettings: {
      apiKey: 'gemini-api-key-39-characters-long-xxxx',
      model: 'gemini-2.5-flash',
      systemPrompt: 'Swing prompt',
      customPrompts: []
    }
  };

  const props = {
    isOpen: true,
    onClose: vi.fn(),
    data: mockData,
    setData: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders correctly with saved settings', async () => {
    render(<SettingsModal {...props} />);
    expect(screen.getByPlaceholderText(/Gemini API key/i).value).toBe('gemini-api-key-39-characters-long-xxxx');
    expect(await screen.findByDisplayValue(/Gemini 2.5 Flash/i)).toBeDefined();
  });

  it('updates state when inputs change', () => {
    render(<SettingsModal {...props} />);
    const apiKeyInput = screen.getByPlaceholderText(/Gemini API key/i);
    fireEvent.change(apiKeyInput, { target: { value: 'new-gemini-api-key-39-characters-long' } });
    expect(apiKeyInput.value).toBe('new-gemini-api-key-39-characters-long');
  });

  it('calls testConnection when Test button is clicked', async () => {
    aiService.testConnection.mockResolvedValue(true);
    render(<SettingsModal {...props} />);
    
    const testBtn = screen.getByText('Test Connection');
    fireEvent.click(testBtn);

    expect(screen.getByText('Testing...')).toBeDefined();

    await act(async () => {
      await Promise.resolve();
    });

    expect(aiService.testConnection).toHaveBeenCalledWith('gemini-api-key-39-characters-long-xxxx', 'gemini-2.5-flash');
    expect(screen.getByText('Connection successful!')).toBeDefined();
  });

  it('calls setData when Save Changes is clicked', () => {
    render(<SettingsModal {...props} />);
    
    const apiKeyInput = screen.getByPlaceholderText(/Gemini API key/i);
    fireEvent.change(apiKeyInput, { target: { value: 'saved-gemini-api-key-39-characters-long' } });
    
    fireEvent.click(screen.getByText('Save Changes'));
    
    expect(props.setData).toHaveBeenCalled();
    const updatedData = props.setData.mock.calls[0][0](mockData);
    expect(updatedData.aiSettings.apiKey).toBe('saved-gemini-api-key-39-characters-long');
  });

  it('handles custom model ID correctly', () => {
    render(<SettingsModal {...props} />);
    
    const modelSelect = screen.getByLabelText(/AI Model/i);
    fireEvent.change(modelSelect, { target: { value: 'custom_option' } });
    
    const customInput = screen.getByPlaceholderText(/e.g. gemini-1.5-pro/i);
    fireEvent.change(customInput, { target: { value: 'my-custom-model' } });
    
    fireEvent.click(screen.getByText('Save Changes'));
    
    const updatedData = props.setData.mock.calls[0][0](mockData);
    expect(updatedData.aiSettings.model).toBe('my-custom-model');
  });
});
