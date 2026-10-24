import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { PrivateRoute } from '../PrivateRoute';

const useAuth = vi.fn();
vi.mock('../../contexts/authContext', () => ({ useAuth: () => useAuth() }));

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<p>login page</p>} />
        <Route
          path="/secret"
          element={
            <PrivateRoute>
              <p>secret content</p>
            </PrivateRoute>
          }
        />
      </Routes>
    </MemoryRouter>,
  );

describe('PrivateRoute', () => {
  beforeEach(() => useAuth.mockReset());

  it('redirects to /login when unauthenticated', () => {
    useAuth.mockReturnValue({ user: null, loading: false });
    renderAt('/secret');
    expect(screen.getByText('login page')).toBeInTheDocument();
    expect(screen.queryByText('secret content')).not.toBeInTheDocument();
  });

  it('shows a loading state and no content while the session loads', () => {
    useAuth.mockReturnValue({ user: null, loading: true });
    renderAt('/secret');
    expect(screen.getByText(/loading your session/i)).toBeInTheDocument();
    expect(screen.queryByText('login page')).not.toBeInTheDocument();
    expect(screen.queryByText('secret content')).not.toBeInTheDocument();
  });

  it('renders children for an authenticated user', () => {
    useAuth.mockReturnValue({ user: { id: '1', name: 'A', email: 'a@b.c', role: 'doctor' }, loading: false });
    renderAt('/secret');
    expect(screen.getByText('secret content')).toBeInTheDocument();
  });
});
