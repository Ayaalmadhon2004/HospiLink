// backend/src/services/notification.service.ts
//
// Central place to create + push notifications. Controllers and (later) cron jobs call
// `notify()`; it resolves recipients, honours each user's UserSettings toggle for the
// event category, stores the rows and emits `new-notification` to room `user-<id>`.
// It NEVER throws: failures are logged and an empty array is returned.
import type { Prisma } from '@prisma/client';
import prisma from '../config/db';
import { io } from '../server';
import logger from '../config/logger';

export type NotificationType = 'VITALS' | 'INCIDENT' | 'DISPATCH' | 'APPOINTMENT' | 'SHIFT' | 'SYSTEM';

type SettingKey =
  | 'criticalVitalsAlerts'
  | 'incidentEscalations'
  | 'shiftReminders'
  | 'dispatchAlerts'
  | 'appointmentReminders';

// Category -> UserSettings toggle. SYSTEM (and unknown types) have no toggle: always delivered.
export const TYPE_TO_SETTING: Record<string, SettingKey | undefined> = {
  VITALS: 'criticalVitalsAlerts',
  INCIDENT: 'incidentEscalations',
  DISPATCH: 'dispatchAlerts',
  APPOINTMENT: 'appointmentReminders',
  SHIFT: 'shiftReminders',
};

// Used when a user has no UserSettings row yet (mirrors the defaults in schema.prisma).
export const DEFAULT_SETTINGS: Record<SettingKey, boolean> = {
  criticalVitalsAlerts: true,
  incidentEscalations: true,
  shiftReminders: false,
  dispatchAlerts: true,
  appointmentReminders: true,
};

export interface RecipientSelector {
  /** Role filter (combined with `department` when both are given). */
  roles?: Array<'ADMIN' | 'DOCTOR' | 'NURSE' | 'DISPATCHER'>;
  /** Department filter (User.department). */
  department?: string;
  /** Explicit users, always included (union with the role/department match). */
  userIds?: string[];
  /** Never notify this user (usually the actor). */
  excludeUserId?: string;
  /** Restrict to a hospital. Defaults to the hospital of `scopeUserId ?? excludeUserId`. */
  hospitalId?: string;
  scopeUserId?: string;
}

export interface NotifyInput {
  type: NotificationType;
  title: string;
  message: string;
  link?: string | null;
  recipients: RecipientSelector;
}

const resolveHospitalId = async (r: RecipientSelector): Promise<string | undefined> => {
  if (r.hospitalId) return r.hospitalId;
  const anchor = r.scopeUserId ?? r.excludeUserId;
  if (!anchor) return undefined;
  const u = await prisma.user.findUnique({ where: { id: anchor }, select: { hospitalId: true } });
  return u?.hospitalId;
};

const buildWhere = (r: RecipientSelector, hospitalId?: string): Prisma.UserWhereInput | null => {
  const or: Prisma.UserWhereInput[] = [];
  const ids = (r.userIds ?? []).filter(Boolean);
  if (ids.length) or.push({ id: { in: ids } });
  if (r.roles?.length || r.department) {
    const group: Prisma.UserWhereInput = {};
    if (r.roles?.length) group.role = { in: r.roles };
    if (r.department) group.department = r.department;
    or.push(group);
  }
  if (!or.length) return null;
  const and: Prisma.UserWhereInput[] = [{ OR: or }];
  if (hospitalId) and.push({ hospitalId });
  if (r.excludeUserId) and.push({ id: { not: r.excludeUserId } });
  return { AND: and };
};

export const notify = async (input: NotifyInput) => {
  try {
    const { type, title, message, recipients } = input;
    const hospitalId = await resolveHospitalId(recipients);
    const where = buildWhere(recipients, hospitalId);
    if (!where) return [];

    const users = (await prisma.user.findMany({ where, select: { id: true, settings: true } })) ?? [];

    const settingKey = TYPE_TO_SETTING[type];
    const targetIds = users
      .filter((u) => {
        if (!settingKey) return true;
        return u.settings ? u.settings[settingKey] : DEFAULT_SETTINGS[settingKey];
      })
      .map((u) => u.id);
    if (!targetIds.length) return [];

    const created =
      (await prisma.notification.createManyAndReturn({
        data: targetIds.map((userId) => ({ userId, type, title, message, link: input.link ?? null })),
      })) ?? [];

    created.forEach((n) => io.to(`user-${n.userId}`).emit('new-notification', n));
    return created;
  } catch (error) {
    logger.error({ err: error }, '[Notifications] notify failed:');
    return [];
  }
};

/** Single-user delivery without settings filtering (kept for the legacy helper). */
export const createNotification = async (data: {
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string;
}) => {
  try {
    const notification = await prisma.notification.create({ data });
    io.to(`user-${data.userId}`).emit('new-notification', notification);
    return notification;
  } catch (error) {
    logger.error({ err: error }, 'Failed to create notification:');
    return null;
  }
};
