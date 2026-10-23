export const STAGES = {
  city: {
    id: "city",
    name: "Metropolis City",
    price: 0,
    category: "URBAN HIGHWAY",
    tagline: "Neon-lit cyber skyline with glass towers & high-speed traffic",
    atmosphere: "Clear Night · Neon",
    gripRating: "10.0 / 10",
    difficulty: "REGULAR",
    badgeColor: "#00efff",

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

  savannah: {
    id: "savannah",
    name: "African Savannah",
    price: 0,
    category: "WILD SAVANNAH",
    tagline: "Golden grassland plains with acacia trees and radiant sunset",
    atmosphere: "Sunset Glow · Warm Amber",
    gripRating: "8.5 / 10",
    difficulty: "ADVANCED",
    badgeColor: "#f59e0b",

    skyColor: "#f59e0b",
    fogColor: "#fde68a",
    groundColor: "#a16207",
    roadColor: "#44403c",
    laneColor: "#fefce8",
    sidewalkColor: "#78350f",

    buildingColors: [
      "#92400e",
      "#78350f",
      "#451a03",
      "#a16207",
      "#713f12"
    ],

    scenery: "savannah"
  },

  desert: {
    id: "desert",
    name: "Dune Canyon",
    price: 0,
    category: "DESERT CANYON",
    tagline: "Scorching red rock canyon roads carved through desert dunes",
    atmosphere: "High Noon · Heat Haze",
    gripRating: "7.8 / 10",
    difficulty: "PRO RACER",
    badgeColor: "#ea580c",

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

  jungle: {
    id: "jungle",
    name: "Rainforest Trail",
    price: 0,
    category: "TROPICAL JUNGLE",
    tagline: "Dense emerald rainforest canopy with winding misty roads",
    atmosphere: "Misty Rain · Humid",
    gripRating: "7.2 / 10",
    difficulty: "EXPERT",
    badgeColor: "#10b981",

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

  beach: {
    id: "beach",
    name: "Sunset Coast",
    price: 0,
    category: "COASTAL BOULEVARD",
    tagline: "Breathtaking seaside highway with palm trees and ocean breeze",
    atmosphere: "Golden Hour · Coastal",
    gripRating: "9.0 / 10",
    difficulty: "CASUAL",
    badgeColor: "#38bdf8",

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

  village: {
    id: "village",
    name: "Alpine Resort",
    price: 0,
    category: "ALPINE PEAKS",
    tagline: "Snow-dusted mountain valley pass with tall evergreen pines",
    atmosphere: "Crisp Morning · Mountain Air",
    gripRating: "6.8 / 10",
    difficulty: "MASTER",
    badgeColor: "#a855f7",

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
