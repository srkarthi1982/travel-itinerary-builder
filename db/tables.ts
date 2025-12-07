/**
 * Travel Itinerary Builder - plan trips with days and activities.
 *
 * Design goals:
 * - Trips (destination, dates).
 * - Days within each trip.
 * - Activities/segments per day (flights, stays, visits).
 */

import { defineTable, column, NOW } from "astro:db";

export const Trips = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    userId: column.text(),

    name: column.text(),                           // "Dubai National Day Trip"
    destination: column.text({ optional: true }),  // "Dubai, UAE"
    startDate: column.date({ optional: true }),
    endDate: column.date({ optional: true }),

    primaryTimeZone: column.text({ optional: true }), // base TZ for schedule
    notes: column.text({ optional: true }),

    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
});

export const TripDays = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    tripId: column.text({
      references: () => Trips.columns.id,
    }),

    dayNumber: column.number(),                    // 1, 2, 3...
    date: column.date({ optional: true }),
    summary: column.text({ optional: true }),

    createdAt: column.date({ default: NOW }),
  },
});

export const TripActivities = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    tripId: column.text({
      references: () => Trips.columns.id,
    }),
    tripDayId: column.text({
      references: () => TripDays.columns.id,
      optional: true,
    }),

    orderIndex: column.number({ optional: true }), // sequence within the day
    type: column.text({ optional: true }),         // "flight", "hotel", "visit", "transport", "meal"
    title: column.text(),                          // "Flight DXB -> MAA", "Visit Louvre Abu Dhabi"
    description: column.text({ optional: true }),

    locationName: column.text({ optional: true }),
    address: column.text({ optional: true }),
    startTimeLocal: column.text({ optional: true }), // "10:00"
    endTimeLocal: column.text({ optional: true }),

    bookingReference: column.text({ optional: true }),
    bookingUrl: column.text({ optional: true }),

    notes: column.text({ optional: true }),

    createdAt: column.date({ default: NOW }),
  },
});

export const tables = {
  Trips,
  TripDays,
  TripActivities,
} as const;
