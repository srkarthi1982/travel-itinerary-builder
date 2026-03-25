import { NOW, column, defineTable } from "astro:db";

export const Trips = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    userId: column.text({ index: true }),
    title: column.text(),
    destination: column.text(),
    startDate: column.date(),
    endDate: column.date(),
    notes: column.text({ optional: true }),
    status: column.text({ default: "draft", index: true }),
    createdAt: column.date({ default: NOW, index: true }),
    updatedAt: column.date({ default: NOW }),
    archivedAt: column.date({ optional: true }),
  },
});

export const TripDays = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    tripId: column.text({ references: () => Trips.columns.id, index: true }),
    dayNumber: column.number(),
    date: column.date({ optional: true }),
    title: column.text({ optional: true }),
    notes: column.text({ optional: true }),
    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
});

export const TripActivities = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    tripDayId: column.text({ references: () => TripDays.columns.id, index: true }),
    title: column.text(),
    location: column.text({ optional: true }),
    startTime: column.text({ optional: true }),
    endTime: column.text({ optional: true }),
    category: column.text({ optional: true }),
    description: column.text({ optional: true }),
    sortOrder: column.number({ default: 0 }),
    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
});

export const tables = { Trips, TripDays, TripActivities };
