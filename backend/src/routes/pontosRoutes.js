const express = require('express');
const router = express.Router();
const pontosController = require('../controllers/pontosController');

// US03: Busca por raio de proximidade (deve vir antes de /:id)
router.get('/proximidade', pontosController.buscarPorProximidade);

// US02: Listar pontos (com ou sem filtro por bbox)
router.get('/', pontosController.listarPontos);

// Obter detalhes de um ponto específico
router.get('/:id', pontosController.obterPontoPorId);

// US04: Cadastrar novo ponto
router.post('/', pontosController.criarPonto);

// US06: Atualizar ponto existente
router.put('/:id', pontosController.atualizarPonto);

// US06: Excluir ponto
router.delete('/:id', pontosController.excluirPonto);

module.exports = router;
