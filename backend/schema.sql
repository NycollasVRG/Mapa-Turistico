-- ========================================================
-- GeoTurismo - Script DDL & Setup Espacial (PostGIS)
-- US07: Configuração do PostGIS na Nuvem (Supabase)
-- ========================================================

-- 1. Habilitar a extensão espacial PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Criação da tabela de Pontos Turísticos
-- NOTA OBRIGATÓRIA: Não salvar apenas latitude/longitude soltas!
-- A coluna 'geom' utiliza o tipo nativo GEOMETRY(Point, 4326)
CREATE TABLE IF NOT EXISTS pontos_turisticos (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    descricao TEXT,
    categoria VARCHAR(50) NOT NULL, -- Ex: Museu, Parque, Histórico, Gastronomia, Praia
    foto_url TEXT,
    geom GEOMETRY(Point, 4326) NOT NULL,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Criação do Índice Espacial GiST (Árvore R)
-- Essencial para performance nas queries com ST_MakeEnvelope e ST_DWithin
CREATE INDEX IF NOT EXISTS idx_pontos_turisticos_geom 
ON pontos_turisticos USING GIST(geom);

-- ========================================================
-- Dados Iniciais para Demonstração / Seed
-- Importante: no ST_MakePoint a ordem é (LONGITUDE, LATITUDE)
-- ========================================================
INSERT INTO pontos_turisticos (nome, descricao, categoria, foto_url, geom) VALUES
(
    'Cristo Redentor',
    'Famosa estátua art déco de Jesus Cristo no topo do Morro do Corcovado.',
    'Histórico',
    'https://images.unsplash.com/photo-1598395927057-85bfaf661631?auto=format&fit=crop&w=800&q=80',
    ST_SetSRID(ST_MakePoint(-43.210487, -22.951916), 4326)
),
(
    'Pão de Açúcar',
    'Complexo de morros com teleférico e vista panorâmica para a Baía de Guanabara.',
    'Parque',
    'https://images.unsplash.com/photo-1516306580123-e6e52b1b7b5f?auto=format&fit=crop&w=800&q=80',
    ST_SetSRID(ST_MakePoint(-43.155896, -22.949249), 4326)
),
(
    'Museu do Amanhã',
    'Museu de ciências aplicadas projetado pelo arquiteto Santiago Calatrava na Praça Mauá.',
    'Museu',
    'https://images.unsplash.com/photo-1575881875475-31024b476d38?auto=format&fit=crop&w=800&q=80',
    ST_SetSRID(ST_MakePoint(-43.179444, -22.894444), 4326)
),
(
    'Praia de Copacabana',
    'Famosa praia em formato de meia-lua com calçadão icônico em mosaico português.',
    'Praia',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
    ST_SetSRID(ST_MakePoint(-43.182365, -22.971964), 4326)
),
(
    'Confeitaria Colombo',
    'Patrimônio histórico e gastronômico fundado em 1894 no centro histórico.',
    'Gastronomia',
    'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80',
    ST_SetSRID(ST_MakePoint(-43.178720, -22.905660), 4326)
),
(
    'Jardim Botânico',
    'Criado em 1808 por D. João VI, abriga milhares de espécies da flora brasileira e mundial.',
    'Parque',
    'https://images.unsplash.com/photo-1584551246679-0daf3d275d0f?auto=format&fit=crop&w=800&q=80',
    ST_SetSRID(ST_MakePoint(-43.224167, -22.967500), 4326)
)
ON CONFLICT DO NOTHING;
