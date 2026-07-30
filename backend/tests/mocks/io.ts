// backend/tests/mocks/io.ts
//
// موك لـ `io` المُصدَّرة من backend/src/server.ts، حتى ما يصير عندنا side effect
// (فتح بورت فعلي بـ server.listen) وحتى نقدر نتأكد إنه الأحداث اللحظية
// (Socket.io events) انبعثت صح من الـ controllers.
//
// لازم يتعمل import لهاد الملف *قبل* استيراد أي controller بيستخدم `io`.

export const mockEmit = jest.fn();
export const mockRoomEmit = jest.fn();

jest.mock('../../src/server', () => ({
  __esModule: true,
  io: {
    emit: (...args: any[]) => mockEmit(...args),
    to: (room: string) => ({
      emit: (...args: any[]) => mockRoomEmit(room, ...args),
    }),
  },
}));

beforeEach(() => {
  mockEmit.mockClear();
  mockRoomEmit.mockClear();
});
