/**
 * GeoTurismo — Módulo de Cadastro e Geocodificação (US04 - Dev 3)
 * Responsável pela interface de cadastro, integração com Nominatim (OpenStreetMap),
 * manipulação do pino arrastável no mapa e envio do POST /api/pontos com PostGIS.
 */

import L from 'leaflet';

let mapInstance = null;
let apiBaseUrl = 'http://localhost:3000/api';
let toastFn = null;
let reloadBBoxFn = null;

let isCadastroOpen = false;
let pinoCriacao = null;
let debounceNominatimTimer = null;

/**
 * Cria o ícone personalizado e destacado para o pino de criação.
 */
function criarIconePinoCriacao() {
  return L.divIcon({
    className: 'creation-pin-container',
    html: `
      <div class="creation-pin-wrapper">
        <div class="creation-pin-pulse"></div>
        <div class="creation-pin-marker">
          <span class="creation-pin-emoji">📍</span>
        </div>
        <div class="creation-pin-tag">Arraste para ajustar</div>
      </div>
    `,
    iconSize: [36, 52],
    iconAnchor: [18, 48]
  });
}

/**
 * Inicializa os ouvintes de eventos e elementos da US04.
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

  // Fecha sugestões ao clicar fora
  document.addEventListener('click', (e) => {
    const nominatimGroup = document.querySelector('.nominatim-group');
    if (nominatimGroup && !nominatimGroup.contains(e.target)) {
      fecharSugestoesNominatim();
    }
  });

  // Registra no objeto global para interoperabilidade
  if (window.geoTurismo) {
    window.geoTurismo.abrirCadastro = abrirPainelCadastro;
    window.geoTurismo.fecharCadastro = fecharPainelCadastro;
  }
}

/**
 * Abre o painel lateral de cadastro e habilita o modo de captura cartográfica.
 */
export function abrirPainelCadastro() {
  const panel = document.getElementById('panel-cadastro-container');
  if (!panel) return;

  panel.classList.remove('hidden');
  isCadastroOpen = true;

  // Atualiza cursor do mapa para indicar modo de seleção de ponto
  if (mapInstance) {
    const container = mapInstance.getContainer();
    if (container) container.classList.add('cursor-crosshair');
    mapInstance.on('click', handleMapClick);
  }

  // Define posição inicial do pino: localização do usuário ou centro do mapa
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
 * Fecha o painel de cadastro e restaura os listeners e o cursor padrão.
 */
export function fecharPainelCadastro() {
  const panel = document.getElementById('panel-cadastro-container');
  if (panel) panel.classList.add('hidden');

  isCadastroOpen = false;

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
}

/**
 * Trata o clique no mapa enquanto o painel de cadastro está ativo.
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

  if (!pinoCriacao) {
    pinoCriacao = L.marker([lat, lng], {
      icon: criarIconePinoCriacao(),
      draggable: true,
      zIndexOffset: 2000,
      title: 'Ponto Turístico em Cadastro'
    }).addTo(mapInstance);

    // Eventos de arraste do pino
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
    mapInstance.flyTo([lat, lng], Math.max(mapInstance.getZoom(), 16), { duration: 1.2 });
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
 * Trata o envio do formulário, validações e POST /api/pontos.
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

  // Validações de entrada
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

  try {
    if (btnSubmit) btnSubmit.disabled = true;
    if (spinner) spinner.classList.remove('hidden');
    if (btnText) btnText.textContent = 'Cadastrando...';

    const response = await fetch(`${apiBaseUrl}/pontos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || `Erro HTTP ${response.status}`);
    }

    if (toastFn) {
      toastFn(
        `"${payload.nome}" foi persistido com sucesso no PostGIS!`,
        'success',
        'Cadastro Concluído'
      );
    }

    fecharPainelCadastro();

    // Recarrega a camada de pontos do mapa e centraliza no novo registro
    if (reloadBBoxFn) {
      await reloadBBoxFn();
    } else if (window.geoTurismo?.carregarPontosPorBBox) {
      await window.geoTurismo.carregarPontosPorBBox();
    }

    if (mapInstance) {
      mapInstance.flyTo([latitude, longitude], 16, { duration: 1.2 });
    }
  } catch (err) {
    console.error('[GeoTurismo] Falha no POST /api/pontos:', err);
    if (toastFn) {
      toastFn(
        err.message || 'Falha ao salvar no banco PostGIS. Verifique o servidor.',
        'error',
        'Erro no Cadastro'
      );
    }
  } finally {
    if (btnSubmit) btnSubmit.disabled = false;
    if (spinner) spinner.classList.add('hidden');
    if (btnText) btnText.textContent = 'Salvar Ponto';
  }
}
