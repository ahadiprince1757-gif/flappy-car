import { Router } from 'express';
import { getLeaderboard, addScore } from '../data/storage.js';

const router = Router();

// GET /api/scores — Top 10 High Scores
router.get('/', (req, res) => {
  try {
    const scores = getLeaderboard();
    res.json({ success: true, scores });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/scores — Save a new score
router.post('/', (req, res) => {
  try {
    const { playerName, score, distance, carId } = req.body;
    if (score === undefined || distance === undefined) {
      return res.status(400).json({ success: false, error: 'score and distance are required' });
    }
    const entry = addScore({ playerName, score, distance, carId });
    res.status(201).json({ success: true, entry });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
