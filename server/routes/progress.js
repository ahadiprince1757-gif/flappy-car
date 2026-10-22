import { Router } from 'express';
import { getProgress, updateProgress } from '../data/storage.js';

const router = Router();

// GET /api/progress — Get unlocked and completed levels
router.get('/', (req, res) => {
  try {
    const progress = getProgress();
    res.json({ success: true, progress });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/progress/complete — Record level completion
router.post('/complete', (req, res) => {
  try {
    const { levelId, score } = req.body;
    if (levelId === undefined) {
      return res.status(400).json({ success: false, error: 'levelId is required' });
    }
    const updated = updateProgress(levelId, score);
    res.json({ success: true, progress: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
