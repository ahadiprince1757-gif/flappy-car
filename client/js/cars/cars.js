export const CARS = {
  cyber: {
    id: "cyber",
    name: "Cyber GT",
    price: 0,
    speed: 24,
    acceleration: 1.2,
    handling: 1.15,
    bodyColor: "#06b6d4",
    cabinColor: "#0f172a",
    accentColor: "#38bdf8",
    style: "sport",
    modelKey: "sport"
  },

  inferno: {
    id: "inferno",
    name: "Inferno V8",
    price: 0,
    speed: 26,
    acceleration: 1.35,
    handling: 1.05,
    bodyColor: "#ef4444",
    cabinColor: "#1e1b4b",
    accentColor: "#f97316",
    style: "muscle",
    modelKey: "sport2"
  },

  neon: {
    id: "neon",
    name: "Neon Apex",
    price: 0,
    speed: 25,
    acceleration: 1.25,
    handling: 1.3,
    bodyColor: "#8b5cf6",
    cabinColor: "#09090b",
    accentColor: "#d946ef",
    style: "futuristic",
    modelKey: "hatchback"
  },

  phantom: {
    id: "phantom",
    name: "Phantom SUV",
    price: 0,
    speed: 22,
    acceleration: 1.15,
    handling: 1.2,
    bodyColor: "#e2e8f0",
    cabinColor: "#0f172a",
    accentColor: "#38bdf8",
    style: "suv",
    modelKey: "suv"
  },

  taxi: {
    id: "taxi",
    name: "Metro Cab",
    price: 0,
    speed: 23,
    acceleration: 1.2,
    handling: 1.1,
    bodyColor: "#eab308",
    cabinColor: "#18181b",
    accentColor: "#fef08a",
    style: "taxi",
    modelKey: "taxi"
  },

  cop: {
    id: "cop",
    name: "Highway Patrol",
    price: 0,
    speed: 27,
    acceleration: 1.4,
    handling: 1.25,
    bodyColor: "#0f172a",
    cabinColor: "#f8fafc",
    accentColor: "#3b82f6",
    style: "police",
    modelKey: "cop"
  },

  cruiser: {
    id: "cruiser",
    name: "Urban Cruiser",
    price: 0,
    speed: 21,
    acceleration: 1.1,
    handling: 1.1,
    bodyColor: "#3b82f6",
    cabinColor: "#1e293b",
    accentColor: "#93c5fd",
    style: "sedan",
    modelKey: "sedan"
  }
};

export function getCarConfig(carId) {
  return CARS[carId] ?? CARS.cyber;
}

export function getAllCars() {
  return Object.values(CARS);
}
