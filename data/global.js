window.solicitacoes = [];

document.addEventListener('DOMContentLoaded', () => {
    if (typeof window.updateSolicitacao === 'function') {
        window.updateSolicitacao();
    }

    const atualizarTudo = () => {
        window.atualizarDisplayGlobais();
        window.atualizarSufixosVisuais();
    };

    const selectSolicita = document.getElementById('solicita');
    if (selectSolicita) {
        selectSolicita.addEventListener('input', atualizarTudo);
        selectSolicita.addEventListener('change', atualizarTudo);
    }

    const obterRodape = () => {
        const rawValue = selectSolicita?.value ?? document.getElementById('solicita')?.value ?? "";
        let solicita = rawValue.replace(/\s+/g, ' ').trim();
        if (!solicita) return "";
        return solicita.endsWith('.') ? solicita : `${solicita}.`;
    };

    const obterLinhasDoCorpo = () => {
        return Array.from(document.querySelectorAll('#resultado .text-line'))
            .map(line => {
                const textos = Array.from(line.querySelectorAll('.text-piece .content'))
                    .map(el => el.innerText.trim())
                    .filter(Boolean);

                if (!textos.length) return null;
                return `${textos.join(' ').replace(/\s+([.,;:?!])/g, '$1')}.`;
            })
            .filter(Boolean);
    };

    window.atualizarDisplayGlobais = () => {
        const editor = document.getElementById('resultado');
        if (!editor) return;

        const isModoEdicao =
            editor.classList.contains('show-outlines') ||
            editor.classList.contains('modo-edicao-ativo');

        document.querySelectorAll('#resultado .text-line').forEach(line => {
            const hasContent = line.querySelectorAll('.text-piece').length > 0;
            line.style.display = (isModoEdicao || hasContent) ? "block" : "none";
            line.style.marginBottom = isModoEdicao ? "8px" : "0px";
            line.style.marginRight = "0px";
        });

        const footer = document.getElementById('despacho-footer');
        if (footer) {
            const rodapeTxt = obterRodape();
            footer.innerText = rodapeTxt;
            footer.style.whiteSpace = "nowrap";
            footer.style.display = rodapeTxt ? "block" : "none";
            footer.style.marginTop = isModoEdicao ? "10px" : "1.2em";
            footer.style.marginLeft = "0px";
        }
    };

    window.atualizarSufixosVisuais = () => {
        document.querySelectorAll('#resultado .text-line').forEach(line => {
            const pieces = line.querySelectorAll('.text-piece');
            pieces.forEach((piece, index) => {
                let suffixSpan = piece.querySelector('.suffix');
                if (!suffixSpan) {
                    suffixSpan = document.createElement('span');
                    suffixSpan.className = 'suffix';
                    piece.appendChild(suffixSpan);
                }
                suffixSpan.innerText = (index === pieces.length - 1) ? '.' : ' ';
            });
        });
    };

    window.obterTextoDoDespacho = () => {
        return [
            obterLinhasDoCorpo().join("\n"),
            obterRodape()
        ].filter(Boolean).join("\n");
    };

    window.atualizarDisplayGlobais();
});

window.renderizarSelectSolicitacao = () => {
    const select = document.getElementById('solicita');
    if (!select) return;

    const valorAtual = select.value;
    select.innerHTML = '<option value="">-- Solicitação --</option>';

    window.solicitacoes.forEach(({ texto }) => {
        const option = document.createElement('option');
        const textoLimpo = String(texto ?? '').replace(/\s+/g, ' ').trim();
        option.value = textoLimpo;
        option.textContent = textoLimpo;
        select.appendChild(option);
    });

    if (valorAtual) select.value = valorAtual;
};