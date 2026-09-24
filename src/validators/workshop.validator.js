const { z } = require('zod');
const { objectId, paginationQuery } = require('./common.validator');
const { WORKSHOP_STATUS, REGISTRATION_STATUS } = require('../constants/enums');

const date = (label) => z.coerce.date({ error: `${label} must be a valid date (ISO 8601, e.g. 2026-10-05T10:00:00+05:30)` });

const fields = {
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(120),
  description: z.string().trim().min(10, 'Description must be at least 10 characters').max(2000),
  trainer: z.string().trim().min(2).max(80),
  venue: z.string().trim().min(2).max(120),
  startAt: date('startAt'),
  endAt: date('endAt'),
  capacity: z.number({ error: 'Capacity must be a number' }).int('Capacity must be a whole number').min(1).max(10000),
  noShowGraceMinutes: z.number().int().min(0).max(120),
};

const endAfterStart = (d) => !(d.startAt && d.endAt) || d.endAt > d.startAt;
const endAfterStartMsg = { message: 'endAt must be after startAt', path: ['endAt'] };

// status / seatsTaken / createdBy are never accepted from clients (stripped)
const create = z
  .object({ ...fields, noShowGraceMinutes: fields.noShowGraceMinutes.optional() })
  .refine(endAfterStart, endAfterStartMsg)
  .refine((d) => d.startAt > new Date(), { message: 'startAt must be in the future', path: ['startAt'] });

const update = z
  .object(Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.optional()])))
  .refine((d) => Object.keys(d).length > 0, { message: 'Provide at least one field to update' })
  .refine(endAfterStart, endAfterStartMsg);

const changeStatus = z.object({
  status: z.enum([WORKSHOP_STATUS.PUBLISHED, WORKSHOP_STATUS.CANCELLED, WORKSHOP_STATUS.COMPLETED], {
    error: 'status must be PUBLISHED, CANCELLED or COMPLETED',
  }),
  reason: z.string().trim().max(300).optional(),
});

const assignSpotRegistrars = z.object({
  userIds: z
    .array(objectId)
    .max(20)
    .transform((ids) => [...new Set(ids)]),
});

const SORTS = ['startAt', '-startAt', 'createdAt', '-createdAt', 'title', '-title'];

const listQuery = paginationQuery.extend({
  search: z.string().trim().min(1).max(100).optional(),
  status: z.enum(Object.values(WORKSHOP_STATUS)).optional(),
  trainer: z.string().trim().min(1).max(80).optional(),
  from: date('from').optional(),
  to: date('to').optional(),
  upcoming: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  sort: z.enum(SORTS).default('startAt'),
});

const participantsQuery = paginationQuery.extend({
  status: z.enum(Object.values(REGISTRATION_STATUS)).optional(),
  search: z.string().trim().min(1).max(100).optional(),
});

module.exports = { create, update, changeStatus, assignSpotRegistrars, listQuery, participantsQuery, SORTS };
