import * as db from './database.js';

//#region EVENTOS
window.registrarAuthEventos = function(){

    const meuSupabase = db.supabaseClient;

    async function configurarAutenticacao() {
        try {
            await inicializarAuth(meuSupabase);
            escutarEstadoAutenticacao(meuSupabase);

            const btnAuth = document.getElementById('btnAuth');
            if (btnAuth) {
                btnAuth.addEventListener('click', (e) => {
                    e.preventDefault();
                    handleAuthClick(meuSupabase);
                });
            }

            const modalAuth = document.getElementById('modalAuth');
            const btnFecharModalAuth = document.getElementById('btnFecharModalAuth');

            if (btnFecharModalAuth && modalAuth) {
                btnFecharModalAuth.addEventListener('click', () => {
                    modalAuth.style.display = 'none';
                });
            }

            const btnAuthGoogle = document.getElementById('btnAuthGoogle');
            if (btnAuthGoogle) {
                btnAuthGoogle.addEventListener('click', () => {
                    iniciarLoginComProvedor(meuSupabase, 'google');
                });
            }

            const btnAuthOutlook = document.getElementById('btnAuthOutlook');
            if (btnAuthOutlook) {
                btnAuthOutlook.addEventListener('click', () => {
                    iniciarLoginComProvedor(meuSupabase, 'azure');
                });
            }

            const btnSignOut = document.getElementById('btnSignOut');
            if (btnSignOut) {
                btnSignOut.addEventListener('click', (e) => {
                    e.preventDefault();
                    handleSignOut(meuSupabase);
                });
            }

        } catch (error) {
            console.error("Erro crítico ao inicializar os botões de autenticação:", error);
        }
    }

    configurarAutenticacao();
}
//#endregion

const REDIRECT_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://127.0.0.1:5500/'
    : window.location.origin;

window.nivelPermissaoUsuario = 0;

export function escutarEstadoAutenticacao(supabase) {
    supabase.auth.onAuthStateChange((event, session) => {
        atualizarInterfaceUsuario(session);
    });
}

export async function inicializarAuth(supabase) {
    const { data: { session } } = await supabase.auth.getSession();
    atualizarInterfaceUsuario(session);
    return session;
}

function renderizarAvatar(avatarUrl, nomeOuEmail) {
    const btnAuth = document.getElementById('btnAuth');
    const panelAvatarContainer = document.getElementById('panelAvatarContainer');
    const panelBanner = document.getElementById('userPanelBanner');

    const iniciais = (nomeOuEmail || '??').substring(0, 2).toUpperCase();

    if (avatarUrl) {
        if (btnAuth) btnAuth.innerHTML = `<img src="${avatarUrl}" alt="Perfil" class="img-perfil-auth">`;
        if (panelAvatarContainer) panelAvatarContainer.innerHTML = `<img src="${avatarUrl}" alt="Perfil">`;
        if (panelBanner) {
            panelBanner.style.backgroundImage = `url('${avatarUrl}')`;
            panelBanner.classList.remove('banner-default');
        }
    } else {
        if (btnAuth) btnAuth.innerHTML = `<div class="img-perfil-auth avatar-iniciais">${iniciais}</div>`;
        if (panelAvatarContainer) panelAvatarContainer.innerHTML = `<div class="avatar-iniciais">${iniciais}</div>`;
        if (panelBanner) {
            panelBanner.style.backgroundImage = 'none';
            panelBanner.classList.add('banner-default');
        }
    }

    if (btnAuth) btnAuth.setAttribute('title', 'Abrir Painel do Usuário');
}

async function sincronizarFotoOutlook(session) {
    if (session.user.app_metadata?.provider !== 'azure') return null;
    if (!session.provider_token) return null;

    try {
        const resp = await fetch('https://graph.microsoft.com/v1.0/me/photo/$value', {
            headers: { Authorization: `Bearer ${session.provider_token}` }
        });

        if (!resp.ok) return null;

        const blob = await resp.blob();
        const caminho = `${session.user.id}/foto.jpg`;

        const { error: erroUpload } = await db.supabaseClient.storage
            .from('avatares')
            .upload(caminho, blob, { upsert: true, contentType: blob.type || 'image/jpeg' });

        if (erroUpload) {
            console.warn('Erro ao salvar foto do Outlook no Storage:', erroUpload);
            return null;
        }

        const { data: urlPublica } = db.supabaseClient.storage
            .from('avatares')
            .getPublicUrl(caminho);

        return urlPublica?.publicUrl || null;

    } catch (e) {
        console.warn('Não foi possível buscar a foto do Outlook:', e);
        return null;
    }
}

export async function verificarPermissaoUsuario() {
    const elementos = {
        btnComp: document.getElementById("btnComplemento"),
        btnCateg: document.getElementById("btnNovaCategoria"),
        btnEdit: document.getElementById("btnModoEdicao"),
        txtCargo: document.getElementById("usuarioCargo")
    };

    if (elementos.btnComp) elementos.btnComp.style.display = "none";
    if (elementos.btnCateg) elementos.btnCateg.style.display = "none";
    if (elementos.btnEdit) elementos.btnEdit.style.display = "none";
    if (elementos.txtCargo) elementos.txtCargo.textContent = "Visitante";
    window.nivelPermissaoUsuario = 0;

    try {
        const session = await db.getSessaoAtual();
        if (!session) return;

        const meta = session.user.user_metadata || {};
        let nomeCompleto = meta.full_name || meta.name || meta.user_name || meta.preferred_username || "";
        let avatarUrl = meta.avatar_url || meta.picture || null;

        if (!nomeCompleto && session.user.email) {
            let parteEmail = session.user.email.match(/^[^@.-_]+/)[0];
            nomeCompleto = parteEmail.charAt(0).toUpperCase() + parteEmail.slice(1);
        }

        let primeiroNome = nomeCompleto.split(" ")[0] || "";

        let { data: usuario, error } = await db.supabaseClient
            .from('usuarios')
            .select('nivel_permissao, nome_completo, avatar_url')
            .eq('id', session.user.id)
            .maybeSingle();

        if (error) throw error;

        if (!avatarUrl && !usuario?.avatar_url) {
            avatarUrl = await sincronizarFotoOutlook(session);
        }

        const avatarFinal = avatarUrl || usuario?.avatar_url || null;

        if (!usuario || usuario.nome_completo !== nomeCompleto || usuario.avatar_url !== avatarFinal) {
            const payloadUsuario = {
                id: session.user.id,
                email: session.user.email,
                nome_completo: nomeCompleto,
                avatar_url: avatarFinal
            };

            if (usuario) {
                payloadUsuario.nivel_permissao = usuario.nivel_permissao;
            }

            const { data: usuarioAtualizado, error: upsertError } = await db.supabaseClient
                .from('usuarios')
                .upsert(payloadUsuario, { onConflict: 'id' })
                .select('nivel_permissao')
                .single();

            if (!upsertError && usuarioAtualizado) {
                usuario = usuarioAtualizado;
            } else if (upsertError) {
                console.error("Erro ao sincronizar usuário na tabela:", upsertError);
            }
        }

        renderizarAvatar(avatarFinal, primeiroNome || session.user.email);

        const nivel = usuario ? usuario.nivel_permissao : 0;
        window.nivelPermissaoUsuario = nivel;

        if (elementos.txtCargo) {
            const cargos = ["Visitante", "Atendente", "Analista", "Supervisor", "Suporte", "Desenvolvedor"];
            const cargo = cargos[nivel] || "Visitante";
            elementos.txtCargo.textContent = primeiroNome ? `${cargo} — ${primeiroNome}` : cargo;
        }

        const safeParaExibicao = window.estadoAtual !== EstadoFluxo.CATEGORIZANDO && window.estadoAtual !== EstadoFluxo.COMPLEMENTANDO && window.estadoAtual !== EstadoFluxo.EDITANDO;

        if (nivel >= 2) {
            const categ = document.getElementById("categoria")?.value;
            const mostrarComp = categ && safeParaExibicao;
            if (elementos.btnComp && mostrarComp) elementos.btnComp.style.display = "flex";
            if (elementos.btnCateg && safeParaExibicao) elementos.btnCateg.style.display = "block";
        }

        if (nivel >= 3) {
            if(elementos.btnEdit && safeParaExibicao) elementos.btnEdit.style.display = "inline-block";
        }

    } catch (err) {
        console.error("Erro ao verificar permissões:", err);
    }
}

function atualizarInterfaceUsuario(session) {
    const btnAuth = document.getElementById('btnAuth');
    const userEmailText = document.getElementById('userEmail');
    const panelBanner = document.getElementById('userPanelBanner');
    const panelAvatarContainer = document.getElementById('panelAvatarContainer');

    if (!btnAuth) return;

    if (session) {
        const meta = session.user.user_metadata || {};
        const avatarUrl = meta.avatar_url || meta.picture || null;
        const email = session.user.email;
        const nomeOuEmail = meta.name || email;

        if (userEmailText) userEmailText.innerText = email;

        // Render rápido a partir dos metadados (Google já vem completo aqui; Outlook cai nas iniciais
        // até verificarPermissaoUsuario resolver a foto de verdade, se houver)
        renderizarAvatar(avatarUrl, nomeOuEmail);

    } else {
        if (userEmailText) userEmailText.innerText = '';
        if (panelBanner) {
            panelBanner.style.backgroundImage = 'none';
            panelBanner.classList.remove('banner-default');
        }
        if (panelAvatarContainer) panelAvatarContainer.innerHTML = '';

        btnAuth.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
            </svg>
        `;
        btnAuth.setAttribute('title', 'Fazer Login');
    }

    verificarPermissaoUsuario();
}

export async function handleAuthClick(supabase) {
    const session = await db.getSessaoAtual();
    if (!session) {
        const modal = document.getElementById('modalAuth');
        if (modal) modal.style.display = 'flex';
    } else {
        if (typeof window.alternarPainelUsuario === 'function') {
            window.alternarPainelUsuario();
        }
    }
}

export async function iniciarLoginComProvedor(supabase, provedor) {
    const { error } = await supabase.auth.signInWithOAuth({
        provider: provedor,
        options: {
            redirectTo: REDIRECT_URL,
            scopes: provedor === 'azure' ? 'email profile User.Read' : undefined
        }
    });

    if (error) {
        console.error(`Erro ao conectar com ${provedor}:`, error.message);
        alert(`Não foi possível conectar com o ${provedor}.`);
    }
}

export async function handleSignOut(supabase) {
    await supabase.auth.signOut();
    location.reload();
}