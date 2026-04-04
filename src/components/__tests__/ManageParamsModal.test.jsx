import { describe, it, vi, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ManageParamsModal from '../ManageParamsModal';
import { ConfirmProvider } from '../ConfirmContext';

describe('ManageParamsModal', () => {
  const mockData = {
    paramDefinitions: {
      p1: { label: 'Price', type: 'number', countries: ['IN'] },
      p2: { label: 'Volume', type: 'number', countries: ['US'] }
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

  const renderWithProvider = (ui) => {
    return render(
      <ConfirmProvider>
        {ui}
      </ConfirmProvider>
    );
  };

  it('renders existing parameters correctly', () => {
    renderWithProvider(<ManageParamsModal {...props} />);
    expect(screen.getByText('Price')).toBeDefined();
    expect(screen.getByText('Volume')).toBeDefined();
    expect(screen.getByText('[IN]')).toBeDefined();
    expect(screen.getByText('[US]')).toBeDefined();
  });

  it('allows selecting countries when adding a new parameter', () => {
    renderWithProvider(<ManageParamsModal {...props} />);
    
    fireEvent.change(screen.getByPlaceholderText(/e.g. relativeStrength/i), { target: { value: 'p3' } });
    fireEvent.change(screen.getByPlaceholderText(/e.g. Relative Strength/i), { target: { value: 'New Param' } });
    
    // Select India (IN)
    fireEvent.click(screen.getByLabelText(/India \(IN\)/i));
    
    fireEvent.click(screen.getByText('Add Parameter'));
    
    expect(props.setData).toHaveBeenCalled();
    const updatedData = props.setData.mock.calls[0][0];
    expect(updatedData.paramDefinitions.p3).toBeDefined();
    expect(updatedData.paramDefinitions.p3.countries).toEqual(['IN']);
  });

  it('correctly handles global parameters (no selection)', () => {
    renderWithProvider(<ManageParamsModal {...props} />);
    
    fireEvent.change(screen.getByPlaceholderText(/e.g. relativeStrength/i), { target: { value: 'global' } });
    fireEvent.change(screen.getByPlaceholderText(/e.g. Relative Strength/i), { target: { value: 'Global Param' } });
    
    // No country selection (Global)
    fireEvent.click(screen.getByText('Add Parameter'));
    
    expect(props.setData).toHaveBeenCalled();
    const updatedData = props.setData.mock.calls[0][0];
    expect(updatedData.paramDefinitions.global.countries).toEqual([]);
  });

  it('shows error if internal name already exists', () => {
    renderWithProvider(<ManageParamsModal {...props} />);
    
    fireEvent.change(screen.getByPlaceholderText(/e.g. relativeStrength/i), { target: { value: 'p1' } });
    fireEvent.change(screen.getByPlaceholderText(/e.g. Relative Strength/i), { target: { value: 'Duplicate' } });
    
    fireEvent.click(screen.getByText('Add Parameter'));
    
    expect(screen.getByText(/Internal Name already exists/i)).toBeDefined();
    expect(props.setData).not.toHaveBeenCalled();
  });
});
