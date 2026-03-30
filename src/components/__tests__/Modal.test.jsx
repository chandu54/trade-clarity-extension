import { describe, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Modal from '../Modal';

describe('Modal', () => {
  it('should not render if not open', () => {
    const { container } = render(
      <Modal isOpen={false} title="Test Title">
        <div>Content</div>
      </Modal>
    );
    expect(container.firstChild).toBeNull();
  });

  it('should render title and children when open', () => {
    render(
      <Modal isOpen={true} title="Test Title">
        <div>Test Content</div>
      </Modal>
    );
    expect(screen.getByText('Test Title')).toBeDefined();
    expect(screen.getByText('Test Content')).toBeDefined();
  });

  it('should call onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<Modal isOpen={true} title="Title" onClose={onClose} />);
    const closeBtn = screen.getByText('×');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('should call onClose when overlay is clicked', () => {
    const onClose = vi.fn();
    render(<Modal isOpen={true} title="Title" onClose={onClose} />);
    
    // Find the modal box by role, then its parent (the overlay)
    const modalBox = screen.getByRole('dialog');
    const overlay = modalBox.parentElement;
    
    expect(overlay).toHaveClass('modal-overlay');
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it('should call onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    render(<Modal isOpen={true} title="Title" onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
