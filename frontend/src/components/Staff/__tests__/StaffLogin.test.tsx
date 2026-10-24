import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StaffCard } from '../StaffCard';
import { StaffModal } from '../StaffModal';
import { createStaff, updateStaff } from '../../../services/staffService';

vi.mock('../../../services/staffService', () => ({ createStaff: vi.fn(), updateStaff: vi.fn() }));

const member = { id: 's1', name: 'Nour Aziz', email: 'nour@h.com', role: 'Nurse', department: 'ER', isActive: true };

describe('staff login link', () => {
  describe('StaffCard', () => {
    it('flags a member without a linked login', () => {
      render(<StaffCard member={{ ...member, hasLogin: false }} />);
      expect(screen.getByText('No login')).toHaveAttribute('title', expect.stringMatching(/no appointment or shift notifications/i));
    });

    it('shows nothing for a member with a login or when the API does not say', () => {
      const { rerender } = render(<StaffCard member={{ ...member, hasLogin: true }} />);
      expect(screen.queryByText('No login')).not.toBeInTheDocument();
      rerender(<StaffCard member={member} />);
      expect(screen.queryByText('No login')).not.toBeInTheDocument();
    });
  });

  describe('StaffModal', () => {
    beforeEach(() => {
      vi.mocked(createStaff).mockReset().mockResolvedValue({} as never);
      vi.mocked(updateStaff).mockReset().mockResolvedValue({} as never);
    });

    it('offers to create a login only when adding a staff member', () => {
      const { rerender } = render(<StaffModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);
      expect(screen.getByText('Login account')).toBeInTheDocument();
      rerender(<StaffModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} initialData={{ id: 's1', name: 'Nour' }} />);
      expect(screen.queryByText('Login account')).not.toBeInTheDocument();
    });

    it('sends the chosen loginRole when creating a staff member', async () => {
      const user = userEvent.setup();
      const { container } = render(<StaffModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);
      const fill = async () => {
        await user.type(screen.getByPlaceholderText('Dr. John Doe'), 'Nour Aziz');
        await user.type(screen.getByPlaceholderText('john@hospilink.com'), 'nour@h.com');
        const selects = container.querySelectorAll('select');
        // role, department, status, loginRole (in field order)
        await user.selectOptions(selects[0], 'Nurse');
        await user.selectOptions(selects[1], selects[1].options[1].value);
        await user.selectOptions(selects[2], 'ACTIVE');
        return selects[3];
      };

      const loginRole = await fill();
      await user.selectOptions(loginRole, 'DOCTOR');
      await user.click(screen.getByRole('button', { name: /add/i }));

      await waitFor(() => expect(createStaff).toHaveBeenCalledTimes(1));
      expect(vi.mocked(createStaff).mock.calls[0][0]).toMatchObject({ email: 'nour@h.com', loginRole: 'DOCTOR' });
    });
  });
});
