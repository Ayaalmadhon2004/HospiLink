import {
  admitPatientSchema,
  updatePatientSchema,
  listPatientsQuerySchema,
  availableBedsQuerySchema,
} from '../../src/validators/patient.validator';

const U1 = '3f2b8c1e-6f0a-4a57-9a39-1c1d8b3f7a10';
const U2 = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';

describe('admitPatientSchema', () => {
  // exactly what AdmitPatientModal sends
  const uiPayload = { name: 'Ahmad Khaled', age: 34, gender: 'MALE', department: 'Cardiology', diagnosis: 'Chest pain', bedId: U1 };

  it('accepts the UI payload', () => {
    expect(admitPatientSchema.parse(uiPayload)).toEqual(uiPayload);
  });

  it('accepts a payload without a bed and with optional ids', () => {
    const { bedId: _bedId, ...noBed } = uiPayload;
    expect(admitPatientSchema.safeParse(noBed).success).toBe(true);
    expect(admitPatientSchema.parse({ ...noBed, doctorId: U2 })).toMatchObject({ doctorId: U2 });
    // hospitalId is never accepted from the client: it is stripped
    expect(admitPatientSchema.parse({ ...noBed, hospitalId: U2 })).not.toHaveProperty('hospitalId');
  });

  it('treats empty / null ids as not provided', () => {
    const out = admitPatientSchema.parse({ ...uiPayload, bedId: '', doctorId: null });
    expect(out.bedId).toBeUndefined();
    expect(out.doctorId).toBeUndefined();
  });

  it('coerces numeric string age and accepts 0', () => {
    expect(admitPatientSchema.parse({ ...uiPayload, age: '12' }).age).toBe(12);
    expect(admitPatientSchema.parse({ ...uiPayload, age: 0 }).age).toBe(0);
  });

  it.each([-1, 151, 34.5, 'abc', null])('rejects age %p', (age) => {
    expect(admitPatientSchema.safeParse({ ...uiPayload, age }).success).toBe(false);
  });

  it('rejects unknown gender / non-uuid ids / blank text', () => {
    expect(admitPatientSchema.safeParse({ ...uiPayload, gender: 'OTHER' }).success).toBe(false);
    expect(admitPatientSchema.safeParse({ ...uiPayload, bedId: 'nope' }).success).toBe(false);
    expect(admitPatientSchema.safeParse({ ...uiPayload, name: '  ' }).success).toBe(false);
    expect(admitPatientSchema.safeParse({ ...uiPayload, diagnosis: '' }).success).toBe(false);
  });

  it('rejects an empty object and strips server-controlled keys', () => {
    expect(admitPatientSchema.safeParse({}).success).toBe(false);
    const out = admitPatientSchema.parse({ ...uiPayload, status: 'CRITICAL', patientCode: 'X', admissionDate: '2020-01-01', junk: 1 });
    expect(out).toEqual(uiPayload);
  });
});

describe('updatePatientSchema', () => {
  it('accepts the EditPatientPage payload (age already parsed)', () => {
    const body = { name: 'A B', age: 40, gender: 'FEMALE', department: 'General', diagnosis: 'x', status: 'STABLE' };
    expect(updatePatientSchema.parse(body)).toEqual(body);
  });

  it('accepts partial updates and nullable bed/doctor/discharge', () => {
    expect(updatePatientSchema.parse({})).toEqual({});
    expect(updatePatientSchema.parse({ bedId: null, doctorId: U1, dischargeDate: null })).toEqual({ bedId: null, doctorId: U1, dischargeDate: null });
  });

  it('coerces dates', () => {
    const out = updatePatientSchema.parse({ dischargeDate: '2025-01-02T03:04:05.000Z' });
    expect(out.dischargeDate).toBeInstanceOf(Date);
    expect(updatePatientSchema.safeParse({ admissionDate: 'not-a-date' }).success).toBe(false);
  });

  it('rejects invalid enums / NaN age (JSON null) / bad ids', () => {
    expect(updatePatientSchema.safeParse({ status: 'DEAD' }).success).toBe(false);
    expect(updatePatientSchema.safeParse({ gender: 'x' }).success).toBe(false);
    expect(updatePatientSchema.safeParse({ age: null }).success).toBe(false);
    expect(updatePatientSchema.safeParse({ bedId: 'x' }).success).toBe(false);
  });

  it('strips fields that must not be mass-assigned', () => {
    const out = updatePatientSchema.parse({ name: 'N N', id: U1, patientCode: 'PT-1', hospitalId: U2, createdAt: 'x' });
    expect(out).toEqual({ name: 'N N' });
  });
});

describe('listPatientsQuerySchema', () => {
  it('accepts the UI query and strips unknown keys', () => {
    expect(listPatientsQuerySchema.parse({ status: 'STABLE', department: 'Cardiology', search: 'ali', page: '1', limit: '10', junk: 'x' }))
      .toEqual({ status: 'STABLE', department: 'Cardiology', search: 'ali', page: '1', limit: '10' });
  });

  it('treats All / ALL / empty status as no filter and upper-cases others', () => {
    expect(listPatientsQuerySchema.parse({ status: 'All' }).status).toBeUndefined();
    expect(listPatientsQuerySchema.parse({ status: 'ALL' }).status).toBeUndefined();
    expect(listPatientsQuerySchema.parse({ status: '' }).status).toBeUndefined();
    expect(listPatientsQuerySchema.parse({ status: 'critical' }).status).toBe('CRITICAL');
  });

  it('rejects bad status, page and limit', () => {
    expect(listPatientsQuerySchema.safeParse({ status: 'NOPE' }).success).toBe(false);
    expect(listPatientsQuerySchema.safeParse({ page: '-1' }).success).toBe(false);
    expect(listPatientsQuerySchema.safeParse({ limit: 'abc' }).success).toBe(false);
  });
});

describe('availableBedsQuerySchema', () => {
  it('keeps department only', () => {
    expect(availableBedsQuerySchema.parse({ department: 'ICU', x: 1 })).toEqual({ department: 'ICU' });
    expect(availableBedsQuerySchema.parse({})).toEqual({});
  });
});
