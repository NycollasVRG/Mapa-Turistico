/**
 * GeoTurismo — Frontend Core & Leaflet
 * Módulo Principal: Inicialização do Mapa e Camadas Espaciais
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
 * @param {number} [duration=4500] Tempo de exibição em milissegundos
 */
export function showToast(message, type = 'info', title = '', duration = 4500) {
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
// 4. Inicialização do Mapa Leaflet
// ========================================================
/**
 * Inicializa a instância do Leaflet, adiciona o TileLayer OpenStreetMap
 * e instancia os LayerGroups obrigatórios (userLayer, markersLayer, radiusLayer).
 */
export function initMap() {
  const mapElement = document.getElementById('map');
  if (!mapElement) {
    console.error('[GeoTurismo] Elemento #map não foi encontrado no DOM.');
    return null;
  }

  // Inicializa o mapa com controles de zoom no canto inferior direito
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

  // Disponibiliza as referências no objeto global window para integração dos demais membros (Dev 2 e Dev 3)
  window.geoTurismo = {
    map,
    userLocation,
    userLayer,
    markersLayer,
    radiusLayer,
    API_BASE_URL,
    showToast
  };

  console.log('[GeoTurismo] Mapa e camadas iniciais configurados com sucesso.');
  return map;
}

// Inicialização automática ao carregar o DOM
document.addEventListener('DOMContentLoaded', () => {
  initMap();
});
