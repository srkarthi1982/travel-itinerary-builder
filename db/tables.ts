import { NOW, column, defineTable } from "astro:db";

export const Trips = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    userId: column.text(),
    name: column.text({ optional: true, deprecated: true }),
    title: column.text({ optional: true }),
    destination: column.text({ optional: true }),
    startDate: column.date({ optional: true }),
    endDate: column.date({ optional: true }),
    primaryTimeZone: column.text({ optional: true, deprecated: true }),
    notes: column.text({ optional: true }),
    status: column.text({ default: "draft" }),
    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
    archivedAt: column.date({ optional: true }),
  },
  indexes: {
    tripsUserIdx: { on: ["userId"] },
    tripsStatusIdx: { on: ["status"] },
    tripsCreatedAtIdx: { on: ["createdAt"] },
  },
});

export const TripDays = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    tripId: column.text({ references: () => Trips.columns.id }),
    dayNumber: column.number(),
    date: column.date({ optional: true }),
    summary: column.text({ optional: true, deprecated: true }),
    title: column.text({ optional: true }),
    notes: column.text({ optional: true }),
    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
  indexes: {
    tripDaysTripIdx: { on: ["tripId"] },
  },
});

export const TripActivities = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    tripId: column.text({ references: () => Trips.columns.id, optional: true, deprecated: true }),
    tripDayId: column.text({ references: () => TripDays.columns.id }),
    orderIndex: column.number({ optional: true, deprecated: true }),
    type: column.text({ optional: true, deprecated: true }),
    title: column.text(),
    locationName: column.text({ optional: true, deprecated: true }),
    address: column.text({ optional: true, deprecated: true }),
    location: column.text({ optional: true }),
    startTimeLocal: column.text({ optional: true, deprecated: true }),
    endTimeLocal: column.text({ optional: true, deprecated: true }),
    startTime: column.text({ optional: true }),
    endTime: column.text({ optional: true }),
    category: column.text({ optional: true }),
    description: column.text({ optional: true }),
    bookingReference: column.text({ optional: true, deprecated: true }),
    bookingUrl: column.text({ optional: true, deprecated: true }),
    notes: column.text({ optional: true, deprecated: true }),
    sortOrder: column.number({ default: 0 }),
    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
  indexes: {
    tripActivitiesDayIdx: { on: ["tripDayId"] },
  },
});

export const tables = { Trips, TripDays, TripActivities };
