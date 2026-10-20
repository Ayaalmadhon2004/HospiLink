import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmModal } from '../ConfirmModal';

const base = { title: 'Delete patient', message: 'This cannot be undone' };

describe('ConfirmModal', () => {
  it('renders nothing when closed', () => {
    render(<ConfirmModal {...base} isOpen={false} onClose={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders title, message and default labels when open', () => {
    render(<ConfirmModal {...base} isOpen onClose={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Delete patient')).toBeInTheDocument();
    expect(screen.getByText('This cannot be undone')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('calls onConfirm then onClose on confirm', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(<ConfirmModal {...base} isOpen onClose={onClose} onConfirm={onConfirm} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('keeps the modal open when onConfirm rejects', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('fail'));
    const onClose = vi.fn();
    render(<ConfirmModal {...base} isOpen onClose={onClose} onConfirm={onConfirm} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: 'Confirm' })).toBeEnabled();
  });

  it('calls onClose on cancel without confirming', async () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(<ConfirmModal {...base} isOpen onClose={onClose} onConfirm={onConfirm} cancelLabel="Keep" />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Keep' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
