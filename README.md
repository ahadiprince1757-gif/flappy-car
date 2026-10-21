# 🏎️ Flappy Car

A high-octane 2D arcade driving and racing game built with pure HTML5 Canvas, modern JavaScript (ES6+), and custom CSS. Dodge obstacles, collect coins, conquer dynamic curved tracks, upgrade cars in the garage, and compete across varied racing stages.

---

## 🌟 Features

- **🎮 Dual Game Modes**:
  - **Endless / Stage Drive**: Cruise down procedural curved roads with changing horizons, environments, and increasing challenges.
  - **Racing Mode**: High-speed competitive tracks with checkpoints, rival obstacles, and stage progression.
- **🚗 Garage & Customization**:
  - Unlock and collect different vehicles with distinct stats and handling.
  - Procedural car rendering with dynamic wheel animations, wing effects, and custom palettes.
- **🏙️ Dynamic Environments & Backgrounds**:
  - Multi-layer parallax cityscapes, mountain horizons, and atmospheric day/night themes.
  - Realistic road curvature and elevation rendering.
- **💥 Obstacles & Power-ups**:
  - Dynamic obstacle spawning (barriers, ramps, road hazards).
  - Collectible coins, speed boosters, magnets, and shields.
- **🔊 Interactive Audio & Effects**:
  - Dynamic synthesizer audio engine for engine revs, coin pick-ups, crashes, and booster sounds.
  - Particle burst effects, screen shake, and speed trail visuals.
- **💾 Local Storage Persistence**:
  - Automatically saves player high scores, collected coins, and unlocked garage vehicles.

---

## 🕹️ Controls

| Action | Keyboard | Touch / Mouse |
| :--- | :--- | :--- |
| **Accelerate / Fly / Hop** | `Space` or `Up Arrow` | Tap & Hold Screen |
| **Steer Left** | `A` or `Left Arrow` | Left Side Touch / On-screen Buttons |
| **Steer Right** | `D` or `Right Arrow` | Right Side Touch / On-screen Buttons |
| **Brake / Down** | `S` or `Down Arrow` | Touch Controls |
| **Pause Game** | `P` or `Esc` | Pause Button (`II`) |

---

## 📂 Project Structure

```
FLAPPY CAR/
├── assets/
│   └── landing_bg.jpg           # Background assets
├── js/
│   ├── cars/                    # Vehicle definitions & garage mechanics
│   │   ├── carRenderer.js       # Procedural canvas car rendering
│   │   ├── cars.js              # Car stats and presets
│   │   └── garage.js            # Garage purchase & upgrade UI logic
│   ├── core/                    # Engine core & state management
│   │   ├── game.js              # Main game controller
│   │   ├── gameLoop.js          # RequestAnimationFrame loop & delta time
│   │   ├── gameState.js         # State machine (Menu, Playing, GameOver)
│   │   └── storage.js           # LocalStorage wrapper
│   ├── obstacles/               # Procedural road hazards & obstacles
│   ├── player/                  # Player physics, controls & movement
│   ├── racing/                  # Racing mode mechanics & levels
│   ├── stages/                  # Parallax scenery, stages & backgrounds
│   ├── systems/                 # Audio, coins, collision, economy & effects
│   ├── ui/                      # HUD, menus, modal screens
│   └── main.js                  # Entry point bootstrap
├── index.html                   # Game canvas and UI layout
├── style.css                    # Game styling & responsive layout
└── README.md                    # Project documentation
```

---

## 🚀 Getting Started

No build tools, bundlers, or package installations required!

1. Clone the repository:
   ```bash
   git clone https://github.com/ahadiprince1757-gif/flappy-car.git
   ```
2. Open `index.html` directly in any modern browser (Chrome, Edge, Firefox, Safari) or run with a local server (e.g. VS Code Live Server).

---

## 📄 License

This project is licensed under the MIT License.
