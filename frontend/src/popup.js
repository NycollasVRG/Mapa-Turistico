/**
 * GeoTurismo — Módulo de Popups e Detalhes do Ponto Turístico (US05 - Dev 3)
 * Responsável pela construção visual dos popups, tratamento de fallback/placeholder
 * de imagens, exibição de metadados espaciais e disponibilização das ações de Editar e Excluir.
 */

const CATEGORIAS_META = {
  'Histórico': { icon: '🏛️', classe: 'cat-historico' },
  'Museu': { icon: '🖼️', classe: 'cat-museu' },
  'Parque': { icon: '🌳', classe: 'cat-parque' },
  'Gastronomia': { icon: '🍽️', classe: 'cat-gastronomia' },
  'Praia': { icon: '🏖️', classe: 'cat-praia' },
  'Mirante': { icon: '🌄', classe: 'cat-mirante' },
  'Religioso': { icon: '⛪', classe: 'cat-religioso' },
  'Cultural': { icon: '🎭', classe: 'cat-cultural' },
  'Outro': { icon: '📍', classe: 'cat-outro' }
};

/**
 * Sanitiza strings para exibição segura em HTML e atributos.
 * @param {string} valor
 * @returns {string}
 */
export function escapeHtml(valor) {
  if (valor === null || valor === undefined) return '';
  return String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Retorna os metadados visuais (ícone e classe CSS) da categoria informada.
 * @param {string} categoria
 * @returns {{ icon: string, classe: string }}
 */
export function obterMetaCategoria(categoria) {
  return CATEGORIAS_META[categoria] || { icon: '📍', classe: 'cat-outro' };
}

/**
 * Constrói o HTML responsivo e estilizado do popup de um ponto turístico (US05).
 * Inclui imagem com fallback automático para placeholder quando ausente ou quando falha o carregamento,
 * badge de categoria, descrição, coordenadas PostGIS e botões de Editar e Excluir.
 *
 * @param {object} ponto Objeto do ponto turístico retornado pela API
 * @param {Function} [formatarDistanciaFn] Função opcional para formatação de distância (US03)
 * @returns {string} HTML estruturado do popup
 */
export function criarConteudoPopup(ponto = {}, formatarDistanciaFn = null) {
  const id = ponto.id ?? '';
  const nome = escapeHtml(ponto.nome || 'Ponto Turístico');
  const categoriaRaw = ponto.categoria || 'Outro';
  const categoria = escapeHtml(categoriaRaw);
  const descricao = escapeHtml(ponto.descricao || 'Nenhuma descrição detalhada disponível para este local.');
  const fotoUrl = ponto.foto_url ? String(ponto.foto_url).trim() : '';

  const catMeta = obterMetaCategoria(categoriaRaw);

  const latNum = parseFloat(ponto.latitude);
  const lngNum = parseFloat(ponto.longitude);
  const coordsTexto = !isNaN(latNum) && !isNaN(lngNum)
    ? `${latNum.toFixed(5)}, ${lngNum.toFixed(5)}`
    : '';

  let distanciaHtml = '';
  if (ponto.distancia_metros !== undefined && ponto.distancia_metros !== null && typeof formatarDistanciaFn === 'function') {
    const distFormatada = formatarDistanciaFn(ponto.distancia_metros);
    if (distFormatada) {
      distanciaHtml = `
        <div class="ponto-popup-distance" title="Distância calculada via PostGIS ST_Distance">
          <span>🎯</span>
          <span>A ${escapeHtml(distFormatada)} de você</span>
        </div>
      `;
    }
  }

  const midiaHtml = fotoUrl
    ? `
      <img
        src="${escapeHtml(fotoUrl)}"
        alt="Foto de ${nome}"
        class="ponto-popup-image"
        loading="lazy"
        onerror="this.classList.add('hidden'); if (this.nextElementSibling) this.nextElementSibling.classList.remove('hidden');"
      />
      <div class="ponto-popup-placeholder hidden" role="img" aria-label="Falha ao carregar imagem de ${nome}">
        <span class="placeholder-icon">${catMeta.icon}</span>
        <span class="placeholder-title">Imagem indisponível</span>
        <span class="placeholder-subtitle">Não foi possível carregar a foto</span>
      </div>
    `
    : `
      <div class="ponto-popup-placeholder" role="img" aria-label="Sem foto cadastrada para ${nome}">
        <span class="placeholder-icon">${catMeta.icon}</span>
        <span class="placeholder-title">Sem fotografia</span>
        <span class="placeholder-subtitle">${categoria}</span>
      </div>
    `;

  return `
    <article class="ponto-popup-container" data-ponto-id="${escapeHtml(id)}">
      <div class="ponto-popup-media">
        ${midiaHtml}
        <span class="ponto-popup-category ${catMeta.classe}">
          <span class="cat-badge-icon">${catMeta.icon}</span>
          <span>${categoria}</span>
        </span>
      </div>

      <div class="ponto-popup-body">
        <div class="ponto-popup-header">
          <h3 class="ponto-popup-title">${nome}</h3>
        </div>

        ${distanciaHtml}

        <p class="ponto-popup-description">${descricao}</p>

        ${coordsTexto ? `
          <div class="ponto-popup-coords" title="Coordenadas Geográficas (SRID 4326)">
            <span class="coords-pin">📍</span>
            <span>${coordsTexto}</span>
          </div>
        ` : ''}

        <div class="ponto-popup-actions" id="ponto-actions-${escapeHtml(id)}">
          <button
            type="button"
            class="btn-popup-action btn-popup-edit"
            data-action="editar"
            data-ponto-id="${escapeHtml(id)}"
            title="Editar informações deste ponto turístico"
            aria-label="Editar ${nome}"
          >
            <span class="btn-popup-icon">✏️</span>
            <span>Editar</span>
          </button>

          <button
            type="button"
            class="btn-popup-action btn-popup-delete"
            data-action="excluir"
            data-ponto-id="${escapeHtml(id)}"
            title="Excluir este ponto turístico"
            aria-label="Excluir ${nome}"
          >
            <span class="btn-popup-icon">🗑️</span>
            <span>Excluir</span>
          </button>
        </div>
      </div>
    </article>
  `;
}

/**
 * Associa os eventos dos botões de Editar e Excluir quando o popup do marcador é aberto no mapa.
 * Permite integração direta com a US06 via callbacks em window.geoTurismo ou CustomEvents no document.
 *
 * @param {L.Marker} marker Instância do marcador Leaflet
 * @param {object} ponto Dados completos do ponto turístico
 * @param {object} [options] Opções auxiliares (showToast, etc.)
 */
export function vincularEventosPopup(marker, ponto, options = {}) {
  if (!marker || !ponto) return;

  marker.on('popupopen', (event) => {
    const popupEl = event.popup?.getElement();
    if (!popupEl) return;

    const btnEdit = popupEl.querySelector('.btn-popup-edit');
    const btnDelete = popupEl.querySelector('.btn-popup-delete');

    if (btnEdit) {
      btnEdit.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();

        document.dispatchEvent(
          new CustomEvent('geoturismo:editar-ponto', { detail: { ponto, marker } })
        );

        if (typeof window.geoTurismo?.abrirEdicao === 'function') {
          window.geoTurismo.abrirEdicao(ponto);
        } else if (typeof options.onEdit === 'function') {
          options.onEdit(ponto);
        } else if (typeof options.showToast === 'function') {
          options.showToast(
            `Edição selecionada para "${ponto.nome}".`,
            'info',
            'Editar Ponto'
          );
        }
      };
    }

    if (btnDelete) {
      btnDelete.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();

        document.dispatchEvent(
          new CustomEvent('geoturismo:excluir-ponto', { detail: { ponto, marker } })
        );

        if (typeof window.geoTurismo?.confirmarExclusao === 'function') {
          window.geoTurismo.confirmarExclusao(ponto);
        } else if (typeof options.onDelete === 'function') {
          options.onDelete(ponto);
        } else if (typeof options.showToast === 'function') {
          options.showToast(
            `Exclusão selecionada para "${ponto.nome}".`,
            'warning',
            'Excluir Ponto'
          );
        }
      };
    }
  });
}
