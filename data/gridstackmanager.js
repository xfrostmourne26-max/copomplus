document.addEventListener('DOMContentLoaded', () => {
    
    //#region VARIAVEIS

    const grid = GridStack.init({
        column: 12,
        cellHeight: 64,
        margin: 8,
        float: true,
        disableOneColumnMode: true
    });

    window.grid = grid;
    
    const gridEl = document.querySelector('.grid-stack');
    const btnGrid = document.getElementById('btnGrid');

    let cardIdCounter = 1;
    let gridVisual = false;
    let isDragOn = false;
    let isResizeEnabled = false;

    const createCardDOM = (id, htmlDiv, layout) => {
        const gridItem = document.createElement('div');
        gridItem.className = 'grid-stack-item';

        gridItem.setAttribute('gs-id', id);
        gridItem.setAttribute('gs-w', layout.w || 2);
        gridItem.setAttribute('gs-h', layout.h || 1);
        
        if (layout.x !== undefined && layout.x !== null) gridItem.setAttribute('gs-x', layout.x);
        if (layout.y !== undefined && layout.y !== null) gridItem.setAttribute('gs-y', layout.y);
        
        if (layout.autoPosition) gridItem.setAttribute('gs-auto-position', 'true');
        
        gridItem.setAttribute('gs-min-h', 1);
        gridItem.setAttribute('gs-min-w', 1);

        //determina os limites maximos que pode ser expandido horizontalmente (w) e verticalmente (h)
        // gridItem.setAttribute('gs-max-w', 12);
        // gridItem.setAttribute('gs-max-h', 4);

        gridItem.setAttribute('gs-resize-handles', 'e, w, s, se'); 

        if (layout.locked) gridItem.setAttribute('gs-locked', 'true');
        if (layout.noMove) gridItem.setAttribute('gs-no-move', 'true');
        if (layout.noResize) gridItem.setAttribute('gs-no-resize', 'true');

        gridItem.innerHTML = htmlDiv;
        return gridItem;
    };

    //#endregion
    
    //#region FUNÇÕES

    window.adicionarCard = function(htmlDiv, layout) {
        if (!grid) return null;
        const newId = cardIdCounter++;
        const myCardDOM = createCardDOM(newId, htmlDiv, layout);
        
        grid.el.appendChild(myCardDOM);
        grid.makeWidget(myCardDOM);
        
        atualizarInterfaceGrid(gridVisual);

        return myCardDOM;
    };
    window.removeCard = (item) => {
        if (item && grid) grid.removeWidget(item);
    };
    window.limparGrid = function() {
        if (grid) grid.removeAll();
        cardIdCounter = 1;
        
        atualizarInterfaceGrid(gridVisual);
    };

    window.alterarVisibilidadeElementoCard = function(idCard, deveOcultar) {
        if (!grid) return;
        
        // Busca o card no DOM usando o ID do GridStack
        const cardDOM = document.querySelector(`.grid-stack-item[gs-id="${idCard}"]`);
        if (!cardDOM) return;

        if (deveOcultar) {
            // Esconde e desativa cliques via CSS (seu ocultos.css cuida da interface visual)
            cardDOM.classList.add('card-bloqueado-oculto');
            
            // REGRA NOVA: Só tranca fisicamente o card se NÃO estivermos editando!
            if (typeof window.estadoAtual === 'undefined' || window.estadoAtual !== EstadoFluxo.EDITANDO) {
                grid.update(cardDOM, { locked: true, noMove: true, noResize: true });
            }
        } else {
            // Mostra novamente
            cardDOM.classList.remove('card-bloqueado-oculto');
            
            // Libera no GridStack
            grid.update(cardDOM, { locked: false, noMove: false, noResize: false });
        }
    };

    //#endregion

    //#region GRID VISUAL

    btnGrid.addEventListener('click', () => {
        gridVisual = !gridVisual;
        atualizarInterfaceGrid(gridVisual);
    });
    window.ativarGrid = () => {
        gridVisual = true;
        atualizarInterfaceGrid(gridVisual);
    };
    window.desativarGrid = () => {
        gridVisual = false;
        atualizarInterfaceGrid(gridVisual);
    };

    function atualizarInterfaceGrid(ativar) {
        if (!gridEl) return;
        gridEl.classList.toggle('visual-grid', ativar);
        
        // Liga/desliga a classe visual 'ativo' no botão
        if (btnGrid) {
            btnGrid.classList.toggle('ativo', ativar);
        }
    }

    //#endregion

});
