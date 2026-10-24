const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: connectionString,
  ssl: process.env.NODE_ENV === 'production' || (connectionString && connectionString.includes('supabase'))
    ? { rejectUnauthorized: false }
    : false
});

pool.on('connect', () => {
  console.log(' Conectado com sucesso ao banco PostgreSQL / PostGIS');
});

pool.on('error', (err) => {
  console.error(' Erro inesperado no cliente do pool PostgreSQL:', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
