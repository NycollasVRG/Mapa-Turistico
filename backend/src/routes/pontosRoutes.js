const express = require('express');
const router = express.Router();
const pontosController = require('../controllers/pontosController');

// US02: Listar pontos (com ou sem filtro por bbox)
router.get('/', pontosController.listarPontos);

module.exports = router;
