# GeoTurismo - API Backend & PostGIS (Dev 1)

Módulo Backend da aplicação **GeoTurismo**, desenvolvido em **Node.js (Express)** integrado ao **PostgreSQL** com a extensão espacial **PostGIS** hospedado no **Supabase**.

---

## 🛠️ Tecnologias Utilizadas
- **Node.js (Express)**
- **PostgreSQL + PostGIS** (Hospedado no Supabase)
- **node-postgres (`pg`)** com suporte a SSL / connection pool
- **CORS** habilitado para integração fluida com o Frontend (Leaflet)

---

## 🗺️ Modelo de Dados Espacial (PostGIS)

Para cumprir o requisito acadêmico formal de **não salvar apenas latitude e longitude soltas**, os pontos turísticos são persistidos com o tipo nativo `GEOMETRY(Point, 4326)` e contam com **Índice Espacial GiST (Árvore R)** para alta performance nas consultas espaciais:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS pontos_turisticos (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    descricao TEXT,
    categoria VARCHAR(50) NOT NULL,
    foto_url TEXT,
    geom GEOMETRY(Point, 4326) NOT NULL,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pontos_turisticos_geom ON pontos_turisticos USING GIST(geom);
```

> **Atenção:** O script DDL completo com dados de demonstração (seed) está disponível em [`schema.sql`](./schema.sql).

---

## 🚀 Como Executar Localmente

### 1. Instalar Dependências
```bash
cd backend
npm install
```

### 2. Configurar Variáveis de Ambiente
Crie um arquivo `.env` na pasta `backend/` baseado no `.env.example`:
```env
PORT=3000
DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[SUA_SENHA]@aws-0-[REGION].pooler.supabase.com:5432/postgres
NODE_ENV=development
```

### 3. Rodar o Servidor
```bash
# Modo desenvolvimento (com auto-reload)
npm run dev

# Modo produção
npm start
```
O servidor estará acessível em `http://localhost:3000`.

---

## 📡 Documentação dos Endpoints (Guia de Integração para Dev 2 e Dev 3)

### 1. Bounding Box (Área Visível) — `US02`
- **Rota:** `GET /api/pontos?bbox={minLng},{minLat},{maxLng},{maxLat}`
- **Descrição:** Chamado no evento `moveend` do Leaflet com os limites obtidos por `map.getBounds()`.
- **Query PostGIS Interna:** `ST_Intersects(geom, ST_MakeEnvelope(minLng, minLat, maxLng, maxLat, 4326))` acelerada pelo índice GiST.
- **Exemplo de URL:** `GET /api/pontos?bbox=-43.25,-22.98,-43.15,-22.90`
- **Resposta (200 OK):**
```json
[
  {
    "id": 1,
    "nome": "Cristo Redentor",
    "descricao": "Famosa estátua art déco de Jesus Cristo...",
    "categoria": "Histórico",
    "foto_url": "https://...",
    "longitude": -43.210487,
    "latitude": -22.951916
  }
]
```

---

### 2. Proximidade por Raio (Buffer) — `US03`
- **Rota:** `GET /api/pontos/proximidade?lng={longitude}&lat={latitude}&raio={raio_em_metros}`
- **Descrição:** Busca os pontos dentro de uma distância máxima em metros a partir de uma coordenada, ordenados pelo mais próximo.
- **Query PostGIS Interna:** `ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)` com distância calculada via `ST_Distance`.
- **Exemplo de URL:** `GET /api/pontos/proximidade?lng=-43.210487&lat=-22.951916&raio=5000`
- **Resposta (200 OK):**
```json
[
  {
    "id": 1,
    "nome": "Cristo Redentor",
    "categoria": "Histórico",
    "foto_url": "https://...",
    "longitude": -43.210487,
    "latitude": -22.951916,
    "distancia_metros": 0
  },
  {
    "id": 2,
    "nome": "Pão de Açúcar",
    "categoria": "Parque",
    "foto_url": "https://...",
    "longitude": -43.155896,
    "latitude": -22.949249,
    "distancia_metros": 5608
  }
]
```

---

### 3. Cadastrar Ponto Turístico — `US04`
- **Rota:** `POST /api/pontos`
- **Body JSON:**
```json
{
  "nome": "Parque Ibirapuera",
  "descricao": "Grande parque urbano com museus e lagos.",
  "categoria": "Parque",
  "foto_url": "https://exemplo.com/foto.jpg",
  "latitude": -23.587416,
  "longitude": -46.657634
}
```
- **Resposta (201 Created):**
```json
{
  "id": 7,
  "nome": "Parque Ibirapuera",
  "descricao": "Grande parque urbano com museus e lagos.",
  "categoria": "Parque",
  "foto_url": "https://exemplo.com/foto.jpg",
  "longitude": -46.657634,
  "latitude": -23.587416,
  "criado_em": "2026-10-24T13:30:00.000Z"
}
```

---

### 4. Atualizar Ponto Turístico — `US06`
- **Rota:** `PUT /api/pontos/:id`
- **Body JSON:** Mesma estrutura do POST.
- **Resposta (200 OK):** Objeto atualizado com latitude e longitude.

---

### 5. Excluir Ponto Turístico — `US06`
- **Rota:** `DELETE /api/pontos/:id`
- **Resposta (200 OK):**
```json
{
  "message": "Ponto turístico removido com sucesso",
  "id": "7"
}
```

---

## ☁️ Deploy no Render (US08)
1. Conecte o repositório GitHub ao [Render](https://render.com).
2. Crie um novo **Web Service**.
3. Configure:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. Na aba **Environment Variables**, adicione:
   - `DATABASE_URL`: String de conexão do Supabase Pooler com senha.
   - `NODE_ENV`: `production`

---

## 🎓 Checklist de Arguição (Apresentação da Disciplina)
- **P: Como provar que não salvaram apenas latitude e longitude soltas?**
  - **R:** A tabela possui a coluna `geom` do tipo `GEOMETRY(Point, 4326)` e no código Node.js utilizamos a função espacial nativa `ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)`.
- **P: Como funciona o carregamento da área visível?**
  - **R:** O backend recebe as coordenadas extremas enviadas pelo Leaflet (`map.getBounds()`) e faz a filtragem espacial com `ST_Intersects(geom, ST_MakeEnvelope(...))` usando o índice GiST.
- **P: Como foi calculada a proximidade em quilômetros/metros?**
  - **R:** Foi utilizada a função `ST_DWithin` com cast explícito para `::geography`, calculando distâncias geodésicas reais sobre o elipsoide terrestre em metros sem distorção angular.
