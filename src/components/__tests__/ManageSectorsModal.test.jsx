import { describe, it, vi, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ManageSectorsModal from '../ManageSectorsModal';

describe('ManageSectorsModal', () => {
  const mockData = {
    uiConfig: {
      sectors: [
        { name: "Finance", countries: ["IN", "US"] },
        { name: "Technology", countries: ["US"] }
      ]
    },
    sectors: [
      { name: "Finance", countries: ["IN", "US"] },
      { name: "Technology", countries: ["US"] }
    ]
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

  it('renders correctly with existing sectors', () => {
    render(<ManageSectorsModal {...props} />);
    expect(screen.getByText('Manage Sectors')).toBeDefined();
    expect(screen.getByDisplayValue('Finance')).toBeDefined();
    expect(screen.getByDisplayValue('Technology')).toBeDefined();
  });

  it('adds a new sector when clicking "+ Add New Sector"', () => {
    render(<ManageSectorsModal {...props} />);
    fireEvent.click(screen.getByText('+ Add New Sector'));
    
    // Check if setData was called with the new empty sector
    expect(props.setData).toHaveBeenCalled();
    const lastCall = props.setData.mock.calls[0][0];
    expect(lastCall.uiConfig.sectors.length).toBe(3);
    expect(lastCall.uiConfig.sectors[2].name).toBe("");
  });

  it('shows error if a sector name is empty', () => {
    const emptyData = {
      uiConfig: { sectors: [{ name: "", countries: ["IN"] }] },
      sectors: [{ name: "", countries: ["IN"] }]
    };
    render(<ManageSectorsModal {...props} data={emptyData} />);
    
    expect(screen.getByText((content) => content.includes("Sector category name(s) required"))).toBeDefined();
    
    // Buttons should be disabled
    const closeBtn = screen.getByText('Close');
    const addBtn = screen.getByText('+ Add New Sector');
    expect(closeBtn.hasAttribute('disabled')).toBe(true);
    expect(addBtn.hasAttribute('disabled')).toBe(true);
  });

  it('shows error if a duplicate sector name is entered (case-insensitive)', () => {
    const duplicateData = {
      uiConfig: { 
        sectors: [
          { name: "Finance", countries: ["IN"] },
          { name: "finance", countries: ["US"] }
        ] 
      },
      sectors: [
        { name: "Finance", countries: ["IN"] },
        { name: "finance", countries: ["US"] }
      ]
    };
    render(<ManageSectorsModal {...props} data={duplicateData} />);
    
    expect(screen.getByText((content) => content.includes("Duplicate sector names detected"))).toBeDefined();
    
    // Close button should be disabled
    const closeBtn = screen.getByText('Close');
    expect(closeBtn.hasAttribute('disabled')).toBe(true);
  });

  it('updates sector name on input change', () => {
    render(<ManageSectorsModal {...props} />);
    const input = screen.getByDisplayValue('Finance');
    
    fireEvent.change(input, { target: { value: 'Fintech' } });
    
    expect(props.setData).toHaveBeenCalled();
    const updatedData = props.setData.mock.calls[0][0];
    expect(updatedData.uiConfig.sectors[0].name).toBe('Fintech');
  });

  it('toggles country scoping correctly', () => {
    render(<ManageSectorsModal {...props} />);
    
    // The first row (Finance) has IN and US checked.
    // Get all checkboxes and toggle India for 'Finance'
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]); // First checkbox is India for Finance
    
    expect(props.setData).toHaveBeenCalled();
    const updatedData = props.setData.mock.calls[0][0];
    // Finance should now only have US
    expect(updatedData.uiConfig.sectors[0].countries).toEqual(["US"]);
  });

  it('deletes a sector correctly', () => {
    render(<ManageSectorsModal {...props} />);
    
    // Find all delete buttons (labels may vary, but they use TrashIcon)
    const deleteBtns = screen.getAllByTitle('Delete sector');
    fireEvent.click(deleteBtns[0]); // Delete Finance
    
    expect(props.setData).toHaveBeenCalled();
    const updatedData = props.setData.mock.calls[0][0];
    expect(updatedData.uiConfig.sectors.length).toBe(1);
    expect(updatedData.uiConfig.sectors[0].name).toBe('Technology');
  });

  it('allows closing only when there are no validation errors', () => {
    render(<ManageSectorsModal {...props} />);
    
    const closeBtn = screen.getByText('Close');
    expect(closeBtn.hasAttribute('disabled')).toBe(false);
    
    fireEvent.click(closeBtn);
    expect(props.onClose).toHaveBeenCalled();
  });
});
