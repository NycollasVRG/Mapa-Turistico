/**
 * GeoTurismo — Frontend Core & Leaflet
 * Módulo Principal: Inicialização do Mapa, Camadas Espaciais e US01 (Geolocalização)
 */

import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import './style.css';

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
// 6. Inicialização do Mapa Leaflet
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

  // Vincula evento do botão "Minha Localização" no Header
  const btnMyLocation = document.getElementById('btn-my-location');
  if (btnMyLocation) {
    btnMyLocation.addEventListener('click', () => {
      locateUser({ notifySuccess: true });
    });
  }

  // Disponibiliza as referências no objeto global window para integração dos demais membros (Dev 2 e Dev 3)
  window.geoTurismo = {
    map,
    userLocation,
    userLayer,
    markersLayer,
    radiusLayer,
    API_BASE_URL,
    locateUser,
    renderUserMarker,
    showToast
  };

  console.log('[GeoTurismo] Mapa e camadas iniciais configurados com sucesso.');

  // US01: Solicita a permissão e centraliza por geolocalização automaticamente ao inicializar
  locateUser();

  return map;
}

// Inicialização automática ao carregar o DOM
document.addEventListener('DOMContentLoaded', () => {
  initMap();
});
