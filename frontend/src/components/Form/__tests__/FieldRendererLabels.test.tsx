import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FormModal } from '../FormModal';
import { QueryWrapper } from '../../../test/QueryWrapper';
import { medicationFields, wardFields } from '../../../configs/entityConfigs';

// Every control must be reachable through its label (screen readers, voice control, Playwright getByLabel).
describe('FormModal labels', () => {
  it('ties each label to its input, select or textarea', () => {
    render(
      <FormModal
        isOpen
        onClose={() => undefined}
        title="t"
        fields={[
          { name: 'a', label: 'Text field', type: 'text' },
          { name: 'b', label: 'Select field', type: 'select', options: [{ label: 'One', value: '1' }] },
          { name: 'c', label: 'Area field', type: 'textarea' },
          { name: 'd', label: 'Number field', type: 'number' },
        ]}
        onSubmit={async () => undefined}
      />,
      { wrapper: QueryWrapper },
    );
    expect(screen.getByLabelText('Text field')).toBeInstanceOf(HTMLInputElement);
    expect(screen.getByLabelText('Select field')).toBeInstanceOf(HTMLSelectElement);
    expect(screen.getByLabelText('Area field')).toBeInstanceOf(HTMLTextAreaElement);
    expect(screen.getByLabelText('Number field')).toHaveAttribute('type', 'number');
  });

  it('a decimal price is a valid number input: the unit price field steps by 0.01', () => {
    render(<FormModal isOpen onClose={() => undefined} title="t" fields={medicationFields} onSubmit={async () => undefined} />, { wrapper: QueryWrapper });
    const price = screen.getByLabelText(/Unit price/i) as HTMLInputElement;
    expect(price).toHaveAttribute('step', '0.01');
    price.value = '2.50';
    expect(price.validity.stepMismatch).toBe(false);
    // other number fields keep the browser default (whole numbers)
    expect(screen.getByLabelText(/Reorder level/i)).not.toHaveAttribute('step');
  });

  it('two forms on one page do not share control ids', () => {
    render(
      <>
        <FormModal isOpen onClose={() => undefined} title="one" fields={wardFields} onSubmit={async () => undefined} />
        <FormModal isOpen onClose={() => undefined} title="two" fields={wardFields} onSubmit={async () => undefined} />
      </>,
      { wrapper: QueryWrapper },
    );
    const ids = screen.getAllByLabelText(/Ward name/i).map((el) => el.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });
});
