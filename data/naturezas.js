window.listaDeNaturezas = [];
window.naturezaRelacionada = null;

//#region EVENTOS
window.registrarNaturezaEventos = function(){

    window.registrar("buscarNatureza","input",(e) => window.pesquisarNatureza(e.target));

    document.addEventListener('scroll', () => {
        const painel = document.getElementById('sugestoesNaturezas');
        const input = document.getElementById('buscarNatureza');
        if (painel && input && painel.style.display === 'block') {
            posicionarPainelSugestoes(input, painel);
        }
    }, true);

    window.addEventListener('resize', () => {
        const painel = document.getElementById('sugestoesNaturezas');
        const input = document.getElementById('buscarNatureza');
        if (painel && input && painel.style.display === 'block') {
            posicionarPainelSugestoes(input, painel);
        }
    });

}
//#endregion

window.obterNatureza = function(naturezaAtual) {
    if (!naturezaAtual?.trim()) return null; 
    const termo = naturezaAtual.toLowerCase();
    return window.listaDeNaturezas?.find(n => n.natureza.toLowerCase() === termo) || null;
};

function posicionarPainelSugestoes(inputElement, painel) {
    const rect = inputElement.getBoundingClientRect();
    painel.style.position = "fixed";
    painel.style.top = `${rect.bottom + 4}px`;
    painel.style.left = `${rect.left}px`;
    painel.style.width = `${rect.width}px`;
}

window.pesquisarNatureza = function(inputElement) {
    const termo = inputElement?.value?.toLowerCase().trim() || "";
    const painel = document.getElementById('sugestoesNaturezas');

    if (!painel) return;

    if (painel.parentElement !== document.body) {
        document.body.appendChild(painel);
    }

    if (!termo) {
        painel.style.display = "none";
        painel.innerHTML = "";
        window.naturezaRelacionada = window.obterNatureza("");
        return;
    }

    const resultados = window.listaDeNaturezas?.filter(n => n.natureza.toLowerCase().includes(termo)) || [];

    if (resultados.length === 0) {
        painel.innerHTML = `<div style="padding: 10px; color: #888; font-size: 14px;">Nenhuma natureza encontrada...</div>`;
    } else {
        painel.innerHTML = resultados.map(n => `
            <div class="sugestao-item-busca" data-id="${n.id}" data-natureza="${n.natureza}">
                ${n.natureza}
            </div>
        `).join('');
    }

    posicionarPainelSugestoes(inputElement, painel);
    painel.style.display = "block";
};
