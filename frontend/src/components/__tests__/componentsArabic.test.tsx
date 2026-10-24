import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryWrapper } from '../../test/QueryWrapper';
import userEvent from '@testing-library/user-event';
import i18n from '../../i18n';
import { ConfirmDeleteDialog } from '../ConfirmDeleteDialog';
import { ConfirmModal } from '../ConfirmModal';
import { IncidentModal } from '../IncidentModal';
import { FormModal } from '../Form';
import { ShiftTimeline } from '../Staff/ShiftTimeline';
import { AlertsPanel } from '../Vitals/AlertsPanel';
import { VitalsCard } from '../Vitals/VitalsCard';

vi.mock('../../services/api', () => ({
  apiGet: vi.fn().mockResolvedValue({ success: true, data: [] }),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
}));

const LOW_SPO2 = 85;
const HIGH_HEART_RATE = 130;

describe('shared components in Arabic', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('ar');
  });

  it('translates the delete dialog', () => {
    render(
      <ConfirmDeleteDialog isOpen name="السرير 1" itemType="السرير" onCancel={vi.fn()} onConfirm={vi.fn()} />,
    );
    expect(screen.getByText('هل تريد حذف السرير 1؟')).toBeInTheDocument();
    expect(screen.getByText('سيتم حذف السرير نهائياً من النظام', { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'إلغاء' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'حذف' })).toBeInTheDocument();
  });

  it('translates the default confirm modal labels but keeps caller overrides', () => {
    render(<ConfirmModal isOpen onClose={vi.fn()} onConfirm={vi.fn()} title="t" message="m" cancelLabel="Keep" />);
    expect(screen.getByRole('button', { name: 'تأكيد' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keep' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'إغلاق' })).toBeInTheDocument();
  });

  it('translates config-driven form labels, options and validation errors', async () => {
    render(<IncidentModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} />, { wrapper: QueryWrapper });
    expect(screen.getByText('إضافة تقرير حادثة')).toBeInTheDocument();
    expect(screen.getByText('عنوان الحادثة')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'سقوط مريض' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('اسم الموظف')).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('button', { name: 'الإبلاغ عن حادثة' }));
    expect(await screen.findByText('عنوان الحادثة مطلوب')).toBeInTheDocument();
  });

  it('still renders plain-text field labels passed by callers', () => {
    render(
      <FormModal
        isOpen
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        title="Custom"
        fields={[{ name: 'x', label: 'Plain label', type: 'text' }]}
      />,
      { wrapper: QueryWrapper },
    );
    expect(screen.getByText('Plain label')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'حفظ' })).toBeInTheDocument();
  });

  it('translates empty states and alert types', () => {
    const { rerender } = render(<ShiftTimeline timeline={null} />);
    expect(screen.getByText('لا توجد ورديات مجدولة لهذا اليوم')).toBeInTheDocument();

    rerender(<AlertsPanel alerts={[]} />);
    expect(screen.getByText('جميع العلامات الحيوية طبيعية', { exact: false })).toBeInTheDocument();

    rerender(
      <AlertsPanel
        alerts={[
          {
            id: 'a1',
            alertType: 'SPO2_LOW',
            recordedAt: '2026-01-01T10:00:00.000Z',
            patient: { name: 'Lina', patientCode: 'PT-2', department: 'ICU' },
            spO2: LOW_SPO2,
          },
        ]}
      />,
    );
    expect(screen.getAllByText('انخفاض تشبّع الأكسجين').length).toBeGreaterThan(0);
    expect(screen.getByText('العناية المركزة')).toBeInTheDocument();
  });

  it('translates the vitals card labels', () => {
    render(<VitalsCard heartRate={HIGH_HEART_RATE} isCritical />);
    expect(screen.getByText('معدل ضربات القلب')).toBeInTheDocument();
    expect(screen.getByText('حرجة', { exact: false })).toBeInTheDocument();
  });
});
