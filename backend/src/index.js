require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const pool = require('./config/db');

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const salesRoutes = require('./routes/sales');
const reportRoutes = require('./routes/reports');
const debtRoutes = require('./routes/debts');
const userRoutes = require('./routes/users');
const supplierRoutes = require('./routes/suppliers');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'sehat', aplikasi: 'UMKM-Scan V1' });
  } catch (e) {
    res.status(500).json({ status: 'db-terputus', pesan: e.message });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/debts', debtRoutes);
app.use('/api/users', userRoutes);
app.use('/api/suppliers', supplierRoutes);

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[api]', err);
  res.status(500).json({ pesan: 'Terjadi kesalahan di server.' });
});

const PORT = process.env.PORT || 3001;
if (require.main === module) {
  app.listen(PORT, () => console.log(`[UMKM-Scan] backend jalan di :${PORT}`));
}

module.exports = app;
