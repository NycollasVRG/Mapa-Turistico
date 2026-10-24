# 🌍 GeoTurismo — Mapa Turístico Espacial

Aplicação web interativa voltada para a catalogação, exploração e gestão de pontos turísticos utilizando **PostgreSQL + PostGIS**, **Node.js (Express)** e **Leaflet.js**.

Projeto prático desenvolvido para a disciplina de **Banco de Dados II / Geográficos**.

---

## 👥 Matriz de Divisão de Responsabilidades

| Membro | Papel | Histórias (US) | Entregáveis na Sprint |
|---|---|---|---|
| **Dev 1** | **Backend & PostGIS Specialist** | **US07, US02 (API), US03 (API), US06 (API)** | • Modelagem do PostGIS no Supabase e índice GiST<br>• API Node.js (rotas BBox, Raio e CRUD)<br>• Deploy do Backend no Render |
| **Dev 2** | Frontend Core & Leaflet | US01, US02 (Front), US03 (Front), US08 (Deploy Front) | • Setup do mapa Leaflet e GPS do navegador<br>• Evento `moveend` (BBox) com debounce<br>• Controle de raio com círculo `L.circle`<br>• Deploy do Frontend na Vercel |
| **Dev 3** | UI/UX, CRUD & Geocodificação | US04, US05, US06 (Front), US08 (Docs) | • Modal de cadastro/edição com Nominatim<br>• Design e conteúdo do Popup Leaflet com fotos<br>• Fluxo de exclusão com confirmação<br>• Suporte a testes e documentação |

---

## 🏛️ Arquitetura do Repositório

```text
Mapa-Turistico/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js               # Conexão com Supabase PostGIS
│   │   ├── controllers/
│   │   │   └── pontosController.js # Lógica espacial PostGIS (BBox, DWithin, CRUD)
│   │   ├── routes/
│   │   │   └── pontosRoutes.js     # Mapeamento de rotas da API
│   │   └── server.js               # Servidor Express com CORS
│   ├── schema.sql                  # DDL PostGIS, índice GiST e seeds
│   ├── .env.example                # Variáveis de ambiente de exemplo
│   ├── package.json
│   └── README.md                   # Documentação detalhada dos endpoints
├── frontend/                       # Código do Frontend (Dev 2 e Dev 3)
└── README.md                       # Apresentação do projeto e visão geral
```

---

## ⚡ Inicialização Rápida do Backend

1. Acesse o diretório `backend`:
   ```bash
   cd backend
   ```
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Configure o arquivo `.env` (baseado em `.env.example`):
   ```bash
   cp .env.example .env
   ```
4. Execute o script `schema.sql` no **SQL Editor** do Supabase.
5. Inicie o servidor:
   ```bash
   npm run dev
   ```

Mais detalhes na [documentação da API](backend/README.md).
