// backend/tests/mocks/io.ts
//
// موك لـ `getIO()` المُصدَّرة من backend/src/utils/socket.ts، حتى ما يصير عندنا side effect
// (فتح بورت فعلي بـ server.listen) وحتى نقدر نتأكد إنه الأحداث اللحظية
// (Socket.io events) انبعثت صح من الـ controllers.
//
// لازم يتعمل import لهاد الملف *قبل* استيراد أي controller بيستخدم `io`.

export const mockEmit = jest.fn();
export const mockRoomEmit = jest.fn();

jest.mock('../../src/utils/socket', () => ({
  __esModule: true,
  initIO: jest.fn(),
  getIO: () => ({
    emit: (...args: unknown[]) => mockEmit(...args),
    to: (room: string) => ({
      emit: (...args: unknown[]) => mockRoomEmit(room, ...args),
    }),
  }),
}));

beforeEach(() => {
  mockEmit.mockClear();
  mockRoomEmit.mockClear();
});
