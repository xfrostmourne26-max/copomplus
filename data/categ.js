//#region EVENTOS
window.registrarCategEvento = function(db) {
    const inputCateg = document.getElementById("categoria");
    const listaSugestoes = document.getElementById("listaCategoriasSugestoes");

    if (inputCateg) {
        inputCateg.addEventListener("input", () => {
            // Se o usuário apagar ou alterar o texto após selecionar uma categoria, limpa seleção ativa
            const selecionado = window.categoriaSelecionada;
            if (selecionado && normalizarTextoCateg(inputCateg.value) !== normalizarTextoCateg(selecionado.nome)) {
                selecionarCategoriaPorObjeto(null, db, { manterTextoInput: true, carregarDados: true });
            }
            window.renderizarSelectCategorias("nome", inputCateg.value);
            abrirSugestoesCategoria();
        });

        inputCateg.addEventListener("focus", () => {
            if (window.estadoAtual === EstadoFluxo.CATEGORIZANDO) return;
            window.renderizarSelectCategorias("nome", inputCateg.value);
            abrirSugestoesCategoria();
        });

        inputCateg.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                fecharSugestoesCategoria();
            } else if (e.key === "Enter") {
                const primeiroItem = listaSugestoes?.querySelector(".categoria-sugestao-item[data-id]");
                if (primeiroItem) {
                    e.preventDefault();
                    primeiroItem.click();
                }
            }
        });
    }

    document.addEventListener("click", (e) => {
        const container = e.target.closest?.(".categoria-autocomplete");
        if (!container) {
            fecharSugestoesCategoria();
        }
    });

    window.registrar("categoria", "change", (e) => window.onCategChange(e, db));
    // registro de nova categoria
    window.registrar("btnNovaCategoria", "click", () => window.exibirNovaCategoria());
    window.registrar("categoriaNome", "input", () => window.updateCategoriaNome());
    window.registrar("inputCategResultado", "input", () => window.updateCategoriaTexto());
};
//#endregion

window.listaDeCategorias = [];
window.categoriaSelecionada = null;
let _criterioOrdenacaoCategoria = "nome";

function normalizarTextoCateg(texto = "") {
    return String(texto)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function abrirSugestoesCategoria() {
    const lista = document.getElementById("listaCategoriasSugestoes");
    if (lista && lista.children.length > 0) {
        lista.hidden = false;
        document.getElementById("categoria")?.setAttribute("aria-expanded", "true");
    }
}

function fecharSugestoesCategoria() {
    const lista = document.getElementById("listaCategoriasSugestoes");
    if (lista) {
        lista.hidden = true;
    }
    document.getElementById("categoria")?.setAttribute("aria-expanded", "false");
}

async function selecionarCategoriaPorObjeto(cat, database = null, opcoes = {}) {
    const { manterTextoInput = false, carregarDados = true } = opcoes;
    const input = document.getElementById("categoria");

    if (cat) {
        window.categoriaSelecionada = cat;
        if (input) {
            input.value = cat.nome;
            input.dataset.selectedId = String(cat.id);
        }
        fecharSugestoesCategoria();

        if (carregarDados) {
            await window.onCategChange({ target: { value: String(cat.id) } }, database);
        }
    } else {
        const tinhaSelecao = Boolean(window.categoriaSelecionada || input?.dataset.selectedId);
        window.categoriaSelecionada = null;
        if (input) {
            input.dataset.selectedId = "";
            if (!manterTextoInput) {
                input.value = "";
            }
        }
        if (carregarDados && tinhaSelecao) {
            await window.onCategChange({ target: { value: "" } }, database);
        }
    }
}

window.bloquearCateg = function(ativar) {
    const inputCategoria = document.getElementById("categoria");
    if (inputCategoria) {
        inputCategoria.disabled = Boolean(ativar);
    }
    if (ativar) {
        fecharSugestoesCategoria();
    }
};

window.temCategoria = function() {
    const input = document.getElementById("categoria");
    if (!input) return false;
    return Boolean(window.categoriaSelecionada?.id || input.dataset.selectedId);
};

window.renderizarSelectCategorias = function(criterio = _criterioOrdenacaoCategoria, termoBusca = null) {
    _criterioOrdenacaoCategoria = criterio || "nome";

    const input = document.getElementById("categoria");
    const lista = document.getElementById("listaCategoriasSugestoes");
    if (!input || !lista) return;

    const consultaRaw = termoBusca !== null ? termoBusca : input.value;
    const consultaNorm = normalizarTextoCateg(consultaRaw);

    let categoriasFiltradas = [...(window.listaDeCategorias || [])];

    if (consultaNorm) {
        categoriasFiltradas = categoriasFiltradas.filter(cat => {
            const nomeNorm = normalizarTextoCateg(cat.nome);
            if (nomeNorm.includes(consultaNorm)) return true;

            const termos = Array.isArray(cat._termosBusca)
                ? cat._termosBusca
                : [normalizarTextoCateg(cat.nome), normalizarTextoCateg(cat.texto_output)];

            return termos.some(t => t.includes(consultaNorm));
        });
    }

    if (_criterioOrdenacaoCategoria === "nome") {
        categoriasFiltradas.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }));
    } else if (_criterioOrdenacaoCategoria === "id") {
        categoriasFiltradas.sort((a, b) => a.id - b.id);
    }

    lista.innerHTML = "";

    if (!categoriasFiltradas.length) {
        const vazio = document.createElement("div");
        vazio.className = "categoria-sugestao-vazia";
        vazio.textContent = consultaNorm
            ? `Nenhuma categoria ou item encontrado para "${consultaRaw.trim()}".`
            : "Nenhuma categoria disponível.";
        lista.appendChild(vazio);
        return;
    }

    categoriasFiltradas.forEach(cat => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "categoria-sugestao-item";
        item.setAttribute("role", "option");
        item.dataset.id = String(cat.id);

        const titulo = document.createElement("span");
        titulo.className = "categoria-sugestao-nome";
        titulo.textContent = cat.nome;
        item.appendChild(titulo);

        if (consultaNorm && !normalizarTextoCateg(cat.nome).includes(consultaNorm)) {
            const matchExtra = (cat._correspondenciasDetalhe || []).find(t => t.includes(consultaNorm));
            if (matchExtra) {
                const detalhe = document.createElement("small");
                detalhe.className = "categoria-sugestao-match";
                detalhe.textContent = `Contém: ${matchExtra}`;
                item.appendChild(detalhe);
            }
        }

        item.addEventListener("click", async () => {
            const dbRef = window.db || window.database || null;
            await selecionarCategoriaPorObjeto(cat, dbRef, { manterTextoInput: false, carregarDados: true });
        });

        lista.appendChild(item);
    });
};

window.onCategChange = async function(e, database) {
    const btn = document.getElementById("btnComplemento");
    const valorSelecionado = e?.target?.value ?? "";
    const db = database || window.db || window.database || null;

    if (valorSelecionado !== "") {
        const idNum = Number(valorSelecionado);

        window.categoriaSelecionada = window.listaDeCategorias.find(cat => cat.id === idNum) || null;
        const allowComplement = btn && (window.nivelPermissaoUsuario >= 2);

        window.alterarVisibilidadeElemento?.("btnComplemento", allowComplement);

        const fnCarregar =
            (db && typeof db.carregarDadosDaCategoria === "function" && db.carregarDadosDaCategoria.bind(db)) ||
            (typeof window.carregarDadosDaCategoria === "function" && window.carregarDadosDaCategoria) ||
            null;

        if (fnCarregar) {
            await fnCarregar(idNum);
        } else {
            console.error("carregarDadosDaCategoria não encontrada.");
        }

        window.atualizarFormulario?.();
        return;
    } else {
        window.categoriaSelecionada = null;
        window.alterarVisibilidadeElemento?.("btnComplemento", false);
        window.alterarVisibilidadeElemento?.("camposDinamicos", false);
        window.fecharNovoComplemento?.();
        window.camposDaCategoria = [];
        window.listasDaCategoria = [];
        window.resetarFormulario?.();
        window.resetarCategoria?.();
        window.limparPagina?.(true);
    }
};

//#region Registro de Categorias

let nomeNovaCategoria = null;
window.textoNovaCategoria = null;

window.exibirNovaCategoria = function() {
    if (!window.nivelPermissaoUsuario || window.nivelPermissaoUsuario < 2) {
        console.warn("Usuario não autorizado a criar categorias.");
        return;
    }
    if (window.estadoAtual === EstadoFluxo.COMPLEMENTANDO) window.fecharNovoComplemento();
    window.naturezaRelacionada = null;
    window.categoriaSelecionada = null;
    window.camposDaCategoria = [];
    window.listasDaCategoria = [];
    window.resetarFormulario();
    window.limparPagina(true);
    window.estadoAtual = EstadoFluxo.CATEGORIZANDO;

    document.getElementById("tituloCardRegistro").textContent = "Nova Categoria";
    ["btnRegistrar", "btnCancelar", "btnOutlines", "categoriaNome"].forEach(id => window.alterarVisibilidadeElemento(id, true));
    ["novaCategCampos", "btnComplemento", "regraOculto", "regraOcultoOperadorContainer", "naturezasCampo", "btnNovaCategoria"].forEach(id => window.alterarVisibilidadeElemento(id, false));
    window.alterarVisibilidadeElemento("btnModoEdicao", false);

    fecharSugestoesCategoria();
    const inputCategoria = document.getElementById("categoria");
    if (inputCategoria) {
        inputCategoria.dataset.selectedId = "";
        inputCategoria.value = "Nova Categoria...";
        inputCategoria.disabled = true;
    }

    window.entrarModoRegistro({ colunaDir: false, grid: false });
};

window.fecharNovaCategoria = function() {
    window.estadoAtual = EstadoFluxo.FORMULANDO;
    nomeNovaCategoria = null;
    window.textoNovaCategoria = null;

    const inputCategoriaNome = document.getElementById("categoriaNome");
    if (inputCategoriaNome) inputCategoriaNome.value = "";

    ["btnRegistrar", "btnCancelar", "btnOutlines", "categoriaNome", "novaCategCampos", "naturezasCampo", "btnComplemento", "regraOculto", "regraOcultoOperadorContainer"].forEach(id => window.alterarVisibilidadeElemento(id, false));

    if (window.nivelPermissaoUsuario && window.nivelPermissaoUsuario >= 2) {
        window.alterarVisibilidadeElemento("btnNovaCategoria", true);
    }
    if (window.nivelPermissaoUsuario && window.nivelPermissaoUsuario >= 3) {
        window.alterarVisibilidadeElemento("btnModoEdicao", true);
    }

    const inputCategoria = document.getElementById("categoria");
    if (inputCategoria) {
        inputCategoria.disabled = false;
        inputCategoria.dataset.selectedId = "";
        inputCategoria.value = "";
    }

    window.sairModoRegistro({ grid: false });

    window.naturezaRelacionada = null;
    window.categoriaSelecionada = null;
    window.camposDaCategoria = [];
    window.listasDaCategoria = [];
    window.resetarFormulario();
    window.limparPagina(true);
};

//#endregion

//#region Registro Preview

window.updateCategoriaNome = function() {
    if (window.estadoAtual === EstadoFluxo.EDITANDO) {
        window.sincronizarTelaEditor();
        return;
    }

    const inputCategoria = document.getElementById("categoria");
    const nome = document.getElementById("categoriaNome")?.value.trim() || "";
    const visivel = nome !== "";

    ["novaCategCampos", "categResultado", "naturezasCampo"].forEach(id => window.alterarVisibilidadeElemento(id, visivel));

    nomeNovaCategoria = nome;
    if (inputCategoria) {
        inputCategoria.value = nome || "Nova Categoria...";
    }
};

window.updateCategoriaTexto = function() {
    if (window.estadoAtual === EstadoFluxo.EDITANDO) {
        window.sincronizarTelaEditor();
        return;
    }

    const inputCategResultado = document.getElementById("inputCategResultado");
    textoNovaCategoria = inputCategResultado ? inputCategResultado.value.trim() : "";
    window.atualizarFormulario();
};

window.entregarDadosNovaCategoria = function() {
    let _ordemContexto = 0;
    let _ordemExibicao = 0;

    const blocoFantasma = document.querySelector('.text-piece[data-card-id="bloco_categoria_output"]');

    if (blocoFantasma) {
        _ordemContexto = parseInt(blocoFantasma.getAttribute('data-ordem-contexto') || 0);
        _ordemExibicao = parseFloat(blocoFantasma.getAttribute('data-peso') || 0);
    }

    const dados = {
        nomeCateg: nomeNovaCategoria,
        textoResultado: window.textoNovaCategoria,
        ordemContexto: _ordemContexto,
        ordemExibicao: _ordemExibicao,
        natureza: window.naturezaRelacionada?.id || null
    };

    console.log("Dados da categoria que serão salvos:", dados);

    return dados;
};

//#endregion