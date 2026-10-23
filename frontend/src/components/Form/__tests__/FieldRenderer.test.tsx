import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FieldRenderer } from '../FieldRenderer';
import type { FieldConfig } from '../types';
import { apiGet } from '../../../services/api';

vi.mock('../../../services/api', () => ({ apiGet: vi.fn() }));

type Values = Record<string, unknown>;

const renderField = (
  field: FieldConfig<Values>,
  props: { value?: unknown; formValues?: Values; error?: string; disabled?: boolean } = {},
) => {
  const setValue = vi.fn();
  render(
    <FieldRenderer
      field={field}
      value={props.value}
      setValue={setValue}
      formValues={props.formValues ?? {}}
      error={props.error}
      disabled={props.disabled}
    />,
  );
  return setValue;
};

describe('FieldRenderer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders a required marker, helper text and error message', () => {
    renderField(
      { name: 'name', label: 'Full Name', type: 'text', required: true, helperText: 'As on ID' },
      { error: 'Name is required' },
    );
    expect(screen.getByText('*')).toBeInTheDocument();
    expect(screen.getByText('As on ID')).toBeInTheDocument();
    expect(screen.getByText('Name is required')).toBeInTheDocument();
  });

  it('calls setValue with the typed text', async () => {
    const setValue = renderField({ name: 'name', label: 'Name', type: 'text', placeholder: 'Enter name' });
    await userEvent.type(screen.getByPlaceholderText('Enter name'), 'a');
    expect(setValue).toHaveBeenCalledWith('name', 'a');
  });

  it('keeps numeric 0 as "0" and sends undefined when a number input is cleared', async () => {
    const setValue = renderField({ name: 'age', label: 'Age', type: 'number' }, { value: 0 });
    const input = screen.getByRole('spinbutton');
    expect(input).toHaveValue(0);
    await userEvent.clear(input);
    expect(setValue).toHaveBeenLastCalledWith('age', undefined);
  });

  it('sends a Number for number inputs', async () => {
    const setValue = renderField({ name: 'age', label: 'Age', type: 'number' });
    await userEvent.type(screen.getByRole('spinbutton'), '7');
    expect(setValue).toHaveBeenCalledWith('age', 7);
  });

  it('renders select options and reports the chosen value', async () => {
    const setValue = renderField({
      name: 'gender',
      label: 'Gender',
      type: 'select',
      options: [
        { label: 'Male', value: 'MALE' },
        { label: 'Female', value: 'FEMALE' },
      ],
    });
    expect(screen.getByRole('option', { name: 'Select Gender' })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByRole('combobox'), 'FEMALE');
    expect(setValue).toHaveBeenCalledWith('gender', 'FEMALE');
  });

  it('reports checkbox changes as booleans', async () => {
    const setValue = renderField({ name: 'consent', label: 'Consent', type: 'checkbox' }, { value: false });
    await userEvent.click(screen.getByRole('checkbox'));
    expect(setValue).toHaveBeenCalledWith('consent', true);
  });

  it('marks the selected radio and reports changes', async () => {
    const setValue = renderField(
      {
        name: 'status',
        label: 'Status',
        type: 'radio',
        options: [
          { label: 'On', value: 'ON' },
          { label: 'Off', value: 'OFF' },
        ],
      },
      { value: 'ON' },
    );
    expect(screen.getByRole('radio', { name: 'On' })).toBeChecked();
    await userEvent.click(screen.getByRole('radio', { name: 'Off' }));
    expect(setValue).toHaveBeenCalledWith('status', 'OFF');
  });

  it('disables the input when the whole form is disabled', () => {
    renderField({ name: 'a', label: 'A', type: 'text' }, { disabled: true });
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('evaluates a disabled function against form values', () => {
    renderField(
      { name: 'a', label: 'A', type: 'text', disabled: (v) => v.locked === true },
      { formValues: { locked: true } },
    );
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('renders custom fields through render()', () => {
    renderField(
      {
        name: 'x',
        label: 'Custom',
        type: 'custom',
        render: ({ formValues }) => <span>custom:{String(formValues.k)}</span>,
      },
      { formValues: { k: 'v' } },
    );
    expect(screen.getByText('custom:v')).toBeInTheDocument();
  });

  describe('search-select', () => {
    const field: FieldConfig<Values> = {
      name: 'bedId',
      label: 'Bed',
      type: 'search-select',
      dependsOn: 'department',
      apiEndpoint: '/beds?department={department}',
    };

    it('does not fetch until the parent field has a value', async () => {
      renderField(field, { formValues: {} });
      await userEvent.click(screen.getByRole('combobox'));
      expect(apiGet).not.toHaveBeenCalled();
      expect(screen.getByText('Please select department first')).toBeInTheDocument();
    });

    it('substitutes the parent value into the endpoint and lists the options', async () => {
      vi.mocked(apiGet).mockResolvedValue({ data: [{ id: 'b1', bedNumber: 'B-1' }, { id: 'b2', name: 'Bed Two' }] });
      const setValue = renderField(field, { formValues: { department: 'ICU' } });

      await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/beds?department=ICU'));
      await userEvent.click(screen.getByRole('combobox'));
      expect(await screen.findByText('Bed Two')).toBeInTheDocument();
      await userEvent.click(screen.getByText('B-1'));
      expect(setValue).toHaveBeenCalledWith('bedId', 'b1');
      expect(screen.queryByText('Bed Two')).not.toBeInTheDocument();
    });

    it('shows "No options available" when the request fails', async () => {
      vi.mocked(apiGet).mockRejectedValue(new Error('boom'));
      renderField(field, { formValues: { department: 'ICU' } });
      await waitFor(() => expect(apiGet).toHaveBeenCalled());
      await userEvent.click(screen.getByRole('combobox'));
      expect(await screen.findByText('No options available')).toBeInTheDocument();
    });
  });
});
