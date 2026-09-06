import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MultiSelectDropdown from '../MultiSelectDropdown';

describe('MultiSelectDropdown', () => {
  const options = ['Renewable Energy', 'Artificial Intelligence', 'Defense', 'Semiconductors'];

  it('renders trigger button with placeholder when empty', () => {
    render(<MultiSelectDropdown options={options} value={[]} onChange={vi.fn()} placeholder="Select scopes..." />);
    expect(screen.getByText('Select scopes...')).toBeDefined();
  });

  it('shows options and search bar when opened', () => {
    render(<MultiSelectDropdown options={options} value={[]} onChange={vi.fn()} />);
    const trigger = screen.getByRole('button');
    fireEvent.click(trigger);

    expect(screen.getByPlaceholderText('Search...')).toBeDefined();
    expect(screen.getByText('Renewable Energy')).toBeDefined();
    expect(screen.getByText('Artificial Intelligence')).toBeDefined();
  });

  it('filters options based on search query', () => {
    render(<MultiSelectDropdown options={options} value={[]} onChange={vi.fn()} />);
    const trigger = screen.getByRole('button');
    fireEvent.click(trigger);

    const searchInput = screen.getByPlaceholderText('Search...');
    fireEvent.change(searchInput, { target: { value: 'Semi' } });

    expect(screen.getByText('Semiconductors')).toBeDefined();
    expect(screen.queryByText('Renewable Energy')).toBeNull();
  });

  it('calls onChange with selected item when option is clicked', () => {
    const handleChange = vi.fn();
    render(<MultiSelectDropdown options={options} value={[]} onChange={handleChange} />);
    const trigger = screen.getByRole('button');
    fireEvent.click(trigger);

    const optionItem = screen.getByText('Defense');
    fireEvent.click(optionItem);

    expect(handleChange).toHaveBeenCalledWith(['Defense']);
  });
});
