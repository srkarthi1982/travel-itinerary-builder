import { randomUUID } from "node:crypto";

import { ActionError, defineAction, type ActionAPIContext } from "astro:actions";
import { and, asc, db, eq, TripActivities, TripDays, Trips } from "astro:db";
import { z } from "astro:schema";
import { pushDashboardSummary, pushNotification } from "../lib/integrations";

const tripStatusSchema = z.enum(["draft", "planned", "completed", "archived", "cancelled"]);

function requireUser(context: ActionAPIContext) {
  const user = (context.locals as App.Locals | undefined)?.user;
  if (!user) {
    throw new ActionError({ code: "UNAUTHORIZED", message: "Please sign in to continue." });
  }
  return user;
}

function parseDate(value: string, fieldName: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ActionError({ code: "BAD_REQUEST", message: `Invalid ${fieldName}.` });
  }
  return date;
}

function parseOptionalDate(value: string | null | undefined, fieldName: string) {
  if (value == null || value === "") return null;
  return parseDate(value, fieldName);
}

function assertDateRange(startDate: Date, endDate: Date) {
  if (endDate < startDate) {
    throw new ActionError({ code: "BAD_REQUEST", message: "End date cannot be before start date." });
  }
}

async function getOwnedTrip(tripId: string, userId: string) {
  const rows = await db.select().from(Trips).where(and(eq(Trips.id, tripId), eq(Trips.userId, userId)));
  const trip = rows[0];
  if (!trip) {
    throw new ActionError({ code: "NOT_FOUND", message: "Trip not found." });
  }
  return trip;
}

async function getOwnedDay(dayId: string, userId: string) {
  const rows = await db
    .select({ day: TripDays, trip: Trips })
    .from(TripDays)
    .innerJoin(Trips, eq(Trips.id, TripDays.tripId))
    .where(and(eq(TripDays.id, dayId), eq(Trips.userId, userId)));

  const day = rows[0];
  if (!day) {
    throw new ActionError({ code: "NOT_FOUND", message: "Trip day not found." });
  }

  return day;
}

async function recalcAndPushSummary(userId: string) {
  const trips = await db.select().from(Trips).where(eq(Trips.userId, userId));
  const ordered = [...trips].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  const recent = ordered[0];

  await pushDashboardSummary({
    userId,
    totalTrips: trips.length,
    plannedTrips: trips.filter((trip) => trip.status === "planned" || trip.status === "draft").length,
    completedTrips: trips.filter((trip) => trip.status === "completed").length,
    recentTrip: recent ? { title: recent.title, destination: recent.destination } : undefined,
  });
}

export const server = {
  createTrip: defineAction({
    input: z.object({
      title: z.string().min(2, "Trip title is required."),
      destination: z.string().min(2, "Destination is required."),
      startDate: z.string(),
      endDate: z.string(),
      notes: z.string().optional().nullable(),
      status: tripStatusSchema.default("planned"),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const startDate = parseDate(input.startDate, "start date");
      const endDate = parseDate(input.endDate, "end date");
      assertDateRange(startDate, endDate);

      const now = new Date();
      const trip = {
        id: randomUUID(),
        userId: user.id,
        title: input.title.trim(),
        destination: input.destination.trim(),
        startDate,
        endDate,
        notes: input.notes || null,
        status: input.status,
        createdAt: now,
        updatedAt: now,
      } satisfies typeof Trips.$inferInsert;

      await db.insert(Trips).values(trip);
      await recalcAndPushSummary(user.id);
      await pushNotification({
        userId: user.id,
        title: "Trip created",
        message: `Your trip to ${trip.destination} is ready to plan.`,
        level: "success",
      });

      return { success: true, data: { trip } };
    },
  }),

  updateTrip: defineAction({
    input: z.object({
      id: z.string().min(1),
      title: z.string().min(2).optional(),
      destination: z.string().min(2).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      notes: z.string().optional().nullable(),
      status: tripStatusSchema.optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const trip = await getOwnedTrip(input.id, user.id);

      const startDate = input.startDate ? parseDate(input.startDate, "start date") : trip.startDate;
      const endDate = input.endDate ? parseDate(input.endDate, "end date") : trip.endDate;
      assertDateRange(startDate, endDate);

      const updates = {
        title: input.title?.trim() ?? trip.title,
        destination: input.destination?.trim() ?? trip.destination,
        startDate,
        endDate,
        notes: input.notes !== undefined ? input.notes : trip.notes,
        status: input.status ?? trip.status,
        archivedAt: input.status === "archived" ? new Date() : input.status ? null : trip.archivedAt,
        updatedAt: new Date(),
      } satisfies Partial<typeof Trips.$inferInsert>;

      await db.update(Trips).set(updates).where(and(eq(Trips.id, trip.id), eq(Trips.userId, user.id)));

      if (input.status === "completed") {
        await pushNotification({
          userId: user.id,
          title: "Trip completed",
          message: `Nice work wrapping up ${updates.title}.`,
          level: "success",
        });
      }

      await recalcAndPushSummary(user.id);
      return { success: true };
    },
  }),

  archiveTrip: defineAction({
    input: z.object({ id: z.string().min(1) }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedTrip(input.id, user.id);

      await db
        .update(Trips)
        .set({ status: "archived", archivedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(Trips.id, input.id), eq(Trips.userId, user.id)));

      await recalcAndPushSummary(user.id);
      return { success: true };
    },
  }),

  restoreTrip: defineAction({
    input: z.object({ id: z.string().min(1) }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedTrip(input.id, user.id);

      await db
        .update(Trips)
        .set({ status: "planned", archivedAt: null, updatedAt: new Date() })
        .where(and(eq(Trips.id, input.id), eq(Trips.userId, user.id)));

      await recalcAndPushSummary(user.id);
      return { success: true };
    },
  }),

  createTripDay: defineAction({
    input: z.object({
      tripId: z.string().min(1),
      dayNumber: z.number().int().positive(),
      date: z.string().optional().nullable(),
      title: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const trip = await getOwnedTrip(input.tripId, user.id);
      const date = parseOptionalDate(input.date, "day date");

      if (date && (date < trip.startDate || date > trip.endDate)) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: "Day date should be within your trip date range.",
        });
      }

      const now = new Date();
      const day = {
        id: randomUUID(),
        tripId: trip.id,
        dayNumber: input.dayNumber,
        date,
        title: input.title || null,
        notes: input.notes || null,
        createdAt: now,
        updatedAt: now,
      } satisfies typeof TripDays.$inferInsert;

      await db.insert(TripDays).values(day);
      await db.update(Trips).set({ updatedAt: now }).where(eq(Trips.id, trip.id));
      await recalcAndPushSummary(user.id);

      return { success: true, data: { day } };
    },
  }),

  updateTripDay: defineAction({
    input: z.object({
      id: z.string().min(1),
      dayNumber: z.number().int().positive(),
      date: z.string().optional().nullable(),
      title: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const { day, trip } = await getOwnedDay(input.id, user.id);
      const date = parseOptionalDate(input.date, "day date");

      if (date && (date < trip.startDate || date > trip.endDate)) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: "Day date should be within your trip date range.",
        });
      }

      await db
        .update(TripDays)
        .set({
          dayNumber: input.dayNumber,
          date,
          title: input.title || null,
          notes: input.notes || null,
          updatedAt: new Date(),
        })
        .where(eq(TripDays.id, day.id));

      await db.update(Trips).set({ updatedAt: new Date() }).where(eq(Trips.id, trip.id));
      return { success: true };
    },
  }),

  deleteTripDay: defineAction({
    input: z.object({ id: z.string().min(1) }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const { day, trip } = await getOwnedDay(input.id, user.id);
      await db.delete(TripActivities).where(eq(TripActivities.tripDayId, day.id));
      await db.delete(TripDays).where(eq(TripDays.id, day.id));
      await db.update(Trips).set({ updatedAt: new Date() }).where(eq(Trips.id, trip.id));
      return { success: true };
    },
  }),

  createTripActivity: defineAction({
    input: z.object({
      tripDayId: z.string().min(1),
      title: z.string().min(1),
      location: z.string().optional().nullable(),
      startTime: z.string().optional().nullable(),
      endTime: z.string().optional().nullable(),
      category: z.string().optional().nullable(),
      description: z.string().optional().nullable(),
      sortOrder: z.number().int().optional().default(0),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const { day, trip } = await getOwnedDay(input.tripDayId, user.id);

      const now = new Date();
      const activity = {
        id: randomUUID(),
        tripDayId: day.id,
        title: input.title.trim(),
        location: input.location || null,
        startTime: input.startTime || null,
        endTime: input.endTime || null,
        category: input.category || null,
        description: input.description || null,
        sortOrder: input.sortOrder,
        createdAt: now,
        updatedAt: now,
      } satisfies typeof TripActivities.$inferInsert;

      await db.insert(TripActivities).values(activity);
      await db.update(Trips).set({ updatedAt: now }).where(eq(Trips.id, trip.id));

      return { success: true, data: { activity } };
    },
  }),

  updateTripActivity: defineAction({
    input: z.object({
      id: z.string().min(1),
      title: z.string().min(1),
      location: z.string().optional().nullable(),
      startTime: z.string().optional().nullable(),
      endTime: z.string().optional().nullable(),
      category: z.string().optional().nullable(),
      description: z.string().optional().nullable(),
      sortOrder: z.number().int().optional().default(0),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const rows = await db
        .select({ activity: TripActivities, day: TripDays, trip: Trips })
        .from(TripActivities)
        .innerJoin(TripDays, eq(TripDays.id, TripActivities.tripDayId))
        .innerJoin(Trips, eq(Trips.id, TripDays.tripId))
        .where(and(eq(TripActivities.id, input.id), eq(Trips.userId, user.id)));

      const row = rows[0];
      if (!row) {
        throw new ActionError({ code: "NOT_FOUND", message: "Activity not found." });
      }

      await db
        .update(TripActivities)
        .set({
          title: input.title.trim(),
          location: input.location || null,
          startTime: input.startTime || null,
          endTime: input.endTime || null,
          category: input.category || null,
          description: input.description || null,
          sortOrder: input.sortOrder,
          updatedAt: new Date(),
        })
        .where(eq(TripActivities.id, row.activity.id));

      await db.update(Trips).set({ updatedAt: new Date() }).where(eq(Trips.id, row.trip.id));
      return { success: true };
    },
  }),

  deleteTripActivity: defineAction({
    input: z.object({ id: z.string().min(1) }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const rows = await db
        .select({ activity: TripActivities, trip: Trips, day: TripDays })
        .from(TripActivities)
        .innerJoin(TripDays, eq(TripDays.id, TripActivities.tripDayId))
        .innerJoin(Trips, eq(Trips.id, TripDays.tripId))
        .where(and(eq(TripActivities.id, input.id), eq(Trips.userId, user.id)));

      const row = rows[0];
      if (!row) {
        throw new ActionError({ code: "NOT_FOUND", message: "Activity not found." });
      }

      await db.delete(TripActivities).where(eq(TripActivities.id, row.activity.id));
      await db.update(Trips).set({ updatedAt: new Date() }).where(eq(Trips.id, row.trip.id));

      return { success: true };
    },
  }),

  reorderTripActivities: defineAction({
    input: z.object({
      tripDayId: z.string().min(1),
      activityIds: z.array(z.string().min(1)),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedDay(input.tripDayId, user.id);

      for (const [index, activityId] of input.activityIds.entries()) {
        await db
          .update(TripActivities)
          .set({ sortOrder: index, updatedAt: new Date() })
          .where(and(eq(TripActivities.id, activityId), eq(TripActivities.tripDayId, input.tripDayId)));
      }

      return { success: true };
    },
  }),

  listTrips: defineAction({
    input: z.object({ includeArchived: z.boolean().default(true) }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const trips = await db.select().from(Trips).where(eq(Trips.userId, user.id)).orderBy(asc(Trips.startDate));
      return {
        success: true,
        data: {
          trips: input.includeArchived ? trips : trips.filter((trip) => trip.status !== "archived"),
        },
      };
    },
  }),

  getTripDetail: defineAction({
    input: z.object({ id: z.string().min(1) }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const trip = await getOwnedTrip(input.id, user.id);
      const days = await db.select().from(TripDays).where(eq(TripDays.tripId, trip.id)).orderBy(asc(TripDays.dayNumber));

      const activities = await db
        .select()
        .from(TripActivities)
        .innerJoin(TripDays, eq(TripDays.id, TripActivities.tripDayId))
        .where(eq(TripDays.tripId, trip.id));

      return {
        success: true,
        data: {
          trip,
          days,
          activitiesByDay: days.map((day) => ({
            dayId: day.id,
            activities: activities
              .filter((row) => row.TripActivities.tripDayId === day.id)
              .map((row) => row.TripActivities)
              .sort((a, b) => a.sortOrder - b.sortOrder),
          })),
        },
      };
    },
  }),
};
