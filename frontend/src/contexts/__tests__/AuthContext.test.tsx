import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext';

// A plain function (not vi.fn) backs apiGet: vitest's mock bookkeeping would
// otherwise flag the intentionally rejected promise as an unhandled rejection.
const state = vi.hoisted(() => ({
  respond: (): Promise<unknown> => Promise.resolve({}),
  calls: [] as string[],
}));
vi.mock('../../services/api', () => ({
  apiGet: (url: string): Promise<unknown> => {
    state.calls.push(url);
    return state.respond();
  },
}));

const label = (loading: boolean, name?: string): string => {
  if (loading) return 'loading';
  return name ? `user:${name}` : 'anonymous';
};

const Probe = () => {
  const { user, loading } = useAuth();
  return <p data-testid="state">{label(loading, user?.name)}</p>;
};

const renderProbe = () =>
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );

describe('AuthProvider bootstrap', () => {
  beforeEach(() => {
    state.calls.length = 0;
    state.respond = () => Promise.resolve({});
  });

  it('starts loading, calls /auth/me, then exposes the user (top-level user)', async () => {
    state.respond = () =>
      Promise.resolve({ user: { id: '1', name: 'Dr Aya', email: 'a@b.c', role: 'doctor' } });
    renderProbe();
    expect(screen.getByTestId('state')).toHaveTextContent('loading');
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('user:Dr Aya'));
    expect(state.calls).toEqual(['/auth/me']);
  });

  it('supports the { data: { user } } response shape', async () => {
    state.respond = () =>
      Promise.resolve({ data: { user: { id: '2', name: 'Nested', email: 'n@b.c', role: 'nurse' } } });
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('user:Nested'));
  });

  it('ends up anonymous when /auth/me fails', async () => {
    state.respond = () => Promise.reject(new Error('Unauthorized'));
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('anonymous'));
  });

  it('ends up anonymous when the response has no user', async () => {
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('anonymous'));
  });
});
