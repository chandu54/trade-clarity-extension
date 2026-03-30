import { describe, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import Header from '../Header';
import { ConfirmContext } from '../ConfirmContext';

// Mock the ConfirmContext
const mockConfirm = vi.fn();

const renderWithContext = (ui) => {
  return render(
    <ConfirmContext.Provider value={{ confirm: mockConfirm }}>
      {ui}
    </ConfirmContext.Provider>
  );
};

describe('Header', () => {
  const props = {
    onOpenModal: vi.fn(),
    onClearAll: vi.fn(),
    onManageTags: vi.fn(),
    onManageWatchlists: vi.fn(),
    theme: 'light',
    onToggleTheme: vi.fn(),
    onShowSettings: vi.fn(),
    onShowUserGuide: vi.fn(),
    country: 'US',
    setCountry: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders app name and tagline', () => {
    renderWithContext(<Header {...props} />);
    expect(screen.getByText('TradeClarity')).toBeDefined();
    expect(screen.getByText(/Your disciplined path/i)).toBeDefined();
  });

  it('toggles theme when clicking theme icon', () => {
    renderWithContext(<Header {...props} />);
    const themeBtn = screen.getByTitle(/Switch to Dark Theme/i);
    fireEvent.click(themeBtn);
    expect(props.onToggleTheme).toHaveBeenCalled();
  });

  it('opens and closes settings menu', () => {
    renderWithContext(<Header {...props} />);
    const settingsBtn = screen.getByText('Settings');
    
    // Open
    fireEvent.click(settingsBtn);
    expect(screen.getByText('Parameters')).toBeDefined();
    
    // Close by clicking outside
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('Parameters')).toBeNull();
  });

  it('calls onOpenModal when menu item is clicked', () => {
    renderWithContext(<Header {...props} />);
    fireEvent.click(screen.getByText('Settings'));
    fireEvent.click(screen.getByText('Parameters'));
    expect(props.onOpenModal).toHaveBeenCalledWith('params');
  });

  it('calls onManageTags when Tags is clicked', () => {
    renderWithContext(<Header {...props} />);
    fireEvent.click(screen.getByText('Settings'));
    fireEvent.click(screen.getByText('Tags'));
    expect(props.onManageTags).toHaveBeenCalled();
  });

  it('shows confirmation before clearing all', async () => {
    mockConfirm.mockResolvedValue(true);
    renderWithContext(<Header {...props} />);
    
    const resetBtn = screen.getByText('Reset All');
    await act(async () => {
      fireEvent.click(resetBtn);
    });
    
    expect(mockConfirm).toHaveBeenCalled();
    expect(props.onClearAll).toHaveBeenCalled();
  });

  it('switches country when region menu is used', () => {
    renderWithContext(<Header {...props} />);
    const regionBtn = screen.getByTitle('Change Region');
    fireEvent.click(regionBtn);
    
    const indiaBtn = screen.getByText('India');
    fireEvent.click(indiaBtn);
    
    expect(props.setCountry).toHaveBeenCalledWith('IN');
  });
});
