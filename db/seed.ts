import { db } from "astro:db";
import { TripActivities, TripDays, Trips } from "./tables";

export default async function seed() {
  await db.delete(TripActivities);
  await db.delete(TripDays);
  await db.delete(Trips);
}
