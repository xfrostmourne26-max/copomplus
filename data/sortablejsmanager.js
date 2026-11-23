document.addEventListener('DOMContentLoaded', () => {

    //#region VARIAVEIS
    const textEditor = document.getElementById('resultado'); 
    const btnOutlines = document.getElementById('btnOutlines');
    let sortables = []; 
    let mainSortable = null;
    let isOutlineOn = false;
    let isSortDragOn = false;
    //#endregion

    //#region INICIALIZADOR DO SORTABLEJS
    const onDragEnd = (evt) => {
        const item = evt.item;
        const prev = item.previousElementSibling;
        const next = item.nextElementSibling;

        let pesoPrev = prev ? parseFloat(prev.getAttribute('data-peso')) : null;
        let pesoNext = next ? parseFloat(next.getAttribute('data-peso')) : null;
        let novoPeso;

        if (pesoPrev !== null && pesoNext !== null) {
            novoPeso = (pesoPrev === pesoNext) ? pesoPrev + 0.1 : (pesoPrev + pesoNext) / 2;
        } else if (pesoPrev !== null) {
            novoPeso = pesoPrev + 1;
        } else if (pesoNext !== null) {
            novoPeso = pesoNext - 1;
        } else {
            novoPeso = 0; 
        }

        novoPeso = Math.round(novoPeso * 10000) / 10000;
        item.setAttribute('data-peso', novoPeso);

        atualizarBlocoTextoUI();
    };

    const initMainSortable = () => {
        if (mainSortable) mainSortable.destroy();
        mainSortable = new Sortable(textEditor, {
            group: 'lines',
            animation: 150,
            filter: '.locked-piece, .bloco-cabecalho-resultado, .bloco-rodape-resultado, .text-line',
            preventOnFilter: true,
            onEnd: onDragEnd
        });
    };

    const initLineSortable = (lineElement) => {
        const s = new Sortable(lineElement, {
            group: 'words',
            animation: 150,
            filter: '.locked-piece',
            direction: 'horizontal',
            onEnd: onDragEnd
        });
        sortables.push(s);
    };

    //essas linhas devem ficar BLOQUEADAS e nao devem ser permitidas o drag&drop de maneira alguma
    const criarLinhasDeContexto = () => {
        textEditor.innerHTML = '';
        sortables.forEach(s => s.destroy());
        sortables = [];

        // 1. Cabeçalho
        const header = document.createElement('div');
        header.id = 'despacho-header';
        header.className = 'bloco-cabecalho-resultado';
        textEditor.appendChild(header);

        // 2. Linhas do Sortable
        for (let i = 0; i <= 2; i++) {
            const line = document.createElement('div');
            line.className = 'text-line';
            line.setAttribute('data-contexto', i);
            textEditor.appendChild(line);
            initLineSortable(line);
        }

        // 3. Rodapé
        const footer = document.createElement('div');
        footer.id = 'despacho-footer';
        footer.className = 'bloco-rodape-resultado';
        textEditor.appendChild(footer);

        initMainSortable();

        if (typeof window.atualizarDisplayGlobais === 'function') {
            window.atualizarDisplayGlobais();
        }
    };

    const criarElementoTexto = (idCard, texto, contexto, ordemPeso) => {
        const piece = document.createElement('div');
        piece.className = 'text-piece';
        piece.setAttribute('data-card-id', idCard);
        piece.setAttribute('data-peso', ordemPeso);
        
        let deveBloquear = true;

        if (typeof EstadoFluxo !== 'undefined') {
            if (window.estadoAtual === EstadoFluxo.EDITANDO) {
                deveBloquear = false; // Se estiver EDITANDO, nenhum bloco é bloqueado
            } else if (window.estadoAtual === EstadoFluxo.COMPLEMENTANDO) {
                deveBloquear = (idCard !== 'bloco_complemento_output');
            } else if (window.estadoAtual === EstadoFluxo.CATEGORIZANDO) {
                deveBloquear = (idCard !== 'bloco_categoria_output');
            }
        } else {
            deveBloquear = (idCard !== 'bloco_complemento_output' && idCard !== 'bloco_categoria_output');
        }

        if (textEditor.classList.contains('modo-edicao-ativo')) {
            deveBloquear = false;
        }

        if (deveBloquear) {
            piece.classList.add('locked-piece');
        }
        
        piece.innerHTML = `
            <span class="idx-badge">0</span>
            <span class="content">${texto}</span><span class="suffix"></span>
        `;
        return piece;
    };
    //#endregion

    //#region MODO EDIÇÃO
    window.ativarModoEdicao = () => {
        const blocks = textEditor.querySelectorAll('.text-piece.locked-piece');
        blocks.forEach(block => block.classList.remove('locked-piece'));
        window.ativarSortDrag();
        textEditor.classList.add('modo-edicao-ativo'); 
        if (typeof window.atualizarDisplayGlobais === 'function') window.atualizarDisplayGlobais();
    };

    window.desativarModoEdicao = () => {
        const blocks = textEditor.querySelectorAll('.text-piece');
        blocks.forEach(block => {
            const idCard = block.getAttribute('data-card-id');
            let isGhost = false;
            
            if (typeof EstadoFluxo !== 'undefined') {
                if (window.estadoAtual === EstadoFluxo.COMPLEMENTANDO) isGhost = (idCard === 'bloco_complemento_output');
                else if (window.estadoAtual === EstadoFluxo.CATEGORIZANDO) isGhost = (idCard === 'bloco_categoria_output');
            }

            if (!isGhost) block.classList.add('locked-piece');
        });
        
        textEditor.classList.remove('modo-edicao-ativo');
        if (typeof window.atualizarDisplayGlobais === 'function') window.atualizarDisplayGlobais();
    };
    //#endregion

    //#region FUNÇÕES DE CRUD E UI
    window.addBlocoTexto = (idCard, texto, contexto = 0, ordemExibicao = null) => {
        const linha = textEditor.querySelector(`.text-line[data-contexto="${contexto}"]`);
        if (!linha) return;

        let blocoExistente = textEditor.querySelector(`.text-piece[data-card-id="${idCard}"]`);
        
        let pesoNovo;
        if (ordemExibicao !== null && ordemExibicao !== undefined) {
            pesoNovo = parseFloat(ordemExibicao);
        } else {
            if (typeof EstadoFluxo !== 'undefined' && window.estadoAtual === EstadoFluxo.CATEGORIZANDO) {
                pesoNovo = 0;
            } else {
                pesoNovo = 9999;
            }
        }

        const posicionarBloco = (bloco) => {
            bloco.setAttribute('data-peso', pesoNovo);
            const irmaos = Array.from(linha.querySelectorAll('.text-piece')).filter(b => b !== bloco);
            
            let inseriu = false;
            for (let i = 0; i < irmaos.length; i++) {
                const pesoIrmao = parseFloat(irmaos[i].getAttribute('data-peso') || 9999);
                if (pesoIrmao > pesoNovo) {
                    linha.insertBefore(bloco, irmaos[i]);
                    inseriu = true;
                    break;
                }
            }

            if (!inseriu) {
                linha.appendChild(bloco);
            }
        };

        if (blocoExistente) {
            blocoExistente.querySelector('.content').innerText = texto;

            if ((typeof EstadoFluxo !== 'undefined' && window.estadoAtual === EstadoFluxo.EDITANDO) || textEditor.classList.contains('modo-edicao-ativo')) {
                blocoExistente.classList.remove('locked-piece');
            }

            const pesoAtual = parseFloat(blocoExistente.getAttribute('data-peso') || 9999);
            if (pesoNovo !== pesoAtual) {
                posicionarBloco(blocoExistente);
            }
        } else {
            const novoBloco = criarElementoTexto(idCard, texto, contexto, pesoNovo);
            posicionarBloco(novoBloco);
        }

        atualizarBlocoTextoUI();
    };

    window.removerBlocoTexto = (idCard) => {
        const bloco = textEditor.querySelector(`.text-piece[data-card-id="${idCard}"]`);
        if (bloco) {
            bloco.remove();
            atualizarBlocoTextoUI();
        }
    };

    window.limparTodosBlocoTexto = () => {
        criarLinhasDeContexto();
    };

    const atualizarBlocoTextoUI = () => {
        const lines = textEditor.querySelectorAll('.text-line');
        let globalIndex = 0;

        lines.forEach(line => {
            const contextoId = line.getAttribute('data-contexto');
            const pieces = line.querySelectorAll('.text-piece');
            
            pieces.forEach((piece, idxFisicoNaTela) => {
                piece.setAttribute('data-ordem-contexto', contextoId);
                piece.setAttribute('data-ordem-exibicao', idxFisicoNaTela); 
                piece.setAttribute('data-index', globalIndex);
                
                const pesoAtual = piece.getAttribute('data-peso') || "0";
                const badge = piece.querySelector('.idx-badge');
                
                if (badge) badge.innerText = `${globalIndex} | ${pesoAtual}`;
                
                const suffix = piece.querySelector('.suffix');
                const sufixoSelecionado = ".";
                if (suffix) suffix.innerText = (idxFisicoNaTela === pieces.length - 1) ? sufixoSelecionado : ' ';
                
                globalIndex++;
            });
        });

        if (typeof window.atualizarDisplayGlobais === 'function') {
            window.atualizarDisplayGlobais();
        }
    };

    window.obterDadosDeCadaBlocoTexto = () => {
        const posicoes = [];
        const lines = document.querySelectorAll('#resultado .text-line');
        
        lines.forEach(line => {
            const contexto = parseInt(line.getAttribute('data-contexto'));
            line.querySelectorAll('.text-piece').forEach((piece) => {
                posicoes.push({
                    idCard: piece.getAttribute('data-card-id'),
                    data_contexto: contexto,
                    data_peso: parseFloat(piece.getAttribute('data-peso') || 0) 
                });
            });
        });
        return posicoes;
    };
    //#endregion

    //#region Drag, Drop & Outlines (Visuais)
    window.ativarSortDrag = () => {
        isSortDragOn = true;
        if (mainSortable) mainSortable.option('disabled', false);
        sortables.forEach(s => s.option('disabled', false));
        if (typeof window.atualizarDisplayGlobais === 'function') window.atualizarDisplayGlobais();
    };

    window.desativarSortDrag = () => {
        isSortDragOn = false;
        if (mainSortable) mainSortable.option('disabled', true);
        sortables.forEach(s => s.option('disabled', true));
        if (typeof window.atualizarDisplayGlobais === 'function') window.atualizarDisplayGlobais();
    };

    if (btnOutlines) {
        btnOutlines.addEventListener('click', () => {
            isOutlineOn = !isOutlineOn;
            textEditor.classList.toggle('show-outlines', isOutlineOn);
            btnOutlines.classList.toggle('ativo', isOutlineOn);
            if (typeof window.atualizarDisplayGlobais === 'function') window.atualizarDisplayGlobais();
        });
    }

    window.ativarOutlines = () => {
        isOutlineOn = true;
        textEditor.classList.add('show-outlines');
        if (btnOutlines) btnOutlines.classList.add('ativo');
        if (typeof window.atualizarDisplayGlobais === 'function') window.atualizarDisplayGlobais();
    };

    window.desativarOutlines = () => {
        isOutlineOn = false;
        textEditor.classList.remove('show-outlines');
        if (btnOutlines) btnOutlines.classList.remove('ativo');
        if (typeof window.atualizarDisplayGlobais === 'function') window.atualizarDisplayGlobais();
    };
    //#endregion

    criarLinhasDeContexto();
});