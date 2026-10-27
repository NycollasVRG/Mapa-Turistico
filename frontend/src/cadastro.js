/**
 * GeoTurismo — Módulo de Cadastro, Geocodificação, Edição e Exclusão (US04 & US06 - Dev 3)
 * Responsável pela interface de cadastro/edição, integração com Nominatim (OpenStreetMap),
 * manipulação do pino arrastável no mapa, envio de POST /api/pontos, PUT /api/pontos/:id
 * e confirmação/exclusão via DELETE /api/pontos/:id com remoção visual imediata.
 */

import L from 'leaflet';
import { criarConteudoPopup } from './popup.js';

let mapInstance = null;
let apiBaseUrl = 'http://localhost:3000/api';
let toastFn = null;
let reloadBBoxFn = null;

let isCadastroOpen = false;
let pinoCriacao = null;
let debounceNominatimTimer = null;

// Estado de Edição e Exclusão (US06)
let pontoEmEdicao = null;
let markerEmEdicao = null;
let pontoParaExcluir = null;
let markerParaExcluir = null;

/**
 * Cria o ícone personalizado e destacado para o pino de criação/edição.
 * @param {boolean} [isEdit=false] Indica se o pino está em modo de edição
 */
function criarIconePinoCriacao(isEdit = false) {
  const tagTexto = isEdit ? 'Arraste para mover' : 'Arraste para ajustar';
  return L.divIcon({
    className: 'creation-pin-container',
    html: `
      <div class="creation-pin-wrapper">
        <div class="creation-pin-pulse"></div>
        <div class="creation-pin-marker">
          <span class="creation-pin-emoji">📍</span>
        </div>
        <div class="creation-pin-tag">${tagTexto}</div>
      </div>
    `,
    iconSize: [36, 52],
    iconAnchor: [18, 48]
  });
}

/**
 * Busca a instância do marcador na markersLayer a partir do ID do ponto turístico.
 * @param {number|string} id
 * @returns {L.Marker|null}
 */
function encontrarMarkerPorId(id) {
  const layerGroup = window.geoTurismo?.markersLayer;
  if (!layerGroup || id === undefined || id === null) return null;

  let encontrado = null;
  layerGroup.eachLayer((layer) => {
    if (String(layer.pontoId) === String(id)) {
      encontrado = layer;
    }
  });
  return encontrado;
}

/**
 * Restaura a opacidade original do marcador que estava sendo editado, se houver.
 */
function restaurarMarkerEmEdicao() {
  if (markerEmEdicao && typeof markerEmEdicao.setOpacity === 'function') {
    markerEmEdicao.setOpacity(1);
  }
  markerEmEdicao = null;
}

/**
 * Inicializa os ouvintes de eventos e elementos da US04 e US06.
 */
export function initCadastro(options = {}) {
  mapInstance = options.map || window.geoTurismo?.map;
  apiBaseUrl = options.API_BASE_URL || window.geoTurismo?.API_BASE_URL || 'http://localhost:3000/api';
  toastFn = options.showToast || window.geoTurismo?.showToast || console.log;
  reloadBBoxFn = options.carregarPontosPorBBox || window.geoTurismo?.carregarPontosPorBBox;

  const btnNovoPonto = document.getElementById('btn-novo-ponto');
  const btnFechar = document.getElementById('btn-fechar-cadastro');
  const btnCancelar = document.getElementById('btn-cancelar-cadastro');
  const form = document.getElementById('form-cadastro-ponto');
  const inputNominatim = document.getElementById('nominatim-search');
  const btnLimparNominatim = document.getElementById('btn-limpar-nominatim');
  const inputLat = document.getElementById('ponto-latitude');
  const inputLng = document.getElementById('ponto-longitude');

  // Elementos do modal de confirmação de exclusão (US06)
  const modalConfirm = document.getElementById('modal-confirmar-exclusao');
  const btnCancelarExclusao = document.getElementById('btn-cancelar-exclusao');
  const btnConfirmarExclusao = document.getElementById('btn-confirmar-exclusao');

  if (btnNovoPonto) {
    btnNovoPonto.addEventListener('click', () => {
      abrirPainelCadastro();
    });
  }

  if (btnFechar) {
    btnFechar.addEventListener('click', () => {
      fecharPainelCadastro();
    });
  }

  if (btnCancelar) {
    btnCancelar.addEventListener('click', () => {
      fecharPainelCadastro();
    });
  }

  if (form) {
    form.addEventListener('submit', handleFormSubmit);
  }

  if (inputNominatim) {
    inputNominatim.addEventListener('input', handleNominatimInput);
    inputNominatim.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') fecharSugestoesNominatim();
    });
  }

  if (btnLimparNominatim) {
    btnLimparNominatim.addEventListener('click', () => {
      if (inputNominatim) inputNominatim.value = '';
      btnLimparNominatim.classList.add('hidden');
      fecharSugestoesNominatim();
    });
  }

  // Sincroniza alteração manual de coordenadas com a posição do pino
  const handleManualCoordChange = () => {
    const lat = parseFloat(inputLat?.value);
    const lng = parseFloat(inputLng?.value);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      atualizarPosicaoPino(lat, lng, false);
    }
  };

  if (inputLat) inputLat.addEventListener('change', handleManualCoordChange);
  if (inputLng) inputLng.addEventListener('change', handleManualCoordChange);

  // Eventos do modal de confirmação de exclusão (US06)
  if (btnCancelarExclusao) {
    btnCancelarExclusao.addEventListener('click', fecharModalConfirmacaoExclusao);
  }

  if (btnConfirmarExclusao) {
    btnConfirmarExclusao.addEventListener('click', executarExclusaoPonto);
  }

  if (modalConfirm) {
    modalConfirm.addEventListener('click', (e) => {
      if (e.target === modalConfirm) {
        fecharModalConfirmacaoExclusao();
      }
    });
  }

  // Fecha sugestões ao clicar fora e fecha modal com Escape
  document.addEventListener('click', (e) => {
    const nominatimGroup = document.querySelector('.nominatim-group');
    if (nominatimGroup && !nominatimGroup.contains(e.target)) {
      fecharSugestoesNominatim();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (modalConfirm && !modalConfirm.classList.contains('hidden')) {
        fecharModalConfirmacaoExclusao();
      }
    }
  });

  // Escuta CustomEvents disparados pelos popups (US05 -> US06)
  document.addEventListener('geoturismo:editar-ponto', (e) => {
    if (e.detail?.ponto) {
      abrirEdicaoPonto(e.detail.ponto, e.detail.marker);
    }
  });

  document.addEventListener('geoturismo:excluir-ponto', (e) => {
    if (e.detail?.ponto) {
      confirmarExclusaoPonto(e.detail.ponto, e.detail.marker);
    }
  });

  // Registra no objeto global para interoperabilidade entre módulos
  if (window.geoTurismo) {
    window.geoTurismo.abrirCadastro = abrirPainelCadastro;
    window.geoTurismo.fecharCadastro = fecharPainelCadastro;
    window.geoTurismo.abrirEdicao = abrirEdicaoPonto;
    window.geoTurismo.confirmarExclusao = confirmarExclusaoPonto;
  }
}

/**
 * Configura os textos de cabeçalho e botão do painel conforme o modo (Criação vs Edição).
 * @param {boolean} isEdit
 */
function configurarCabecalhoPainel(isEdit = false) {
  const titleEl = document.getElementById('cadastro-title');
  const subtitleEl = document.querySelector('.panel-subtitle');
  const iconEl = document.querySelector('.panel-title-icon');
  const btnTextEl = document.getElementById('cadastro-btn-text');

  if (isEdit) {
    if (titleEl) titleEl.textContent = 'Editar Ponto Turístico';
    if (subtitleEl) subtitleEl.textContent = 'Atualizar Dados e Geometria';
    if (iconEl) iconEl.textContent = '✏️';
    if (btnTextEl) btnTextEl.textContent = 'Salvar Alterações';
  } else {
    if (titleEl) titleEl.textContent = 'Novo Ponto Turístico';
    if (subtitleEl) subtitleEl.textContent = 'Geocodificação e PostGIS';
    if (iconEl) iconEl.textContent = '📍';
    if (btnTextEl) btnTextEl.textContent = 'Salvar Ponto';
  }
}

/**
 * Abre o painel lateral em modo de criação de novo ponto (US04).
 */
export function abrirPainelCadastro() {
  const panel = document.getElementById('panel-cadastro-container');
  if (!panel) return;

  restaurarMarkerEmEdicao();
  pontoEmEdicao = null;
  resetFormulario();
  configurarCabecalhoPainel(false);

  if (pinoCriacao && mapInstance) {
    mapInstance.removeLayer(pinoCriacao);
    pinoCriacao = null;
  }

  panel.classList.remove('hidden');
  isCadastroOpen = true;

  if (mapInstance) {
    mapInstance.closePopup();
    const container = mapInstance.getContainer();
    if (container) container.classList.add('cursor-crosshair');
    mapInstance.off('click', handleMapClick);
    mapInstance.on('click', handleMapClick);
  }

  const initialCoord = window.geoTurismo?.userLocation?.lat
    ? [window.geoTurismo.userLocation.lat, window.geoTurismo.userLocation.lng]
    : mapInstance ? [mapInstance.getCenter().lat, mapInstance.getCenter().lng] : [-22.951916, -43.210487];

  atualizarPosicaoPino(initialCoord[0], initialCoord[1], false);

  const inputNome = document.getElementById('ponto-nome');
  if (inputNome) inputNome.focus();

  if (toastFn) {
    toastFn(
      'Clique no mapa ou busque o endereço pelo Nominatim para definir a coordenada.',
      'info',
      'Cadastro de Ponto'
    );
  }
}

/**
 * Abre o painel lateral pré-preenchido com os dados do ponto turístico para edição (US06).
 * Posiciona o pino arrastável nas coordenadas atuais do ponto para permitir ajuste geométrico.
 *
 * @param {object} ponto Objeto com os dados atuais do ponto turístico
 * @param {L.Marker} [marker=null] Referência opcional ao marcador no mapa
 */
export function abrirEdicaoPonto(ponto, marker = null) {
  if (!ponto || ponto.id === undefined) return;

  const panel = document.getElementById('panel-cadastro-container');
  if (!panel) return;

  restaurarMarkerEmEdicao();
  pontoEmEdicao = { ...ponto };
  markerEmEdicao = marker || encontrarMarkerPorId(ponto.id);

  if (markerEmEdicao && typeof markerEmEdicao.setOpacity === 'function') {
    markerEmEdicao.setOpacity(0.35);
  }

  resetFormulario();
  configurarCabecalhoPainel(true);

  if (pinoCriacao && mapInstance) {
    mapInstance.removeLayer(pinoCriacao);
    pinoCriacao = null;
  }

  // Pré-preenchimento dos campos do formulário (Critério 1 - US06)
  const nomeInput = document.getElementById('ponto-nome');
  const categoriaSelect = document.getElementById('ponto-categoria');
  const fotoInput = document.getElementById('ponto-foto');
  const descricaoInput = document.getElementById('ponto-descricao');

  if (nomeInput) nomeInput.value = ponto.nome || '';
  if (categoriaSelect) {
    const opcoesValidas = Array.from(categoriaSelect.options).map((o) => o.value);
    categoriaSelect.value = opcoesValidas.includes(ponto.categoria) ? ponto.categoria : 'Outro';
  }
  if (fotoInput) fotoInput.value = ponto.foto_url || '';
  if (descricaoInput) descricaoInput.value = ponto.descricao || '';

  panel.classList.remove('hidden');
  isCadastroOpen = true;

  if (mapInstance) {
    mapInstance.closePopup();
    const container = mapInstance.getContainer();
    if (container) container.classList.add('cursor-crosshair');
    mapInstance.off('click', handleMapClick);
    mapInstance.on('click', handleMapClick);
  }

  const lat = parseFloat(ponto.latitude);
  const lng = parseFloat(ponto.longitude);
  if (!isNaN(lat) && !isNaN(lng)) {
    atualizarPosicaoPino(lat, lng, true);
  }

  if (nomeInput) nomeInput.focus();

  if (toastFn) {
    toastFn(
      `Editando "${ponto.nome}". Arraste o pino ou clique no mapa se desejar alterar o local.`,
      'info',
      'Modo de Edição'
    );
  }
}

/**
 * Fecha o painel de cadastro/edição e restaura os listeners e o cursor padrão.
 */
export function fecharPainelCadastro() {
  const panel = document.getElementById('panel-cadastro-container');
  if (panel) panel.classList.add('hidden');

  isCadastroOpen = false;
  pontoEmEdicao = null;
  restaurarMarkerEmEdicao();

  if (mapInstance) {
    const container = mapInstance.getContainer();
    if (container) container.classList.remove('cursor-crosshair');
    mapInstance.off('click', handleMapClick);
  }

  if (pinoCriacao && mapInstance) {
    mapInstance.removeLayer(pinoCriacao);
    pinoCriacao = null;
  }

  fecharSugestoesNominatim();
  resetFormulario();
  configurarCabecalhoPainel(false);
}

/**
 * Trata o clique no mapa enquanto o painel de cadastro/edição está ativo.
 */
function handleMapClick(e) {
  if (!isCadastroOpen) return;
  const { lat, lng } = e.latlng;
  atualizarPosicaoPino(lat, lng, false);
}

/**
 * Atualiza as coordenadas nos inputs e posiciona o pino arrastável no Leaflet.
 */
function atualizarPosicaoPino(lat, lng, panToLocation = false) {
  if (!mapInstance) return;

  const latFormatada = Number(lat).toFixed(6);
  const lngFormatada = Number(lng).toFixed(6);

  const inputLat = document.getElementById('ponto-latitude');
  const inputLng = document.getElementById('ponto-longitude');

  if (inputLat) inputLat.value = latFormatada;
  if (inputLng) inputLng.value = lngFormatada;

  const isEdit = Boolean(pontoEmEdicao);

  if (!pinoCriacao) {
    pinoCriacao = L.marker([lat, lng], {
      icon: criarIconePinoCriacao(isEdit),
      draggable: true,
      zIndexOffset: 2000,
      title: isEdit ? 'Arraste para atualizar a posição' : 'Ponto Turístico em Cadastro'
    }).addTo(mapInstance);

    pinoCriacao.on('drag', (ev) => {
      const pos = ev.target.getLatLng();
      if (inputLat) inputLat.value = pos.lat.toFixed(6);
      if (inputLng) inputLng.value = pos.lng.toFixed(6);
    });

    pinoCriacao.on('dragend', (ev) => {
      const pos = ev.target.getLatLng();
      if (inputLat) inputLat.value = pos.lat.toFixed(6);
      if (inputLng) inputLng.value = pos.lng.toFixed(6);
    });
  } else {
    pinoCriacao.setLatLng([lat, lng]);
  }

  if (panToLocation) {
    mapInstance.flyTo([lat, lng], Math.max(mapInstance.getZoom(), 16), { duration: 1.0 });
  }
}

/**
 * Trata digitação com debounce para consulta à API Nominatim (OpenStreetMap).
 */
function handleNominatimInput(e) {
  const query = e.target.value.trim();
  const btnLimpar = document.getElementById('btn-limpar-nominatim');
  const spinner = document.getElementById('nominatim-spinner');

  if (btnLimpar) {
    btnLimpar.classList.toggle('hidden', query.length === 0);
  }

  if (debounceNominatimTimer) {
    clearTimeout(debounceNominatimTimer);
  }

  if (query.length < 3) {
    fecharSugestoesNominatim();
    return;
  }

  if (spinner) spinner.classList.remove('hidden');

  debounceNominatimTimer = setTimeout(async () => {
    try {
      const resultados = await buscarNominatim(query);
      renderizarSugestoesNominatim(resultados);
    } catch (err) {
      console.error('[Nominatim] Erro ao buscar endereço:', err);
    } finally {
      if (spinner) spinner.classList.add('hidden');
    }
  }, 400);
}

/**
 * Executa requisição para o endpoint de busca pública do Nominatim.
 */
async function buscarNominatim(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1&accept-language=pt-BR`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha no Nominatim (Status ${res.status})`);
  return await res.json();
}

/**
 * Renderiza o dropdown de sugestões retornadas pelo Nominatim.
 */
function renderizarSugestoesNominatim(sugestoes) {
  const lista = document.getElementById('nominatim-results');
  if (!lista) return;

  lista.innerHTML = '';

  if (!sugestoes || sugestoes.length === 0) {
    lista.innerHTML = `<li class="nominatim-no-results">Nenhum local encontrado para a busca.</li>`;
    lista.classList.remove('hidden');
    return;
  }

  sugestoes.forEach((item) => {
    const li = document.createElement('li');
    li.className = 'nominatim-item';
    li.setAttribute('role', 'option');

    const displayCurto = item.display_name.split(',').slice(0, 3).join(',');
    const complemento = item.display_name.split(',').slice(3).join(',');

    li.innerHTML = `
      <span class="nominatim-icon">📍</span>
      <div class="nominatim-text-group">
        <span class="nominatim-primary">${displayCurto}</span>
        ${complemento ? `<span class="nominatim-secondary">${complemento}</span>` : ''}
      </div>
    `;

    li.addEventListener('click', () => {
      selecionarSugestaoNominatim(item);
    });

    lista.appendChild(li);
  });

  lista.classList.remove('hidden');
}

/**
 * Aplica a sugestão selecionada no formulário e posiciona o pino no mapa.
 */
function selecionarSugestaoNominatim(item) {
  const lat = parseFloat(item.lat);
  const lng = parseFloat(item.lon);

  const inputBusca = document.getElementById('nominatim-search');
  if (inputBusca) {
    inputBusca.value = item.display_name.split(',').slice(0, 2).join(',');
  }

  const inputNome = document.getElementById('ponto-nome');
  if (inputNome && !inputNome.value) {
    inputNome.value = item.display_name.split(',')[0].trim();
  }

  fecharSugestoesNominatim();
  atualizarPosicaoPino(lat, lng, true);

  if (toastFn) {
    toastFn('Localização encontrada via Nominatim e centralizada no mapa.', 'info', 'Geocodificação');
  }
}

/**
 * Oculta e limpa a lista de sugestões do Nominatim.
 */
function fecharSugestoesNominatim() {
  const lista = document.getElementById('nominatim-results');
  if (lista) {
    lista.classList.add('hidden');
    lista.innerHTML = '';
  }
}

/**
 * Reseta todos os campos do formulário para o estado inicial.
 */
function resetFormulario() {
  const form = document.getElementById('form-cadastro-ponto');
  if (form) form.reset();

  const inputBusca = document.getElementById('nominatim-search');
  if (inputBusca) inputBusca.value = '';

  const btnLimpar = document.getElementById('btn-limpar-nominatim');
  if (btnLimpar) btnLimpar.classList.add('hidden');
}

/**
 * Trata o envio do formulário, validações e chamadas POST /api/pontos (US04) ou PUT /api/pontos/:id (US06).
 */
async function handleFormSubmit(e) {
  e.preventDefault();

  const nomeInput = document.getElementById('ponto-nome');
  const categoriaSelect = document.getElementById('ponto-categoria');
  const fotoInput = document.getElementById('ponto-foto');
  const descricaoInput = document.getElementById('ponto-descricao');
  const latInput = document.getElementById('ponto-latitude');
  const lngInput = document.getElementById('ponto-longitude');

  const btnSubmit = document.getElementById('btn-submeter-cadastro');
  const spinner = document.getElementById('cadastro-btn-spinner');
  const btnText = document.getElementById('cadastro-btn-text');

  const nome = nomeInput?.value.trim();
  const categoria = categoriaSelect?.value;
  const foto_url = fotoInput?.value.trim() || null;
  const descricao = descricaoInput?.value.trim() || null;
  const latitude = parseFloat(latInput?.value);
  const longitude = parseFloat(lngInput?.value);

  if (!nome) {
    if (toastFn) toastFn('Informe o nome do ponto turístico.', 'warning', 'Campo Obrigatório');
    nomeInput?.focus();
    return;
  }

  if (!categoria) {
    if (toastFn) toastFn('Selecione uma categoria para o ponto.', 'warning', 'Campo Obrigatório');
    categoriaSelect?.focus();
    return;
  }

  if (isNaN(latitude) || latitude < -90 || latitude > 90) {
    if (toastFn) toastFn('Latitude inválida. Deve estar entre -90 e 90.', 'warning', 'Coordenada Inválida');
    latInput?.focus();
    return;
  }

  if (isNaN(longitude) || longitude < -180 || longitude > 180) {
    if (toastFn) toastFn('Longitude inválida. Deve estar entre -180 e 180.', 'warning', 'Coordenada Inválida');
    lngInput?.focus();
    return;
  }

  const payload = {
    nome,
    categoria,
    descricao,
    foto_url,
    latitude,
    longitude
  };

  const isEditing = Boolean(pontoEmEdicao && pontoEmEdicao.id !== undefined);
  const endpoint = isEditing ? `${apiBaseUrl}/pontos/${pontoEmEdicao.id}` : `${apiBaseUrl}/pontos`;
  const metodo = isEditing ? 'PUT' : 'POST';

  try {
    if (btnSubmit) btnSubmit.disabled = true;
    if (spinner) spinner.classList.remove('hidden');
    if (btnText) btnText.textContent = isEditing ? 'Salvando...' : 'Cadastrando...';

    const response = await fetch(endpoint, {
      method: metodo,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || `Erro HTTP ${response.status}`);
    }

    // Se estiver editando, atualiza imediatamente o marcador existente na tela antes mesmo do reload
    if (isEditing && markerEmEdicao) {
      const pontoAtualizado = {
        ...pontoEmEdicao,
        ...payload,
        ...data
      };
      markerEmEdicao.pontoData = pontoAtualizado;
      markerEmEdicao.setLatLng([latitude, longitude]);
      markerEmEdicao.setOpacity(1);
      const novoHtmlPopup = criarConteudoPopup(pontoAtualizado, window.geoTurismo?.formatarDistancia);
      markerEmEdicao.setPopupContent(novoHtmlPopup);
    }

    if (toastFn) {
      toastFn(
        isEditing
          ? `"${payload.nome}" foi atualizado com sucesso no PostGIS!`
          : `"${payload.nome}" foi persistido com sucesso no PostGIS!`,
        'success',
        isEditing ? 'Edição Concluída' : 'Cadastro Concluído'
      );
    }

    fecharPainelCadastro();

    // Recarrega a camada de pontos do mapa
    if (!window.geoTurismo?.isRadiusSearchActive) {
      if (reloadBBoxFn) {
        await reloadBBoxFn();
      } else if (window.geoTurismo?.carregarPontosPorBBox) {
        await window.geoTurismo.carregarPontosPorBBox();
      }
    }

    if (mapInstance) {
      mapInstance.flyTo([latitude, longitude], Math.max(mapInstance.getZoom(), 16), { duration: 1.0 });
    }
  } catch (err) {
    console.error(`[GeoTurismo] Falha no ${metodo} ${endpoint}:`, err);
    if (toastFn) {
      toastFn(
        err.message || 'Falha ao salvar no banco PostGIS. Verifique o servidor.',
        'error',
        isEditing ? 'Erro na Edição' : 'Erro no Cadastro'
      );
    }
  } finally {
    if (btnSubmit) btnSubmit.disabled = false;
    if (spinner) spinner.classList.add('hidden');
    if (btnText) btnText.textContent = isEditing ? 'Salvar Alterações' : 'Salvar Ponto';
  }
}

// ========================================================
// Fluxo de Confirmação e Exclusão de Ponto (US06)
// ========================================================

/**
 * Abre o modal de confirmação antes de excluir um ponto turístico (Critério 3 - US06).
 * @param {object} ponto Dados do ponto turístico a ser excluído
 * @param {L.Marker} [marker=null] Instância do marcador no Leaflet
 */
export function confirmarExclusaoPonto(ponto, marker = null) {
  if (!ponto || ponto.id === undefined) return;

  pontoParaExcluir = ponto;
  markerParaExcluir = marker || encontrarMarkerPorId(ponto.id);

  const modal = document.getElementById('modal-confirmar-exclusao');
  const nomeSpan = document.getElementById('confirm-ponto-nome');
  const btnConfirmar = document.getElementById('btn-confirmar-exclusao');

  if (nomeSpan) {
    nomeSpan.textContent = `"${ponto.nome || 'Ponto Turístico'}"`;
  }

  if (modal) {
    modal.classList.remove('hidden');
  }

  if (btnConfirmar) {
    btnConfirmar.focus();
  }
}

/**
 * Fecha o modal de confirmação de exclusão e limpa o estado temporário.
 */
export function fecharModalConfirmacaoExclusao() {
  const modal = document.getElementById('modal-confirmar-exclusao');
  if (modal) {
    modal.classList.add('hidden');
  }
  pontoParaExcluir = null;
  markerParaExcluir = null;
}

/**
 * Remove imediatamente o marcador da camada do mapa e atualiza o contador de pontos (Critério 5 - US06).
 * @param {number|string} id ID do ponto removido
 * @param {L.Marker} [markerRef=null] Referência direta opcional ao marcador
 */
function removerMarkerVisualmente(id, markerRef = null) {
  const layerGroup = window.geoTurismo?.markersLayer;
  if (!layerGroup) return;

  if (mapInstance) {
    mapInstance.closePopup();
  }

  const alvo = markerRef || encontrarMarkerPorId(id);
  if (alvo && layerGroup.hasLayer(alvo)) {
    layerGroup.removeLayer(alvo);
  } else {
    layerGroup.eachLayer((layer) => {
      if (String(layer.pontoId) === String(id)) {
        layerGroup.removeLayer(layer);
      }
    });
  }

  if (typeof window.geoTurismo?.atualizarStatusPontos === 'function') {
    window.geoTurismo.atualizarStatusPontos(layerGroup.getLayers().length, false);
  }
}

/**
 * Executa a chamada DELETE /api/pontos/:id e remove o marcador imediatamente (Critérios 4 e 5 - US06).
 */
async function executarExclusaoPonto() {
  if (!pontoParaExcluir || pontoParaExcluir.id === undefined) return;

  const id = pontoParaExcluir.id;
  const nome = pontoParaExcluir.nome || 'Ponto Turístico';
  const markerRef = markerParaExcluir;

  const btnConfirmar = document.getElementById('btn-confirmar-exclusao');
  const btnCancelar = document.getElementById('btn-cancelar-exclusao');
  const spinner = document.getElementById('exclusao-btn-spinner');
  const btnText = document.getElementById('exclusao-btn-text');

  try {
    if (btnConfirmar) btnConfirmar.disabled = true;
    if (btnCancelar) btnCancelar.disabled = true;
    if (spinner) spinner.classList.remove('hidden');
    if (btnText) btnText.textContent = 'Excluindo...';

    const response = await fetch(`${apiBaseUrl}/pontos/${id}`, {
      method: 'DELETE'
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || `Erro HTTP ${response.status}`);
    }

    // Se o ponto excluído estava aberto em modo de edição, fecha o painel lateral
    if (pontoEmEdicao && String(pontoEmEdicao.id) === String(id)) {
      fecharPainelCadastro();
    }

    // Critério 5: Remove o marcador visualmente de forma imediata do mapa
    removerMarkerVisualmente(id, markerRef);

    fecharModalConfirmacaoExclusao();

    if (toastFn) {
      toastFn(
        `O ponto "${nome}" foi removido permanentemente.`,
        'success',
        'Ponto Excluído'
      );
    }
  } catch (err) {
    console.error(`[GeoTurismo] Falha no DELETE /api/pontos/${id}:`, err);
    if (toastFn) {
      toastFn(
        err.message || 'Não foi possível excluir o ponto turístico. Tente novamente.',
        'error',
        'Erro na Exclusão'
      );
    }
  } finally {
    if (btnConfirmar) btnConfirmar.disabled = false;
    if (btnCancelar) btnCancelar.disabled = false;
    if (spinner) spinner.classList.add('hidden');
    if (btnText) btnText.textContent = 'Sim, Excluir';
  }
}
