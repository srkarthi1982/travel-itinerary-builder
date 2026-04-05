import { db, TripActivities, TripDays, Trips } from "astro:db";

export default async function seed() {
  await db.delete(TripActivities);
  await db.delete(TripDays);
  await db.delete(Trips);
}
