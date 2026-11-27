document.addEventListener('DOMContentLoaded', () => {
    // 1. Elementos de Controle (Mostrar/Esconder)
    const btnToggleDados = document.getElementById('btnToggleDados');
    const containerDados = document.getElementById('containerDados');

    // 2. Inputs de Identificação e Localização
    const camposIds = ['nome', 'contato', 'cidade', 'bairro', 'endereco', 'numero', 'complemento'];
    const inputs = {};
    camposIds.forEach(id => {
        inputs[id] = document.getElementById(id);
    });

    // 3. Elementos do Despacho e Ações
    const resultadoDiv = document.getElementById('resultado');
    const btnCopiar = document.getElementById('copiarOutput');
    const btnLimpar = document.getElementById('limparOutput');

    function limparCamposDados() {
        camposIds.forEach(id => {
            if (inputs[id]) inputs[id].value = '';
        });
        atualizarCabecalhoDespacho();
    }

    // --- FUNÇÃO: MOSTRAR / ESCONDER COLUNA 1 ---
    if (btnToggleDados && containerDados) {
        containerDados.classList.add('oculto');
        btnToggleDados.textContent = '▶ Mostrar Identificação e Localização';

        btnToggleDados.addEventListener('click', () => {
            const estaOculto = containerDados.classList.toggle('oculto');
            btnToggleDados.textContent = estaOculto
                ? '▶ Mostrar Identificação e Localização'
                : '▼ Ocultar Identificação e Localização';

            if (estaOculto) {
                limparCamposDados();
            }
        });
    }

    // --- FUNÇÃO: ATUALIZAR CABEÇALHO NO RESULTADO DO DESPACHO ---
    function atualizarCabecalhoDespacho() {
        const nome = inputs.nome?.value.trim() || '';
        const contato = inputs.contato?.value.trim() || '';
        const cidade = inputs.cidade?.value.trim() || '';
        const bairro = inputs.bairro?.value.trim() || '';
        const endereco = inputs.endereco?.value.trim() || '';
        const numero = inputs.numero?.value.trim() || '';
        const complemento = inputs.complemento?.value.trim() || '';

        // Procura se já existe o bloco de cabeçalho dentro de #resultado
        let blocoCabecalho = resultadoDiv.querySelector('.bloco-cabecalho-resultado');

        // Monta as linhas apenas com o que foi preenchido
        let linhas = [];

        if (nome || contato) {
            let linhaId = [];
            if (nome) linhaId.push(`<strong>NOME:</strong> ${nome.toUpperCase()}`);
            if (contato) linhaId.push(`<strong>CONTATO:</strong> ${contato}`);
            linhas.push(linhaId.join(' | '));
        }

        // Monta o endereço completo de forma inteligente
        let partesEndereco = [];
        if (endereco) partesEndereco.push(endereco.toUpperCase());
        if (numero) partesEndereco.push(`Nº ${numero.toUpperCase()}`);
        if (complemento) partesEndereco.push(`(${complemento.toUpperCase()})`);
        if (bairro) partesEndereco.push(`- BAIRRO: ${bairro.toUpperCase()}`);
        if (cidade) partesEndereco.push(`- ${cidade.toUpperCase()}`);

        if (partesEndereco.length > 0) {
            linhas.push(`<strong>LOCALIZAÇÃO:</strong> ${partesEndereco.join(' ')}`);
        }

        // Se todos os campos estiverem vazios, remove o bloco do resultado
        if (linhas.length === 0) {
            if (blocoCabecalho) blocoCabecalho.remove();
            return;
        }

        // Se não existir ainda, cria no topo da #resultado sem apagar o resto do despacho
        if (!blocoCabecalho) {
            blocoCabecalho = document.createElement('div');
            blocoCabecalho.className = 'bloco-cabecalho-resultado';
            resultadoDiv.prepend(blocoCabecalho);
        }

        blocoCabecalho.innerHTML = linhas.join('<br>');
    }

    // Escuta a digitação em tempo real em todos os inputs
    camposIds.forEach(id => {
        if (inputs[id]) {
            inputs[id].addEventListener('input', atualizarCabecalhoDespacho);
        }
    });

    // --- FUNÇÃO: COPIAR OUTPUT COMPLETO (CABEÇALHO + DESPACHO) ---
    if (btnCopiar) {
        btnCopiar.addEventListener('click', () => {
            const textoParaCopiar = resultadoDiv.innerText.trim();

            if (!textoParaCopiar) {
                alert('O resultado do despacho está vazio!');
                return;
            }

            navigator.clipboard.writeText(textoParaCopiar).then(() => {
                const textoOriginal = btnCopiar.textContent;
                btnCopiar.textContent = 'Copiado! ✓';
                setTimeout(() => {
                    btnCopiar.textContent = textoOriginal;
                }, 2000);
            }).catch(err => {
                console.error('Erro ao copiar texto: ', err);
            });
        });
    }

    // --- FUNÇÃO: LIMPAR TUDO ---
    if (btnLimpar) {
        btnLimpar.addEventListener('click', () => {
            camposIds.forEach(id => {
                if (inputs[id]) inputs[id].value = '';
            });
            const selectSolicita = document.getElementById('solicita');
            if (selectSolicita) selectSolicita.value = '';

            resultadoDiv.innerHTML = '';
        });
    }
});