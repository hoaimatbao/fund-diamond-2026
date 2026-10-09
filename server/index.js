import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRouter from './routes/api.js';
import { initDailyClosingScheduler } from './services/dailyScheduler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Static bill uploads
const uploadsDir = path.join(__dirname, '../public/uploads');
app.use('/uploads', express.static(uploadsDir));

// API Routes
app.use('/api', apiRouter);

// Serve frontend build if in production
const distDir = path.join(__dirname, '../dist');
app.use(express.static(distDir));

// Fallback to index.html for SPA
app.get('*', (req, res) => {
  if (req.url.startsWith('/api') || req.url.startsWith('/uploads')) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  const indexPath = path.join(distDir, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(200).send('API Server is running. Frontend is available on Vite dev server (port 5173).');
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Smart Fund Server is running on http://localhost:${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}/api/fund`);
  
  // Tự động kích hoạt scheduler chốt sổ Excel 23:59 mỗi ngày
  try {
    initDailyClosingScheduler();
  } catch (err) {
    console.error('Lỗi khởi động scheduler chốt sổ Excel:', err);
  }
});
