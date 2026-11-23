//#region EVENTOS
window.registrarComplementoEventos = function(db) {
    //#region LOGICA DO PAINEL DE REGISTRO

    const painel = document.getElementById("bodyRegistro");
    const handle = document.getElementById("dragHandleRegistro");

    if (!painel || !handle) return;

    let isDragging = false;
    let startX, startY, initialLeft, initialTop;
    let bounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };

    handle.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        isDragging = true;
        painel.style.transition = "none";
        const rect = painel.getBoundingClientRect();
        const parent = painel.parentElement;
        const parentRect = parent.getBoundingClientRect();

        if (window.getComputedStyle(painel).transform !== "none") {
            painel.style.transform = "none";
            painel.style.left = (rect.left - parentRect.left + parent.scrollLeft) + "px";
            painel.style.top = (rect.top - parentRect.top + parent.scrollTop) + "px";
        }

        startX = e.clientX;
        startY = e.clientY;
        initialLeft = parseFloat(painel.style.left) || 0;
        initialTop = parseFloat(painel.style.top) || 0;
        bounds.minX = 0;
        bounds.maxX = Math.max(0, parent.clientWidth - painel.offsetWidth);
        bounds.minY = 0;
        bounds.maxY = Math.max(0, parent.clientHeight - painel.offsetHeight);
        document.body.style.cursor = "grabbing";
        document.body.style.userSelect = "none";
    });

    document.addEventListener("mousemove", (e) => {
        if (!isDragging) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        let newLeft = initialLeft + dx;
        let newTop = initialTop + dy;
        newLeft = Math.max(bounds.minX, Math.min(newLeft, bounds.maxX));
        newTop = Math.max(bounds.minY, Math.min(newTop, bounds.maxY));
        painel.style.left = `${newLeft}px`;
        painel.style.top = `${newTop}px`;
    });

    document.addEventListener("mouseup", () => {
        if (isDragging) {
            isDragging = false;
            painel.style.transition = "";
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
        }
    });

    //#endregion

    //#region LOGICA DOS CAMPOS DENTRO DO PAINEL DE REGISTRO

    document.getElementById("btnRegistrar")?.addEventListener("click", async (evento) => {
        const btn = evento.currentTarget;
        const textoOriginal = btn.textContent;
        btn.disabled = true;
        btn.textContent = "Registrando...";

        try {
            switch (window.estadoAtual) {
                case EstadoFluxo.CATEGORIZANDO: {
                    const salvouCategoriaComSucesso = await db.salvarNovaCategoria();
                    if (salvouCategoriaComSucesso) {
                        window.fecharNovaCategoria();
                    }
                    break;
                }
                case EstadoFluxo.COMPLEMENTANDO: {
                    const salvouComplementoComSucesso = await db.salvarNovoComplemento();
                    if (salvouComplementoComSucesso) {
                        if (typeof window.salvarCardsModificados === "function") {
                            await window.salvarCardsModificados();
                        }
                        window.fecharNovoComplemento();
                        if (typeof window.carregarCards === "function") {
                            window.carregarCards();
                        }
                    }
                    break;
                }
                case EstadoFluxo.EDITANDO:
                    if (typeof window.salvarNovosDados === "function") {
                        window.salvarNovosDados();
                    }
                    break;
            }
        } finally {
            btn.disabled = false;
            btn.textContent = textoOriginal;
        }
    });

    document.getElementById("btnCancelar")?.addEventListener("click", () => {
        switch (window.estadoAtual) {
            case EstadoFluxo.CATEGORIZANDO:
                window.fecharNovaCategoria();
                break;
            case EstadoFluxo.COMPLEMENTANDO:
                window.fecharNovoComplemento();
                if (typeof window.carregarCards === "function") {
                    window.carregarCards();
                }
                break;
            case EstadoFluxo.EDITANDO:
                window.fecharPainelEdicao();
                break;
        }
    });

    // Registro de nova complementação
    window.registrar("btnComplemento", "click", () => window.toggleComplemento());
    window.registrar("complementoTipo", "change", () => window.sincronizarTela());
    window.registrar("selectListaTipo", "change", () => window.sincronizarTela());
    window.registrar("inputListaNome", "input", () => window.sincronizarTela());
    window.registrar("selectListaExistente", "change", () => window.sincronizarTela());
    window.registrar("inputNomeOpcao", "input", () => window.sincronizarTela());
    window.registrar("inputTextoResultado", "input", () => window.sincronizarTela());
    window.registrar("selectRegraOculto", "change", () => {
        window.sincronizarTela();
        window.verificarOperadorOculto();
    });
    window.registrar("btnAdicionarOpcaoLista", "click", () => window.adicionarOpcaoPendente());

    //#endregion
};
//#endregion

window.cardPreview = null;
window.opcoesPendentesLista = [];
window.posicaoSugeridaProximaOpcao = null;
let ultimoTipoRenderizado = "";
let listasForamPopuladas = false;
let regrasOcultasForamPopuladas = false;

function normalizarCategLookup(texto = "") {
    return String(texto)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function obterCategoriaSelecionadaId() {
    const select = document.getElementById("categoria");

    const candidatos = [
        window.categoriaSelecionada?.id,
        select?.dataset?.selectedId,
        select?.selectedOptions?.[0]?.dataset?.id,
        select?.value
    ];

    for (const cand of candidatos) {
        if (cand === null || cand === undefined || typeof cand === "object") continue;
        const str = String(cand).trim();
        if (/^\d+$/.test(str) && Number(str) > 0) {
            return Number(str);
        }
    }

    // Fallback: se o input recebeu o NOME da categoria em vez do ID, resolve pelo nome
    const textoBusca = normalizarCategLookup(window.categoriaSelecionada?.nome || select?.value || "");
    if (textoBusca && Array.isArray(window.listaDeCategorias)) {
        const encontrada = window.listaDeCategorias.find(
            cat => normalizarCategLookup(cat.nome) === textoBusca
        );
        if (encontrada && /^\d+$/.test(String(encontrada.id).trim())) {
            const idResolvido = Number(String(encontrada.id).trim());
            window.categoriaSelecionada = encontrada;
            if (select) select.dataset.selectedId = String(idResolvido);
            return idResolvido;
        }
    }

    return null;
}

//#region Complemento
// =====================================================

window.toggleComplemento = function() {
    if (window.estadoAtual === EstadoFluxo.COMPLEMENTANDO) {
        window.fecharNovoComplemento();
    } else {
        window.exibirNovoComplemento();
    }
    listasForamPopuladas = false;
    regrasOcultasForamPopuladas = false;
};

window.exibirNovoComplemento = function() {
    if (!window.nivelPermissaoUsuario || window.nivelPermissaoUsuario < 2) {
        console.warn("Usuário não autorizado a criar opções.");
        return;
    }

    if (window.estadoAtual === EstadoFluxo.CATEGORIZANDO) {
        window.fecharNovaCategoria();
    }

    window.estadoAtual = EstadoFluxo.COMPLEMENTANDO;
    window.cardsModificados?.clear();
    window.opcoesPendentesLista = [];
    window.posicaoSugeridaProximaOpcao = null;
    renderizarOpcoesPendentes();

    const tituloEl = document.getElementById("tituloCardRegistro");
    const tipoEl = document.getElementById("complementoTipo");
    if (tituloEl) tituloEl.textContent = "Novo Complemento";
    if (tipoEl) tipoEl.value = "";

    ["btnRegistrar", "btnCancelar", "btnGrid", "btnOutlines", "complementoTipo", "camposDinamicos"].forEach(id => {
        window.alterarVisibilidadeElemento(id, true);
    });
    ["novoCardCampos", "btnComplemento", "regraOculto", "regraOcultoOperadorContainer", "areaOpcoesPendentes", "btnModoEdicao", "btnNovaCategoria"].forEach(id => {
        window.alterarVisibilidadeElemento(id, false);
    });

    const gridDinamicos = document.querySelector('.grid-campos-dinamicos');
    if (gridDinamicos) gridDinamicos.classList.add('mostrar-borda');
    document.getElementById("camposDinamicos")?.classList.add("modo-edicao");

    window.entrarModoRegistro({ colunaDir: false, grid: true });

    sincronizarTela();
};

window.fecharNovoComplemento = function() {
    window.estadoAtual = EstadoFluxo.FORMULANDO;

    ["complementoTipo", "novoCardCampos", "btnRegistrar", "btnCancelar", "btnGrid", "btnOutlines", "naturezasCampo", "regraOculto", "regraOcultoOperadorContainer", "areaOpcoesPendentes", "aditivoCampo"].forEach(id => {
        window.alterarVisibilidadeElemento(id, false);
    });
    window.alterarVisibilidadeElemento("btnComplemento", window.temCategoria());

    const gridDinamicos = document.querySelector('.grid-campos-dinamicos');
    if (gridDinamicos) gridDinamicos.classList.remove('mostrar-borda');
    document.getElementById("camposDinamicos")?.classList.remove("modo-edicao");
    window.alterarVisibilidadeElemento("camposDinamicos", window.temCategoria());

    if (window.nivelPermissaoUsuario && window.nivelPermissaoUsuario >= 2) {
        window.alterarVisibilidadeElemento("btnNovaCategoria", true);
    }
    if (window.nivelPermissaoUsuario && window.nivelPermissaoUsuario >= 3) {
        window.alterarVisibilidadeElemento("btnModoEdicao", true);
    }

    window.sairModoRegistro({ grid: true });

    window.naturezaRelacionada = null;
    window.opcoesPendentesLista = [];
    window.posicaoSugeridaProximaOpcao = null;
    listasForamPopuladas = false;

    removerCardPreviewDoGridInput();
    window.atualizarFormulario();
};

// =====================================================
//#endregion

//#region Complemento Preview
// =====================================================

//#region Card Preview
function renderizarCardPreview(tipo, nomeAtual, opcoes) {
    const dimensoesPorTipo = {
        autoPosition: true,
        "bool": { w: 3, h: 1 },
        "integer": { w: 4, h: 1 },
        "inputfield": { w: 6, h: 1 },
        "dropdown": { w: 6, h: 2 }
    };

    const dimensao = dimensoesPorTipo[tipo] || { w: 6, h: 2 };
    const conteudo = window.gerarCard(tipo, nomeAtual, opcoes, "preview");
    const htmlCard = window.htmlDoCard(tipo, conteudo, nomeAtual, "preview", "", "preview");

    window.cardPreview = window.adicionarCard(htmlCard, dimensao);
}

function removerCardPreviewDoGridInput() {
    if (window.cardPreview) {
        if (window.grid && typeof window.grid.removeWidget === "function") {
            window.grid.removeWidget(window.cardPreview, true);
        } else if (typeof removeCard === "function") {
            removeCard(window.cardPreview);
        } else {
            window.cardPreview.remove();
        }

        window.cardPreview = null;
    }
}
//#endregion

//#region Opções Pendentes da Lista Nova

window.adicionarOpcaoPendente = function() {
    const inputNome = document.getElementById("inputNomeOpcao");
    const inputTexto = document.getElementById("inputTextoResultado");

    const nome = inputNome?.value.trim();
    const texto = inputTexto?.value.trim();

    if (!nome) {
        window.mostrarToast("Digite o nome da opção antes de adicionar.");
        return;
    }

    const jaExiste = window.opcoesPendentesLista.some(op => op.nome.toLowerCase() === nome.toLowerCase());
    if (jaExiste) {
        window.mostrarToast("Já existe uma opção com esse nome nesta lista.");
        return;
    }

    const blocoFantasma = document.querySelector('.text-piece[data-card-id="bloco_complemento_output"]');
    const ordemContexto = blocoFantasma ? parseInt(blocoFantasma.getAttribute('data-ordem-contexto') || 0, 10) : 0;
    const ordemExibicao = blocoFantasma ? parseFloat(blocoFantasma.getAttribute('data-peso') || 0) : 0;

    window.opcoesPendentesLista.push({
        nome,
        textoResultado: texto || "",
        naturezaId: window.naturezaRelacionada?.id || null,
        naturezaNome: window.naturezaRelacionada?.natureza || window.naturezaRelacionada?.nome || null,
        ordemContexto,
        ordemExibicao,
        aditivoTexto: document.getElementById("inputAditivoTexto")?.value.trim() || null,
        aditivoPosicao: document.getElementById("selectAditivoPosicao")?.value || null
    });

    window.posicaoSugeridaProximaOpcao = { contexto: ordemContexto, peso: ordemExibicao };

    renderizarOpcoesPendentes();

    if (inputNome) inputNome.value = "";
    if (inputTexto) inputTexto.value = "";
    window.preencherInputNatureza(null);

    const inputAditivoTexto = document.getElementById("inputAditivoTexto");
    const selectAditivoPosicao = document.getElementById("selectAditivoPosicao");
    if (inputAditivoTexto) inputAditivoTexto.value = "";
    if (selectAditivoPosicao) selectAditivoPosicao.value = "";

    window.removerBlocoTexto("bloco_complemento_output");
    window.sincronizarTela();
};

window.removerOpcaoPendente = function(indice) {
    window.opcoesPendentesLista.splice(indice, 1);
    renderizarOpcoesPendentes();
};

function renderizarOpcoesPendentes() {
    const lista = document.getElementById("listaOpcoesPendentes");
    if (!lista) return;

    if (window.opcoesPendentesLista.length === 0) {
        lista.innerHTML = `<li class="opcao-pendente-vazia">Nenhuma opção adicionada ainda.</li>`;
        return;
    }

    lista.innerHTML = window.opcoesPendentesLista.map((op, indice) => `
        <li class="opcao-pendente-item">
            <span class="opcao-pendente-nome">${op.nome}</span>
            ${op.naturezaNome ? `<span class="opcao-pendente-natureza">${op.naturezaNome}</span>` : ''}
            <button type="button" class="btn-remover-opcao-pendente" data-indice="${indice}" title="Remover opção">&times;</button>
        </li>
    `).join('');

    lista.querySelectorAll('.btn-remover-opcao-pendente').forEach(btn => {
        btn.addEventListener('click', () => {
            window.removerOpcaoPendente(parseInt(btn.dataset.indice, 10));
        });
    });
}
//#endregion

//#region Sincronização da Tela Durante Complementação

window.sincronizarTela = function() {
    if (window.estadoAtual === EstadoFluxo.EDITANDO) {
        window.sincronizarTelaEditor();
        return;
    }

    const estado = obterEstadoDoComplemento();

    window.alterarVisibilidadeElemento("novoCardCampos", !!estado.tipo);

    if (!estado.tipo) {
        removerCardPreviewDoGridInput();
        ultimoTipoRenderizado = "";
        return;
    }

    atualizarVisibilidadeCampos(estado);
    atualizarTextosEInputs(estado);
    atualizarListasDeDependencia(estado);

    atualizarPreviewVisual(
        estado.tipo,
        estado.isDropdown,
        estado.isNovoDropdown,
        estado.isExistenteDropdown,
        estado.idListaExistente,
        estado.valorNomeLista,
        estado.valorNomeOpcao
    );

    window.atualizarFormulario();
};

//#region MODULOS AJUDANTES
function obterEstadoDoComplemento() {
    const tipo = document.getElementById("complementoTipo")?.value;
    const isDropdown = (tipo === "dropdown");

    const tipoListaSelecionado = document.getElementById("selectListaTipo")?.value;
    const isNovoDropdown = isDropdown && tipoListaSelecionado === "novo";
    const isExistenteDropdown = isDropdown && tipoListaSelecionado === "existente";

    const valorNomeLista = document.getElementById("inputListaNome")?.value.trim() || "";
    const idListaExistente = document.getElementById("selectListaExistente")?.value || "";
    const valorNomeOpcao = document.getElementById("inputNomeOpcao")?.value.trim() || "";
    const valorTextoResultado = document.getElementById("inputTextoResultado")?.value.trim() || "";

    let mostrarNomeOpcao = false;
    if (!isDropdown) mostrarNomeOpcao = true;
    else if (isNovoDropdown) mostrarNomeOpcao = (valorNomeLista !== "");
    else if (isExistenteDropdown) mostrarNomeOpcao = (idListaExistente !== "");

    const temPreenchimentoObrigatorio = mostrarNomeOpcao && (valorNomeOpcao !== "");
    const ehOpcaoDeLista = isExistenteDropdown || (window.cardEmEdicaoAtual?._tipoEdicao === "dropdown_opcao");

    return {
        tipo,
        isDropdown,
        isNovoDropdown,
        isExistenteDropdown,
        valorNomeLista,
        idListaExistente,
        valorNomeOpcao,
        valorTextoResultado,
        mostrarNomeOpcao,
        mostrarTextoResultado: (mostrarNomeOpcao && valorNomeOpcao !== ""),
        mostrarDicaDinamica: (tipo === "integer" || tipo === "inputfield"),
        mostrarRegraOculto: isNovoDropdown ? (valorNomeLista !== "") : (temPreenchimentoObrigatorio && !ehOpcaoDeLista),
        mostrarCardNatureza: temPreenchimentoObrigatorio,
        mostrarBuscaNatureza: temPreenchimentoObrigatorio
    };
}

function atualizarVisibilidadeCampos(estado) {
    window.alterarVisibilidadeElemento("listaTipo", estado.isDropdown);
    window.alterarVisibilidadeElemento("listaNome", estado.isNovoDropdown);
    window.alterarVisibilidadeElemento("listaExistente", estado.isExistenteDropdown);
    window.alterarVisibilidadeElemento("nomeOpcao", estado.mostrarNomeOpcao);
    window.alterarVisibilidadeElemento("textoResultado", estado.mostrarTextoResultado);
    window.alterarVisibilidadeElemento("aditivoCampo", estado.mostrarTextoResultado);
    window.alterarVisibilidadeElemento("dicaTextoDinamico", estado.mostrarDicaDinamica);

    const labelOculto = document.querySelector('label[for="selectRegraOculto"]');
    const selectOculto = document.getElementById("selectRegraOculto");
    if (labelOculto) labelOculto.style.display = estado.mostrarRegraOculto ? "" : "none";
    if (selectOculto) selectOculto.style.display = estado.mostrarRegraOculto ? "" : "none";
    window.alterarVisibilidadeElemento("regraOculto", estado.mostrarRegraOculto);

    if (!estado.mostrarRegraOculto) {
        window.alterarVisibilidadeElemento("regraOcultoOperadorContainer", false);
    } else {
        window.verificarOperadorOculto();
    }

    window.alternarColuneDireita(estado.mostrarRegraOculto);
    window.alterarVisibilidadeElemento("naturezasCampo", estado.mostrarCardNatureza);

    window.alterarVisibilidadeElemento("areaOpcoesPendentes", estado.isNovoDropdown);
    if (!estado.isNovoDropdown && window.opcoesPendentesLista.length > 0) {
        window.opcoesPendentesLista = [];
        renderizarOpcoesPendentes();
    }
}

function atualizarTextosEInputs(estado) {
    const inputNomeOpcao = document.getElementById("inputNomeOpcao");

    if (inputNomeOpcao) {
        if (!estado.isDropdown) {
            inputNomeOpcao.placeholder = "Nome da Nova Opção...";
        } else if (estado.isNovoDropdown) {
            inputNomeOpcao.placeholder = window.opcoesPendentesLista.length > 0
                ? "Nome da Próxima Opção..."
                : "Nome da Primeira Opção da Lista...";
        } else if (estado.isExistenteDropdown) {
            inputNomeOpcao.placeholder = "Nome da Nova Opção...";
        }
    }

    if (!estado.mostrarBuscaNatureza) {
        const inputBuscaNatureza = document.getElementById("buscarNatureza");
        if (inputBuscaNatureza) inputBuscaNatureza.value = "";
    }
}
//#endregion

//#region Popular Listas de vinculo e ocultamento

function atualizarListasDeDependencia(estado) {
    if (estado.isExistenteDropdown && !listasForamPopuladas) {
        popularComListasDaCategoria();
        listasForamPopuladas = true;
    }

    if (estado.mostrarRegraOculto && !regrasOcultasForamPopuladas) {
        popularSelectOcultoAte();
        regrasOcultasForamPopuladas = true;
    }
}

function popularComListasDaCategoria() {
    const selectMae = document.getElementById("selectListaExistente");
    if (!selectMae || !window.listasDaCategoria) return;

    const opcoes = window.listasDaCategoria.map(l => `<option value="${l.id}">${l.valor_opcao}</option>`).join("");
    selectMae.innerHTML = `<option value="">-- Escolha uma Lista existente nesta Categoria --</option>${opcoes}`;
}

function popularSelectOcultoAte() {
    const selectOculto = document.getElementById("selectRegraOculto");
    if (!selectOculto) return;

    const htmlPadrao = `<option value="">Nenhuma (Sempre Visível)</option>`;

    const camposOrdenados = [...(window.camposDaCategoria || [])].sort((a, b) => a.nome_campo.localeCompare(b.nome_campo, 'pt-BR'));
    const listasOrdenadas = [...(window.listasDaCategoria || [])].sort((a, b) => a.valor_opcao.localeCompare(b.valor_opcao, 'pt-BR'));

    const camposGroup = camposOrdenados.length
        ? `<optgroup label="Campos Regulares">` +
          camposOrdenados.map(c => `<option value="campo_${c.id}">${c.nome_campo}</option>`).join("") +
          `</optgroup>`
        : "";

    const listasGroup = listasOrdenadas.map(lista => {
        const opcoesOrdenadas = [...(lista.opcoes || [])].sort((a, b) => a.nome_campo.localeCompare(b.nome_campo, 'pt-BR'));
        const subOpcoes = opcoesOrdenadas.map(o => `<option value="opcao_${o.id}">↳ Somente se: ${o.nome_campo}</option>`).join("");
        return `
            <optgroup label="Lista: ${lista.valor_opcao}">
                <option value="lista_${lista.id}">Qualquer opção de: ${lista.valor_opcao}</option>
                ${subOpcoes}
            </optgroup>
        `;
    }).join("");

    selectOculto.innerHTML = htmlPadrao + camposGroup + listasGroup;
}

window.verificarOperadorOculto = function() {
    const selectOculto = document.getElementById("selectRegraOculto");
    const checkboxOperador = document.getElementById("checkboxRegraOcultoOperador");

    if (!selectOculto) return;

    const selecionados = Array.from(selectOculto.selectedOptions).filter(opt => opt.value !== "");
    const temMaisDeUm = selecionados.length > 1;

    window.alterarVisibilidadeElemento("regraOcultoOperadorContainer", temMaisDeUm);

    if (!temMaisDeUm && checkboxOperador) {
        checkboxOperador.checked = true;
    }
};

//#endregion

//#region PREVIEW AO VIVO DO COMPLEMENTO NA TELA
function atualizarPreviewVisual(tipo, isDropdown, isNovoDropdown, isExistenteDropdown, idListaExistente, valorNomeLista, valorNomeOpcao) {
    if ((isDropdown && !isNovoDropdown && !isExistenteDropdown) || isExistenteDropdown) {
        removerCardPreviewDoGridInput();
        ultimoTipoRenderizado = "";

        if (isExistenteDropdown && idListaExistente) {
            atualizarOpcaoEmDropdownExistente(idListaExistente, valorNomeOpcao);
        }
        return;
    }

    const nomeTopoCard = (isDropdown && isNovoDropdown)
        ? (valorNomeLista || "Nome da Lista...")
        : (valorNomeOpcao || "Novo Campo");

    if (!window.cardPreview || ultimoTipoRenderizado !== tipo) {
        removerCardPreviewDoGridInput();
        const opcoesIniciais = (isDropdown && isNovoDropdown && valorNomeOpcao) ? [{ nome_campo: valorNomeOpcao }] : [];
        renderizarCardPreview(tipo, nomeTopoCard, opcoesIniciais);
        ultimoTipoRenderizado = tipo;
    }

    if (window.cardPreview) {
        atualizarConteudoDoPreviewCard(tipo, isNovoDropdown, nomeTopoCard, valorNomeOpcao);
    }
}

function atualizarOpcaoEmDropdownExistente(idListaExistente, valorNomeOpcao) {
    const dropdownReal = document.getElementById(`lista_${idListaExistente}`) ||
                         document.getElementById(`campo_${idListaExistente}`) ||
                         document.querySelector(`[data-id="${idListaExistente}"] select`);

    if (!dropdownReal) return;

    dropdownReal.querySelectorAll('.preview-temp-option').forEach(el => el.remove());

    if (valorNomeOpcao) {
        const novaOpcao = new Option(`[Nova] ${valorNomeOpcao}`, valorNomeOpcao);
        novaOpcao.className = "preview-temp-option";
        dropdownReal.add(novaOpcao);
        dropdownReal.value = valorNomeOpcao;
    }
}

function atualizarConteudoDoPreviewCard(tipo, isNovoDropdown, nomeTopoCard, valorNomeOpcao) {
    const cardNomePreview = window.cardPreview.querySelector('.card-preview-nome');
    const cardPreviewInput = window.cardPreview.querySelector('input, select, textarea');

    if (cardNomePreview) cardNomePreview.textContent = nomeTopoCard;
    if (!cardPreviewInput) return;

    if (tipo === "inputfield") {
        cardPreviewInput.placeholder = valorNomeOpcao || "Preview do texto...";
    } else if (tipo === "dropdown") {
        const textoOpcao = valorNomeOpcao || "Primeira opção...";
        const isDisabled = (!isNovoDropdown && !valorNomeOpcao) ? "disabled" : "";
        cardPreviewInput.innerHTML = `<option value="" ${isDisabled} selected>${textoOpcao}</option>`;
    }
}
//#endregion

//#endregion

// =====================================================
//#endregion

//#region Salvar Complemento
// =====================================================

window.entregarDadosDoComplemento = function() {
    let grid = { x: 0, y: 0, w: 1, h: 1 };

    if (typeof window.cardPreview !== 'undefined') {
        if (window.cardPreview?.gridstackNode) {
            const node = window.cardPreview.gridstackNode;
            grid = { x: node.x || 0, y: node.y || 0, w: node.w || 1, h: node.h || 1 };
        } else if (window.cardPreview) {
            grid.x = parseInt(window.cardPreview.getAttribute('gs-x') || 0, 10);
            grid.y = parseInt(window.cardPreview.getAttribute('gs-y') || 0, 10);
            grid.w = parseInt(window.cardPreview.getAttribute('gs-w') || 1, 10);
            grid.h = parseInt(window.cardPreview.getAttribute('gs-h') || 1, 10);
        }
    }

    const _categoriaID = obterCategoriaSelecionadaId();
    const _tipoCampo = document.getElementById("complementoTipo")?.value;
    const _nomeCampo = document.getElementById("inputNomeOpcao")?.value.trim();
    const _textoResultado = document.getElementById("inputTextoResultado")?.value.trim() || "";

    const dropRootElement = document.getElementById("selectListaExistente");
    const _subtipo = document.getElementById("selectListaTipo")?.value;
    const _campoRootId = dropRootElement?.value;

    const _novoDropdown = (_tipoCampo === "dropdown" && _subtipo === "novo");
    const _nomeNovoDropdown = document.getElementById("inputListaNome")?.value.trim();
    const _nomeDropdownVinculado = dropRootElement?.options[dropRootElement.selectedIndex]?.text || "";

    const _nomeDroproot = _novoDropdown ? (_nomeNovoDropdown || _nomeCampo) : (_nomeDropdownVinculado || _nomeCampo);

    const selectOculto = document.getElementById("selectRegraOculto");
    const valoresOcultosSelecionados = selectOculto ? Array.from(selectOculto.selectedOptions).map(opt => opt.value).filter(v => v !== "") : [];
    const checkboxOperador = document.getElementById("checkboxRegraOcultoOperador");
    const operadorOculto = (checkboxOperador && !checkboxOperador.checked) ? "||" : "&&";
    const _ocultoAte = valoresOcultosSelecionados.length > 0 ? valoresOcultosSelecionados.join(` ${operadorOculto} `) : null;

    let _ordemContexto = 0;
    let _ordemExibicao = 0;

    const blocoFantasma = document.querySelector('.text-piece[data-card-id="bloco_complemento_output"]');

    if (blocoFantasma) {
        _ordemContexto = parseInt(blocoFantasma.getAttribute('data-ordem-contexto') || 0, 10);
        _ordemExibicao = parseFloat(blocoFantasma.getAttribute('data-peso') || 0);
    } else if (typeof window.obterDadosDeCadaBlocoTexto === 'function') {
        const todosBlocos = window.obterDadosDeCadaBlocoTexto();
        const blocosNoContextoCorreto = todosBlocos.filter(b => b.data_contexto === _ordemContexto);

        let maxOrdem = -1;
        blocosNoContextoCorreto.forEach(b => {
            if (b.data_peso > maxOrdem) maxOrdem = b.data_peso;
        });

        _ordemExibicao = maxOrdem + 1;
    }

    const dados = {
        categoriaId: _categoriaID,
        tipoCampo: _tipoCampo,
        nomeCampo: _nomeCampo,
        textoResultado: _textoResultado,
        subtipo: _subtipo,
        campoRootId: _campoRootId,
        novoDropdown: _novoDropdown,
        nomeNovoDropdown: _nomeNovoDropdown,
        nomeDroproot: _nomeDroproot,
        ordemContexto: _ordemContexto,
        ordemExibicao: _ordemExibicao,
        ocultoAte: _ocultoAte,
        gridX: grid.x,
        gridY: grid.y,
        gridW: grid.w,
        gridH: grid.h,
        natureza: window.naturezaRelacionada?.id || null,
        opcoesLista: _novoDropdown ? [...window.opcoesPendentesLista] : [],
        aditivoTexto: document.getElementById("inputAditivoTexto")?.value.trim() || null,
        aditivoPosicao: document.getElementById("selectAditivoPosicao")?.value || null,
    };

    console.log("Dados do Complemento que serão salvos:", dados);
    return dados;
};

// =====================================================
//#endregion