import { describe, it, vi, beforeEach, expect } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import ManageTagsModal from '../ManageTagsModal';
import { ToastContext } from '../ToastContext';
import { ConfirmContext } from '../ConfirmContext';

const mockShowToast = vi.fn();
const mockConfirm = vi.fn();

const renderWithContext = (ui) => {
  return render(
    <ToastContext.Provider value={{ showToast: mockShowToast }}>
      <ConfirmContext.Provider value={{ confirm: mockConfirm }}>
        {ui}
      </ConfirmContext.Provider>
    </ToastContext.Provider>
  );
};

describe('ManageTagsModal', () => {
  const mockData = {
    uiConfig: {
      tags: ['AI: BUY', 'Growth', 'Value', 'ai: sell'],
      showTags: true
    },
    weeks: {}
  };

  const props = {
    data: mockData,
    setData: vi.fn(),
    onClose: vi.fn(),
    isOpen: true
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly and filters out AI tags from listing', () => {
    renderWithContext(<ManageTagsModal {...props} />);
    expect(screen.getByText('Manage Tags')).toBeDefined();
    
    // Normal tags should render
    expect(screen.getByText('Growth')).toBeDefined();
    expect(screen.getByText('Value')).toBeDefined();

    // AI tags should be filtered out from user selector list
    expect(screen.queryByText('AI: BUY')).toBeNull();
    expect(screen.queryByText('ai: sell')).toBeNull();
  });

  it('blocks adding a tag starting with AI:', () => {
    renderWithContext(<ManageTagsModal {...props} />);
    
    const input = screen.getByPlaceholderText('New tag name...');
    fireEvent.change(input, { target: { value: 'AI: NewTag' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(mockShowToast).toHaveBeenCalledWith("Cannot create tags starting with 'AI:'", "warning");
    expect(props.setData).not.toHaveBeenCalled();
  });

  it('blocks adding a tag starting with ai: (case-insensitive)', () => {
    renderWithContext(<ManageTagsModal {...props} />);
    
    const input = screen.getByPlaceholderText('New tag name...');
    fireEvent.change(input, { target: { value: 'ai: custom' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(mockShowToast).toHaveBeenCalledWith("Cannot create tags starting with 'AI:'", "warning");
    expect(props.setData).not.toHaveBeenCalled();
  });

  it('allows adding a valid tag', () => {
    renderWithContext(<ManageTagsModal {...props} />);
    
    const input = screen.getByPlaceholderText('New tag name...');
    fireEvent.change(input, { target: { value: 'Momentum' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(props.setData).toHaveBeenCalled();
    const updatedData = props.setData.mock.calls[0][0];
    expect(updatedData.uiConfig.tags).toContain('Momentum');
  });

  it('handles delete confirmation and deletes tag', async () => {
    mockConfirm.mockResolvedValue(true);
    renderWithContext(<ManageTagsModal {...props} />);

    // Click remove button for "Growth"
    const tagsContainer = screen.getByText('Growth').closest('.tag-chip-manage');
    const deleteBtn = within(tagsContainer).getByRole('button');
    
    await act(async () => {
      fireEvent.click(deleteBtn);
    });

    expect(mockConfirm).toHaveBeenCalledWith('Delete tag "Growth"?');
    expect(props.setData).toHaveBeenCalled();
    
    const updatedData = props.setData.mock.calls[0][0];
    expect(updatedData.uiConfig.tags).not.toContain('Growth');
    // AI tags must remain in the data structure unchanged
    expect(updatedData.uiConfig.tags).toContain('AI: BUY');
  });
});
