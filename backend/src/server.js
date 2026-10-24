const express = require('express');
const cors = require('cors');
require('dotenv').config();

const pontosRoutes = require('./routes/pontosRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Rota de status da API
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    mensagem: 'API do GeoTurismo funcionando!',
    timestamp: new Date().toISOString()
  });
});

// US02: Rotas de pontos turísticos
app.use('/api/pontos', pontosRoutes);

app.listen(PORT, () => {
  console.log(` Servidor rodando na porta ${PORT}`);
  console.log(` Endpoint de pontos: http://localhost:${PORT}/api/pontos`);
});
