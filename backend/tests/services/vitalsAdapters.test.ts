import { parseHl7, parseFhir, parseJson, IngestParseError } from '../../src/services/vitalsAdapters';

const HL7 = [
  'MSH|^~\\&|MONITOR|WARD|HOSPILINK|HL|20260101120000||ORU^R01|1|P|2.5',
  'PID|1||P-0001^^^HL||Doe^John',
  'OBX|1|NM|8867-4^Heart rate^LN||88|/min||||||||20260101115900',
  'OBX|2|ST|85354-9^BP^LN||120/80|mm[Hg]',
  'OBX|3|NM|2708-6^SpO2^LN||97|%',
  'OBX|4|NM|8310-5^Temp^LN||98.6|[degF]',
  'OBX|5|NM|99999-9^Unknown^LN||1|x',
].join('\r');

describe('vitalsAdapters', () => {
  it('HL7 ORU^R01 -> one merged reading, °F converted to °C', () => {
    const [r] = parseHl7(HL7);
    expect(r.patientCode).toBe('P-0001');
    expect(r.values).toEqual({ heartRate: 88, systolicBP: 120, diastolicBP: 80, spO2: 97, temperature: 37 });
    expect(r.observedAt?.toISOString()).toBe('2026-01-01T11:59:00.000Z');
  });

  it('HL7 rejects non-ORU / non-HL7 / missing PID', () => {
    expect(() => parseHl7('hello')).toThrow(IngestParseError);
    expect(() => parseHl7('MSH|^~\\&|A|B|C|D|20260101||ADT^A01|1|P|2.5')).toThrow(/ORU/);
    expect(() => parseHl7('MSH|^~\\&|A|B|C|D|20260101||ORU^R01|1|P|2.5\rOBX|1|NM|8867-4||80')).toThrow(/PID/);
    expect(() => parseHl7('MSH|^~\\&|A|B|C|D|20260101||ORU^R01|1|P|2.5\rPID|1||')).toThrow(/PID-3/);
  });

  it('FHIR Bundle: per-vital Observations and the BP panel components merge per patient', () => {
    const subject = { identifier: { value: 'P-0002' } };
    const readings = parseFhir({
      resourceType: 'Bundle',
      entry: [
        { resource: { resourceType: 'Observation', subject, code: { coding: [{ system: 'http://loinc.org', code: '8867-4' }] }, valueQuantity: { value: 72 }, effectiveDateTime: '2026-01-01T10:00:00Z' } },
        { resource: { resourceType: 'Observation', subject, code: { coding: [{ code: '85354-9' }] }, component: [
          { code: { coding: [{ code: '8480-6' }] }, valueQuantity: { value: 130 } },
          { code: { coding: [{ code: '8462-4' }] }, valueQuantity: { value: 85 } },
        ] } },
        { resource: { resourceType: 'Patient' } },
      ],
    });
    expect(readings).toHaveLength(1);
    expect(readings[0].values).toEqual({ heartRate: 72, systolicBP: 130, diastolicBP: 85 });
  });

  it('FHIR: Patient/<code> reference works; garbage is rejected', () => {
    const [r] = parseFhir({ resourceType: 'Observation', subject: { reference: 'Patient/P-3' }, code: { coding: [{ code: '2708-6' }] }, valueQuantity: { value: 91.5 } });
    expect(r).toMatchObject({ patientCode: 'P-3', values: { spO2: 91.5 } });
    expect(() => parseFhir({ resourceType: 'Patient' })).toThrow(IngestParseError);
    expect(() => parseFhir({ resourceType: 'Observation', code: { coding: [{ code: '8867-4' }] } })).toThrow(/subject/);
  });

  it('JSON: single or batch, rounds integer vitals, drops non-numeric values', () => {
    expect(parseJson({ patientCode: 'P-4', heartRate: 80.6, spO2: '96', temperature: 'abc' })[0].values).toEqual({ heartRate: 81, spO2: 96 });
    expect(parseJson({ readings: [{ patientCode: 'A', heartRate: 70 }, { patientCode: 'B', heartRate: 71 }] })).toHaveLength(2);
    expect(() => parseJson({ heartRate: 70 })).toThrow(/patientCode/);
    expect(() => parseJson({ readings: [] })).toThrow(IngestParseError);
  });
});
