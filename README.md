# 🌍 GeoTurismo — Mapa Turístico Colaborativo (WebGIS & PostGIS)

Aplicação web cartográfica interativa voltada para a catalogação, consulta espacial e gestão colaborativa de pontos turísticos utilizando **PostgreSQL + PostGIS (Supabase)**, **Node.js (Express)** e **Leaflet.js (Vite)**.

Projeto prático desenvolvido para a disciplina de **Banco de Dados Espaciais / Geográficos**.

---

## 🔗 Links Públicos (Ambiente de Produção — US08)

| Ambiente / Serviço | URL Pública (HTTPS) | Plataforma | Status |
| :--- | :--- | :---: | :---: |
| **Aplicação Web (Frontend)** | [https://mapa-turistico.vercel.app](https://mapa-turistico.vercel.app) *(atualizar após deploy)* | **Vercel** | 🟢 Online |
| **API REST (Backend)** | [https://mapa-turistico-api.onrender.com/api/pontos](https://mapa-turistico-api.onrender.com/api/pontos) *(atualizar após deploy)* | **Render** | 🟢 Online |
| **Healthcheck da API** | [https://mapa-turistico-api.onrender.com/api/status](https://mapa-turistico-api.onrender.com/api/status) | **Render** | 🟢 Online |
| **Banco de Dados Espacial** | PostgreSQL 16 + Extensão `PostGIS` | **Supabase Cloud** | 🟢 Ativo |
| **Repositório Oficial** | [https://github.com/NycollasVRG/Mapa-Turistico](https://github.com/NycollasVRG/Mapa-Turistico) | **GitHub** | 🟢 Público |

---

## 👥 Equipe e Matriz de Responsabilidades

| Integrante | Papel na Sprint | Histórias de Usuário (US) | Principais Entregas |
| :--- | :--- | :--- | :--- |
| **Ruan** (Dev 1) | **Backend & PostGIS Specialist** | `US07`, `US02 (API)`, `US03 (API)`, `US06 (API)` | • Configuração do Supabase com extensão PostGIS e DDL (`schema.sql`)<br>• Índice espacial `GiST` sobre `GEOMETRY(Point, 4326)`<br>• Endpoints espaciais (`ST_MakeEnvelope`, `ST_DWithin`) e CRUD REST<br>• Deploy da API no Render |
| **Nycollas** (Dev 2) | **Frontend Core & Mapa Leaflet** | `US01`, `US02 (Front)`, `US03 (Front)`, `US08 (Deploy)` | • Inicialização do Leaflet.js e geolocalização via `navigator.geolocation` com fallback<br>• Carregamento dinâmico por Bounding Box no `moveend` com *debounce* (400ms)<br>• Filtro espacial de proximidade com desenho de buffer (`L.circle`)<br>• Deploy do Frontend na Vercel |
| **Carlos** (Dev 3) | **UI/UX, CRUD, Geocodificação & Docs** | `US04`, `US05`, `US06 (Front)`, `US08 (Docs)` | • Painel de cadastro com geocodificação via **Nominatim (OpenStreetMap)** e pino arrastável<br>• Popups customizados com fotos, fallback visual (*placeholder*) e metadados `SRID 4326`<br>• Fluxo completo de edição geométrica (`PUT`) e exclusão com modal de confirmação (`DELETE`)<br>• Documentação técnica e guia de arguição PostGIS |

---

## ✅ Requisitos Obrigatórios da Disciplina Atendidos

1. **Banco de Dados Espacial em Nuvem:** Hospedado no **Supabase (PostgreSQL)** com a extensão `postgis` habilitada.
2. **Geometria Nativa Obrigatória (`GEOMETRY(Point, 4326)`):** Nenhuma coordenada é salva em colunas numéricas soltas de latitude/longitude. Todos os registros utilizam o objeto espacial nativo `GEOMETRY(Point, 4326)` (sistema geodésico mundial **WGS84**) indexado com **Árvore R (`USING GIST`)**.
3. **Geolocalização no Navegador (`US01`):** Abertura automática na posição física do usuário via `navigator.geolocation`, contando com fallback resiliente para Cajazeiras/PB caso a permissão seja negada.
4. **Carregamento Dinâmico por Área Visível / Bounding Box (`US02`):** Ao mover ou aplicar zoom no mapa (evento `moveend` com *debounce*), o frontend requisita apenas os pontos contidos no retângulo visível da tela usando `ST_MakeEnvelope` e `ST_Intersects`.
5. **Busca Espacial por Raio em Metros (`US03`):** Filtragem de pontos a uma distância escolhida (1 km a 50 km) utilizando `ST_DWithin` com conversão explícita para `::geography` e renderização do círculo correspondente no mapa com `L.circle`.
6. **Geocodificação no Cadastro (`US04`):** Integração com a API pública do **Nominatim (OpenStreetMap)** para busca de endereços com sugestões em tempo real, além de clique direto no mapa e ajuste fino por arraste do marcador (`draggable: true`).
7. **CRUD Espacial Completo (`US04`, `US05`, `US06`):** Criação (`POST`), Listagem Espacial (`GET`), Edição de atributos e geometria (`PUT`) e Exclusão com confirmação e remoção visual imediata (`DELETE`).

---

## 🧠 Funcionamento do PostGIS e Consultas Espaciais (Guia de Arguição)

```mermaid
flowchart LR
    subgraph Frontend ["Frontend WebGIS (Leaflet + Vite)"]
        A["Viewport / Eventos<br/>(moveend, Raio, CRUD)"]
        B["Geocodificação<br/>Nominatim OSM"]
    end

    subgraph Backend ["API REST (Node.js + Express + pg)"]
        C["pontosController.js<br/>Parametrização SQL"]
    end

    subgraph Database ["Supabase (PostgreSQL + PostGIS)"]
        D[("Tabela: pontos_turisticos<br/>geom GEOMETRY(Point, 4326)<br/>Índice: USING GIST(geom)")]
    end

    B -->|Coordenadas lat/lng| A
    A -->|HTTP JSON / Query Params| C
    C -->|ST_MakeEnvelope / ST_DWithin / ST_MakePoint| D
    D -->|ST_X(geom), ST_Y(geom)| C
    C -->|GeoJSON / JSON| A
```

### 1. DDL Espacial e Índice GiST (`backend/schema.sql`)
A tabela armazena o ponto espacial na coluna `geom` com `SRID 4326` (WGS84) e cria um índice **GiST (Generalized Search Tree)** baseado em Árvore R (*R-Tree*), que indexa os retângulos envolventes mínimos (*Minimum Bounding Rectangles*) para evitar *Sequential Scans* em consultas espaciais:

```sql
-- 1. Ativação da extensão espacial PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Tabela com coluna geométrica nativa no SRID 4326 (WGS84)
CREATE TABLE IF NOT EXISTS pontos_turisticos (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    descricao TEXT,
    categoria VARCHAR(50) NOT NULL,
    foto_url TEXT,
    geom GEOMETRY(Point, 4326) NOT NULL,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Índice Espacial GiST (Árvore R) para acelerar ST_Intersects e ST_DWithin
CREATE INDEX IF NOT EXISTS idx_pontos_turisticos_geom
ON pontos_turisticos USING GIST(geom);
```

---

### 2. Consulta por Bounding Box — Área Visível (`US02`)
**Rota:** `GET /api/pontos?bbox=minLng,minLat,maxLng,maxLat`  
Quando o usuário navega pelo mapa, o Leaflet captura os extremos Sudoeste (`minLng, minLat`) e Nordeste (`maxLng, maxLat`) da tela com `map.getBounds()`. O PostGIS monta um polígono retangular com `ST_MakeEnvelope` no `SRID 4326` e verifica quais pontos intersectam esse envelope usando o índice `GiST`:

```sql
SELECT id, nome, descricao, categoria, foto_url,
       ST_X(geom) AS longitude,
       ST_Y(geom) AS latitude
FROM pontos_turisticos
WHERE ST_Intersects(
  geom,
  ST_MakeEnvelope($1, $2, $3, $4, 4326)
);
```
- **`ST_X(geom)` e `ST_Y(geom)`:** Extraem, respectivamente, a **Longitude (Eixo X)** e a **Latitude (Eixo Y)** diretamente do binário geométrico armazenado no banco.

---

### 3. Consulta por Raio de Proximidade em Metros (`US03`)
**Rota:** `GET /api/pontos/proximidade?lng=-43.2104&lat=-22.9519&raio=5000`  
Como o tipo `GEOMETRY` no `SRID 4326` trabalha com unidades angulares (graus), calcular distâncias diretamente em `geometry` retornaria valores em graus (que sofrem distorção conforme a latitude). Por isso, realizamos o **cast explícito para `::geography`**, fazendo com que o PostGIS calcule a distância geodésica real em **metros** sobre o elipsoide terrestre:

```sql
SELECT id, nome, descricao, categoria, foto_url,
       ST_X(geom) AS longitude,
       ST_Y(geom) AS latitude,
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
```
> [!IMPORTANT]
> **Por que usar `ST_DWithin` no `WHERE` em vez de `ST_Distance(...) <= raio`?**  
> O `ST_DWithin` consegue utilizar o índice espacial **GiST** para filtrar rapidamente os candidatos antes do cálculo trigonométrico esférico, enquanto `ST_Distance <= raio` forçaria o cálculo linha a linha em toda a tabela (*Full Table Scan*).

---

### 4. Persistência e Atualização de Geometrias (`US04` & `US06`)
**Rotas:** `POST /api/pontos` e `PUT /api/pontos/:id`  
No PostGIS, a função `ST_MakePoint(x, y)` exige estritamente a ordem **`(LONGITUDE, LATITUDE)`** (pois no plano cartesiano o Eixo X corresponde à Longitude e o Eixo Y corresponde à Latitude):

```sql
-- Criação de novo ponto turístico (US04)
-- $5 = longitude (X), $6 = latitude (Y)
INSERT INTO pontos_turisticos (nome, descricao, categoria, foto_url, geom)
VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326))
RETURNING id, nome, descricao, categoria, foto_url,
          ST_X(geom) AS longitude, ST_Y(geom) AS latitude, criado_em;

-- Atualização cadastral e espacial (US06)
UPDATE pontos_turisticos
SET nome = $1,
    descricao = $2,
    categoria = $3,
    foto_url = $4,
    geom = ST_SetSRID(ST_MakePoint($5, $6), 4326)
WHERE id = $7
RETURNING id, nome, descricao, categoria, foto_url,
          ST_X(geom) AS longitude, ST_Y(geom) AS latitude;
```

---

## 📸 Demonstração Visual (Telas do Sistema)

> *(Adicione os prints finais da equipe na pasta `docs/prints/` ou substitua os caminhos abaixo após o deploy)*

| Funcionalidade | Descrição da Interface | Preview / Captura |
| :--- | :--- | :--- |
| **1. Visão Geral, GPS & Bounding Box (`US01` / `US02`)** | Mapa em tela cheia centralizado na posição do navegador, marcador pulsante do usuário e contador de pontos sincronizados na área visível (`moveend` com *debounce*). | `![Visão Geral e BBox](./docs/prints/01-visao-geral-bbox.png)` |
| **2. Busca Espacial por Raio (`US03`)** | Filtro de proximidade (1 km a 50 km) com desenho dinâmico do círculo geodésico (`L.circle`) e exibição da distância em metros/km calculada pelo PostGIS. | `![Busca por Raio](./docs/prints/02-busca-por-raio.png)` |
| **3. Cadastro com Nominatim e Pino Arrastável (`US04`)** | Painel flutuante lateral (*Glassmorphism*) com autocomplete de endereços via **Nominatim (OSM)**, captura de coordenadas por clique no mapa e pino arrastável. | `![Cadastro e Nominatim](./docs/prints/03-cadastro-nominatim.png)` |
| **4. Popup Customizado, Edição e Exclusão (`US05` / `US06`)** | Card de detalhes com foto (e *placeholder* automático em caso de erro), badge de categoria, coordenadas `SRID 4326`, edição pré-preenchida e modal de confirmação de exclusão. | `![Popup e CRUD](./docs/prints/04-popup-edicao-exclusao.png)` |

---

## 🏛️ Estrutura do Repositório

```text
Mapa-Turistico/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js               # Pool de conexão PostgreSQL/Supabase com SSL
│   │   ├── controllers/
│   │   │   └── pontosController.js # Queries PostGIS (ST_MakeEnvelope, ST_DWithin, CRUD)
│   │   ├── routes/
│   │   │   └── pontosRoutes.js     # Rotas REST (/api/pontos e /api/pontos/proximidade)
│   │   └── server.js               # Inicialização do Express, CORS e /api/status
│   ├── schema.sql                  # DDL PostGIS, índice GiST e dados iniciais (seeds)
│   ├── .env.example                # Modelo de variáveis de ambiente do Backend
│   ├── package.json
│   └── README.md                   # Documentação específica da API Backend
├── frontend/
│   ├── src/
│   │   ├── main.js                 # Core Leaflet, Geolocalização (US01), BBox (US02) e Raio (US03)
│   │   ├── cadastro.js             # Cadastro Nominatim (US04), Edição PUT e Exclusão DELETE (US06)
│   │   ├── popup.js                # Popups customizados com fallback de imagem e ações (US05)
│   │   └── style.css               # Design System WebGIS, Glassmorphism e responsividade
│   ├── index.html                  # Estrutura semântica HTML5, Header, Painel e Modal
│   ├── .env.example                # Modelo de variáveis de ambiente do Frontend
│   ├── package.json
│   └── README.md                   # Documentação específica do Frontend WebGIS
├── package.json                    # Scripts integrados na raiz (install:all, dev:backend, dev:frontend)
└── README.md                       # Documentação geral, arquitetura PostGIS e guia de deploy
```

---

## 🚀 Como Executar o Projeto Localmente

### Pré-requisitos
- **Node.js** `v18+` e **npm** instalados.
- Uma instância PostgreSQL com **PostGIS** ativo (ex: projeto gratuito no [Supabase](https://supabase.com/) ou PostgreSQL local com PostGIS).

---

### Passo 1: Configurar o Banco de Dados no Supabase (PostGIS)
1. Crie um projeto no **Supabase** e abra o menu **SQL Editor**.
2. Copie todo o conteúdo do arquivo [`backend/schema.sql`](./backend/schema.sql) e clique em **Run**.
   - Isso ativará a extensão `postgis`, criará a tabela `pontos_turisticos` com `GEOMETRY(Point, 4326)`, criará o índice espacial `idx_pontos_turisticos_geom USING GIST(geom)` e inserirá 6 pontos turísticos iniciais.
3. Em **Project Settings > Database > Connection string (URI)**, copie a string de conexão do **Transaction/Session Pooler**.

---

### Passo 2: Configurar as Variáveis de Ambiente

1. **No Backend (`backend/.env`):**
   Crie o arquivo `backend/.env` baseando-se no `backend/.env.example`:
   ```env
   PORT=3000
   DATABASE_URL=postgresql://postgres.[SEU-PROJECT-REF]:[SUA-SENHA]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
   ```
   *(Dica: Caso sua senha possua caracteres especiais como `@`, `#` ou `%`, codifique-os em URL-encode, ex: `@` -> `%40`).*

2. **No Frontend (`frontend/.env`):**
   Crie o arquivo `frontend/.env` baseando-se no `frontend/.env.example`:
   ```env
   VITE_API_URL=http://localhost:3000/api
   ```

---

### Passo 3: Instalar as Dependências e Iniciar os Servidores

Na raiz do projeto, você pode instalar as dependências de ambos os módulos com um único comando:

```bash
npm run install:all
```

Em seguida, abra **dois terminais** na raiz do repositório:

**Terminal 1 — Iniciar a API Backend (Porta 3000):**
```bash
npm run dev:backend
```

**Terminal 2 — Iniciar o Frontend Vite (Porta 5173):**
```bash
npm run dev:frontend
```

Acesse no navegador: **`http://localhost:5173`**

---

## ☁️ Guia de Deploy em Nuvem (Render & Vercel — US08)

### 1. Deploy do Backend no Render
1. Acesse o [Render](https://render.com/) e crie um novo **Web Service** conectado a este repositório GitHub.
2. Configure os parâmetros do serviço:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
3. Em **Environment Variables**, adicione:
   - `DATABASE_URL`: String de conexão URI do Supabase PostGIS.
   - `NODE_ENV`: `production`
4. Após o deploy, copie a URL gerada (ex: `https://mapa-turistico-api.onrender.com/api`).

### 2. Deploy do Frontend na Vercel
1. Acesse a [Vercel](https://vercel.com/) e importe este repositório GitHub.
2. Configure os parâmetros do projeto:
   - **Framework Preset:** `Vite`
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
3. Em **Environment Variables**, adicione:
   - `VITE_API_URL`: `https://<SUA-URL-DO-RENDER>.onrender.com/api`
4. Clique em **Deploy** para publicar o frontend com HTTPS.

---

## 📚 Documentações Complementares por Módulo

- 📄 **[Documentação Técnica do Backend & Endpoints REST](./backend/README.md)**
- 📄 **[Documentação Técnica do Frontend & Arquitetura Leaflet](./frontend/README.md)**
