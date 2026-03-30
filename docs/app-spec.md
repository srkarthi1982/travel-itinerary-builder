# App Spec: travel-itinerary-builder

## 1) App Overview
- **App Name:** Travel Itinerary Builder
- **Category:** Travel / Planning
- **Version:** V1
- **App Type:** DB-backed
- **Purpose:** Help an authenticated user manage trips, trip days, and activity planning in a structured itinerary workspace.
- **Primary User:** A signed-in user planning personal trips.

## 2) User Stories
- As a user, I want to create a trip with destination and date range, so that I can organize travel plans.
- As a user, I want to add days and activities under a trip, so that I can build a day-by-day itinerary.
- As a user, I want to archive, restore, and complete trips, so that I can manage current and past travel plans.

## 3) Core Workflow
1. User signs in and opens `/app`.
2. User creates a trip from the workspace modal.
3. App stores the trip in the user-scoped database and lists it under active trips.
4. User opens the trip detail route to add days and activities under each day.
5. User marks the trip completed or archives/restores it from the workspace and detail flow.

## 4) Functional Behavior
- Trips are stored per user with destination, date range, notes, status, and archive state.
- Trip detail supports adding and deleting trip days and activities, plus marking the trip completed.
- `/app` and trip detail routes are protected and scoped to the authenticated owner.
- Current implementation focuses on private itinerary planning and does not include booking, budgeting, or public sharing.

## 5) Data & Storage
- **Storage type:** Astro DB on the app’s isolated Turso database
- **Main entities:** Trips, TripDays, TripActivities
- **Persistence expectations:** Trip data persists across refresh and future sessions for the authenticated owner.
- **User model:** Multi-user shared infrastructure with per-user isolation

## 6) Special Logic (Optional)
- Workspace summary distinguishes active, completed, and archived trips from the current user’s full trip list.
- Trips can hold multiple days, and each day can hold multiple ordered activity records.

## 7) Edge Cases & Error Handling
- Invalid IDs/routes: Missing or invalid trip IDs redirect safely back to `/app`.
- Empty input: Trip title, destination, and date range are required before save.
- Unauthorized access: Protected routes redirect to the parent login flow.
- Missing records: Missing or non-owned trips should not expose data.
- Invalid payload/state: Invalid day or activity payloads should fail safely instead of corrupting itinerary records.

## 8) Tester Verification Guide
### Core flow tests
- [ ] Create a trip, open its detail route, add a day, then add an activity under that day.
- [ ] Mark the trip completed, archive it, restore it, and confirm each state change is reflected in the workspace.

### Safety tests
- [ ] Open an invalid or missing trip detail route and confirm the app falls back safely.
- [ ] Attempt to save a trip without required fields and confirm the request is rejected.
- [ ] Confirm deleting a day or activity only affects that user’s trip records.

### Negative tests
- [ ] Confirm there is no booking integration or map planning in V1.
- [ ] Confirm there is no permanent delete flow for trips in the documented V1 behavior.

## 9) Out of Scope (V1)
- Booking, reservations, or travel payments
- Shared trip planning between users
- Budgeting and expense tracking

## 10) Freeze Notes
- V1 release freeze: this document reflects the current repo implementation before final browser verification.
- This spec was populated conservatively from current routes, stores, and DB tables; runtime route safety and form validation should be confirmed during freeze verification.
- During freeze, only verification fixes and cleanup are allowed; no undocumented feature expansion.
