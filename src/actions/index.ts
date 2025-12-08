import { randomUUID } from "node:crypto";

import { ActionError, type ActionAPIContext, defineAction } from "astro:actions";
import { z } from "astro:schema";
import { and, db, eq, TripActivities, TripDays, Trips } from "astro:db";

function requireUser(context: ActionAPIContext) {
  const locals = context.locals as App.Locals | undefined;
  const user = locals?.user;

  if (!user) {
    throw new ActionError({
      code: "UNAUTHORIZED",
      message: "You must be signed in to perform this action.",
    });
  }

  return user;
}

function parseOptionalDate(value: string | null | undefined, field: string) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ActionError({
      code: "BAD_REQUEST",
      message: `Invalid date provided for ${field}.`,
    });
  }

  return parsed;
}

async function assertTripOwnership(tripId: string, userId: string) {
  const trip = await db
    .select()
    .from(Trips)
    .where(and(eq(Trips.id, tripId), eq(Trips.userId, userId)));

  if (trip.length === 0) {
    throw new ActionError({
      code: "NOT_FOUND",
      message: "Trip not found.",
    });
  }

  return trip[0];
}

async function assertDayBelongsToTrip(tripDayId: string, tripId: string) {
  const day = await db
    .select()
    .from(TripDays)
    .where(and(eq(TripDays.id, tripDayId), eq(TripDays.tripId, tripId)));

  if (day.length === 0) {
    throw new ActionError({
      code: "NOT_FOUND",
      message: "Trip day not found for this trip.",
    });
  }

  return day[0];
}

export const server = {
  createTrip: defineAction({
    input: z.object({
      name: z.string().min(1, "Name is required."),
      destination: z.string().optional(),
      startDate: z.string().optional().nullable(),
      endDate: z.string().optional().nullable(),
      primaryTimeZone: z.string().optional(),
      notes: z.string().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const now = new Date();

      const startDate = parseOptionalDate(input.startDate, "startDate");
      const endDate = parseOptionalDate(input.endDate, "endDate");

      const trip = {
        id: randomUUID(),
        userId: user.id,
        name: input.name,
        destination: input.destination,
        startDate: startDate ?? undefined,
        endDate: endDate ?? undefined,
        primaryTimeZone: input.primaryTimeZone,
        notes: input.notes,
        createdAt: now,
        updatedAt: now,
      } satisfies typeof Trips.$inferInsert;

      await db.insert(Trips).values(trip);

      return {
        success: true,
        data: { trip },
      };
    },
  }),

  updateTrip: defineAction({
    input: z.object({
      id: z.string().min(1, "Trip id is required."),
      name: z.string().min(1).optional(),
      destination: z.string().optional().nullable(),
      startDate: z.string().optional().nullable(),
      endDate: z.string().optional().nullable(),
      primaryTimeZone: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      await assertTripOwnership(input.id, user.id);

      const updates: Record<string, unknown> = {};

      if (input.name !== undefined) updates.name = input.name;
      if (input.destination !== undefined) updates.destination = input.destination;

      const startDate = parseOptionalDate(input.startDate, "startDate");
      if (input.startDate !== undefined) updates.startDate = startDate;

      const endDate = parseOptionalDate(input.endDate, "endDate");
      if (input.endDate !== undefined) updates.endDate = endDate;

      if (input.primaryTimeZone !== undefined) {
        updates.primaryTimeZone = input.primaryTimeZone;
      }

      if (input.notes !== undefined) updates.notes = input.notes;

      if (Object.keys(updates).length === 0) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: "No updates provided.",
        });
      }

      updates.updatedAt = new Date();

      await db
        .update(Trips)
        .set(updates)
        .where(and(eq(Trips.id, input.id), eq(Trips.userId, user.id)));

      const trip = await db
        .select()
        .from(Trips)
        .where(and(eq(Trips.id, input.id), eq(Trips.userId, user.id)));

      return {
        success: true,
        data: { trip: trip[0] },
      };
    },
  }),

  deleteTrip: defineAction({
    input: z.object({
      id: z.string().min(1, "Trip id is required."),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      await assertTripOwnership(input.id, user.id);

      await db.delete(TripActivities).where(eq(TripActivities.tripId, input.id));
      await db.delete(TripDays).where(eq(TripDays.tripId, input.id));
      await db.delete(Trips).where(and(eq(Trips.id, input.id), eq(Trips.userId, user.id)));

      return {
        success: true,
        data: { id: input.id },
      };
    },
  }),

  listMyTrips: defineAction({
    input: z.object({
      page: z.number().int().positive().default(1),
      pageSize: z.number().int().positive().max(100).default(20),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const allTrips = await db
        .select()
        .from(Trips)
        .where(eq(Trips.userId, user.id));

      const offset = (input.page - 1) * input.pageSize;
      const items = allTrips.slice(offset, offset + input.pageSize);

      return {
        success: true,
        data: {
          items,
          total: allTrips.length,
          page: input.page,
          pageSize: input.pageSize,
        },
      };
    },
  }),

  getTripWithDetails: defineAction({
    input: z.object({
      id: z.string().min(1, "Trip id is required."),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const trip = await assertTripOwnership(input.id, user.id);

      const days = await db
        .select()
        .from(TripDays)
        .where(eq(TripDays.tripId, input.id));

      const activities = await db
        .select()
        .from(TripActivities)
        .where(eq(TripActivities.tripId, input.id));

      return {
        success: true,
        data: {
          trip,
          days,
          activities,
        },
      };
    },
  }),

  upsertTripDay: defineAction({
    input: z.object({
      id: z.string().optional(),
      tripId: z.string().min(1, "Trip id is required."),
      dayNumber: z.number().int().positive(),
      date: z.string().optional().nullable(),
      summary: z.string().optional().nullable(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await assertTripOwnership(input.tripId, user.id);

      const date = parseOptionalDate(input.date, "date");

      if (input.id) {
        await db
          .update(TripDays)
          .set({
            dayNumber: input.dayNumber,
            date: date ?? undefined,
            summary: input.summary,
          })
          .where(and(eq(TripDays.id, input.id), eq(TripDays.tripId, input.tripId)));

        const updated = await db
          .select()
          .from(TripDays)
          .where(and(eq(TripDays.id, input.id), eq(TripDays.tripId, input.tripId)));

        if (updated.length === 0) {
          throw new ActionError({
            code: "NOT_FOUND",
            message: "Trip day not found.",
          });
        }

        return { success: true, data: { day: updated[0] } };
      }

      const day = {
        id: randomUUID(),
        tripId: input.tripId,
        dayNumber: input.dayNumber,
        date: date ?? undefined,
        summary: input.summary,
        createdAt: new Date(),
      } satisfies typeof TripDays.$inferInsert;

      await db.insert(TripDays).values(day);

      return { success: true, data: { day } };
    },
  }),

  upsertTripActivity: defineAction({
    input: z.object({
      id: z.string().optional(),
      tripId: z.string().min(1, "Trip id is required."),
      tripDayId: z.string().optional().nullable(),
      orderIndex: z.number().int().optional().nullable(),
      type: z.string().optional().nullable(),
      title: z.string().min(1, "Title is required."),
      description: z.string().optional().nullable(),
      locationName: z.string().optional().nullable(),
      address: z.string().optional().nullable(),
      startTimeLocal: z.string().optional().nullable(),
      endTimeLocal: z.string().optional().nullable(),
      bookingReference: z.string().optional().nullable(),
      bookingUrl: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await assertTripOwnership(input.tripId, user.id);

      if (input.tripDayId) {
        await assertDayBelongsToTrip(input.tripDayId, input.tripId);
      }

      const activityValues = {
        tripId: input.tripId,
        tripDayId: input.tripDayId ?? undefined,
        orderIndex: input.orderIndex ?? undefined,
        type: input.type ?? undefined,
        title: input.title,
        description: input.description ?? undefined,
        locationName: input.locationName ?? undefined,
        address: input.address ?? undefined,
        startTimeLocal: input.startTimeLocal ?? undefined,
        endTimeLocal: input.endTimeLocal ?? undefined,
        bookingReference: input.bookingReference ?? undefined,
        bookingUrl: input.bookingUrl ?? undefined,
        notes: input.notes ?? undefined,
      } satisfies Partial<typeof TripActivities.$inferInsert>;

      if (input.id) {
        await db
          .update(TripActivities)
          .set(activityValues)
          .where(and(eq(TripActivities.id, input.id), eq(TripActivities.tripId, input.tripId)));

        const updated = await db
          .select()
          .from(TripActivities)
          .where(and(eq(TripActivities.id, input.id), eq(TripActivities.tripId, input.tripId)));

        if (updated.length === 0) {
          throw new ActionError({
            code: "NOT_FOUND",
            message: "Activity not found.",
          });
        }

        return { success: true, data: { activity: updated[0] } };
      }

      const activity = {
        id: randomUUID(),
        ...activityValues,
        createdAt: new Date(),
      } satisfies typeof TripActivities.$inferInsert;

      await db.insert(TripActivities).values(activity);

      return { success: true, data: { activity } };
    },
  }),
};
