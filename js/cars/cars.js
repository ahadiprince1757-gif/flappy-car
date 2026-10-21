export const CARS = {
  cyber: {
    id: "cyber",
    name: "Cyber GT",
    price: 0,
    speed: 20,
    acceleration: 1.1,
    handling: 1.1,
    bodyColor: "#06b6d4",
    cabinColor: "#0f172a",
    accentColor: "#38bdf8",
    style: "sport"
  },

  inferno: {
    id: "inferno",
    name: "Inferno V8",
    price: 0,
    speed: 23,
    acceleration: 1.25,
    handling: 1.0,
    bodyColor: "#ef4444",
    cabinColor: "#1e1b4b",
    accentColor: "#f97316",
    style: "muscle"
  },

  neon: {
    id: "neon",
    name: "Neon Apex",
    price: 0,
    speed: 25,
    acceleration: 1.3,
    handling: 1.2,
    bodyColor: "#8b5cf6",
    cabinColor: "#09090b",
    accentColor: "#d946ef",
    style: "futuristic"
  },

  phantom: {
    id: "phantom",
    name: "Phantom X",
    price: 0,
    speed: 28,
    acceleration: 1.4,
    handling: 1.15,
    bodyColor: "#f8fafc",
    cabinColor: "#0f172a",
    accentColor: "#38bdf8",
    style: "luxury"
  }
};

export function getCarConfig(carId) {
  return CARS[carId] ?? CARS.cyber;
}

export function getAllCars() {
  return Object.values(CARS);
}
