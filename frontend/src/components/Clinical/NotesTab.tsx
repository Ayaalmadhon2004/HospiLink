// components/Clinical/NotesTab.tsx
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { FormModal } from '../Form';
import { useAuthPermissions } from '../../hooks/useAuthPermissions';
import { noteFields, amendFields, type NoteFormValues } from '../../configs/entityConfigs';
import { clinicalKeys, getNotes, getNoteHistory, createNote, amendNote } from '../../services/clinicalService';
import { NOTE_TYPES, type ClinicalNote, type NoteType } from '../../types/clinical';
import { formatDateTime } from '../../utils/datetime';

const History = ({ noteId }: { noteId: string }) => {
  const { t } = useTranslation();
  const { data = [], isPending } = useQuery({ queryKey: ['clinical', 'history', noteId], queryFn: () => getNoteHistory(noteId) });
  if (isPending) return <p className="text-xs text-gray-500">{t('common.loading')}</p>;
  return (
    <ol className="mt-2 space-y-2 border-s-2 border-slate-200 ps-3" aria-label={t('clinical.notes.history')}>
      {data.slice(1).map((v) => (
        <li key={v.id} className="text-xs text-gray-600">
          <span className="font-medium">{v.authorName}</span> · <time dateTime={v.createdAt}>{formatDateTime(v.createdAt)}</time>
          <p className="whitespace-pre-wrap mt-0.5">{v.content}</p>
        </li>
      ))}
    </ol>
  );
};

export const NotesTab = ({ patientId }: { patientId: string }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { can, role } = useAuthPermissions();
  const [creating, setCreating] = useState(false);
  const [amending, setAmending] = useState<ClinicalNote | null>(null);
  const [openHistory, setOpenHistory] = useState<string | null>(null);

  const { data: notes = [], isPending } = useQuery({ queryKey: clinicalKeys.notes(patientId), queryFn: () => getNotes(patientId) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['clinical'] });

  // Mirrors the backend: doctors write every type, nurses only nursing notes.
  const writableTypes: readonly NoteType[] = role === 'NURSE' ? ['NURSING'] : NOTE_TYPES;
  const mayEdit = (n: ClinicalNote) => can('notes:write') && writableTypes.includes(n.type);

  return (
    <div className="space-y-3">
      {can('notes:write') && (
        <button onClick={() => setCreating(true)} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium">{t('clinical.notes.add')}</button>
      )}
      {isPending ? <p className="text-sm text-gray-500">{t('common.loading')}</p> : notes.length === 0 ? (
        <p className="text-sm text-gray-500">{t('clinical.notes.empty')}</p>
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => (
            <li key={n.id} className="border border-slate-200 rounded-lg p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 font-medium">{t(`clinical.noteTypes.${n.type}`)}</span>
                <span className="font-medium">{n.authorName}</span>
                <time dateTime={n.createdAt}>{formatDateTime(n.createdAt)}</time>
                {n.supersedesId && <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800">{t('clinical.notes.amended')}</span>}
              </div>
              <p className="mt-2 text-sm text-gray-900 whitespace-pre-wrap">{n.content}</p>
              <div className="mt-2 flex gap-3 text-sm">
                {mayEdit(n) && <button className="text-blue-700 underline" onClick={() => setAmending(n)}>{t('clinical.notes.amend')}</button>}
                {n.supersedesId && (
                  <button className="text-gray-600 underline" aria-expanded={openHistory === n.id} onClick={() => setOpenHistory(openHistory === n.id ? null : n.id)}>
                    {t('clinical.notes.history')}
                  </button>
                )}
              </div>
              {openHistory === n.id && <History noteId={n.id} />}
            </li>
          ))}
        </ul>
      )}

      {creating && (
        <FormModal<NoteFormValues>
          isOpen
          onClose={() => setCreating(false)}
          title={t('clinical.notes.add')}
          fields={noteFields(writableTypes)}
          initialValues={{ type: writableTypes[0] }}
          onSubmit={async (v) => { await createNote({ patientId, type: v.type as NoteType, content: v.content }); await refresh(); }}
          submitLabel={t('clinical.notes.save')}
          submittingLabel={t('common.saving')}
        />
      )}
      {amending && (
        <FormModal<{ content: string }>
          isOpen
          onClose={() => setAmending(null)}
          title={t('clinical.notes.amend')}
          subtitle={t('forms.note.amendHint')}
          fields={amendFields}
          initialValues={{ content: amending.content }}
          onSubmit={async (v) => { await amendNote(amending.id, v.content); await refresh(); }}
          submitLabel={t('clinical.notes.saveAmendment')}
          submittingLabel={t('common.saving')}
          mode="edit"
        />
      )}
    </div>
  );
};
