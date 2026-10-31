import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatCard from '../StatCard';

describe('StatCard', () => {
  it('renders title and value without optional parts', () => {
    render(<StatCard title="Patients" value="128" />);
    expect(screen.getByRole('heading', { name: 'Patients' })).toBeInTheDocument();
    expect(screen.getByText('128')).toBeInTheDocument();
  });

  it('renders icon and a green trend when trendUp', () => {
    render(<StatCard title="Beds" value="40" icon="B" trend="+5%" trendUp />);
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('+5%')).toHaveClass('text-green-500');
  });

  it('renders a red trend when not trendUp', () => {
    render(<StatCard title="Beds" value="40" trend="-3%" />);
    expect(screen.getByText('-3%')).toHaveClass('text-red-600');
  });
});
