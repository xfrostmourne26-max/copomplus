//Ultilitarios do projeto
import * as db from './data/database.js';
import * as auth from './data/auth.js';
import * as grid from './data/gridStackManager.js';
import * as sort from './data/sortableJSManager.js';
import * as edit from './data/editor.js';
import * as user from './data/userPanel.js';
//Funções do projeto
import * as despacho from './data/despacho.js';
import * as categ from './data/categ.js';
import * as form from './data/formulario.js';
import * as comp from './data/complemento.js';
import * as naturezas from './data/naturezas.js';
import * as global from './data/global.js';

window.EstadoFluxo = Object.freeze({
    FORMULANDO: "formulando",
    CATEGORIZANDO: "categorizando",
    COMPLEMENTANDO: "complementando",
    EDITANDO: "editando"
});

window.estadoAtual = window.EstadoFluxo.FORMULANDO;

// =====================================================
// BOOTSTRAP
// =====================================================

window.onload = async () => {

    aplicarTemaInicial();

    await db.carregarCategorias();
    await db.carregarNaturezasCopom();
    
    inicializarResizer();
    window.atualizarFormulario();
    registrarEventos();

    await auth.verificarPermissaoUsuario();
};

// =====================================================
// UPDATE
// =====================================================

let timeoutFormulario; 
window.atualizarFormulario = function() {
    clearTimeout(timeoutFormulario);
    timeoutFormulario = setTimeout(() => {
        window.atualizarOcultados();
        window.gerarDespacho(); 
    }, 200);
}

//#region EventHandlers
// =====================================================

window.registrar = function(id,evento,callback){
    const el = document.getElementById(id);

    if (!el) {
        console.warn("Elemento não encontrado:", id);
        return;
    }
    if (!callback) {
        console.warn("Callback inexistente:", id);
        return;
    }

    el.addEventListener(evento,callback);
}
function registrarEventos() {

    window.registrarAuthEventos();
    window.registrarNaturezaEventos();
    window.registrarCategEvento(db);
    window.registrarComplementoEventos(db);
    window.registrarEditorEventos();
    window.registrarDespachoEventos();
    window.registrarUserEventos();

    // =====================================
    // EVENTOS GLOBAIS
    // =====================================

    window.registrar("btnTema", "click", alternarTema);

    document.addEventListener('click', (e) => {

        // --- LÓGICA DO AUTOCOMPLETE ABAIXO --- //
        const painelSugestoes = document.getElementById('sugestoesNaturezas');
        const inputNatureza = document.getElementById('buscarNatureza');
        const sugestao = e.target.closest('.sugestao-item-busca');
        
        if (sugestao) {
            const naturezaSelecionada = sugestao.dataset.natureza;
            inputNatureza.value = naturezaSelecionada;
            painelSugestoes.style.display = "none";
            window.naturezaRelacionada = window.obterNatureza(naturezaSelecionada);
            console.log(`Natureza vinculada: | ID: ${window.naturezaRelacionada?.id} | NATUREZA: ${window.naturezaRelacionada?.natureza} |`);
        }

        if (painelSugestoes && painelSugestoes.style.display === 'block') {
            if (!painelSugestoes.contains(e.target) && e.target !== inputNatureza) {
                painelSugestoes.style.display = 'none';
            }
        }
    });

}
// =====================================================
//#endregion

//#region TEMA
// =====================================================

function alternarTema(){
    const body = document.body;
    const botao = document.getElementById("btnTema");
    const indoParaEscuro = body.getAttribute("data-theme") !== "dark";

    const aplicarNovoTema = () => {
        if (indoParaEscuro) {
            body.setAttribute("data-theme", "dark");
            localStorage.setItem("theme", "dark");
        } else {
            body.removeAttribute("data-theme");
            localStorage.setItem("theme", "light");
        }
        if (botao) {
            botao.setAttribute("aria-pressed", String(indoParaEscuro));
            botao.title = indoParaEscuro ? "Modo Claro" : "Modo Noturno";
        }
    };

    // Marca o ponto de origem (posição do botão) para a animação
    // circular de revelação ao trocar de tema.
    if (botao) {
        const rect = botao.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        document.documentElement.style.setProperty("--theme-toggle-x", `${x}px`);
        document.documentElement.style.setProperty("--theme-toggle-y", `${y}px`);
    }

    const semAnimacao = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (document.startViewTransition && !semAnimacao) {
        document.startViewTransition(aplicarNovoTema);
    } else {
        aplicarNovoTema();
    }
}
function aplicarTemaInicial() {

    const btn = document.getElementById("btnTema");
    const escuro = localStorage.getItem("theme") === "dark";

    if (escuro) {
        document.body.setAttribute("data-theme", "dark");
    }

    if (btn) {
        btn.setAttribute("aria-pressed", String(escuro));
        btn.title = escuro ? "Modo Claro" : "Modo Noturno";
    }
}
// =====================================================
//#endregion

//#region RESIZERS
// =====================================================

function inicializarResizer() {
    const layout = document.getElementById("htmlBody");
    
    // Referências das Colunas (Apenas Centro e Direita agora)
    const bodyFormulario = document.getElementById("bodyFormulario");
    const bodyDespacho = document.getElementById("bodyDespacho");
    
    // Referências dos Resizers
    const resizerDespacho = document.getElementById("resizerDespacho");

    if (!layout || !bodyFormulario || !bodyDespacho) return;

    // Configurações de limite
    const MIN_LATERAL = 250; 
    const MIN_CENTRO = 350;  

    bodyFormulario.style.width = "";
    bodyDespacho.style.width = ""; 

    // ==========================================
    // LAYOUT RESPONSIVO: abaixo do breakpoint de
    // empilhamento, limpa qualquer largura fixa
    // aplicada manualmente para que a coluna use
    // 100% da largura (regra definida em CSS).
    // ==========================================
    const BREAKPOINT_EMPILHAR = 1250;
    const sincronizarLayoutResponsivo = () => {
        if (window.innerWidth <= BREAKPOINT_EMPILHAR) {
            bodyFormulario.style.width = "";
            bodyDespacho.style.width = "";
        }
    };
    window.addEventListener("resize", sincronizarLayoutResponsivo);
    sincronizarLayoutResponsivo();

    // ==========================================
    // LÓGICA DO RESIZER DIREITO (Despacho)
    // ==========================================
    if (resizerDespacho && bodyDespacho) {
        let startX, startWidth, maxWidth;
        
        const onMouseMoveDespacho = (e) => {
            let newWidth = startWidth - (e.clientX - startX); // Invertido porque arrasta para a esquerda
            
            newWidth = Math.max(MIN_LATERAL, Math.min(newWidth, maxWidth));
            bodyDespacho.style.width = `${newWidth}px`;
        };
        
        const onMouseUpDespacho = () => {
            document.removeEventListener("mousemove", onMouseMoveDespacho);
            document.removeEventListener("mouseup", onMouseUpDespacho);
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
        };

        resizerDespacho.addEventListener("mousedown", (e) => {
            startX = e.clientX;
            startWidth = bodyDespacho.getBoundingClientRect().width;
            
            // Calcula o máximo que pode crescer pegando o espaço atual do centro
            const centroWidth = bodyFormulario.getBoundingClientRect().width;
            maxWidth = startWidth + (centroWidth - MIN_CENTRO);
            
            document.body.style.cursor = "col-resize";
            document.body.style.userSelect = "none";
            
            document.addEventListener("mousemove", onMouseMoveDespacho);
            document.addEventListener("mouseup", onMouseUpDespacho);
        });
    }
}

window.PainelRegistro = function(mostrar) {
    const painelRegistro = document.getElementById("bodyRegistro");
    const botoesRegistro = document.getElementById("painelBotoesRegistro");

    if (!painelRegistro || !botoesRegistro) return;

    if (mostrar) {
        // Exibe o painel em background primeiro
        painelRegistro.style.display = "flex";
        botoesRegistro.style.display = "flex";
        
        // Pequeno delay para acionar a transição CSS de Topo para Baixo
        setTimeout(() => {
            painelRegistro.classList.add("visivel");
            botoesRegistro.classList.add("visivel");
        }, 10);

    } else {
        // Envia o painel pra cima e esconde os botões
        painelRegistro.classList.remove("visivel");
        botoesRegistro.classList.remove("visivel");
        
        // Aguarda a animação acabar para ocultar e resetar as posições arrastadas
        setTimeout(() => {
            painelRegistro.style.display = "none";
            botoesRegistro.style.display = "none";
            
            // Reseta a posição embutida pelo "Drag&Drop" para a posição inicial de fábrica
            painelRegistro.style.top = "";
            painelRegistro.style.left = "";
            painelRegistro.style.transform = ""; 
        }, 400); 
    }
}
window.alternarColuneDireita = function(mostrarColunaDir) {
    const duasColunas = document.querySelector("#cardRegistro .painel-duas-colunas");
    const painelFlutuante = document.querySelector(".painel-flutuante");

    if (!duasColunas) return;

    duasColunas.classList.toggle("coluna-unica", !mostrarColunaDir);
    painelFlutuante?.classList.toggle("painel-compacto", !mostrarColunaDir);
};

window.PainelEdicao = function(mostrar, tempOccult = false){
    const botoesEditor = document.getElementById("painelBotoesEdicao");

    if (mostrar) {
        window.alterarVisibilidadeElemento("btnModoEdicao", false);
        botoesEditor.style.display = "flex";
        setTimeout(() => {
            botoesEditor.classList.add("visivel");
        }, 10);

    } else {
        const permissao = Number(window.nivelPermissaoUsuario) || 0;
        console.log("Checando permissão para exibir btnModoEdicao:", permissao);

        if (permissao >= 2 && !tempOccult) {
            window.alterarVisibilidadeElemento("btnModoEdicao", true);
        }

        botoesEditor.classList.remove("visivel");
        setTimeout(() => {
            botoesEditor.style.display = "none";
        }, 400); 
    }
}

window.entrarModoRegistro = function({ colunaDir = false, grid = false } = {}) {
    window.PainelRegistro(true);
    window.alternarColuneDireita(colunaDir);

    if (grid) {
        window.ativarGrid();
        if (window.grid) {
            window.grid.enableMove(true);
            window.grid.enableResize(true);
        }
    }

    window.ativarOutlines();
    window.ativarSortDrag();
    window.bloquearCateg(true);
    window.desabilitarBotoesAcoes();
};

window.sairModoRegistro = function({ grid = false } = {}) {
    window.PainelRegistro(false);
    window.alternarColuneDireita(false);

    if (grid) {
        window.desativarGrid();
        if (window.grid) {
            window.grid.enableMove(false);
            window.grid.enableResize(false);
        }
    }

    window.desativarOutlines();
    window.desativarSortDrag();
    window.bloquearCateg(false);
    window.habilitarBotoesAcoes();
};

// =====================================================
//#endregion

//#region Funções de uso Geral.
// =====================================================

window.resetarCategoria = function(){
    window.listaDeCategorias = [];
    window.categoriaSelecionada = null;
    db.carregarCategorias();
}
window.resetarFormulario = function(){
    window.limparGrid();
    if(window.estadoAtual === EstadoFluxo.EDITANDO) {
        return; 
    }
    window.desativarGrid();
    if (window.grid) {
        window.grid.enableMove(false);
        window.grid.enableResize(false);
    }
    window.desativarOutlines();
    window.desativarSortDrag();
}

window.alterarVisibilidadeElemento = function(id, condicao){
    const el = document.getElementById(id);
    if (!el) return;

    el.style.display = condicao ? "block" : "none";

    if (!condicao) {
        const campos = el.matches('input, textarea, select')
            ? [el, ...el.querySelectorAll('input, textarea, select')]
            : el.querySelectorAll('input, textarea, select');

        campos.forEach(campo => {
            if (campo.type === 'checkbox' || campo.type === 'radio') {
                campo.checked = false;
            } else {
                campo.value = "";
            }
        });
    }
}

let toastTimeout = null;
export function mostrarToast(mensagem, duracao = 2000) {
    const toast = document.getElementById("toastCopia");
    if (!toast) return;
    toast.textContent = mensagem;
    toast.classList.add("show");
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.remove("show");
    }, duracao);
}

window.mostrarToast = mostrarToast;

// =====================================================
//#endregion