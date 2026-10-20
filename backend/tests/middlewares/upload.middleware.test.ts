// backend/tests/middlewares/upload.middleware.test.ts
//
// upload.middleware.ts بيبني كائن multer بإعدادات (fileFilter + limits) مش
// مصدَّرة لحالها. هون منعمل mock لمكتبة multer نفسها حتى نمسك الإعدادات
// (config) يلي تمريرت إلها ونتأكد من منطق الفلترة والحجم المسموح فعلياً.

let capturedConfig: any;

jest.mock('multer', () => {
  const memoryStorage = jest.fn(() => ({ __isMemoryStorage: true }));
  const multerMock: any = jest.fn((config: any) => {
    capturedConfig = config;
    return { __isMulterInstance: true };
  });
  multerMock.memoryStorage = memoryStorage;
  return multerMock;
});

describe('upload.middleware', () => {
  beforeAll(() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('../../src/middlewares/upload.middleware');
  });

  it('بيحدد أقصى حجم ملف 5 ميغا', () => {
    expect(capturedConfig.limits).toEqual({ fileSize: 5 * 1024 * 1024 });
  });

  it('بيقبل ملفات JPEG وPNG وPDF بس', () => {
    const cb = jest.fn();

    capturedConfig.fileFilter({}, { mimetype: 'image/jpeg' }, cb);
    expect(cb).toHaveBeenLastCalledWith(null, true);

    capturedConfig.fileFilter({}, { mimetype: 'image/png' }, cb);
    expect(cb).toHaveBeenLastCalledWith(null, true);

    capturedConfig.fileFilter({}, { mimetype: 'application/pdf' }, cb);
    expect(cb).toHaveBeenLastCalledWith(null, true);
  });

  it('يرفض أي نوع ملف تاني (متل ملفات .exe أو فيديو)', () => {
    const cb = jest.fn();

    capturedConfig.fileFilter({}, { mimetype: 'application/x-msdownload' }, cb);

    expect(cb).toHaveBeenCalledWith(expect.any(Error), false);
    expect(cb.mock.calls[0][0].message).toContain('Invalid file type');
  });

  it('بيخزن الملفات بالذاكرة (للحفظ بالداتابيز) مش على القرص', () => {
    expect(capturedConfig.storage.__isMemoryStorage).toBe(true);
  });
});
