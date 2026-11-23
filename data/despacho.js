//#region EVENTOS
window.registrarDespachoEventos = function(){
    window.registrar("copiarOutput", "click", window.copiarTexto);
    window.registrar("limparOutput", "click", () => window.limparPagina(false, false, false));  
}
//#endregion

let naturezasDosTexosExibidos = [];

window.gerarDespacho = function() {
    const txtResultado = document.getElementById("resultado");
    if (!txtResultado) return;

    let blocosParaAdicionar = [];
    naturezasDosTexosExibidos = [];

    const dadosCategoria = coletarDadosDaCategoriaAtual();
    const dadosCampos = coletarCamposDaCategoria(window.camposDaCategoria || []);
    const dadosListas = coletarListasDaCategoria(window.listasDaCategoria || []);

    blocosParaAdicionar = blocosParaAdicionar.concat(dadosCategoria.blocos, dadosCampos.blocos, dadosListas.blocos);
    naturezasDosTexosExibidos = naturezasDosTexosExibidos.concat(dadosCategoria.naturezas, dadosCampos.naturezas, dadosListas.naturezas);

    blocosParaAdicionar.sort((a, b) => {
        if (a.ordemContexto !== b.ordemContexto) return a.ordemContexto - b.ordemContexto;
        return a.ordemExibicao - b.ordemExibicao;
    });

    blocosParaAdicionar.forEach((bloco, index) => {
        if (!bloco.aditivoTexto || !bloco.aditivoPosicao) return;

        if (bloco.aditivoPosicao === 'antes') {
            const anterior = blocosParaAdicionar[index - 1];
            if (anterior && anterior.ordemContexto === bloco.ordemContexto) {
                bloco.texto = `${bloco.aditivoTexto} ${bloco.texto}`;
            }
        } else if (bloco.aditivoPosicao === 'depois') {
            const proximo = blocosParaAdicionar[index + 1];
            if (proximo && proximo.ordemContexto === bloco.ordemContexto) {
                bloco.texto = `${bloco.texto} ${bloco.aditivoTexto}`;
            }
        }
    });

    blocosParaAdicionar.forEach(bloco => {
        window.addBlocoTexto(bloco.idUnico, bloco.texto, bloco.ordemContexto, bloco.ordemExibicao);
    });

    if (window.estadoAtual === EstadoFluxo.CATEGORIZANDO) {
        gerarTextoCateg();
        if (window.naturezaRelacionada && window.naturezaRelacionada.id) {
            naturezasDosTexosExibidos.push(window.naturezaRelacionada.id);
        }
    } else if (window.estadoAtual === EstadoFluxo.COMPLEMENTANDO) {
        gerarTextoComplemento();
        if (window.naturezaRelacionada && window.naturezaRelacionada.id) {
            naturezasDosTexosExibidos.push(window.naturezaRelacionada.id);
        }
    }

    atualizarPainelDeProbabilidades(naturezasDosTexosExibidos);

    if (typeof window.atualizarDisplayGlobais === 'function') window.atualizarDisplayGlobais();
    if (typeof window.atualizarSufixosVisuais === 'function') window.atualizarSufixosVisuais();
};

function gerarTextoCateg(){
    
    const idCategoria = "bloco_categoria_output"

    if(window.textoNovaCategoria){
        window.addBlocoTexto(idCategoria, window.textoNovaCategoria, 0, null);
        setTimeout(() => {
            const el = document.querySelector(`.text-piece[data-card-id="${idCategoria}"]`);
            if (el) {
                el.style.outline = "2px solid #a855f7";
                el.style.outlineOffset = "-1px";
                el.style.borderRadius = "4px";
            }
        }, 50);
    }
    else{
        window.removerBlocoTexto(idCategoria);
    }
    
}
function gerarTextoComplemento() {
    const formCriarOpcao = document.getElementById("cardRegistro");
    const idFantasma = "bloco_complemento_output";
    
    if (formCriarOpcao && formCriarOpcao.style.display !== "none") {
        let textoFantasma = document.getElementById("inputTextoResultado")?.value.trim();
        const tipoFantasma = document.getElementById("complementoTipo")?.value;

        if (textoFantasma) {
            let adicionarAoDespacho = true;
            
            let previewInput = null;
            if (window.cardPreview) {
                previewInput = window.cardPreview.querySelector('input, select, textarea');
            }

            if (tipoFantasma === "bool") {
                adicionarAoDespacho = true; 
            }

            if (adicionarAoDespacho) {
                if (tipoFantasma === "integer" || tipoFantasma === "inputfield" || tipoFantasma === "dropdown") {
                    
                    let valorSimulado = "";

                    if (tipoFantasma === "dropdown") {
                        const valorNomeOpcao = document.getElementById("inputNomeOpcao")?.value.trim();
                        
                        if (valorNomeOpcao) {
                            valorSimulado = valorNomeOpcao;
                        } else if (previewInput && previewInput.options && previewInput.options.length > 0 && previewInput.selectedIndex >= 0) {
                            valorSimulado = previewInput.options[previewInput.selectedIndex].text;
                        }
                    } 
                    else if (previewInput) {
                        valorSimulado = previewInput.value;
                        if (tipoFantasma === "integer" || tipoFantasma === "quantidade") {
                            valorSimulado = valorSimulado.replace(/-/g, '');
                        }
                    }

                    if (!valorSimulado || valorSimulado.trim() === "") valorSimulado = "'...'";

                    if (textoFantasma.toLowerCase().includes("{valor}")) {
                        textoFantasma = textoFantasma.replace(/{valor}/gi, valorSimulado);
                    } else {
                        if (tipoFantasma !== "dropdown") {
                            textoFantasma = `${textoFantasma} ${valorSimulado}`;
                        }
                    }
                }
                
                let ctxFantasma = 0;
                let exibirFantasma = null;

                const ctxInput = document.getElementById("ordemContextoInput")?.value;
                
                if (ctxInput !== undefined && ctxInput !== "") {
                    ctxFantasma = window.parseOrdem ? window.parseOrdem(ctxInput) : parseInt(ctxInput);
                }
                if (isNaN(ctxFantasma) || ctxFantasma === null) ctxFantasma = 0;

                const blocoExistente = document.querySelector(`.text-piece[data-card-id="${idFantasma}"]`);
                
                if (blocoExistente) {
                    ctxFantasma = parseInt(blocoExistente.getAttribute('data-ordem-contexto') || ctxFantasma);
                    exibirFantasma = parseFloat(blocoExistente.getAttribute('data-peso') || 0);
                } 
                else {
                    if (window.posicaoSugeridaProximaOpcao) {
                        ctxFantasma = window.posicaoSugeridaProximaOpcao.contexto;
                        exibirFantasma = window.posicaoSugeridaProximaOpcao.peso;
                    } else {
                        const linhaAlvo = document.querySelector(`.text-line[data-contexto="${ctxFantasma}"]`);
                        
                        if (linhaAlvo) {
                            const irmaos = Array.from(linhaAlvo.querySelectorAll('.text-piece'))
                                                .filter(b => b.getAttribute('data-card-id') !== idFantasma);
                            
                            let maiorPeso = -1;
                            irmaos.forEach(bloco => {
                                const peso = parseFloat(bloco.getAttribute('data-peso') || 0);
                                if (!isNaN(peso) && peso > maiorPeso) {
                                    maiorPeso = peso;
                                }
                            });

                            exibirFantasma = maiorPeso >= 0 ? maiorPeso + 1 : 0;
                        } else {
                            exibirFantasma = 0;
                        }
                    }
                }

                const aditivoTextoFantasma = document.getElementById("inputAditivoTexto")?.value.trim();
                const aditivoPosicaoFantasma = document.getElementById("selectAditivoPosicao")?.value;

                if (aditivoTextoFantasma && aditivoPosicaoFantasma) {
                    const linhaAlvo = document.querySelector(`.text-line[data-contexto="${ctxFantasma}"]`);
                    const irmaos = linhaAlvo
                        ? Array.from(linhaAlvo.querySelectorAll('.text-piece')).filter(b => b.getAttribute('data-card-id') !== idFantasma)
                        : [];

                    if (aditivoPosicaoFantasma === 'antes') {
                        const temAntes = irmaos.some(b => parseFloat(b.getAttribute('data-peso') || 0) < exibirFantasma);
                        if (temAntes) textoFantasma = `${aditivoTextoFantasma} ${textoFantasma}`;
                    } else if (aditivoPosicaoFantasma === 'depois') {
                        const temDepois = irmaos.some(b => parseFloat(b.getAttribute('data-peso') || 0) > exibirFantasma);
                        if (temDepois) textoFantasma = `${textoFantasma} ${aditivoTextoFantasma}`;
                    }
                }

                window.addBlocoTexto(idFantasma, textoFantasma, ctxFantasma, exibirFantasma);

                setTimeout(() => {
                    const el = document.querySelector(`.text-piece[data-card-id="${idFantasma}"]`);
                    if (el) {
                        el.style.outline = "2px solid #a855f7";
                        el.style.outlineOffset = "-1px";
                        el.style.borderRadius = "4px";
                    }
                }, 50);

            } else {
                window.removerBlocoTexto(idFantasma);
            }
        } else {
             window.removerBlocoTexto(idFantasma);
        }
    } else {
        window.removerBlocoTexto(idFantasma);
    }
}

function coletarDadosDaCategoriaAtual() {
    let blocos = [];
    let naturezas = [];

    const categoriaAtual = window.categoriaSelecionada;

    if (categoriaAtual) {
        if (categoriaAtual.texto_output) {
            blocos.push({
                idUnico: "bloco_categoria_output", 
                texto: categoriaAtual.texto_output,
                ordemContexto: window.parseOrdem(categoriaAtual.data_contexto),
                ordemExibicao: window.parseOrdem(categoriaAtual.data_peso)
            });
        } else {
            window.removerBlocoTexto("bloco_categoria_output");
        }

        if (categoriaAtual.natureza_id) {
            naturezas.push(categoriaAtual.natureza_id);
        }
    } else {
        window.removerBlocoTexto("bloco_categoria_output");
    }

    return { blocos, naturezas };
}
function coletarCamposDaCategoria(campos) {
    let blocos = [];
    let naturezas = [];

    campos.forEach((campo) => {
        if (campo.tipo_campo === "dropdown") return;

        const el = document.getElementById(`campo_${campo.id}`);
        const gridItem = el?.closest('.grid-stack-item');

        if (el && gridItem && !gridItem.classList.contains('card-condicional-oculto')) {
            let valor = "";
            let temValor = false;

            if (el.type === 'checkbox') {
                temValor = el.checked;
            } else {
                valor = el.value.trim();
                
                if (campo.tipo_campo === "integer" || campo.tipo_campo === "quantidade") {
                    valor = valor.replace(/-/g, '');
                }
                
                temValor = valor !== "";
            }

            if (temValor) {
                if (campo.texto_output) {

                    let texto = campo.texto_output;

                    if (texto.toLowerCase().includes("{valor}")) {
                        texto = texto.replace(/{valor}/gi, valor);
                    } 
                    else if (campo.tipo_campo === "integer" || campo.tipo_campo === "inputfield" || campo.tipo_campo === "quantidade") {
                        texto = `${texto} ${valor}`;
                    }

                    blocos.push({
                        idUnico: `campo_${campo.id}`,
                        texto: texto,
                        ordemContexto: window.parseOrdem(campo.data_contexto),
                        ordemExibicao: window.parseOrdem(campo.data_peso),
                        aditivoTexto: campo.aditivo_texto || null,
                        aditivoPosicao: campo.aditivo_posicao || null
                    });
                }
                
                if (campo.natureza_id) {
                    naturezas.push(campo.natureza_id);
                }
            } else {
                window.removerBlocoTexto(`campo_${campo.id}`);
            }
        } else {
            window.removerBlocoTexto(`campo_${campo.id}`);
        }
    });

    return { blocos, naturezas };
}
function coletarListasDaCategoria(listas) {
    let blocos = [];
    let naturezas = [];

    listas.forEach((lista) => {
        const opcoes = lista.opcoes || [];
        
        opcoes.forEach(op => window.removerBlocoTexto(`opcao_${op.id}`));

        const el = document.getElementById(`lista_${lista.id}`);
        const gridItem = el?.closest('.grid-stack-item');

        if (el && gridItem && !gridItem.classList.contains('card-condicional-oculto')) {
            const selectedOptionValue = el.value;
            
            if (selectedOptionValue && selectedOptionValue !== "") {
                const opcaoSelecionada = opcoes.find(o => String(o.id) === String(selectedOptionValue));
                
                if (opcaoSelecionada) {
                    if (opcaoSelecionada.texto_output) {
                        blocos.push({
                            idUnico: `opcao_${opcaoSelecionada.id}`,
                            texto: opcaoSelecionada.texto_output,
                            ordemContexto: window.parseOrdem(opcaoSelecionada.data_contexto),
                            ordemExibicao: window.parseOrdem(opcaoSelecionada.data_peso),
                            aditivoTexto: opcaoSelecionada.aditivo_texto || null,
                            aditivoPosicao: opcaoSelecionada.aditivo_posicao || null
                        });
                    }
                    
                    const naturezaIDValida = opcaoSelecionada.natureza_id || lista.natureza_id;
                    if (naturezaIDValida) {
                        naturezas.push(naturezaIDValida);
                    }
                }
            }
        }
    });

    return { blocos, naturezas };
}

function atualizarPainelDeProbabilidades(arrayDeNaturezasIds) {
    const painel = document.getElementById('painelSugestoes');
    const ul = document.getElementById('listaSugestoes');
    if (!painel || !ul) return; 

    ul.innerHTML = "";
    const totalValidos = arrayDeNaturezasIds.length;

    if (totalValidos === 0) {
        painel.style.display = 'none';
        return;
    }

    // Conta a repetição de cada ID de natureza
    let contagemNaturezas = {};
    arrayDeNaturezasIds.forEach(idNat => {
        const idStr = String(idNat);
        contagemNaturezas[idStr] = (contagemNaturezas[idStr] || 0) + 1;
    });

    const listaNaturezas = window.listaDeNaturezas || [];
    let arrayResultados = [];
    
    // Calcula as porcentagens
    for (let idNat in contagemNaturezas) {
        let infoNat = listaNaturezas.find(n => String(n.id) === idNat);
        let nomeNatureza = infoNat ? infoNat.natureza : "Natureza Indefinida";
        let porcentagem = ((contagemNaturezas[idNat] / totalValidos) * 100).toFixed(0);

        arrayResultados.push({
            nome: nomeNatureza,
            porcentagem: Number(porcentagem)
        });
    }

    // Ordena do maior % para o menor
    arrayResultados.sort((a, b) => b.porcentagem - a.porcentagem);

    // Renderiza na tela
    arrayResultados.forEach(item => {
        const li = document.createElement('li');
        li.innerHTML = `[${item.porcentagem}%] <strong>${item.nome}</strong>`;
        ul.appendChild(li);
    });

    painel.style.display = 'block';
}

window.parseOrdem = (valor) => {
    if (valor === null || valor === undefined || valor === "") return 0;
    const num = Number(valor);
    return isNaN(num) ? 0 : num;
};

// =====================================================
// BOTOES DO DESPACHO
// =====================================================

window.copiarTexto = function() {
    const textoParaCopiar = window.obterTextoDoDespacho();
    if (!textoParaCopiar || textoParaCopiar.trim() === "") return;
    navigator.clipboard.writeText(textoParaCopiar).then(() => {
        if (typeof mostrarToast === "function") mostrarToast("Texto copiado com sucesso!");
    }).catch(err => console.error("Erro ao copiar o texto: ", err));
}

//LIMPA A PAGINA INTEIRA
window.limparPagina = function(muted = false, ignorarCateg = true, ignorarGlobals = true) {
    document.querySelectorAll("input, select, textarea").forEach(el => {
        if (ignorarCateg && el.id === "categoria") return;
        if (ignorarGlobals && (el.id === "nome" || el.id === "contato" || el.id === "endereco" || el.id === "referencia" || el.id === "solicita")) return;

        if (el.type === "checkbox" || el.type === "radio") {
            el.checked = false;
        } else if (el.tagName.toLowerCase() === "select") {
            el.selectedIndex = 0;
        } else {
            el.value = "";
        }
    });
    
    if (typeof window.atualizarDisplayGlobais === 'function') window.atualizarDisplayGlobais();
    if (typeof window.atualizarSufixosVisuais === 'function') window.atualizarSufixosVisuais();
    if (typeof window.limparTodosBlocoTexto === "function") window.limparTodosBlocoTexto();
    if (typeof window.atualizarFormulario === "function") window.atualizarFormulario();

    window.resetarFormulario();

    if(!ignorarCateg){
        window.alterarVisibilidadeElemento("btnComplemento", false);
        if (window.estadoAtual === EstadoFluxo.COMPLEMENTANDO) window.fecharNovoComplemento();
        window.resetarCategoria();
    }

    if (typeof mostrarToast === "function" && !muted) mostrarToast("Limpando página...");
}

window.desabilitarBotoesAcoes = function() {
    const btnCopiar = document.getElementById("copiarOutput");
    const btnLimpar = document.getElementById("limparOutput");

    if (btnCopiar) btnCopiar.disabled = true;
    if (btnLimpar) btnLimpar.disabled = true;
}
window.habilitarBotoesAcoes = function() {
    const btnCopiar = document.getElementById("copiarOutput");
    const btnLimpar = document.getElementById("limparOutput");

    if (btnCopiar) btnCopiar.disabled = false;
    if (btnLimpar) btnLimpar.disabled = false;
}