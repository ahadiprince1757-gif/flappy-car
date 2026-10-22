# 🚀 Flappy Car 3D — Cloud Deployment Guide

This guide walks you step-by-step through deploying **Flappy Car 3D** to **Render** (Node.js backend & full-stack) and **Vercel** (Global Edge CDN frontend & serverless).

---

## 📌 Architecture Options

You have two simple ways to deploy:

| Architecture | Description | Recommended For |
|---|---|---|
| **Option 1: Full-Stack on Render** | Render hosts the Express server which serves both the frontend game and the REST APIs. | Simplest 1-step deployment. |
| **Option 2: Frontend on Vercel + Backend on Render** | Vercel provides lightning-fast Edge CDN for 3D graphics & audio; Render runs the persistent Node.js API. | Best performance and scalability. |
| **Option 3: All-in-One on Vercel** | Vercel serves the static frontend and runs `/api/*` via Serverless Function (`api/index.js`). | 100% serverless, zero server maintenance. |

---

## 🏎️ Part 1: Deploying Backend to Render

### Method A: 1-Click Blueprint (Fastest)
The repository contains a pre-configured `render.yaml` blueprint:
1. Log in to [dashboard.render.com](https://dashboard.render.com/).
2. Click the **Blueprints** tab in the top navigation.
3. Click **New Blueprint Instance**.
4. Connect your GitHub repository: `ahadiprince1757-gif/flappy-car`.
5. Render reads `render.yaml` and pre-populates all settings automatically.
6. Click **Apply**.

---

### Method B: Manual Web Service
1. Log in to [dashboard.render.com](https://dashboard.render.com/).
2. Click **New +** (top right) and choose **Web Service**.
3. Select **Build and deploy from a Git repository** and connect:
   `ahadiprince1757-gif/flappy-car`
4. Fill in the service configuration:
   - **Name**: `flappy-car-3d` (or any name you prefer)
   - **Region**: Choose the closest region (e.g. Frankfurt, Oregon, Singapore)
   - **Branch**: `main`
   - **Root Directory**: Leave blank (default `./`)
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`
5. Expand **Environment Variables** and add:
   | Key | Value | Notes |
   |---|---|---|
   | `NODE_ENV` | `production` | Enables production optimizations |
   | `PORT` | `10000` | Port Render listens to |
   | `CORS_ORIGIN` | `*` | Allows cross-origin requests from Vercel |
6. Click **Create Web Service**.
7. Wait 1-2 minutes for the build to complete. Once deployed, Render gives you a public URL (e.g. `https://flappy-car-3d.onrender.com`).
8. Verify by opening in your browser:
   `https://flappy-car-3d.onrender.com/api/health`
   You should see:
   ```json
   {
     "status": "online",
     "timestamp": "...",
     "game": "Flappy Car 3D"
   }
   ```

---

## ⚡ Part 2: Deploying Frontend to Vercel

1. Log in to [vercel.com](https://vercel.com/) (sign in with your GitHub account).
2. On your Vercel Dashboard, click **Add New...** > **Project**.
3. Under **Import Git Repository**, find `ahadiprince1757-gif/flappy-car` and click **Import**.
4. In the **Configure Project** screen:
   - **Project Name**: `flappy-car` (or default)
   - **Framework Preset**: `Other` (Vercel automatically detects the root `vercel.json` config)
   - **Root Directory**: `./` (leave default)
   - **Build and Output Settings**: Leave default / blank (handled automatically by `vercel.json`)
   - **Environment Variables** (Optional):
     If you want the Vercel frontend to forward API requests to your Render backend, you can add:
     - `RENDER_API_URL` = `https://your-service.onrender.com`
5. Click **Deploy**.
6. Within 30 seconds, Vercel will build and deploy your game to a global URL (e.g. `https://flappy-car.vercel.app`).

---

## 🔗 Part 3: Connecting Vercel Frontend to Render Backend

If you run the frontend on Vercel and the backend on Render:

1. Copy your Render service URL (e.g. `https://flappy-car-3d.onrender.com`).
2. In [client/index.html](client/index.html) (inside `<head>`), you can set the backend URL:
   ```html
   <script>
     window.__API_URL__ = "https://flappy-car-3d.onrender.com";
   </script>
   ```
   *(Alternatively, in the browser console on your Vercel app, you can run:*
   `localStorage.setItem('flappy_car_api_url', 'https://flappy-car-3d.onrender.com');`
   *and reload).*

3. On your Render dashboard, update the `CORS_ORIGIN` environment variable with your Vercel domain:
   ```
   CORS_ORIGIN=https://flappy-car.vercel.app
   ```

---

## 📱 Mobile PWA Verification
Once deployed:
1. Open your Vercel or Render URL on your smartphone (Chrome for Android or Safari for iOS).
2. The game displays in portrait with your logo and menu buttons.
3. Tap **PLAY** — the game prompts you to rotate into **Landscape** mode and enables high-speed touch controls (steering wheel, throttle pedal, brake, and turbo boost).
4. Tap **Add to Home screen** in your browser menu to install Flappy Car as a native app!
