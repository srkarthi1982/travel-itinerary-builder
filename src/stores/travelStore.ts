import type { Alpine } from "alpinejs";

export type TripSummary = {
  id: string;
  title: string;
  destination: string;
  status: string;
};

export function registerTravelStore(Alpine: Alpine) {
  Alpine.store("travel", {
    trips: [] as TripSummary[],
    selectedTab: "overview",
    activeTripId: null as string | null,
    drawers: {
      trip: false,
      day: false,
      activity: false,
    },
    loading: {
      createTrip: false,
      createDay: false,
      createActivity: false,
    },
    flash: {
      type: "success" as "success" | "error",
      message: "",
    },
    setTrips(trips: TripSummary[]) {
      this.trips = trips;
    },
    setTab(tab: string) {
      this.selectedTab = tab;
    },
    openDrawer(name: "trip" | "day" | "activity") {
      this.drawers[name] = true;
    },
    closeDrawer(name: "trip" | "day" | "activity") {
      this.drawers[name] = false;
    },
    notify(type: "success" | "error", message: string) {
      this.flash = { type, message };
      setTimeout(() => {
        this.flash.message = "";
      }, 2500);
    },
  });
}
