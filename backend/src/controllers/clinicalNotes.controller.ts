import { Request, Response } from 'express';
import { Prisma, NoteType } from '@prisma/client';
import prisma from '../config/db';
import logger from '../config/logger';
import { hospitalIdOf } from '../utils/tenant';
import { pageParams, pageInfo } from '../utils/pagination';
import { ok, fail } from '../utils/apiResponse';
import { findTenantPatient, actorOf } from '../services/clinicalAccess';

const NOTE_SELECT = {
  id: true, patientId: true, type: true, content: true, authorId: true, authorName: true, supersedesId: true, createdAt: true,
} satisfies Prisma.ClinicalNoteSelect;

// Doctors write every kind of note; nurses only nursing notes (and may only amend those).
const mayWrite = (role: string | undefined, type: NoteType): boolean => role === 'DOCTOR' || (role === 'NURSE' && type === 'NURSING');

// GET /api/clinical-notes?patientId= - current versions only (a note that has an amendment is history), newest first
export const listNotes = async (req: Request, res: Response) => {
  try {
    const q = req.query as { patientId: string; type?: NoteType };
    const where: Prisma.ClinicalNoteWhereInput = {
      hospitalId: hospitalIdOf(req), patientId: q.patientId, patient: { deletedAt: null }, amendment: null, ...(q.type ? { type: q.type } : {}),
    };
    const page = pageParams(req.query);
    const [rows, totalCount] = await Promise.all([
      prisma.clinicalNote.findMany({ where, select: NOTE_SELECT, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: page.skip, take: page.take }),
      prisma.clinicalNote.count({ where }),
    ]);
    return ok(res, rows, { count: rows.length, pagination: pageInfo(page, totalCount) });
  } catch (error: unknown) {
    logger.error({ err: error }, 'List notes error:');
    return fail(res, 500, 'INTERNAL_ERROR', 'Failed to load notes');
  }
};

// GET /api/clinical-notes/:id/history - the note and every earlier version, newest first
export const noteHistory = async (req: Request, res: Response) => {
  try {
    const hospitalId = hospitalIdOf(req);
    const chain = [];
    let nextId: string | null = req.params.id as string;
    for (let i = 0; nextId && i < 100; i++) {
      const row: (typeof chain)[number] | null = await prisma.clinicalNote.findFirst({ where: { id: nextId, hospitalId, patient: { deletedAt: null } }, select: NOTE_SELECT });
      if (!row) break;
      chain.push(row);
      nextId = row.supersedesId;
    }
    if (chain.length === 0) return fail(res, 404, 'NOT_FOUND', 'Note not found');
    return ok(res, chain);
  } catch (error: unknown) {
    logger.error({ err: error }, 'Note history error:');
    return fail(res, 500, 'INTERNAL_ERROR', 'Failed to load note history');
  }
};

// POST /api/clinical-notes
export const createNote = async (req: Request, res: Response) => {
  try {
    const { patientId, type, content } = req.body as { patientId: string; type: NoteType; content: string };
    if (!mayWrite(req.user?.role, type)) return fail(res, 403, 'FORBIDDEN', 'Your role cannot write this type of note');
    const patient = await findTenantPatient(req, patientId);
    if (!patient) return fail(res, 404, 'PATIENT_NOT_FOUND', 'Patient not found');
    const actor = await actorOf(req);
    const note = await prisma.clinicalNote.create({
      data: { hospitalId: hospitalIdOf(req), patientId, type, content, authorId: actor.id, authorName: actor.name },
      select: NOTE_SELECT,
    });
    return ok(res, note, {}, 201);
  } catch (error: unknown) {
    logger.error({ err: error }, 'Create note error:');
    return fail(res, 500, 'INTERNAL_ERROR', 'Failed to create note');
  }
};

// POST /api/clinical-notes/:id/amend - appends a corrected version; the original stays untouched
export const amendNote = async (req: Request, res: Response) => {
  try {
    const original = await prisma.clinicalNote.findFirst({
      where: { id: req.params.id as string, hospitalId: hospitalIdOf(req), patient: { deletedAt: null } },
      select: { id: true, patientId: true, type: true, amendment: { select: { id: true } } },
    });
    if (!original) return fail(res, 404, 'NOT_FOUND', 'Note not found');
    if (!mayWrite(req.user?.role, original.type)) return fail(res, 403, 'FORBIDDEN', 'Your role cannot amend this type of note');
    if (original.amendment) return fail(res, 409, 'CONFLICT', 'This note was already amended; amend the latest version');
    const actor = await actorOf(req);
    const note = await prisma.clinicalNote.create({
      data: {
        hospitalId: hospitalIdOf(req), patientId: original.patientId, type: original.type, content: req.body.content,
        authorId: actor.id, authorName: actor.name, supersedesId: original.id,
      },
      select: NOTE_SELECT,
    });
    return ok(res, note, {}, 201);
  } catch (error: unknown) {
    // supersedesId is unique: a concurrent amendment of the same version loses here.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return fail(res, 409, 'CONFLICT', 'This note was already amended; amend the latest version');
    }
    logger.error({ err: error }, 'Amend note error:');
    return fail(res, 500, 'INTERNAL_ERROR', 'Failed to amend note');
  }
};
