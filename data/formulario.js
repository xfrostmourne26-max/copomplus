window.camposDaCategoria = [];
window.listasDaCategoria = [];

//#region CARDS DO GRID
window.gerarCard = function(tipo, nomeAtual = "Novo Campo", opcoesDisponiveis = [], idUnico) {
    const idSeguro = idUnico;
    const prefixoId = tipo === "dropdown" ? "lista" : "campo";
    const htmlId = `${prefixoId}_${idSeguro}`;
    const eventosInteracao = `oninput="window.atualizarOcultados?.(); window.atualizarFormulario();" onchange="window.atualizarOcultados?.(); window.atualizarFormulario();"`;

    let htmlOpcoes = `<option value="" selected>${opcoesDisponiveis.length ? "Selecione uma opção..." : "Nenhuma opção criada..."}</option>`;

    if (opcoesDisponiveis.length) {
        const opcoesOrdenadas = opcoesDisponiveis.map((opt, index) => ({
            ...opt,
            _indiceOriginal: index,
            _nomeExibicao: opt.nome_campo || opt.valor_opcao || `Opção ${index + 1}`
        }))
        .sort((a, b) => a._nomeExibicao.localeCompare(b._nomeExibicao, 'pt-BR', { sensitivity: 'base' }));

        htmlOpcoes += opcoesOrdenadas.map((opt) => {
            const optIdSeguro = opt.id || `${idSeguro}_opt_${opt._indiceOriginal}`;
            return `<option id="opcao_${optIdSeguro}" value="${optIdSeguro}">${opt._nomeExibicao}</option>`;
        }).join('');
    }

    const templates = {
        "bool": `<div style="display: flex; align-items: center; gap: 8px;"><input type="checkbox" id="${htmlId}" autocomplete="off" style="transform: scale(1.3); cursor: pointer;" ${eventosInteracao}></div>`,
        "integer": `<input type="number" id="${htmlId}" class="input-area" autocomplete="off" placeholder="0" ${eventosInteracao}>`,
        "inputfield": `<input type="text" id="${htmlId}" class="input-area" autocomplete="off" placeholder="${nomeAtual}" ${eventosInteracao}>`,
        "dropdown": `<select id="${htmlId}" class="input-area" ${eventosInteracao}>${htmlOpcoes}</select>`
    };

    return templates[tipo] || "";
};

window.htmlDoCard = function(tipo, conteudo, nomeExibicao, idUnico, ocultoAte = "", tabela = "campos_formulario") {
    return `
        <div class="grid-stack-item-content card-preview-${tipo}" data-oculto-ate="${ocultoAte}" data-id="${idUnico}" data-tabela="${tabela}">
            <div class="card-info-container">
                <div id="label_${idUnico}" class="card-preview-nome">${nomeExibicao}</div>
                ${conteudo}
            </div>
        </div>
    `;
};
//#endregion

//#region LOGICA DO FORMULARIO

window.carregarCards = function() {
    const campos = window.camposDaCategoria || [];
    const listas = window.listasDaCategoria || [];

    if (campos.length > 0 || listas.length > 0) {
        window.alterarVisibilidadeElemento?.("camposDinamicos", true);
    }

    window.resetarFormulario?.();
    window.limparPagina?.(true);

    const criarLayoutBloqueado = (item) => ({
        w: item.grid_w || 1,
        h: item.grid_h || 1,
        x: item.grid_x || 0,
        y: item.grid_y || 0,
        locked: true,
        noMove: true,
        noResize: true
    });

    campos.filter(c => c.tipo_campo !== "dropdown").forEach((campo) => {
        const conteudo = window.gerarCard(campo.tipo_campo, campo.nome_campo, [], campo.id);
        const htmlCard = window.htmlDoCard(campo.tipo_campo, conteudo, campo.nome_campo, campo.id, campo.oculto_ate, "campos_formulario");
        window.adicionarCard?.(htmlCard, criarLayoutBloqueado(campo));
    });

    listas.forEach((lista) => {
        const conteudo = window.gerarCard("dropdown", lista.valor_opcao, lista.opcoes, lista.id);
        const htmlCard = window.htmlDoCard("dropdown", conteudo, lista.valor_opcao, lista.id, lista.oculto_ate, "lista_formulario");
        window.adicionarCard?.(htmlCard, criarLayoutBloqueado(lista));
    });

    window.atualizarOcultados?.();
};

window.atualizarOcultados = function() {
    document.querySelectorAll('.grid-stack-item-content').forEach(contentDiv => {
        const regraOculto = contentDiv.getAttribute('data-oculto-ate');
        const cardGridStack = contentDiv.closest('.grid-stack-item');

        if (!cardGridStack) return;

        if (!regraOculto || regraOculto === "null" || regraOculto.trim() === "") {
            window.mostrarCardNoGrid?.(cardGridStack);
            return;
        }

        let deveMostrar = false;

        const verificarDependenciaUnica = (dependenciaId) => {
            if (!dependenciaId) return false;

            const elementoOrigem = document.getElementById(dependenciaId);
            if (!elementoOrigem) return false;

            if (elementoOrigem.tagName === "OPTION") {
                return elementoOrigem.selected;
            } else if (elementoOrigem.type === "checkbox") {
                return elementoOrigem.checked;
            } else {
                return !!elementoOrigem.value.trim();
            }
        };

        if (regraOculto.includes('&&')) {
            const dependencias = regraOculto.split('&&');
            deveMostrar = dependencias.every(dep => verificarDependenciaUnica(dep.trim()));
        } else if (regraOculto.includes('||')) {
            const dependencias = regraOculto.split('||');
            deveMostrar = dependencias.some(dep => verificarDependenciaUnica(dep.trim()));
        } else {
            deveMostrar = verificarDependenciaUnica(regraOculto.trim());
        }

        deveMostrar ? window.mostrarCardNoGrid?.(cardGridStack) : window.ocultarCardNoGrid?.(cardGridStack);
    });
};

window.mostrarCardNoGrid = function(card) {
    if (!card.classList.contains('card-condicional-oculto')) return;

    card.classList.remove('card-condicional-oculto');

    card.style.display = "";
    card.style.visibility = "visible";
    card.style.opacity = "1";
    card.style.pointerEvents = "auto";
};

window.ocultarCardNoGrid = function(card) {
    if (card.classList.contains('card-condicional-oculto')) return;

    card.classList.add('card-condicional-oculto');

    const inputs = card.querySelectorAll("input, select, textarea");
    let mudouAlgumValor = false;

    inputs.forEach(el => {
        if (el.type === "checkbox" || el.type === "radio") {
            if (el.checked) {
                el.checked = false;
                mudouAlgumValor = true;
            }
        } else if (el.tagName.toLowerCase() === "select") {
            if (el.selectedIndex !== 0) {
                el.selectedIndex = 0;
                mudouAlgumValor = true;
            }
        } else {
            if (el.value !== "") {
                el.value = "";
                mudouAlgumValor = true;
            }
        }
    });

    if (mudouAlgumValor) {
        window.atualizarFormulario?.();
        window.atualizarOcultados?.();
    }

    if (typeof window.estadoAtual !== "undefined" && window.estadoAtual === EstadoFluxo.EDITANDO) {
        card.style.display = "";
        card.style.visibility = "visible";
        card.style.pointerEvents = "auto";
    } else {
        card.style.display = "";
        card.style.visibility = "hidden";
        card.style.opacity = "0";
        card.style.pointerEvents = "none";
    }
};

//#endregion