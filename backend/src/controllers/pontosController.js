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

// US03: Busca Espacial por Raio de Proximidade (Buffer / ST_DWithin)
// GET /api/pontos/proximidade?lng=-43.21&lat=-22.95&raio=2000
exports.buscarPorProximidade = async (req, res) => {
  try {
    const { lng, lat, raio } = req.query;

    if (!lng || !lat || !raio) {
      return res.status(400).json({
        error: 'Parâmetros obrigatórios ausentes. Informe: lng, lat e raio (em metros)'
      });
    }

    const longitude = parseFloat(lng);
    const latitude = parseFloat(lat);
    const raioMetros = parseFloat(raio);

    if (isNaN(longitude) || isNaN(latitude) || isNaN(raioMetros) || raioMetros <= 0) {
      return res.status(400).json({
        error: 'Parâmetros inválidos. Garanta que lng, lat e raio sejam números válidos e raio > 0'
      });
    }

    // Query espacial com ST_DWithin e cálculo exato de distância com cast para geography (US03)
    const query = `
      SELECT id, nome, descricao, categoria, foto_url,
             ST_X(geom) AS longitude, ST_Y(geom) AS latitude,
             ROUND(ST_Distance(
               geom::geography, 
               ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
             )::numeric, 0) AS distancia_metros
      FROM pontos_turisticos
      WHERE ST_DWithin(
        geom::geography,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
        $3
      )
      ORDER BY distancia_metros ASC;
    `;

    // Lembrar: no ST_MakePoint a ordem é ($1 = longitude, $2 = latitude)
    const result = await db.query(query, [longitude, latitude, raioMetros]);
    res.json(result.rows);
  } catch (error) {
    console.error('Erro na busca por proximidade:', error);
    res.status(500).json({ error: 'Erro interno na busca espacial por proximidade' });
  }
};
