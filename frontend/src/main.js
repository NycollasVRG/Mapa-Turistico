/**
 * GeoTurismo — Frontend Core & Leaflet
 * Módulo Principal: Inicialização do Mapa, Camadas Espaciais e US01 (Geolocalização)
 */

import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import './style.css';
import { initCadastro } from './cadastro.js';

// Garante compatibilidade tanto com Vite quanto com CDN nativo (window.L)
const Leaflet = window.L || L;

// ========================================================
// 1. Configurações Globais & Endpoints da API (Backend)
// ========================================================
// Conforme documentação em backend/README.md, a API roda na porta 3000 sob o prefixo /api
export const API_BASE_URL = import.meta.env?.VITE_API_URL || 'http://localhost:3000/api';

// Coordenada padrão de Fallback: Cajazeiras/PB (conforme especificação da US01)
export const DEFAULT_LOCATION = {
  lat: -6.8897,
  lng: -38.5564,
  label: 'Cajazeiras, PB (Padrão)'
};

export const DEFAULT_ZOOM = 14;

// ========================================================
// 2. Estado do Mapa e Camadas Espaciais (Escopo da Aplicação)
// ========================================================
/** Instância principal do mapa Leaflet */
export let map = null;

/** 
 * Coordenada atual de referência { lat, lng }
 * Atualizada pela geolocalização e utilizada pelas histórias US01, US02 e US03 (Raio)
 */
export let userLocation = { lat: DEFAULT_LOCATION.lat, lng: DEFAULT_LOCATION.lng };

/** Grupo de camada para a posição do usuário ("Você está aqui") */
export let userLayer = null;

/** Grupo de camada para pontos turísticos gerais (US02 - Bounding Box / US03 - Proximidade) */
export let markersLayer = null;

/** Grupo de camada para o círculo de buffer/raio em metros (US03) */
export let radiusLayer = null;

// ========================================================
// 3. Sistema de Notificações Não Bloqueantes (Toasts)
// ========================================================
/**
 * Exibe um toast temporário e não bloqueante no canto superior da tela.
 * @param {string} message Texto descritivo da notificação
 * @param {'info'|'warning'|'success'|'error'} [type='info'] Categoria visual do toast
 * @param {string} [title] Título opcional
 * @param {number} [duration=5000] Tempo de exibição em milissegundos
 */
export function showToast(message, type = 'info', title = '', duration = 5000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = {
    info: 'ℹ️',
    warning: '⚠️',
    success: '✅',
    error: '❌'
  };

  const defaultTitles = {
    info: 'Informação',
    warning: 'Aviso',
    success: 'Sucesso',
    error: 'Erro'
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');

  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
    <div class="toast-content">
      <div class="toast-title">${title || defaultTitles[type]}</div>
      <div class="toast-message">${message}</div>
    </div>
    <button class="toast-close" aria-label="Fechar notificação">&times;</button>
  `;

  const closeBtn = toast.querySelector('.toast-close');
  const dismiss = () => {
    toast.classList.add('hiding');
    setTimeout(() => {
      if (toast.parentElement) toast.parentElement.removeChild(toast);
    }, 300);
  };

  closeBtn.addEventListener('click', dismiss);
  container.appendChild(toast);

  if (duration > 0) {
    setTimeout(dismiss, duration);
  }
}

// ========================================================
// 4. Marcadores Customizados de Geolocalização
// ========================================================
/**
 * Cria e estiliza o marcador do usuário no Leaflet usando divIcon com animação pulsante.
 * @param {number} lat Latitude
 * @param {number} lng Longitude
 * @param {boolean} [isRealLocation=true] Define se é a localização real do GPS ou fallback
 * @returns {L.Marker} Marcador Leaflet configurado
 */
export function renderUserMarker(lat, lng, isRealLocation = true) {
  if (!userLayer) return null;

  // Limpa o marcador anterior do usuário para não duplicar
  userLayer.clearLayers();

  const pulseClass = isRealLocation ? 'gps-pulse' : 'gps-pulse fallback-gps-pulse';
  const coreClass = isRealLocation ? 'gps-core' : 'gps-core fallback-gps-core';

  const userIcon = Leaflet.divIcon({
    className: 'user-gps-marker-container',
    html: `
      <div class="user-gps-marker">
        <div class="${pulseClass}"></div>
        <div class="${coreClass}"></div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });

  const markerTitle = isRealLocation ? 'Você está aqui' : 'Localização Padrão';
  const marker = Leaflet.marker([lat, lng], {
    icon: userIcon,
    title: markerTitle,
    zIndexOffset: 1000 // Mantém o marcador do usuário sempre acima dos demais
  });

  // Popup informativo
  const popupContent = `
    <div class="user-popup">
      <strong>📍 ${markerTitle}</strong>
      <span>${
        isRealLocation
          ? 'Posição obtida com sucesso via GPS.'
          : 'Cajazeiras, PB (Referência de Fallback)'
      }</span>
      <span style="font-size: 0.7rem; color: #94a3b8; margin-top: 2px;">
        Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}
      </span>
    </div>
  `;

  marker.bindPopup(popupContent);
  marker.bindTooltip(markerTitle, {
    direction: 'top',
    offset: [0, -12],
    opacity: 0.9
  });

  userLayer.addLayer(marker);
  marker.openPopup();

  return marker;
}

// ========================================================
// 5. US01: Centralização Automática por Geolocalização
// ========================================================
/**
 * Executa o fallback quando o GPS não puder ser obtido.
 * Centraliza em Cajazeiras/PB e exibe aviso discreto não bloqueante.
 * @param {string} reason Motivo do acionamento do fallback
 */
export function handleLocationFallback(reason) {
  console.warn(`[GeoTurismo] Geolocalização fallback acionada: ${reason}`);

  userLocation.lat = DEFAULT_LOCATION.lat;
  userLocation.lng = DEFAULT_LOCATION.lng;

  if (map) {
    map.setView([DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lng], DEFAULT_ZOOM);
    renderUserMarker(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lng, false);
    debouncedCarregarPontos();
  }

  showToast(
    `${reason} O mapa foi centralizado na localização padrão (${DEFAULT_LOCATION.label}).`,
    'warning',
    'Localização Padrão Ativada'
  );
}

/**
 * Solicita a geolocalização do usuário via API nativa do navegador.
 * Atende aos critérios da US01:
 * - Zoom nível 14
 * - Marcador diferenciado "Você está aqui"
 * - Fallback gracioso com toast em caso de negação, timeout ou erro
 * @param {object} [options] Opções de execução
 * @param {boolean} [options.notifySuccess=false] Notificar mesmo se obtiver sucesso (ex: clique manual)
 */
export function locateUser(options = { notifySuccess: false }) {
  if (!('geolocation' in navigator)) {
    handleLocationFallback('Navegador sem suporte à API de geolocalização.');
    return;
  }

  const geoOptions = {
    enableHighAccuracy: true,
    timeout: 8000,
    maximumAge: 0
  };

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      console.log(`[GeoTurismo] Localização obtida: Lat ${latitude}, Lng ${longitude}`);

      userLocation.lat = latitude;
      userLocation.lng = longitude;

      if (map) {
        map.setView([latitude, longitude], DEFAULT_ZOOM);
        renderUserMarker(latitude, longitude, true);
        debouncedCarregarPontos();
      }

      if (options.notifySuccess) {
        showToast('Localização atualizada com sucesso!', 'success', 'GPS Conectado');
      }
    },
    (error) => {
      let reasonMessage = 'Não foi possível obter sua localização exata.';

      switch (error.code) {
        case error.PERMISSION_DENIED:
          reasonMessage = 'Permissão de localização negada pelo usuário.';
          break;
        case error.POSITION_UNAVAILABLE:
          reasonMessage = 'Sinal de localização GPS indisponível no dispositivo.';
          break;
        case error.TIMEOUT:
          reasonMessage = 'Tempo limite esgotado ao tentar obter o GPS.';
          break;
        default:
          reasonMessage = 'Ocorreu um erro ao consultar o GPS.';
          break;
      }

      handleLocationFallback(reasonMessage);
    },
    geoOptions
  );
}

// ========================================================
// 6. Utilitários & Feedback Visual de Sincronização
// ========================================================
/**
 * Utilitário de Debounce para limitar a frequência de chamadas repetitivas
 * (ex: eventos 'moveend' ao arrastar ou dar zoom no Leaflet).
 * @param {Function} func Função a ser executada com atraso
 * @param {number} [delay=400] Atraso em milissegundos (padrão 400ms conforme US02)
 * @returns {Function} Função decorada com debounce
 */
export function debounce(func, delay = 400) {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      func.apply(this, args);
      timer = null;
    }, delay);
  };
}

/**
 * Atualiza o indicador visual e contador de pontos no header da aplicação.
 * @param {number|null} [count=null] Quantidade de pontos visíveis
 * @param {boolean} [isLoading=false] Estado de carregamento ativo
 * @param {boolean} [isError=false] Estado de erro de conexão
 * @param {string} [customText=''] Texto personalizado opcional
 */
export function atualizarStatusPontos(count = null, isLoading = false, isError = false, customText = '') {
  const dot = document.getElementById('badge-status-dot');
  const text = document.getElementById('points-status-text');
  if (!dot || !text) return;

  dot.classList.remove('loading', 'error', 'offline');

  if (isLoading) {
    dot.classList.add('loading');
    text.textContent = customText || 'Carregando área...';
    return;
  }

  if (isError) {
    dot.classList.add('error');
    text.textContent = customText || 'Erro ao sincronizar';
    return;
  }

  // Estado sincronizado com sucesso
  if (typeof count === 'number') {
    text.textContent = count === 1 ? '1 ponto visível' : `${count} pontos visíveis`;
  } else if (customText) {
    text.textContent = customText;
  }
}

// ========================================================
// 7. Renderização Modular de Marcadores (US02 / US03)
// ========================================================
/**
 * Renderiza os pontos turísticos recebidos da API na camada markersLayer.
 * Executa a reciclagem da camada (clearLayers) preservando intacta a userLayer.
 * Associa popups limpos com identificação para o Dev 3 (US05/US06).
 * @param {Array<object>} pontos Lista de pontos turísticos
 */
export function renderizarPontos(pontos = []) {
  if (!markersLayer) {
    console.warn('[GeoTurismo] markersLayer ainda não foi inicializado.');
    return;
  }

  // 1. Reciclagem de marcadores: remove apenas pontos da camada markersLayer
  // Mantém estritamente o marcador do usuário ("Você está aqui") na userLayer
  markersLayer.clearLayers();

  if (!Array.isArray(pontos)) {
    console.warn('[GeoTurismo] renderizarPontos recebeu dados em formato inválido:', pontos);
    atualizarStatusPontos(0, false);
    return;
  }

  // 2. Itera e cria marcadores no Leaflet
  pontos.forEach((ponto) => {
    const lat = parseFloat(ponto.latitude);
    const lng = parseFloat(ponto.longitude);

    if (isNaN(lat) || isNaN(lng)) {
      console.warn(`[GeoTurismo] Ponto com coordenadas inválidas ignorado: ID ${ponto.id}`);
      return;
    }

    const marker = Leaflet.marker([lat, lng], {
      title: ponto.nome || 'Ponto Turístico'
    });

    // Sanitização e formatação do conteúdo do popup
    const nome = ponto.nome || 'Ponto Turístico';
    const categoria = ponto.categoria || 'Geral';
    const descricao = ponto.descricao || 'Nenhuma descrição detalhada disponível.';
    const fotoHtml = ponto.foto_url
      ? `<img src="${ponto.foto_url}" alt="${nome}" class="ponto-popup-image" loading="lazy" onerror="this.style.display='none'" />`
      : '';

    // Estrutura modular preparada para estilização e ações do Dev 3 (US05/US06)
    const popupContent = `
      <div class="ponto-popup-container" data-ponto-id="${ponto.id || ''}">
        <div class="ponto-popup-header">
          <h3 class="ponto-popup-title">${nome}</h3>
          <span class="ponto-popup-category">${categoria}</span>
        </div>
        ${fotoHtml}
        <p class="ponto-popup-description">${descricao}</p>
        <div class="ponto-popup-actions" id="ponto-actions-${ponto.id || ''}">
          <!-- Slot reservado para botões de detalhes, edição e exclusão (Dev 3 - US05/US06) -->
        </div>
      </div>
    `;

    marker.bindPopup(popupContent, {
      maxWidth: 280,
      className: 'ponto-leaflet-popup'
    });

    markersLayer.addLayer(marker);
  });

  // Atualiza o contador de pontos visíveis
  atualizarStatusPontos(markersLayer.getLayers().length, false);
}

// ========================================================
// 8. US02: Carregamento Otimizado por Bounding Box
// ========================================================
/**
 * Flag booleana de controle para evitar conflito com a busca por raio (US03).
 * Quando true, o carregamento automático por Bounding Box no 'moveend' é ignorado.
 */
export let isRadiusSearchActive = false;

/**
 * Altera o estado da busca por raio (US03) e sincroniza com o objeto global window.
 * @param {boolean} active 
 */
export function setRadiusSearchActive(active) {
  isRadiusSearchActive = Boolean(active);
  if (window.geoTurismo) {
    window.geoTurismo.isRadiusSearchActive = isRadiusSearchActive;
  }
}

/**
 * Executa a requisição de pontos turísticos contidos estritamente na viewport visível (Bounding Box).
 * Utiliza as coordenadas extremas fornecidas por map.getBounds() e atualiza a markersLayer.
 * @returns {Promise<Array<object>|null>} Lista de pontos obtidos da API
 */
export async function carregarPontosPorBBox() {
  if (!map) {
    console.warn('[GeoTurismo] Tentativa de buscar pontos sem o mapa estar inicializado.');
    return null;
  }

  // Prevenção de conflito arquitetural com US03 (busca por raio)
  if (isRadiusSearchActive) {
    console.log('[GeoTurismo] Busca por BBox ignorada: busca por raio (US03) está ativa.');
    return null;
  }

  const bounds = map.getBounds();
  const minLng = bounds.getWest();
  const minLat = bounds.getSouth();
  const maxLng = bounds.getEast();
  const maxLat = bounds.getNorth();

  // Ativa feedback visual de carregamento
  atualizarStatusPontos(null, true);

  try {
    const url = `${API_BASE_URL}/pontos?bbox=${minLng},${minLat},${maxLng},${maxLat}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Falha na resposta do servidor (Status HTTP ${response.status})`);
    }

    const pontos = await response.json();
    renderizarPontos(pontos);
    return pontos;
  } catch (error) {
    console.error('[GeoTurismo] Falha ao carregar pontos por BBox:', error);
    atualizarStatusPontos(0, false, true, 'Servidor offline / Erro');
    showToast(
      'Não foi possível conectar ao servidor para carregar os pontos turísticos.',
      'error',
      'Erro de Conexão'
    );
    return null;
  }
}

/**
 * Função de carregamento por BBox envolvida por debounce de 400ms para o evento moveend.
 */
export const debouncedCarregarPontos = debounce(() => {
  if (isRadiusSearchActive) return;
  carregarPontosPorBBox();
}, 400);

// ========================================================
// 9. US03: Busca Espacial por Raio de Proximidade (Buffer / ST_DWithin)
// ========================================================
/**
 * Formata um valor numérico de distância em metros para exibição amigável.
 * @param {number|string} metros Distância calculada em metros
 * @returns {string} Distância formatada (ex: "450 m" ou "2.5 km")
 */
export function formatarDistancia(metros) {
  if (metros === undefined || metros === null || isNaN(metros)) return '';
  const m = Math.round(Number(metros));
  if (m < 1000) {
    return `${m} m`;
  }
  const km = (m / 1000).toFixed(1).replace('.0', '');
  return `${km} km`;
}

/**
 * Executa a busca de pontos turísticos dentro de um raio especificado em quilômetros.
 * Desenha o círculo visual translúcido no Leaflet (radiusLayer), enquadra o mapa com fitBounds,
 * previne conflito com o carregamento por BBox e consome GET /api/pontos/proximidade.
 * @param {number|string} raioKm Raio em quilômetros
 * @returns {Promise<Array<object>|null>} Lista de pontos encontrados
 */
export async function buscarPontosPorRaio(raioKm) {
  if (!map) {
    console.warn('[GeoTurismo] Tentativa de buscar por raio sem o mapa estar inicializado.');
    return null;
  }

  // Se o valor for vazio ou inválido, desativa o filtro de raio e volta para a área visível
  if (!raioKm || isNaN(raioKm) || Number(raioKm) <= 0) {
    desativarBuscaPorRaio(false);
    return null;
  }

  const km = parseFloat(raioKm);
  const raioMetros = km * 1000;

  // Garante que as coordenadas de referência estão definidas
  if (userLocation.lat === undefined || userLocation.lng === undefined) {
    showToast('Localização de referência indisponível para busca por raio.', 'warning', 'Aviso');
    return null;
  }

  // 1. Limpa desenhos de raios anteriores
  if (radiusLayer) {
    radiusLayer.clearLayers();
  }

  // 2. CRÍTICO: Ativa a flag ANTES de fitBounds para evitar que o evento moveend
  // disparado pelo fitBounds execute uma busca por BBox sobrescrevendo o raio
  setRadiusSearchActive(true);

  // 3. Desenha o círculo visual translúcido centrado no usuário
  const circle = Leaflet.circle([userLocation.lat, userLocation.lng], {
    radius: raioMetros,
    color: '#0284c7',
    weight: 2,
    opacity: 0.85,
    fillColor: '#38bdf8',
    fillOpacity: 0.15,
    dashArray: '6, 6'
  });

  if (radiusLayer) {
    radiusLayer.addLayer(circle);
  }

  // 4. Ajusta o enquadramento suavemente para caber o círculo na tela
  map.fitBounds(circle.getBounds(), {
    padding: [30, 30],
    maxZoom: 16
  });

  // 5. Exibe o botão de limpar filtro no Header
  const btnClear = document.getElementById('btn-clear-radius');
  if (btnClear) {
    btnClear.classList.remove('hidden');
  }

  // 6. Ativa feedback de carregamento
  atualizarStatusPontos(null, true, false, `Buscando em ${km} km...`);

  try {
    const url = `${API_BASE_URL}/pontos/proximidade?lng=${userLocation.lng}&lat=${userLocation.lat}&raio=${raioMetros}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Falha na resposta do servidor (Status HTTP ${response.status})`);
    }

    const pontos = await response.json();

    // 7. Renderiza os pontos encontrados
    renderizarPontos(pontos);

    // 8. Atualiza o status badge e notifica com toast amigável
    const count = Array.isArray(pontos) ? pontos.length : 0;
    const textoStatus = count === 1 ? `1 ponto em ${km} km` : `${count} pontos em ${km} km`;
    atualizarStatusPontos(count, false, false, textoStatus);

    showToast(
      count === 0
        ? `Nenhum ponto turístico cadastrado no raio de ${km} km.`
        : `${count} ponto(s) encontrado(s) dentro do raio de ${km} km.`,
      count === 0 ? 'info' : 'success',
      'Busca por Proximidade'
    );

    return pontos;
  } catch (error) {
    console.error('[GeoTurismo] Erro na busca por proximidade:', error);
    atualizarStatusPontos(0, false, true, 'Erro na busca');
    showToast(
      'Não foi possível realizar a busca por proximidade no servidor.',
      'error',
      'Erro de Conexão'
    );
    return null;
  }
}

/**
 * Desativa o filtro de busca por raio, limpa a camada gráfica e restaura o modo de Bounding Box.
 * @param {boolean} [resetSelect=true] Se true, redefine o elemento select para vazio
 */
export function desativarBuscaPorRaio(resetSelect = true) {
  if (radiusLayer) {
    radiusLayer.clearLayers();
  }

  setRadiusSearchActive(false);

  if (resetSelect) {
    const select = document.getElementById('select-radius');
    if (select) select.value = '';
  }

  const btnClear = document.getElementById('btn-clear-radius');
  if (btnClear) {
    btnClear.classList.add('hidden');
  }

  showToast('Filtro por raio desativado. Exibindo área visível.', 'info', 'Área Visível');
  carregarPontosPorBBox();
}

// ========================================================
// 10. Inicialização do Mapa Leaflet
// ========================================================
/**
 * Inicializa a instância do Leaflet, adiciona o TileLayer OpenStreetMap,
 * registra os LayerGroups e inicia a rotina de geolocalização da US01.
 */
export function initMap() {
  const mapElement = document.getElementById('map');
  if (!mapElement) {
    console.error('[GeoTurismo] Elemento #map não foi encontrado no DOM.');
    return null;
  }

  // Inicializa o mapa centralizado previamente no fallback enquanto obtém o GPS
  map = Leaflet.map('map', {
    zoomControl: false,
    attributionControl: true
  }).setView([DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lng], DEFAULT_ZOOM);

  // Controle de Zoom posicionado na parte inferior para evitar sobreposição com o Header
  Leaflet.control.zoom({
    position: 'bottomright'
  }).addTo(map);

  // Camada Base: OpenStreetMap Cartografia Livre
  Leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
  }).addTo(map);

  // Inicialização e vinculação dos LayerGroups exigidos pela arquitetura
  userLayer = Leaflet.layerGroup().addTo(map);
  markersLayer = Leaflet.layerGroup().addTo(map);
  radiusLayer = Leaflet.layerGroup().addTo(map);

  // US02: Ouve o evento moveend com debounce de 400ms para recarregar a viewport
  map.on('moveend', debouncedCarregarPontos);

  // Vincula evento do botão "Minha Localização" no Header
  const btnMyLocation = document.getElementById('btn-my-location');
  if (btnMyLocation) {
    btnMyLocation.addEventListener('click', () => {
      locateUser({ notifySuccess: true });
    });
  }

  // US03: Vincula eventos do seletor de raio e botão de limpar
  const selectRadius = document.getElementById('select-radius');
  if (selectRadius) {
    selectRadius.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val) {
        buscarPontosPorRaio(val);
      } else {
        desativarBuscaPorRaio(false);
      }
    });
  }

  const btnClearRadius = document.getElementById('btn-clear-radius');
  if (btnClearRadius) {
    btnClearRadius.addEventListener('click', () => {
      desativarBuscaPorRaio(true);
    });
  }

  // Exposição global direta para Dev 3 (operações CRUD) e US03
  window.carregarPontosPorBBox = carregarPontosPorBBox;
  window.buscarPontosPorRaio = buscarPontosPorRaio;
  window.desativarBuscaPorRaio = desativarBuscaPorRaio;

  // Disponibiliza as referências no objeto global window para integração dos demais membros (Dev 2 e Dev 3)
  window.geoTurismo = {
    map,
    userLocation,
    userLayer,
    markersLayer,
    radiusLayer,
    API_BASE_URL,
    isRadiusSearchActive,
    setRadiusSearchActive,
    carregarPontosPorBBox,
    debouncedCarregarPontos,
    buscarPontosPorRaio,
    desativarBuscaPorRaio,
    formatarDistancia,
    locateUser,
    renderUserMarker,
    renderizarPontos,
    atualizarStatusPontos,
    debounce,
    showToast
  };

  console.log('[GeoTurismo] Mapa e camadas iniciais configurados com sucesso.');

  // US01: Solicita a permissão e centraliza por geolocalização automaticamente ao inicializar
  locateUser();

  // US04: Inicializa módulo de cadastro e geocodificação (Dev 3)
  initCadastro({
    map,
    API_BASE_URL,
    showToast,
    carregarPontosPorBBox
  });

  return map;
}

// Inicialização automática ao carregar o DOM
document.addEventListener('DOMContentLoaded', () => {
  initMap();
});
