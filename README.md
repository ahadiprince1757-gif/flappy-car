# 🏎️ Flappy Car 3D — Full-Stack Edition

A high-octane 3D arcade highway driving and racing game built with Three.js, ES6 modules, custom cyberpunk CSS, and an Express.js backend for high scores, garage state, and stage progression.

---

## 🌟 Architecture Overview

The repository is organized into a clean separation of concerns:
- **`client/`**: Modern 3D frontend web client (Three.js WebGL canvas, HUD overlays, procedural stage generation, FBX car loaders, synthesis audio, and REST API service).
- **`server/`**: Lightweight Node.js + Express backend providing persistent REST endpoints for leaderboards, cloud saves, garage upgrades, and circuit progression.

```
FLAPPY CAR/
├── client/                      # 🌐 Frontend Web Application
│   ├── index.html               # Game layout, 3D canvas viewport & menus
│   ├── style.css                # Arcade & cyberpunk UI styling
│   ├── assets/                  # 3D models, textures, and images
│   │   ├── models/              # FBX models for cars and buildings
│   │   ├── textures/            # Procedural and building textures
│   │   └── tixar.png            # Arcade title visual
│   └── js/                      # Modular ES6 frontend codebase
│       ├── main.js              # Game bootstrap & initialization
│       ├── cars/                # Car configurations, stats & FBX loaders
│       ├── core/                # Three.js scene, camera, loop & storage
│       ├── obstacles/           # Procedural road hazards & spawner
│       ├── player/              # Player physics, boost & steering
│       ├── racing/              # Racing stage levels & objective rules
│       ├── services/            # Backend REST API client & cloud sync
│       ├── stages/              # 3D curved roads, environments & skybox
│       ├── systems/             # Web Audio synth, coins, effects & collision
│       ├── traffic/             # Dynamic highway traffic vehicles
│       └── ui/                  # Cockpit controls, HUD & menu modals
│
├── server/                      # 🚀 Backend Node.js / Express API
│   ├── server.js                # Server entry, static file hosting & API routing
│   ├── routes/                  # Express REST route controllers
│   │   ├── scores.js            # Leaderboard & score submission
│   │   ├── garage.js            # Vehicle selections & coin wallet
│   │   └── progress.js          # Circuit & stage unlocks
│   └── data/                    # Server-side persistence
│       ├── storage.js           # JSON database access layer
│       └── database.json        # High scores, garage & level save data
│
├── package.json                 # Project dependencies & npm scripts
├── package-lock.json            # Exact lockfile
├── .gitignore                   # Ignore node_modules, temp files, and logs
└── README.md                    # Project documentation
```

---

## 🚀 Quick Start

### 1. Install Dependencies
Make sure you have [Node.js](https://nodejs.org/) (v18+) installed:
```bash
npm install
```

### 2. Start the Server
Run the full-stack server (hosts both backend API and frontend static assets):
```bash
npm start
```

For hot-reload during development:
```bash
npm run dev
```

Open your browser to:
```
http://localhost:5000
```

---

## 🔌 Backend REST API

The Express backend exposes RESTful JSON endpoints:

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Server health check and uptime status |
| `GET` | `/api/scores` | Returns top 10 leaderboard high scores |
| `POST` | `/api/scores` | Submit new score (`{ playerName, score, distance, carId }`) |
| `GET` | `/api/garage` | Get player wallet balance, selected car, and unlocked vehicles |
| `POST` | `/api/garage/sync` | Sync garage updates (`{ coins, selectedCar, selectedStage }`) |
| `GET` | `/api/progress` | Get completed and unlocked racing circuit levels |
| `POST` | `/api/progress/complete` | Record level completion (`{ levelId, score }`) |

> **Offline Resiliency**: The frontend uses an offline-first architecture. If the backend server is unreachable, game data seamlessly persists in browser `localStorage` and synchronizes whenever the backend is reconnected.

---

## 🕹️ Controls

| Action | Keyboard | Touch / On-screen Cockpit |
| :--- | :--- | :--- |
| **Accelerate / Fly / Hop** | `Space` or `Up Arrow` or `W` | On-screen **GAS** Pedal |
| **Rocket Booster Jump** | `Shift` or `J` | On-screen **JUMP** Button |
| **Steer Left** | `A` or `Left Arrow` | On-screen **LEFT** Arrow |
| **Steer Right** | `D` or `Right Arrow` | On-screen **RIGHT** Arrow |
| **Brake / Down** | `S` or `Down Arrow` | On-screen **BRAKE** Pedal |
| **Pause Game** | `P` or `Esc` | Pause Button (`II`) |

---

## 🎮 Game Modes

1. **Endless Adventure**:
   - Cruise down infinite curved 3D highways.
   - Dynamic traffic cars, hazard barriers, collectible coins, and speed boosters.
   - Live high score tracking and Hall of Fame ranking.

2. **Racing Circuits**:
   - Progress through multi-stage racing tracks with distance checkpoints and time limits.
   - Unlock new stages as circuits are mastered.

3. **Garage**:
   - Spend collected coins on new vehicles (Cyber, Inferno, Neon, Phantom, Taxi, Cruiser, Cop Car).
   - Customize driving stages (City, Beach, Jungle, Desert).

---

## 📄 License
This project is licensed under the ISC / MIT License.
