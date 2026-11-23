import * as db from './database.js';

//#region EVENTOS
window.registrarEditorEventos = function() {
    const btnModoEdicaoElement = document.getElementById("btnModoEdicao");
    const btnSalvarEdicaoElement = document.getElementById("btnSalvarEdicao");
    const btnCancelarEdicaoElement = document.getElementById("btnCancelarEdicao");
    
    if (btnModoEdicaoElement) {
        btnModoEdicaoElement.addEventListener("click", async () => {
            if (window.estadoAtual !== EstadoFluxo.EDITANDO) {
                await window.iniciarModoEdicao();
            }
        });
    }
    if (btnSalvarEdicaoElement) {
        btnSalvarEdicaoElement.addEventListener("click", async () => {
            if (window.estadoAtual === EstadoFluxo.EDITANDO) {
                const resultado = await window.salvarCardsModificados();
                
                await window.finalizarModoEdicaoComSucesso(); 

                if (resultado === 'salvo') {
                    window.mostrarToast("Organização salva com sucesso!");
                } 
                else if (resultado === 'nada') {
                    window.mostrarToast("Nenhuma alteração feita. Edição finalizada.");
                } 
                else {
                    window.mostrarToast("Erro ao salvar posições.");
                }
            }
        });
    }

    if (btnCancelarEdicaoElement) {
        btnCancelarEdicaoElement.addEventListener("click", async () => {
            if (window.estadoAtual === EstadoFluxo.EDITANDO) {
                await window.cancelarModoEdicao();
            }
        });
    }
}
//#endregion

const EditState = Object.freeze({
    DEFAULT: "EditingDefault",
    CATEG: "EditingCateg",
    CARD: "EditingCard"
});
let currentEditState = EditState.DEFAULT;

window.itemSendoEditado = null;

//#region FUNÇÕES AUXILIARES PRIVADAS
// =====================================================

const configurarGridStack = (ativar) => {
    if (!window.grid) return;

    if (ativar) {
        window.grid.enable();
        setTimeout(() => {
            document.querySelectorAll('.grid-stack-item').forEach(card => {
                card.removeAttribute('gs-locked');
                card.removeAttribute('gs-no-move');
                card.removeAttribute('gs-no-resize');
                card.style.pointerEvents = 'auto';
                window.grid.update(card, { locked: false, noMove: false, noResize: false });
                window.grid.movable(card, true);
                window.grid.resizable(card, true);
            });
        }, 50);
    } else {
        document.querySelectorAll('.grid-stack-item').forEach(card => {
            card.setAttribute('gs-locked', 'true');
            card.setAttribute('gs-no-move', 'true');
            card.setAttribute('gs-no-resize', 'true');
            window.grid.update(card, { locked: true, noMove: true, noResize: true });
        });
        window.grid.disable();
    }
};

const showBtnCateg = (ativar) => {
    if (ativar) {
        const linhaCategoria = document.querySelector('.linha-categoria');
        
        if (linhaCategoria) {
            linhaCategoria.style.position = 'relative';

            // --- BOTÃO EDITAR CATEGORIA (Canto Superior Esquerdo) ---
            if (!document.getElementById('btnEditarCategDinamico')) {
                const btnEditCateg = document.createElement('button');
                btnEditCateg.id = 'btnEditarCategDinamico';
                btnEditCateg.className = 'btn-acao-card btn-editar'; 
                btnEditCateg.textContent = '</>';
                btnEditCateg.title = "Editar esta categoria";
                
                btnEditCateg.addEventListener('click', window.abrirEdicaoCategoria);
                linhaCategoria.appendChild(btnEditCateg);
            }

            // --- BOTÃO EXCLUIR CATEGORIA (Canto Superior Direito) ---
            if (!document.getElementById('btnExcluirCategDinamico')) {
                const btnDelCateg = document.createElement('button');
                btnDelCateg.id = 'btnExcluirCategDinamico';
                btnDelCateg.className = 'btn-acao-card btn-excluir'; 
                btnDelCateg.textContent = '<x>';
                btnDelCateg.title = "Excluir esta categoria permanentemente";
                
                btnDelCateg.addEventListener('click', window.abrirExclusaoCategoria);
                linhaCategoria.appendChild(btnDelCateg);
            }
        }
    } else {
        const btnEditCateg = document.getElementById('btnEditarCategDinamico');
        if (btnEditCateg) {
            btnEditCateg.removeEventListener('click', window.abrirEdicaoCategoria);
            btnEditCateg.remove();
        }

        const btnDelCateg = document.getElementById('btnExcluirCategDinamico');
        if (btnDelCateg) {
            btnDelCateg.removeEventListener('click', window.abrirExclusaoCategoria);
            btnDelCateg.remove();
        }
    }
}
const showBtnCards = (ativar) => {
    if (ativar) {
        document.querySelectorAll('.grid-stack-item-content').forEach(card => {
            card.style.cursor = "default"; 
            
            // --- BOTÃO EDITAR CARD (Canto Superior Esquerdo) ---
            let btnEdit = card.querySelector('.btn-editar');
            if (!btnEdit) {
                btnEdit = document.createElement('button');
                btnEdit.className = 'btn-acao-card btn-editar';
                btnEdit.textContent = '</>';
                btnEdit.title = "Editar este card";
                
                card.appendChild(btnEdit);
            }

            btnEdit.removeEventListener('click', window.abrirEdicaoCard);
            btnEdit.addEventListener('click', window.abrirEdicaoCard);

            // --- BOTÃO EXCLUIR CARD (Canto Superior Direito) ---
            let btnDel = card.querySelector('.btn-excluir');
            if (!btnDel) {
                btnDel = document.createElement('button');
                btnDel.className = 'btn-acao-card btn-excluir';
                btnDel.textContent = '<x>';
                btnDel.title = "Excluir este card";
                
                card.appendChild(btnDel);
            }
            btnDel.removeEventListener('click', window.abrirExclusaoCard);
            btnDel.addEventListener('click', window.abrirExclusaoCard);
            
        });
    } else {
        document.querySelectorAll('.btn-acao-card').forEach(btn => btn.remove());
    }
};

const alternarBotoesEdicao = (isEditando) => {
    window.fecharPainelUsuario?.();

    const btnGrid = document.getElementById("btnGrid");
    const btnOutlines = document.getElementById("btnOutlines");
    const camposDinamicos = document.getElementById("camposDinamicos");

    window.PainelEdicao(isEditando);

    const temPermissao = !window.nivelPermissaoUsuario || window.nivelPermissaoUsuario >= 3;
    const mostrarBotoesAdicionais = !isEditando && temPermissao;
    
    ["btnComplemento", "btnNovaCategoria"].forEach(id => window.alterarVisibilidadeElemento(id, mostrarBotoesAdicionais));
    
    if (btnGrid) btnGrid.style.display = isEditando ? "inline-block" : "none";
    if (btnOutlines) btnOutlines.style.display = isEditando ? "inline-block" : "none";

    document.body.classList.toggle("mostrar-grid", isEditando);
    document.body.classList.toggle("mostrar-outlines", isEditando);

    if (camposDinamicos) {
        camposDinamicos.classList.toggle("modo-edicao", isEditando);
        camposDinamicos.classList.toggle('mostrar-borda', isEditando);
    }
};

//#endregion

//#region EDIÇÃO
// =====================================================

window.iniciarModoEdicao = async function() {
    if(!window.temCategoria()){
        window.mostrarToast("Selecione uma Categoria para Editar.");
        return;
    }

    if(window.estadoAtual === EstadoFluxo.CATEGORIZANDO) window.fecharNovaCategoria?.();
    if(window.estadoAtual === EstadoFluxo.COMPLEMENTANDO) window.fecharNovoComplemento?.();

    window.estadoAtual = EstadoFluxo.EDITANDO;
    currentEditState = EditState.DEFAULT;
    
    alternarBotoesEdicao(true);
    window.bloquearCateg?.(true);
    window.ativarOutlines?.();
    window.ativarModoEdicao?.();
    window.ativarGrid?.();
    
    configurarGridStack(true);

    if (window.sortableContexto) window.sortableContexto.option("disabled", false);
    if (window.sortableExibicao) window.sortableExibicao.option("disabled", false);
    
    window.atualizarFormulario?.();

    showBtnCateg(true);
    showBtnCards(true);
    window.desabilitarBotoesAcoes();
    window.mostrarToast("Modo Edição ativado: Mova/redimensione os cards ou clique em </> para EXCLUIR.");
};

window.reaplicarEventosModoEdicao = function() {
    if (window.estadoAtual !== EstadoFluxo.EDITANDO) return;
    
    alternarBotoesEdicao(true); 
    configurarGridStack(true);
    showBtnCards(true);
};

window.limparInterfaceModoEdicao = async function() {
    window.estadoAtual = EstadoFluxo.FORMULANDO;
    alternarBotoesEdicao(false);
    window.desativarOutlines?.();
    window.desativarModoEdicao?.();
    window.desativarGrid?.();
    configurarGridStack(false);
    if (window.sortableContexto) window.sortableContexto.option("disabled", true);
    if (window.sortableExibicao) window.sortableExibicao.option("disabled", true);
    
    currentEditState = EditState.DEFAULT;
    showBtnCateg(false);
    showBtnCards(false);
    window.bloquearCateg?.(false);
    window.habilitarBotoesAcoes();
};

window.finalizarModoEdicaoComSucesso = async function() {
    await window.limparInterfaceModoEdicao();
    await db.carregarDadosDaCategoria();
    window.atualizarFormulario?.();
};

window.cancelarModoEdicao = async function() {
    if (!confirm("Tem certeza que deseja CANCELAR as edições?\nTodas as alterações de layout não salvas serão perdidas (Cards excluídos não serão restaurados).")) {
        return;
    }

    window.mostrarToast("Cancelando edição e restaurando layout original...");
    await window.limparInterfaceModoEdicao();
    await db.carregarDadosDaCategoria();
    window.atualizarFormulario?.();
    window.mostrarToast("Edição cancelada!");
};

window.salvarCardsModificados = async function() {
    const atualizacoes = { campos_formulario: {}, lista_formulario: {}, lista_opcao: {} };
    const posicoesTextos = window.obterDadosDeCadaBlocoTexto?.() || [];
    
    if (window.grid) {
        window.grid.engine.nodes.forEach(node => {
            if (!node.el) return;
            const contentDiv = node.el.querySelector('.grid-stack-item-content');
            if (!contentDiv) return;

            const idCard = parseInt(contentDiv.getAttribute('data-id'));
            if (isNaN(idCard)) return;

            const tabela = contentDiv.getAttribute('data-tabela') || 'campos_formulario';
            const payload = { id: idCard, grid_x: node.x, grid_y: node.y, grid_w: node.w, grid_h: node.h };

            atualizacoes[tabela][idCard] = payload;
        });
    }

    //guarda nova ordem dos blocosTextos
    posicoesTextos.forEach(pos => {
        const idStr = pos.idCard;
        const isOpcao = String(idStr).startsWith('opcao_');
        const idInt = parseInt(String(idStr).replace(/\D/g, '')); 
        if (isNaN(idInt)) return;

        const tabela = isOpcao ? 'lista_opcao' : 'campos_formulario';
        if (!atualizacoes[tabela][idInt]) atualizacoes[tabela][idInt] = { id: idInt };
        
        atualizacoes[tabela][idInt].data_contexto = parseInt(pos.data_contexto);
        atualizacoes[tabela][idInt].data_peso = parseFloat(pos.data_peso); 
    });

    try {
        let algoParaSalvar = false;
        
        for (const [tabela, records] of Object.entries(atualizacoes)) {
            const arr = Object.values(records);
            if (arr.length > 0) {
                algoParaSalvar = true;
                await db.atualizarCardsEmLote(tabela, arr);
            }
        }
        
        return algoParaSalvar ? 'salvo' : 'nada';
    } catch (error) {
        console.error("Erro ao salvar atualizações unificadas em lote:", error);
        return 'erro';
    }
};

//#region EDIÇÃO DE DADOS EXISTENTES
window.sincronizarTelaEditor = function(){
    //TODO;
    // - FUNÇÃO PARA CASO NO FUTURO EU QUERIA ATUAIZAR A TELA DINAMICAMENTE DURANTE UMA EDIÇÃO. (POR ENQUANTO ELA SERVE APENAS DE STANDBY)
}

window.abrirEdicaoCategoria = async function (){
    resetarPainel();
    const idCateg = window.categoriaSelecionada ? window.categoriaSelecionada.id : null; 

    if (!idCateg) {
        window.mostrarToast("Nenhuma categoria selecionada para edição.");
        console.error("ID da categoria não definido.");
        return;
    }

    currentEditState = EditState.CATEG;
    
    // SALVANDO DADOS DO ITEM SENDO EDITADO
    window.itemSendoEditado = {
        id: idCateg,
        tabelaOrigem: 'categorias'
    };

    window.PainelRegistro(true);
    window.PainelEdicao(false, true);
    window.alternarColuneDireita(false);

    ["btnRegistrar", "btnCancelar","novaCategCampos", "categoriaNome", "categResultado", "naturezasCampo"].forEach(id => window.alterarVisibilidadeElemento(id, true));

    // COLETAR DADOS DA CATEGORIA NO BANCO E PREENCHER
    const dadosCateg = await db.coletarDadosDoBanco(idCateg, 'categorias');
    if (dadosCateg) {
        const inputNome = document.getElementById("categoriaNome");
        const inputTexto = document.getElementById("inputCategResultado");

        if(inputNome) inputNome.value = dadosCateg.nome || "";
        if(inputTexto) inputTexto.value = dadosCateg.texto_output || "";
        
        preencherInputNatureza(dadosCateg.natureza_id);
    }
};
window.abrirEdicaoCard = async function (evento){
    resetarPainel();
    const contentDiv = evento.currentTarget.closest('.grid-stack-item-content');
    if (!contentDiv) return;

    const idCard = contentDiv.getAttribute('data-id');
    const tabela = contentDiv.getAttribute('data-tabela') || 'campos_formulario';
    if (!idCard) return;

    currentEditState = EditState.CARD;

    // SALVANDO DADOS DO ITEM SENDO EDITADO
    window.itemSendoEditado = {
        id: idCard,
        tabelaOrigem: tabela
    };

    window.PainelRegistro(true);
    window.PainelEdicao(false, true);

    if (tabela === 'lista_formulario'){

        window.alternarColuneDireita(true);
        const selectElement = contentDiv.querySelector('select');
        const valorSelecionado = selectElement?.value;
        const dropdownPai = window.listasDaCategoria?.find(l => l.id == idCard);

        if (!valorSelecionado || valorSelecionado.trim() === "") {
            // Editando o "Pai" da Lista (O próprio Dropdown)
            
            ["btnRegistrar","btnCancelar","novoCardCampos","listaNome","regraOculto"].forEach(id => window.alterarVisibilidadeElemento(id, true));
            const dadosLista = await db.coletarDadosDoBanco(idCard, 'lista_formulario');

            if (dadosLista) {
                document.getElementById("inputListaNome").value = dadosLista.valor_opcao || "";
                
                popularSelectOcultoAte(idCard, 'lista_formulario');
                const qtdSelecionados = preencherSelectMultiplo("selectRegraOculto", dadosLista.oculto_ate);
                
                window.alterarVisibilidadeElemento("regraOcultoOperadorContainer", qtdSelecionados > 1);

                const checkboxOperador = document.getElementById("checkboxRegraOcultoOperador");
                if (checkboxOperador) {
                    const ocultoStr = String(dadosLista.oculto_ate || "");
                    checkboxOperador.checked = !ocultoStr.includes("||");
                }
            }
        }
        else if (dropdownPai?.opcoes) {
            window.alternarColuneDireita(false);
            const dadosCard = dropdownPai.opcoes.find(op => op.id == valorSelecionado || op.nome_campo == valorSelecionado);
            
            if (dadosCard) {

                ["btnRegistrar", "btnCancelar", "novoCardCampos", "nomeOpcao", "textoResultado", "naturezasCampo", "aditivoCampo"].forEach(id => window.alterarVisibilidadeElemento(id, true));
                window.itemSendoEditado.id = dadosCard.id; 
                window.itemSendoEditado.tabelaOrigem = 'lista_opcao';

                const dadosOpcao = await db.coletarDadosDoBanco(dadosCard.id, 'lista_opcao');

                if (dadosOpcao) {
                    document.getElementById("inputNomeOpcao").value = dadosOpcao.nome_campo || "";
                    document.getElementById("inputTextoResultado").value = dadosOpcao.texto_output || "";
                    document.getElementById("inputAditivoTexto").value = dadosOpcao.aditivo_texto || "";
                    document.getElementById("selectAditivoPosicao").value = dadosOpcao.aditivo_posicao || "";
                    preencherInputNatureza(dadosOpcao.natureza_id);
                }
            }
        }
    }
    else {

        window.alternarColuneDireita(true);
        ["btnRegistrar", "btnCancelar", "novoCardCampos", "nomeOpcao", "textoResultado", "regraOculto", "naturezasCampo", "aditivoCampo"].forEach(id => window.alterarVisibilidadeElemento(id, true));

        const dadosCampo = await db.coletarDadosDoBanco(idCard, 'campos_formulario');

        if (dadosCampo) {
            document.getElementById("inputNomeOpcao").value = dadosCampo.nome_campo || "";
            document.getElementById("inputTextoResultado").value = dadosCampo.texto_output || "";
            document.getElementById("inputAditivoTexto").value = dadosCampo.aditivo_texto || "";
            document.getElementById("selectAditivoPosicao").value = dadosCampo.aditivo_posicao || "";
            preencherInputNatureza(dadosCampo.natureza_id);

            popularSelectOcultoAte(idCard, 'campos_formulario');
            const qtdSelecionados = preencherSelectMultiplo("selectRegraOculto", dadosCampo.oculto_ate);
            
            window.alterarVisibilidadeElemento("regraOcultoOperadorContainer", qtdSelecionados > 1);

            const checkboxOperador = document.getElementById("checkboxRegraOcultoOperador");
            if (checkboxOperador) {
                const ocultoStr = String(dadosCampo.oculto_ate || "");
                checkboxOperador.checked = !ocultoStr.includes("||");
            }
        }
    }
};

function resetarPainel(){
    [
        "btnRegistrar", "btnCancelar", "novaCategCampos", "categoriaNome", "categResultado",
        "novoCardCampos", "listaTipo", "listaNome", "nomeOpcao", "textoResultado",
        "regraOculto", "regraOcultoOperadorContainer", "naturezasCampo",
        "aditivoCampo"
    ].forEach(id => window.alterarVisibilidadeElemento(id, false));
}
window.fecharPainelEdicao = function (){

    window.PainelRegistro(false);
    window.PainelEdicao(true);
    window.window.alternarColuneDireita(false);

    [
        "btnRegistrar",
        "btnCancelar",
        "novaCategCampos",
        "categoriaNome",
        "categResultado",
        "novoCardCampos",
        "listaTipo",
        "listaNome",
        "nomeOpcao",
        "textoResultado",
        "regraOculto",
        "regraOcultoOperadorContainer",
        "naturezasCampo",
        "aditivoCampo"
    ].forEach(id => window.alterarVisibilidadeElemento(id, false));

    currentEditState = EditState.DEFAULT;
    window.itemSendoEditado = null;
}
window.salvarNovosDados = async function (){

    if (!window.nivelPermissaoUsuario || window.nivelPermissaoUsuario < 2) {
        window.mostrarToast("Ação não autorizada."); 
        return;
    }

    if (!window.itemSendoEditado || !window.itemSendoEditado.id) {
        window.mostrarToast("Nenhum item em edição encontrado!");
        return;
    }

    const idItem = window.itemSendoEditado.id; 
    const tipoTabela = window.itemSendoEditado.tabelaOrigem;

    try {
        let sucesso = false;

        // ==========================================
        // LÓGICA DE VALIDAÇÃO ANTES DE SALVAR
        // ==========================================
        
        if (currentEditState === EditState.CATEG) {
            const inputNomeCateg = document.getElementById("categoriaNome").value.trim();
            
            if (!inputNomeCateg) {
                window.mostrarToast("O nome da categoria não pode ficar vazio!");
                return; 
            }
            
            const dados = window.entregarDadosParaEdicao(idItem, currentEditState, tipoTabela);
            sucesso = await db.atualizarCategoriaDB(idItem, dados);
        } 
        
        else if (currentEditState === EditState.CARD) {
            
            let nomeEditado = "";
            if (tipoTabela === 'lista_formulario') {
                nomeEditado = document.getElementById("inputListaNome").value.trim();
            } else {
                nomeEditado = document.getElementById("inputNomeOpcao").value.trim();
            }

            if (!nomeEditado) {
                window.mostrarToast("O nome não pode ficar vazio!");
                return;
            }

            let nomeDuplicado = false;
            
            if (window.camposDaCategoria && window.camposDaCategoria.length > 0) {
                if (window.camposDaCategoria.some(c => c.nome_campo.toLowerCase() === nomeEditado.toLowerCase() && String(c.id) !== String(idItem))) {
                    nomeDuplicado = true;
                }
            }

            if (!nomeDuplicado && window.listasDaCategoria && window.listasDaCategoria.length > 0) {
                for (const lista of window.listasDaCategoria) {
                    if (lista.valor_opcao.toLowerCase() === nomeEditado.toLowerCase() && String(lista.id) !== String(idItem)) {
                        nomeDuplicado = true;
                        break;
                    }
                    if (lista.opcoes && lista.opcoes.length > 0) {
                        if (lista.opcoes.some(op => op.nome_campo.toLowerCase() === nomeEditado.toLowerCase() && String(op.id) !== String(idItem))) {
                            nomeDuplicado = true;
                            break;
                        }
                    }
                }
            }

            if (nomeDuplicado) {
                window.mostrarToast("Já existe um campo ou opção com este nome nesta categoria!");
                return;
            }

            const dados = window.entregarDadosParaEdicao(idItem, currentEditState, tipoTabela);
            
            if (tipoTabela === 'campos_formulario') {
                sucesso = await db.atualizarCampoNormalDB(idItem, dados);
            } 
            else if (tipoTabela === 'lista_formulario') {
                sucesso = await db.atualizarListaDB(idItem, dados);
            } 
            else if (tipoTabela === 'lista_opcao') {
                sucesso = await db.atualizarOpcaoListaDB(idItem, dados);
            }
        }

        // ==========================================
        // FINALIZAÇÃO (SE SUCESSO)
        // ==========================================

        if (sucesso) {
            window.mostrarToast("Edição salva com sucesso!");
            window.limparPagina(true); 
            
            if (currentEditState === EditState.CATEG) {
                await db.carregarCategorias();
            } else {
                await db.carregarDadosDaCategoria();
            }
            
            window.fecharPainelEdicao();
            window.reaplicarEventosModoEdicao();
        }

    } catch (error) {
        console.error("Erro ao salvar edição:", error);
        window.mostrarToast("Erro ao salvar edição. Tente novamente.");
    }
}

//#region HELPER DO CARREGAMENTO DE DADOS PARA EDIÇÃO
function popularSelectOcultoAte(idExcluir = null, tipoExcluir = null) {
    const selectOculto = document.getElementById("selectRegraOculto"); 
    if (!selectOculto) return;

    const htmlPadrao = `<option value="">Nenhuma (Sempre Visível)</option>`;

    const camposFiltrados = (window.camposDaCategoria || [])
        .filter(c => !(tipoExcluir === 'campos_formulario' && String(c.id) === String(idExcluir)))
        .sort((a, b) => a.nome_campo.localeCompare(b.nome_campo, 'pt-BR'));

    const listasFiltradas = (window.listasDaCategoria || [])
        .filter(l => !(tipoExcluir === 'lista_formulario' && String(l.id) === String(idExcluir)))
        .sort((a, b) => a.valor_opcao.localeCompare(b.valor_opcao, 'pt-BR'));

    const camposGroup = camposFiltrados.length 
        ? `<optgroup label="Campos Regulares">` + 
          camposFiltrados.map(c => `<option value="campo_${c.id}">${c.nome_campo}</option>`).join("") + 
          `</optgroup>` 
        : "";

    const listasGroup = listasFiltradas.map(lista => {
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
};
function preencherSelectMultiplo(idSelect, valoresDoBanco) {
    const select = document.getElementById(idSelect);
    if (!select) return 0;

    let valoresArray = [];
    if (valoresDoBanco) {
        if (Array.isArray(valoresDoBanco)) {
            valoresArray = valoresDoBanco.map(String);
        } else if (typeof valoresDoBanco === 'string') {
            try {
                // Tenta fazer o PARSE caso venha em formato de string JSON
                const parsed = JSON.parse(valoresDoBanco);
                valoresArray = Array.isArray(parsed) ? parsed.map(String) : String(valoresDoBanco).split(/&&|\|\||,/);
            } catch (e) {
                // Separa por '&&', '||' ou ','
                valoresArray = String(valoresDoBanco).split(/&&|\|\||,/).map(s => s.trim());
            }
        }
    }

    let qtdSelecionados = 0;

    // Varre as opções do select e marca as que existem no banco
    Array.from(select.options).forEach(opt => {
        if (opt.value && valoresArray.includes(String(opt.value))) {
            opt.selected = true;
            qtdSelecionados++;
        } else {
            opt.selected = false;
        }
    });

    return qtdSelecionados;
};
window.preencherInputNatureza = function(natureza_id) {
    const inputNatureza = document.getElementById('buscarNatureza');

    if (!natureza_id) {
        window.naturezaRelacionada = null;
        if (inputNatureza) inputNatureza.value = "";
        return;
    }

    const naturezaEncontrada = window.listaDeNaturezas?.find(n => String(n.id) === String(natureza_id));

    if (naturezaEncontrada) {
        window.naturezaRelacionada = naturezaEncontrada;
        if (inputNatureza) inputNatureza.value = naturezaEncontrada.natureza;
        console.log(`[Edição] Natureza vinculada automaticamente: | ID: ${window.naturezaRelacionada.id} | NATUREZA: ${window.naturezaRelacionada.natureza} |`);
    } else {
        window.naturezaRelacionada = null;
        if (inputNatureza) inputNatureza.value = "";
    }
};
window.entregarDadosParaEdicao = function(idItem, estadoEdicao, tipoTabela) {

    //#region RETORNO PARA CATEGORIAS
    if (estadoEdicao === EditState.CATEG) {
        const nomeEditado = document.getElementById("categoriaNome")?.value.trim() || "";
        const textoEditado = document.getElementById("inputCategResultado")?.value.trim() || "";

        const dadosCategoria = {
            nomeCateg: nomeEditado,
            textoResultado: textoEditado,
            natureza: window.naturezaRelacionada?.id || null
        };

        return dadosCategoria;
    }
    //#endregion

    //#region RETORNO PARA CARDS (COMPLEMENTOS)
    else if (estadoEdicao === EditState.CARD) {
        const _categoriaID = document.getElementById("categoria")?.value;
        const _textoResultado = document.getElementById("inputTextoResultado")?.value.trim() || "";
        
        let _nomeCampo = "";

        // LISTA (DROPDOWN ROOT)
        if (tipoTabela === 'lista_formulario') {
            _nomeCampo = document.getElementById("inputListaNome")?.value.trim();
            const selectOculto = document.getElementById("selectRegraOculto");
            const valoresOcultosSelecionados = selectOculto ? Array.from(selectOculto.selectedOptions).map(opt => opt.value).filter(v => v !== "") : [];
            const checkboxOperador = document.getElementById("checkboxRegraOcultoOperador");
            const operadorOculto = (checkboxOperador && !checkboxOperador.checked) ? "||" : "&&";
            const _ocultoAte = valoresOcultosSelecionados.length > 0 ? valoresOcultosSelecionados.join(` ${operadorOculto} `) : null;

            const dadosLista = {
                categoriaId: _categoriaID,
                nomeCampo: _nomeCampo,
                ocultoAte: _ocultoAte
            };
            return dadosLista;
        }
        
        // OPÇÃO DE LISTA
        else if(tipoTabela === 'lista_opcao'){
            _nomeCampo = document.getElementById("inputNomeOpcao")?.value.trim();
            
            const dadosOpcao = {
                categoriaId: _categoriaID,
                nomeCampo: _nomeCampo,
                textoResultado: _textoResultado,
                natureza: window.naturezaRelacionada?.id || null,
                aditivoTexto: document.getElementById("inputAditivoTexto")?.value.trim() || null,
                aditivoPosicao: document.getElementById("selectAditivoPosicao")?.value || null
            };
            return dadosOpcao;
        } 
        
        // CAMPO NORMAL
        else {
            _nomeCampo = document.getElementById("inputNomeOpcao")?.value.trim();
            const selectOculto = document.getElementById("selectRegraOculto");
            const valoresOcultosSelecionados = selectOculto ? Array.from(selectOculto.selectedOptions).map(opt => opt.value).filter(v => v !== "") : [];
            const checkboxOperador = document.getElementById("checkboxRegraOcultoOperador");
            const operadorOculto = (checkboxOperador && !checkboxOperador.checked) ? "||" : "&&";
            const _ocultoAte = valoresOcultosSelecionados.length > 0 ? valoresOcultosSelecionados.join(` ${operadorOculto} `) : null;

            const dadosCard = {
                categoriaId: _categoriaID,
                nomeCampo: _nomeCampo,
                textoResultado: _textoResultado,
                ocultoAte: _ocultoAte,
                natureza: window.naturezaRelacionada?.id || null,
                aditivoTexto: document.getElementById("inputAditivoTexto")?.value.trim() || null,
                aditivoPosicao: document.getElementById("selectAditivoPosicao")?.value || null
            };
            return dadosCard;
        }
    }
    //#endregion
};
//#endregion

//#endregion

//#region EXCLUSAO

window.abrirExclusaoCategoria = async function(evento) {
    if (window.estadoAtual !== EstadoFluxo.EDITANDO || currentEditState !== EditState.DEFAULT) return;
    evento.preventDefault();

    if (!window.categoriaSelecionada?.id) {
        window.mostrarToast("Nenhuma categoria válida selecionada.");
        return;
    }

    const selectCategoria = document.getElementById("categoria");
    const nomeCategoria = selectCategoria.options[selectCategoria.selectedIndex]?.text || "esta categoria";

    if (!confirm(`Tem certeza que deseja EXCLUIR a categoria "${nomeCategoria.toUpperCase()}"?\n\nIsso apagará a categoria permanentemente do banco de dados.\nEsta ação NÃO PODE ser desfeita.`)) {
        return;
    }

    try {
        const sucesso = await db.deletarCategoria(window.categoriaSelecionada.id);
        if (sucesso) {
            window.mostrarToast("Processando exclusão... aguarde.");
            await new Promise(resolve => setTimeout(resolve, 3000));
            window.mostrarToast("Categoria excluída com sucesso!");
            
            await window.limparInterfaceModoEdicao();
            selectCategoria.value = "";
            window.limparPagina?.(false, false, false);
            window.resetarCategoria?.();
        }
    } catch (error) {
        console.error("Erro ao excluir categoria:", error);
        window.mostrarToast("Erro ao excluir categoria. Verifique o console.");
    }
};

window.abrirExclusaoCard = async function(evento) {
    if (window.estadoAtual !== EstadoFluxo.EDITANDO || currentEditState !== EditState.DEFAULT) return;
    evento.stopPropagation();
    evento.preventDefault();

    const contentDiv = evento.currentTarget.closest('.grid-stack-item-content');
    if (!contentDiv) return;

    const idCard = contentDiv.getAttribute('data-id');
    const tabela = contentDiv.getAttribute('data-tabela') || 'campos_formulario';
    if (!idCard) return;

    if (tabela === 'lista_formulario') {
        const selectElement = contentDiv.querySelector('select');
        const valorSelecionado = selectElement?.value;
        const dropdownPai = window.listasDaCategoria?.find(l => l.id == idCard);

        if (!valorSelecionado || valorSelecionado.trim() === "") {
            if(confirm("Deseja excluir esta LISTA inteira permanentemente?")) {
                await window.deletarCampoSelecionado(idCard, 'lista_formulario');
            }
            return;
        }

        if (dropdownPai?.opcoes) {
            const dadosCard = dropdownPai.opcoes.find(op => op.id == valorSelecionado || op.nome_campo == valorSelecionado);
            
            if (confirm(`Excluir APENAS a opção atual ("${dadosCard.nome_campo}")?\n\nClique OK para EXCLUIR A OPÇÃO.\nClique Cancelar para ver a opção de excluir a lista inteira.`)) {
                await window.deletarCampoSelecionado(dadosCard.id, 'lista_opcao', dropdownPai.id);
            } 
            else if (confirm(`Atenção: Deseja excluir a LISTA INTEIRA ("${dropdownPai.valor_opcao}") e todas as suas opções?`)) {
                await window.deletarCampoSelecionado(dropdownPai.id, 'lista_formulario');
            }
        }
    } else {
        if (confirm("Tem certeza que deseja excluir este card permanentemente?")) {
            await window.deletarCampoSelecionado(idCard, 'campos_formulario');
        }
    }
};

window.deletarCampoSelecionado = async function(campoId, tabela, idDropdownPai = null) {
    try {
        const sucesso = await db.deletarCampo(campoId, tabela, idDropdownPai);
        
        if (sucesso) {
            window.mostrarToast("Item excluído com sucesso!");
            await db.carregarDadosDaCategoria();
            window.atualizarFormulario?.();

            setTimeout(() => {
                if (window.estadoAtual === EstadoFluxo.EDITANDO) {
                    window.reaplicarEventosModoEdicao?.();
                    if (typeof window.ativarSortDrag === 'function') {
                        window.ativarSortDrag();
                    }
                }
            }, 300);
        }
    } catch (error) {
        console.error("Erro ao deletar o campo:", error);
        window.mostrarToast("Erro ao excluir item.");
    }
}

//#endregion

// =====================================================
//#endregion