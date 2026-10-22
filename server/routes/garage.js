import { Router } from 'express';
import { getGarage, updateGarage } from '../data/storage.js';

const router = Router();

// GET /api/garage — Get player's wallet and selections
router.get('/', (req, res) => {
  try {
    const garage = getGarage();
    res.json({ success: true, garage });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/garage/sync — Update coins or selection
router.post('/sync', (req, res) => {
  try {
    const { coins, selectedCar, selectedStage, unlockedCars, unlockedStages } = req.body;
    const updated = updateGarage({ coins, selectedCar, selectedStage, unlockedCars, unlockedStages });
    res.json({ success: true, garage: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/garage/select — Select active car
router.post('/select', (req, res) => {
  try {
    const { carId } = req.body;
    if (!carId) {
      return res.status(400).json({ success: false, error: 'carId is required' });
    }
    const updated = updateGarage({ selectedCar: carId });
    res.json({ success: true, garage: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
