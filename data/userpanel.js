//#region ÍCONES E UTILITÁRIOS DE LIKE
const ICONE_LIKE_OUTLINE = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;
const ICONE_LIKE_PREENCHIDO = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;

// Monta o badge de like de um item, já considerando permissão e se o usuário logado já curtiu
function renderBadgeLikes(item, meusLikes) {
    const totalLikes = item.likes || 0;
    const jaCurtiu = meusLikes instanceof Set && meusLikes.has(`${item.tipo_base}:${item.id}`);
    const icone = jaCurtiu ? ICONE_LIKE_PREENCHIDO : ICONE_LIKE_OUTLINE;

    // Visitantes (nível 0) não podem curtir - mostra só o número, sem botão
    if (!(window.nivelPermissaoUsuario >= 1)) {
        return `<div class="badge-likes" title="Faça login para curtir">
            ${icone}
            <span class="contagem-likes">${totalLikes}</span>
        </div>`;
    }

    return `<button type="button" class="badge-likes btn-like ${jaCurtiu ? 'like-ativo' : ''}" data-tipo="${item.tipo_base}" data-id="${item.id}" title="${jaCurtiu ? 'Remover like' : 'Dar like'}">
        ${icone}
        <span class="contagem-likes">${totalLikes}</span>
    </button>`;
}

window.ativarBotoesLike = function(container, aoAlternarLike) {
    container.querySelectorAll('.btn-like').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (btn.disabled) return;
            btn.disabled = true;

            const tipo = btn.dataset.tipo;
            const id = btn.dataset.id;
            const resultado = await window.alternarLike(tipo, id);

            if (resultado !== null) {
                btn.innerHTML = `${resultado.curtido ? ICONE_LIKE_PREENCHIDO : ICONE_LIKE_OUTLINE}<span class="contagem-likes">${resultado.total}</span>`;
                btn.classList.toggle('like-ativo', resultado.curtido);
                btn.title = resultado.curtido ? 'Remover like' : 'Dar like';

                btn.classList.add('like-dado');
                setTimeout(() => btn.classList.remove('like-dado'), 400);

                if (typeof aoAlternarLike === 'function') aoAlternarLike(id, resultado.total, resultado.curtido);
            } else {
                alert('Não foi possível curtir este item. Verifique sua permissão ou tente novamente.');
            }

            btn.disabled = false;
        });
    });
};
//#endregion

//#region CONTROLE DO PAINEL
window.abrirPainelUsuario = function() {
    const painel = document.getElementById('painelUsuario');
    if (painel) painel.classList.add('aberto');
};

window.fecharPainelUsuario = function() {
    const painel = document.getElementById('painelUsuario');
    if (painel) painel.classList.remove('aberto');
    window.fecharPainelRecentes();
    window.fecharPainelLeaderboards();
};

window.alternarPainelUsuario = function() {
    const painel = document.getElementById('painelUsuario');
    if (painel) {
        if (painel.classList.contains('aberto')) {
            window.fecharPainelUsuario();
        } else {
            window.abrirPainelUsuario();
        }
    }
};

window.fecharPainelRecentes = function() {
    const overlay = document.getElementById('overlayRecentes');
    if (overlay) overlay.classList.remove('aberto');

    const filtroPeriodo = document.getElementById('filtroPeriodo');
    const filtroTipo = document.getElementById('filtroTipo');
    const filtroOrdenacao = document.getElementById('filtroOrdenacao');
    const buscaNome = document.getElementById('buscaRecentesNome');
    if (filtroPeriodo) filtroPeriodo.value = '3dias';
    if (filtroTipo) filtroTipo.value = 'todos';
    if (filtroOrdenacao) filtroOrdenacao.value = 'recentes';
    if (buscaNome) buscaNome.value = '';
};

window.fecharPainelLeaderboards = function() {
    const overlay = document.getElementById('overlayLeaderboards');
    if (overlay) overlay.classList.remove('aberto');
};
window.fecharPainelUsuarioDetalhe = function() {
    const overlay = document.getElementById('overlayUsuarioDetalhe');
    if (overlay) overlay.classList.remove('aberto');
};
//#endregion

//#region EVENTOS
window.registrarUserEventos = function() {
    document.getElementById('btnRecentes')?.addEventListener('click', window.mostrarRecentes);
    document.getElementById('btnFecharRecentes')?.addEventListener('click', window.fecharPainelRecentes);

    document.getElementById('overlayRecentes')?.addEventListener('click', (e) => {
        if (e.target.id === 'overlayRecentes') {
            window.fecharPainelRecentes();
        }
    });

    document.addEventListener('click', (e) => {
        const painelUsuario = document.getElementById('painelUsuario');
        const btnAuth = document.getElementById('btnAuth');

        if (painelUsuario && painelUsuario.classList.contains('aberto')) {
            const clicouDentroDoPainel = painelUsuario.contains(e.target);
            const clicouNoBtnAuth = btnAuth && btnAuth.contains(e.target);
            const clicouEmOverlay = e.target.closest('.recentes-overlay, .leaderboards-overlay');

            if (!clicouDentroDoPainel && !clicouNoBtnAuth && !clicouEmOverlay) {
                window.fecharPainelUsuario();
            }
        }
    });

    document.getElementById('btnLeaderboards')?.addEventListener('click', window.mostrarLeaderboards);
    document.getElementById('btnFecharLeaderboards')?.addEventListener('click', window.fecharPainelLeaderboards);
    document.getElementById('overlayLeaderboards')?.addEventListener('click', (e) => {
        if (e.target.id === 'overlayLeaderboards') window.fecharPainelLeaderboards();
    });

    document.getElementById('btnFecharUsuarioDetalhe')?.addEventListener('click', window.fecharPainelUsuarioDetalhe);
    document.getElementById('overlayUsuarioDetalhe')?.addEventListener('click', (e) => {
        if (e.target.id === 'overlayUsuarioDetalhe') window.fecharPainelUsuarioDetalhe();
    });

    document.getElementById('btnVoltarLeaderboards')?.addEventListener('click', () => {
        window.fecharPainelUsuarioDetalhe();
        window.mostrarLeaderboards();
    });
};
//#endregion

//#region RECENTES
window.mostrarRecentes = async function() {
    const overlay = document.getElementById('overlayRecentes');
    if (!overlay) return;

    const filtroPeriodo = document.getElementById('filtroPeriodo');
    const filtroTipo = document.getElementById('filtroTipo');
    const buscaNome = document.getElementById('buscaRecentesNome');
    if (filtroPeriodo) filtroPeriodo.value = '3dias';
    if (filtroTipo) filtroTipo.value = 'todos';
    if (buscaNome) buscaNome.value = '';

    overlay.classList.add('aberto');
    const body = document.getElementById('bodyRecentes');
    body.innerHTML = '<div style="padding:20px; text-align:center;">Carregando atividades...</div>';

    try {
        const [mapaUsers, todosDados, meusLikes] = await Promise.all([
            window.getUsuariosMap(),
            window.getTodasAtividades(),
            window.getMeusLikes()
        ]);

        const aplicarFiltros = () => {
            const periodo = document.getElementById('filtroPeriodo').value;
            const tipoFiltro = document.getElementById('filtroTipo').value;
            const ordenacao = document.getElementById('filtroOrdenacao')?.value || 'recentes';
            const termoBusca = (document.getElementById('buscaRecentesNome')?.value || '').trim().toLowerCase();
            const agora = new Date();

            let filtrados = todosDados.filter(item => {
                const dataItem = window.arrumarDataAtividade(item.criado_em);

                if (periodo === '3dias') {
                    const d = new Date(); d.setDate(agora.getDate() - 3);
                    if (dataItem < d) return false;
                } else if (periodo === 'semana') {
                    const d = new Date(); d.setDate(agora.getDate() - 7);
                    if (dataItem < d) return false;
                } else if (periodo === 'mes') {
                    if (dataItem.getMonth() !== agora.getMonth()) return false;
                }

                if (tipoFiltro !== 'todos') {
                    if (tipoFiltro.startsWith('campo_')) {
                        const tipoReal = tipoFiltro.split('_')[1];
                        if (item.tipo_base !== 'Campo' || item.sub_tipo !== tipoReal) return false;
                    } else {
                        if (item.tipo_base !== tipoFiltro) return false;
                    }
                }

                if (termoBusca) {
                    const nomeDoItem = (item.nome || item.nome_campo || item.valor_opcao || '').toLowerCase();
                    if (!nomeDoItem.includes(termoBusca)) return false;
                }

                return true;
            });

            if (ordenacao === 'likes') {
                filtrados.sort((a, b) => (b.likes || 0) - (a.likes || 0));
            } else {
                filtrados.sort((a, b) => window.arrumarDataAtividade(b.criado_em) - window.arrumarDataAtividade(a.criado_em));
            }

            if (filtrados.length === 0) {
                body.innerHTML = '<div style="padding:20px; text-align:center; color:#666;">Nenhuma atividade encontrada neste filtro.</div>';
                return;
            }

            body.innerHTML = filtrados.map(item => {
                const nomeDoItem = item.nome || item.nome_campo || item.valor_opcao || 'Item sem nome';
                const nomeCriador = mapaUsers[item.criado_por] || item.criado_por || 'Desconhecido';
                const nomeEditor = item.editado_por ? (mapaUsers[item.editado_por] || item.editado_por) : null;

                const dataFormatada = window.formatarDataBR(item.criado_em);

                let nomeTag = item.tipo_base;
                if (item.tipo_base === 'Campo' && item.sub_tipo) {
                    nomeTag = `Campo: ${item.sub_tipo}`;
                }

                const linhaCategoria = item.categoria_nome ? `
                    <div class="info-linha" style="color: #8e44ad; font-weight: 500; margin-bottom: 6px;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                        Pertence à Categoria: ${item.categoria_nome}
                    </div>
                ` : '';

                return `
                <div class="card-recente">
                    <div class="card-header-flex">
                        <div class="nome-item">${nomeDoItem}</div>
                        <div style="display:flex; align-items:center; gap:6px;">
                            ${renderBadgeLikes(item, meusLikes)}
                            <div class="tipo-tag">${nomeTag}</div>
                        </div>
                    </div>

                    ${linhaCategoria}

                    <div class="info-linha">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        Criado em ${dataFormatada}
                    </div>
                    <div class="info-linha">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                        Por: <strong>${nomeCriador}</strong>
                    </div>
                    ${nomeEditor ? `
                    <div class="info-linha" style="color: #d35400; margin-top: 8px; border-top: 1px dashed #eee; padding-top: 8px;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        Editado por: ${nomeEditor}
                    </div>` : ''}
                </div>
                `;
            }).join('');

            window.ativarBotoesLike(body, (id, novoTotal) => {
                const item = todosDados.find(i => String(i.id) === String(id));
                if (item) item.likes = novoTotal;
            });
        };

        document.getElementById('filtroPeriodo').onchange = aplicarFiltros;
        document.getElementById('filtroTipo').onchange = aplicarFiltros;
        document.getElementById('filtroOrdenacao').onchange = aplicarFiltros;
        if (buscaNome) buscaNome.oninput = aplicarFiltros;

        aplicarFiltros();

    } catch (e) {
        console.error(e);
        body.innerHTML = `<div style="color:red; padding:20px;">Erro ao carregar dados: ${e.message}</div>`;
    }
};
//#endregion

//#region LEADERBOARDS

function gerarIniciais(nome) {
    if (!nome) return '?';
    const partes = nome.trim().split(' ');
    if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase();
    return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

function renderCardLeaderboard(usuario, posicao) {
    const avatarHtml = usuario.avatar
        ? `<img src="${usuario.avatar}" alt="${usuario.nome}" class="leaderboard-avatar-img">`
        : `<div class="leaderboard-avatar-fallback">${gerarIniciais(usuario.nome)}</div>`;

    const rankHtml = posicao
        ? `<div class="leaderboard-rank">#${posicao}</div>`
        : `<div class="leaderboard-rank leaderboard-rank-dev">DEV</div>`;

    return `
    <div class="card-leaderboard">
        ${rankHtml}
        ${avatarHtml}
        <div class="leaderboard-info">
            <div class="leaderboard-nome">${usuario.nome}</div>
            <div class="leaderboard-stats">
                <span class="stat-item stat-likes">${ICONE_LIKE_OUTLINE} ${usuario.totalLikes} Likes</span>
                <span class="stat-item stat-registros">📄 ${usuario.totalRegistros} Registros</span>
            </div>
        </div>
        <button class="btn-expandir-usuario" data-userid="${usuario.id}">Ver Registros</button>
    </div>
    `;
}

window.mostrarLeaderboards = async function() {
    const overlay = document.getElementById('overlayLeaderboards');
    if (!overlay) return;

    window.fecharPainelRecentes();

    const filtro = document.getElementById('filtroLeaderboard');
    if (filtro) filtro.value = 'likes';

    overlay.classList.add('aberto');
    const body = document.getElementById('bodyLeaderboards');
    body.innerHTML = '<div style="padding:20px; text-align:center;">Carregando leaderboard...</div>';

    try {
        const usuariosStats = await window.getLeaderboardData();

        const renderizar = () => {
            const modo = document.getElementById('filtroLeaderboard').value;
            const comparador = modo === 'registros'
                ? (a, b) => b.totalRegistros - a.totalRegistros
                : (a, b) => b.totalLikes - a.totalLikes;

            const normais = usuariosStats.filter(u => (u.nivel ?? 0) < 5).sort(comparador);
            const devs = usuariosStats.filter(u => (u.nivel ?? 0) >= 5).sort(comparador);

            if (normais.length === 0 && devs.length === 0) {
                body.innerHTML = '<div style="padding:20px; text-align:center; color:#666;">Nenhum usuário com registros ainda.</div>';
                return;
            }

            let html = normais.map((usuario, index) => renderCardLeaderboard(usuario, index + 1)).join('');

            if (devs.length > 0) {
                html += `<div class="leaderboard-divisor"><span>...</span></div>`;
                html += devs.map(usuario => renderCardLeaderboard(usuario, null)).join('');
            }

            body.innerHTML = html;

            body.querySelectorAll('.btn-expandir-usuario').forEach(btn => {
                btn.addEventListener('click', () => {
                    const usuario = usuariosStats.find(u => u.id === btn.dataset.userid);
                    if (usuario) {
                        window.fecharPainelLeaderboards();
                        window.mostrarDetalheUsuario(usuario);
                    }
                });
            });
        };

        document.getElementById('filtroLeaderboard').onchange = renderizar;
        renderizar();

    } catch (e) {
        console.error(e);
        body.innerHTML = `<div style="color:red; padding:20px;">Erro ao carregar leaderboard: ${e.message}</div>`;
    }
};

window.mostrarDetalheUsuario = async function(usuario) {
    const overlay = document.getElementById('overlayUsuarioDetalhe');
    if (!overlay) return;

    document.getElementById('tituloUsuarioDetalhe').textContent = `Registros de ${usuario.nome}`;

    const filtroPeriodoDet = document.getElementById('filtroPeriodoDetalhe');
    const filtroTipoDet = document.getElementById('filtroTipoDetalhe');
    if (filtroPeriodoDet) filtroPeriodoDet.value = 'todos';
    if (filtroTipoDet) filtroTipoDet.value = 'todos';

    overlay.classList.add('aberto');
    const body = document.getElementById('bodyUsuarioDetalhe');
    body.innerHTML = '<div style="padding:20px; text-align:center;">Carregando registros...</div>';

    const meusLikes = await window.getMeusLikes();

    const aplicarFiltrosDetalhe = () => {
        const periodo = document.getElementById('filtroPeriodoDetalhe')?.value || 'todos';
        const tipoFiltro = document.getElementById('filtroTipoDetalhe')?.value || 'todos';
        const agora = new Date();

        let filtrados = usuario.registros.filter(item => {
            const dataItem = window.arrumarDataAtividade(item.criado_em);

            if (periodo === '3dias') {
                const d = new Date(); d.setDate(agora.getDate() - 3);
                if (dataItem < d) return false;
            } else if (periodo === 'semana') {
                const d = new Date(); d.setDate(agora.getDate() - 7);
                if (dataItem < d) return false;
            } else if (periodo === 'mes') {
                if (dataItem.getMonth() !== agora.getMonth()) return false;
            }

            if (tipoFiltro !== 'todos') {
                if (tipoFiltro.startsWith('campo_')) {
                    const tipoReal = tipoFiltro.split('_')[1];
                    if (item.tipo_base !== 'Campo' || item.sub_tipo !== tipoReal) return false;
                } else {
                    if (item.tipo_base !== tipoFiltro) return false;
                }
            }

            return true;
        });

        filtrados.sort((a, b) => (b.likes || 0) - (a.likes || 0));

        if (filtrados.length === 0) {
            body.innerHTML = '<div style="padding:20px; text-align:center; color:#666;">Nenhum registro encontrado neste filtro.</div>';
            return;
        }

        body.innerHTML = filtrados.map(item => {
            const nomeDoItem = item.nome || item.nome_campo || item.valor_opcao || 'Item sem nome';
            let nomeTag = item.tipo_base;
            if (item.tipo_base === 'Campo' && item.sub_tipo) {
                nomeTag = `Campo: ${item.sub_tipo}`;
            }
            const dataFormatada = window.formatarDataBR(item.criado_em);

            return `
            <div class="card-recente">
                <div class="card-header-flex">
                    <div class="nome-item">${nomeDoItem}</div>
                    <div style="display:flex; align-items:center; gap:6px;">
                        ${renderBadgeLikes(item, meusLikes)}
                        <div class="tipo-tag">${nomeTag}</div>
                    </div>
                </div>
                ${item.categoria_nome ? `<div class="info-linha" style="color: #8e44ad;">Pertence à Categoria: ${item.categoria_nome}</div>` : ''}
                <div class="info-linha">Criado em ${dataFormatada}</div>
            </div>
            `;
        }).join('');

        window.ativarBotoesLike(body, (id, novoTotal) => {
            const item = usuario.registros.find(i => String(i.id) === String(id));
            if (item) item.likes = novoTotal;
        });
    };

    if (filtroPeriodoDet) filtroPeriodoDet.onchange = aplicarFiltrosDetalhe;
    if (filtroTipoDet) filtroTipoDet.onchange = aplicarFiltrosDetalhe;

    aplicarFiltrosDetalhe();
};
//#endregion