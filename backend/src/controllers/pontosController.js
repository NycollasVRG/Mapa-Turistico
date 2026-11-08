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

// Obter detalhes de um único ponto por ID
// GET /api/pontos/:id
exports.obterPontoPorId = async (req, res) => {
  try {
    const { id } = req.params;
    const query = `
      SELECT id, nome, descricao, categoria, foto_url,
             ST_X(geom) AS longitude, ST_Y(geom) AS latitude,
             criado_em
      FROM pontos_turisticos
      WHERE id = $1
    `;
    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ponto turístico não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao buscar ponto por ID:', error);
    res.status(500).json({ error: 'Erro interno ao consultar ponto turístico' });
  }
};

// US04: Cadastrar novo ponto turístico
// POST /api/pontos
exports.criarPonto = async (req, res) => {
  try {
    const { nome, descricao, categoria, foto_url, latitude, longitude } = req.body;

    if (!nome || !categoria || latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        error: 'Campos obrigatórios: nome, categoria, latitude e longitude'
      });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: 'Latitude e Longitude devem ser valores numéricos válidos' });
    }

    // Persistência com tipo geométrico nativo Point e SRID 4326 (WGS84)
    const query = `
      INSERT INTO pontos_turisticos (nome, descricao, categoria, foto_url, geom)
      VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326))
      RETURNING id, nome, descricao, categoria, foto_url,
                ST_X(geom) AS longitude, ST_Y(geom) AS latitude, criado_em
    `;

    // Lembrar: ST_MakePoint recebe (longitude, latitude)
    const result = await db.query(query, [
      nome,
      descricao || null,
      categoria,
      foto_url || null,
      lng,
      lat
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao cadastrar ponto turístico:', error);
    res.status(500).json({ error: 'Erro interno ao cadastrar ponto turístico' });
  }
};

// US06: Atualizar ponto turístico existente
// PUT /api/pontos/:id
exports.atualizarPonto = async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, descricao, categoria, foto_url, latitude, longitude } = req.body;

    if (!nome || !categoria || latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        error: 'Campos obrigatórios: nome, categoria, latitude e longitude'
      });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: 'Latitude e Longitude devem ser valores numéricos válidos' });
    }

    const query = `
      UPDATE pontos_turisticos
      SET nome = $1,
          descricao = $2,
          categoria = $3,
          foto_url = $4,
          geom = ST_SetSRID(ST_MakePoint($5, $6), 4326)
      WHERE id = $7
      RETURNING id, nome, descricao, categoria, foto_url,
                ST_X(geom) AS longitude, ST_Y(geom) AS latitude
    `;

    const result = await db.query(query, [
      nome,
      descricao || null,
      categoria,
      foto_url || null,
      lng,
      lat,
      id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ponto turístico não encontrado para atualização' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar ponto turístico:', error);
    res.status(500).json({ error: 'Erro interno ao atualizar ponto turístico' });
  }
};

// US06: Excluir ponto turístico
// DELETE /api/pontos/:id
exports.excluirPonto = async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      DELETE FROM pontos_turisticos
      WHERE id = $1
      RETURNING id
    `;

    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ponto turístico não encontrado para exclusão' });
    }

    res.json({ message: 'Ponto turístico removido com sucesso', id: result.rows[0].id });
  } catch (error) {
    console.error('Erro ao excluir ponto turístico:', error);
    res.status(500).json({ error: 'Erro interno ao excluir ponto turístico' });
  }
};
