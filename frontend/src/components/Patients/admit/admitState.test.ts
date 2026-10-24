import { describe, it, expect } from 'vitest';
import { admitReducer, groupBedsByWard, initialAdmitState, validateAdmitForm, type AdmitFormData, type AvailableBed } from './admitState';

const valid: AdmitFormData = { name: ' Ali ', age: '40', gender: 'MALE', department: 'ICU', diagnosis: 'Flu', bedId: '' };
const bed = (id: string, ward?: string): AvailableBed => ({ id, bedNumber: id, status: 'AVAILABLE', ward: ward ? { id: ward, name: ward } : undefined });

describe('validateAdmitForm', () => {
  it('accepts a complete form', () => {
    expect(validateAdmitForm(valid)).toBeNull();
  });

  it.each([
    [{ name: '  ' }, 'patients.admitModal.nameRequired'],
    [{ age: '' }, 'patients.admitModal.ageRequired'],
    [{ age: '151' }, 'patients.admitModal.ageRequired'],
    [{ age: '-1' }, 'patients.admitModal.ageRequired'],
    [{ department: '' }, 'patients.admitModal.departmentRequired'],
    [{ diagnosis: ' ' }, 'patients.admitModal.diagnosisRequired'],
  ])('reports the first problem for %j', (patch, key) => {
    expect(validateAdmitForm({ ...valid, ...patch })).toBe(key);
  });
});

describe('admitReducer', () => {
  it('drops the chosen bed when the department changes, not for other fields', () => {
    const withBed = admitReducer(initialAdmitState, { type: 'SET_FIELD', field: 'bedId', value: 'b1' });
    expect(admitReducer(withBed, { type: 'SET_FIELD', field: 'name', value: 'Ali' }).formData.bedId).toBe('b1');
    expect(admitReducer(withBed, { type: 'SET_FIELD', field: 'department', value: 'ICU' }).formData).toMatchObject({ department: 'ICU', bedId: '' });
  });

  it('walks the submit lifecycle and resets', () => {
    let state = admitReducer(initialAdmitState, { type: 'SUBMIT_ERROR', error: 'boom', details: 'why' });
    expect(state).toMatchObject({ submitting: false, error: 'boom', errorDetails: 'why' });
    state = admitReducer(state, { type: 'SUBMIT_START' });
    expect(state).toMatchObject({ submitting: true, error: '' });
    state = admitReducer(state, { type: 'SUBMIT_SUCCESS' });
    expect(state).toMatchObject({ submitting: false, success: true });
    expect(admitReducer(state, { type: 'RESET_FORM' })).toEqual(initialAdmitState);
  });

  it('clears the beds when loading them fails', () => {
    const loaded = admitReducer(initialAdmitState, { type: 'FETCH_BEDS_SUCCESS', beds: [bed('b1')] });
    expect(admitReducer(loaded, { type: 'FETCH_BEDS_ERROR', error: 'x' })).toMatchObject({ availableBeds: [], bedsError: 'x', bedsLoading: false });
  });
});

describe('groupBedsByWard', () => {
  it('groups by ward name and puts beds without a ward in the fallback group', () => {
    const groups = groupBedsByWard([bed('b1', 'North'), bed('b2'), bed('b3', 'North')], 'General ward');
    expect(Object.keys(groups)).toEqual(['North', 'General ward']);
    expect(groups.North.map((b) => b.id)).toEqual(['b1', 'b3']);
  });
});
