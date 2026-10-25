import { isSerializationFailure } from '../src/utils/dbErrors';

describe('isSerializationFailure', () => {
  it.each([
    [{ code: 'P2034' }],
    [{ message: 'TransactionWriteConflict', cause: { originalCode: '40001' } }],
    [{ meta: { driverAdapterError: { cause: { originalCode: '40P01' } } } }],
    [new Error('TransactionWriteConflict')],
  ])('recognises %j', (e) => expect(isSerializationFailure(e)).toBe(true));
  it.each([[null], [undefined], ['x'], [new Error('boom')], [{ code: 'P2002' }], [{ cause: { originalCode: '23505' } }]])('ignores %j', (e) => expect(isSerializationFailure(e)).toBe(false));
});
