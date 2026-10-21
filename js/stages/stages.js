export const STAGES = {
  city: {
    id: "city",
    name: "Metropolis City",
    price: 0,

    skyColor: "#7dd3fc",
    fogColor: "#bae6fd",
    groundColor: "#475569",
    roadColor: "#1e293b",
    laneColor: "#f8fafc",
    sidewalkColor: "#94a3b8",

    buildingColors: [
      "#334155",
      "#475569",
      "#64748b",
      "#94a3b8",
      "#0284c7"
    ],

    scenery: "city"
  },

  beach: {
    id: "beach",
    name: "Sunset Coast",
    price: 0,

    skyColor: "#fdba74",
    fogColor: "#fed7aa",
    groundColor: "#fde047",
    roadColor: "#334155",
    laneColor: "#ffffff",
    sidewalkColor: "#d97706",

    buildingColors: [
      "#fb923c",
      "#f43f5e",
      "#38bdf8"
    ],

    scenery: "beach"
  },

  jungle: {
    id: "jungle",
    name: "Rainforest Trail",
    price: 0,

    skyColor: "#86efac",
    fogColor: "#bbf7d0",
    groundColor: "#15803d",
    roadColor: "#1c1917",
    laneColor: "#fef08a",
    sidewalkColor: "#166534",

    buildingColors: [
      "#16a34a",
      "#22c55e",
      "#14532d"
    ],

    scenery: "jungle"
  },

  desert: {
    id: "desert",
    name: "Dune Canyon",
    price: 0,

    skyColor: "#fdba74",
    fogColor: "#fed7aa",
    groundColor: "#d97706",
    roadColor: "#292524",
    laneColor: "#fef3c7",
    sidewalkColor: "#b45309",

    buildingColors: [
      "#ea580c",
      "#c2410c",
      "#f59e0b"
    ],

    scenery: "desert"
  },

  village: {
    id: "village",
    name: "Alpine Resort",
    price: 0,

    skyColor: "#93c5fd",
    fogColor: "#bfdbfe",
    groundColor: "#16a34a",
    roadColor: "#334155",
    laneColor: "#f8fafc",
    sidewalkColor: "#64748b",

    buildingColors: [
      "#78350f",
      "#92400e",
      "#b45309"
    ],

    scenery: "village"
  }
};

export function getStageConfig(stageId) {
  return STAGES[stageId] ?? STAGES.city;
}

export function getAllStages() {
  return Object.values(STAGES);
}
