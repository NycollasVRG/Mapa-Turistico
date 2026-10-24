const db = require('../config/db');

// US02: Listar pontos com filtro opcional por Bounding Box (Área Visível)
// GET /api/pontos?bbox=minLng,minLat,maxLng,maxLat
exports.listarPontos = async (req, res) => {
  try {
    const { bbox } = req.query;

    if (bbox) {
      const coords = bbox.split(',').map(Number);
      if (coords.length !== 4 || coords.some(isNaN)) {
        return res.status(400).json({
          error: 'Parâmetro bbox inválido. Formato esperado: minLng,minLat,maxLng,maxLat'
        });
      }

      const [minLng, minLat, maxLng, maxLat] = coords;

      // Query espacial acelerada pelo índice GiST (US02)
      const queryBbox = `
        SELECT id, nome, descricao, categoria, foto_url,
               ST_X(geom) AS longitude, ST_Y(geom) AS latitude
        FROM pontos_turisticos
        WHERE ST_Intersects(
          geom,
          ST_MakeEnvelope($1, $2, $3, $4, 4326)
        )
      `;

      const result = await db.query(queryBbox, [minLng, minLat, maxLng, maxLat]);
      return res.json(result.rows);
    }

    // Listagem geral caso bbox não seja fornecido
    const queryGeral = `
      SELECT id, nome, descricao, categoria, foto_url,
             ST_X(geom) AS longitude, ST_Y(geom) AS latitude
      FROM pontos_turisticos
      ORDER BY id DESC
    `;
    const result = await db.query(queryGeral);
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao listar pontos turísticos:', error);
    res.status(500).json({ error: 'Erro interno ao consultar pontos turísticos' });
  }
};
