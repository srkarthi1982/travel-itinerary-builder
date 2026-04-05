import type { Alpine } from "alpinejs";

export type TripSummary = {
  id: string;
  title: string;
  destination: string;
  status: string;
};

type TravelStore = {
  trips: TripSummary[];
  selectedTab: string;
  activeTripId: string | null;
  drawers: {
    trip: boolean;
    day: boolean;
    activity: boolean;
  };
  loading: {
    createTrip: boolean;
    createDay: boolean;
    createActivity: boolean;
  };
  flash: {
    type: "success" | "error";
    message: string;
  };
  setTrips(trips: TripSummary[]): void;
  setTab(tab: string): void;
  openDrawer(name: "trip" | "day" | "activity"): void;
  closeDrawer(name: "trip" | "day" | "activity"): void;
  notify(type: "success" | "error", message: string): void;
};

export function registerTravelStore(Alpine: Alpine) {
  const store: TravelStore = {
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
  };

  Alpine.store("travel", store);
}
