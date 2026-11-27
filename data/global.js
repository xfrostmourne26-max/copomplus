document.addEventListener('DOMContentLoaded', () => {
    // 1. Elementos de Controle (Mostrar / Esconder)
    const btnToggleDados = document.getElementById('btnToggleDados');
    const containerDados = document.getElementById('containerDados');

    // 2. Inputs de Identificação e Localização
    const camposIds = ['nome', 'contato', 'cidade', 'bairro', 'endereco', 'numero', 'complemento'];
    const inputs = {};
    camposIds.forEach(id => {
        inputs[id] = document.getElementById(id);
    });

    // 3. Select de Solicitação e Área de Resultado
    const selectSolicita = document.getElementById('solicita');
    const resultadoDiv = document.getElementById('resultado');

    // --- FUNÇÃO: LIMPAR CAMPOS GLOBAIS ---
    function limparCamposGlobais() {
        camposIds.forEach(id => {
            if (inputs[id]) inputs[id].value = '';
        });
        atualizarCabecalhoDespacho();
    }

    // --- FUNÇÃO: MOSTRAR / ESCONDER CAMPOS (INICIA OCULTO) ---
    if (btnToggleDados && containerDados) {
        containerDados.classList.add('oculto');
        btnToggleDados.textContent = '▶ Mostrar Identificação e Localização';

        btnToggleDados.addEventListener('click', () => {
            const estaOculto = containerDados.classList.toggle('oculto');
            btnToggleDados.textContent = estaOculto
                ? '▶ Mostrar Identificação e Localização'
                : '▼ Ocultar Identificação e Localização';

            if (estaOculto) {
                limparCamposGlobais();
            }
        });
    }

    // --- FUNÇÃO: ATUALIZAR CABEÇALHO / GLOBAIS NO RESULTADO DO DESPACHO ---
    function atualizarCabecalhoDespacho() {
        if (!resultadoDiv) return;

        const nome = inputs.nome?.value.trim() || '';
        const contato = inputs.contato?.value.trim() || '';
        const cidade = inputs.cidade?.value.trim() || '';
        const bairro = inputs.bairro?.value.trim() || '';
        const endereco = inputs.endereco?.value.trim() || '';
        const numero = inputs.numero?.value.trim() || '';
        const complemento = inputs.complemento?.value.trim() || '';
        const solicitacao = selectSolicita?.value?.trim() || '';

        let blocoCabecalho = resultadoDiv.querySelector('.bloco-cabecalho-resultado');
        const linhas = [];

        if (nome || contato) {
            const linhaId = [];
            if (nome) linhaId.push(`<strong>NOME:</strong> ${nome.toUpperCase()}`);
            if (contato) linhaId.push(`<strong>CONTATO:</strong> ${contato}`);
            linhas.push(linhaId.join(' | '));
        }

        const partesEndereco = [];
        if (endereco) partesEndereco.push(endereco.toUpperCase());
        if (numero) partesEndereco.push(`Nº ${numero.toUpperCase()}`);
        if (complemento) partesEndereco.push(`(${complemento.toUpperCase()})`);
        if (bairro) partesEndereco.push(`- BAIRRO: ${bairro.toUpperCase()}`);
        if (cidade) partesEndereco.push(`- ${cidade.toUpperCase()}`);

        if (partesEndereco.length > 0) {
            linhas.push(`<strong>LOCALIZAÇÃO:</strong> ${partesEndereco.join(' ')}`);
        }

        if (solicitacao) {
            linhas.push(`${solicitacao}`);
        }

        if (linhas.length === 0) {
            if (blocoCabecalho) blocoCabecalho.remove();
            return;
        }

        if (!blocoCabecalho) {
            blocoCabecalho = document.createElement('div');
            blocoCabecalho.className = 'bloco-cabecalho-resultado';
            resultadoDiv.prepend(blocoCabecalho);
        }

        blocoCabecalho.innerHTML = linhas.join('<br>');
    }

    // --- ESCUTA DIGITAÇÃO NOS INPUTS ---
    camposIds.forEach(id => {
        if (inputs[id]) {
            inputs[id].addEventListener('input', atualizarCabecalhoDespacho);
        }
    });

    // --- ESCUTA SELEÇÃO EM #solicita ---
    if (selectSolicita) {
        selectSolicita.addEventListener('change', () => {
            atualizarCabecalhoDespacho();
            window.gerarDespacho?.();
        });
    }

    // Sincroniza quando o despacho atualiza os campos globais
    window.atualizarDisplayGlobais = function () {
        atualizarCabecalhoDespacho();
    };

    window.atualizarCabecalhoDespacho = atualizarCabecalhoDespacho;
    window.limparCamposGlobais = limparCamposGlobais;
});