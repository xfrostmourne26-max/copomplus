const SUPABASE_URL = "https://nlcwlixlaupficvekqcd.supabase.co";
const SUPABASE_KEY = "sb_publishable_sr2AxvtVjV6jQGjj-lXCVw_hX2AJUBO";
export const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==========================================
// HELPERS DE VALIDAÇÃO (BIGINT / IDs)
// ==========================================
function parseIdBigInt(valor) {
    if (valor === null || valor === undefined) return null;
    if (typeof valor === "boolean" || typeof valor === "object") return null;

    const str = String(valor).trim();
    if (!/^\d+$/.test(str)) return null;

    const num = Number(str);
    if (!Number.isSafeInteger(num) || num <= 0) return null;

    return num;
}

// ==========================================
// UTILS
// ==========================================
export async function getSessaoAtual() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    return session;
}

async function getUsuarioIdLogado() {
    const session = await getSessaoAtual();
    return session?.user?.id || null;
}

export async function getNomePeloUUID(uuid) {
    if (!uuid) return "Sistema";
    try {
        const { data, error } = await supabaseClient
            .from('usuarios')
            .select('nome_completo')
            .eq('id', uuid)
            .single();
        if (error) throw error;
        return data?.nome_completo || "Desconhecido";
    } catch (err) {
        console.error("Erro ao buscar nome do usuário:", err);
        return "Desconhecido";
    }
}

window.formatarDataBR = function(dataStr) {
    if (!dataStr) return '—';
    const data = new Date(dataStr);
    if (isNaN(data.getTime())) return '—';
    return data.toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: 'America/Sao_Paulo'
    });
};

window.arrumarDataAtividade = function(dataStr) {
    if (!dataStr) return new Date(0);

    const data = new Date(dataStr);

    if (isNaN(data.getTime())) {
        console.warn('criado_em inválido ou em formato inesperado:', dataStr);
        return new Date(0);
    }

    return data;
};

window.getUsuariosMap = async function() {
    const { data, error } = await supabaseClient
        .from('usuarios')
        .select('id, nome_completo');

    if (error) {
        console.error("Erro ao buscar usuários:", error);
        return {};
    }

    const userMap = {};
    data.forEach(user => {
        userMap[user.id] = user.nome_completo;
    });
    return userMap;
};

window.getTodasAtividades = async function() {
    const [cat, campos, listas, opcoes] = await Promise.all([
        supabaseClient.from('categorias').select('*'),
        supabaseClient.from('campos_formulario').select('*'),
        supabaseClient.from('lista_formulario').select('*'),
        supabaseClient.from('lista_opcao').select('*')
    ]);

    const mapaCategorias = {};
    if (cat.data) {
        cat.data.forEach(c => {
            mapaCategorias[c.id] = c.nome;
        });
    }

    const mapaListas = {};
    if (listas.data) {
        listas.data.forEach(l => {
            mapaListas[l.id] = l.categoria_id;
        });
    }

    let tudo = [];

    if (cat.data) cat.data.forEach(i => tudo.push({ ...i, tipo_base: 'Categoria' }));
    if (campos.data) campos.data.forEach(i => {
        tudo.push({ ...i, tipo_base: 'Campo', sub_tipo: i.tipo_campo, categoria_nome: mapaCategorias[i.categoria_id] });
    });
    if (listas.data) listas.data.forEach(i => {
        tudo.push({ ...i, tipo_base: 'Lista de Formulário', categoria_nome: mapaCategorias[i.categoria_id] });
    });
    if (opcoes.data) opcoes.data.forEach(i => {
        const idDaCategoria = mapaListas[i.dropdown_id];
        tudo.push({ ...i, tipo_base: 'Opção de Lista', categoria_nome: mapaCategorias[idDaCategoria] });
    });

    return tudo;
};

window.getUsuariosDetalhados = async function() {
    const { data, error } = await supabaseClient
        .from('usuarios')
        .select('id, nome_completo, avatar_url, nivel_permissao');

    if (error) {
        console.error("Erro ao buscar usuários:", error);
        return {};
    }

    const userMap = {};
    data.forEach(user => {
        userMap[user.id] = {
            nome: user.nome_completo,
            avatar: user.avatar_url,
            nivel: user.nivel_permissao
        };
    });
    return userMap;
};

window.getLeaderboardData = async function() {
    const [usuarios, todasAtividades] = await Promise.all([
        window.getUsuariosDetalhados(),
        window.getTodasAtividades()
    ]);

    const statsPorUsuario = {};

    todasAtividades.forEach(item => {
        const criadorId = item.criado_por;
        if (!criadorId) return;

        if (!statsPorUsuario[criadorId]) {
            statsPorUsuario[criadorId] = {
                id: criadorId,
                nome: usuarios[criadorId]?.nome || 'Desconhecido',
                avatar: usuarios[criadorId]?.avatar || null,
                nivel: usuarios[criadorId]?.nivel ?? 0,
                totalLikes: 0,
                totalRegistros: 0,
                registros: []
            };
        }

        statsPorUsuario[criadorId].totalLikes += (item.likes || 0);
        statsPorUsuario[criadorId].totalRegistros += 1;
        statsPorUsuario[criadorId].registros.push(item);
    });

    return Object.values(statsPorUsuario);
};

window.getMeusLikes = async function() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return new Set();

    const { data, error } = await supabaseClient
        .from('likes_usuario')
        .select('item_tipo, item_id')
        .eq('usuario_id', user.id);

    if (error) {
        console.error('Erro ao buscar likes do usuário:', error);
        return new Set();
    }

    return new Set(data.map(l => `${l.item_tipo}:${l.item_id}`));
};

window.alternarLike = async function(tipoBase, itemId) {
    const mapaFuncoes = {
        'Categoria': 'toggle_like_categoria',
        'Campo': 'toggle_like_campo',
        'Lista de Formulário': 'toggle_like_lista',
        'Opção de Lista': 'toggle_like_opcao'
    };

    const nomeFuncao = mapaFuncoes[tipoBase];
    if (!nomeFuncao) {
        console.error('Tipo de item desconhecido para like:', tipoBase);
        return null;
    }

    const { data, error } = await supabaseClient.rpc(nomeFuncao, { item_id: itemId });

    if (error) {
        console.error('Erro ao curtir/descurtir:', error);
        return null;
    }

    return data; // { total, curtido }
};

//#region INSERTS
// ==========================================

export async function salvarNovaCategoria() {
    if (!window.nivelPermissaoUsuario || window.nivelPermissaoUsuario < 2) {
        window.mostrarToast("Ação não autorizada.");
        return false;
    }

    const dados = typeof window.entregarDadosNovaCategoria === "function"
        ? window.entregarDadosNovaCategoria()
        : null;

    if (!dados?.nomeCateg) {
        window.mostrarToast("Preencha o Nome da Categoria.");
        return false;
    }

    try {
        const usuarioAtualId = await getUsuarioIdLogado();
        const payloadCateg = {
            nome: dados.nomeCateg,
            texto_output: dados.textoResultado,
            data_contexto: dados.ordemContexto,
            data_peso: dados.ordemExibicao,
            criado_por: usuarioAtualId,
            natureza_id: parseIdBigInt(dados.natureza)
        };

        const { data: novaCateg, error: errCateg } = await supabaseClient
            .from('categorias')
            .insert([payloadCateg])
            .select()
            .single();

        if (errCateg) throw errCateg;

        await carregarCategorias();
        window.mostrarToast("Categoria Registrada!");
        return true;
    } catch (error) {
        alert(`Erro ao salvar Categoria no banco: ${error.message || error}`);
        return false;
    }
}

export async function salvarNovoComplemento() {
    if (!window.nivelPermissaoUsuario || window.nivelPermissaoUsuario < 2) {
        window.mostrarToast("Ação não autorizada.");
        return false;
    }

    const dados = typeof window.entregarDadosDoComplemento === "function"
        ? window.entregarDadosDoComplemento()
        : null;

    if (!dados) {
        window.mostrarToast("Não foi possível ler os dados do formulário.");
        return false;
    }

    const categoriaIdInt = parseIdBigInt(dados.categoriaId);
    if (!categoriaIdInt) {
        console.error("categoriaId inválido em salvarNovoComplemento:", dados.categoriaId, dados);
        window.mostrarToast("Selecione uma Categoria válida antes de salvar.");
        return false;
    }

    const ehListaNova = dados.tipoCampo === "dropdown" && dados.novoDropdown;

    if (ehListaNova) {
        if (!dados.nomeNovoDropdown) {
            window.mostrarToast("Preencha Categoria e o Nome da Lista!");
            return false;
        }
        if (dados.nomeCampo) {
            window.mostrarToast("Clique em 'Adicionar Opção' para incluir a opção que você digitou.");
            return false;
        }
        if (!dados.opcoesLista || dados.opcoesLista.length === 0) {
            window.mostrarToast("Adicione ao menos uma opção antes de registrar!");
            return false;
        }
    } else {
        if (!dados.tipoCampo || !dados.nomeCampo) {
            window.mostrarToast("Preencha Categoria, Tipo e Nome!");
            return false;
        }
    }

    let registroCriado = { tipo: null, id: null, idListaRelacionada: null, idsOpcoesExtras: [] };

    try {
        const usuarioAtualId = await getUsuarioIdLogado();
        let resultado = { sucesso: false };

        if (dados.tipoCampo === "dropdown") {
            resultado = await salvarLista({ ...dados, categoriaId: categoriaIdInt }, usuarioAtualId);
        } else {
            resultado = await salvarCampo({ ...dados, categoriaId: categoriaIdInt }, usuarioAtualId);
        }

        if (resultado.sucesso && resultado.novoCampo) {
            registroCriado = {
                tipo: dados.tipoCampo,
                id: resultado.novoCampo.id,
                idListaRelacionada: resultado.idListaRelacionada || null,
                idsOpcoesExtras: (resultado.opcoesInseridas || []).slice(1).map(o => o.id)
            };

            if (dados.tipoCampo === "dropdown") {
                window.mostrarToast(
                    resultado.listaExistente
                        ? "Opção(ões) registrada(s) e textos reordenados!"
                        : "Nova Lista registrada e textos reordenados!"
                );
            } else {
                window.mostrarToast("Novo Campo registrado e textos reordenados!");
            }

            if (typeof window.limparPagina === "function") {
                window.limparPagina(true);
            }
            await carregarDadosDaCategoria(categoriaIdInt);
            return true;
        }

        return false;
    } catch (error) {
        console.error("Erro no salvamento:", error);

        if (registroCriado.id) {
            console.log("Rollback: Deletando registro incompleto...");
            if (registroCriado.tipo === "dropdown") {
                await supabaseClient.from('lista_opcao').delete().eq('id', registroCriado.id);
                if (registroCriado.idsOpcoesExtras?.length) {
                    await supabaseClient.from('lista_opcao').delete().in('id', registroCriado.idsOpcoesExtras);
                }
                if (registroCriado.idListaRelacionada) {
                    await supabaseClient.from('lista_formulario').delete().eq('id', registroCriado.idListaRelacionada);
                }
            } else {
                await supabaseClient.from('campos_formulario').delete().eq('id', registroCriado.id);
            }
        }
        alert(`Operação cancelada. Detalhe: ${error.message || error}`);
        return false;
    }
}

async function salvarCampo(dados, idUsuario) {
    if (!dados) {
        alert("Dados não recebidos para criação do Campo");
        return { sucesso: false };
    }

    const categoriaIdInt = parseIdBigInt(dados.categoriaId);
    if (!categoriaIdInt) {
        console.error("categoriaId inválido em salvarCampo:", dados.categoriaId, dados);
        alert("Erro: ID da categoria inválido (NaN). Recarregue a página ou selecione outra categoria.");
        return { sucesso: false };
    }

    try {
        const payloadCampo = {
            categoria_id: categoriaIdInt,
            nome_campo: dados.nomeCampo,
            tipo_campo: dados.tipoCampo,
            texto_output: dados.textoResultado,
            aditivo_texto: dados.aditivoTexto,
            aditivo_posicao: dados.aditivoPosicao,
            data_contexto: dados.ordemContexto,
            data_peso: dados.ordemExibicao,
            oculto_ate: dados.ocultoAte || null,
            grid_x: dados.gridX,
            grid_y: dados.gridY,
            grid_w: dados.gridW,
            grid_h: dados.gridH,
            criado_por: idUsuario,
            natureza_id: parseIdBigInt(dados.natureza)
        };

        const { data: novoCampo, error: errCampo } = await supabaseClient
            .from('campos_formulario')
            .insert([payloadCampo])
            .select()
            .single();

        if (errCampo) throw errCampo;

        return { sucesso: true, novoCampo };
    } catch (error) {
        alert(`Erro ao salvar Campo no banco: ${error.message || error}`);
        return { sucesso: false };
    }
}

async function salvarLista(dados, idUsuario) {
    if (!dados) {
        alert("Dados não recebidos para criação da Lista");
        return { sucesso: false };
    }

    const categoriaIdInt = parseIdBigInt(dados.categoriaId);
    if (!categoriaIdInt) {
        console.error("categoriaId inválido em salvarLista:", dados.categoriaId, dados);
        alert("Erro ao salvar Lista no banco: categoria_id inválido (NaN).");
        return { sucesso: false };
    }

    const nomeLista = (dados.nomeDroproot ?? dados.nomeNovoDropdown ?? "").trim();
    if (!nomeLista) {
        alert("Erro ao salvar Lista no banco: nome da lista não informado.");
        return { sucesso: false };
    }

    let idListaCriadaParaRollback = null;

    try {
        let dropdownId = null;
        let listaExistente = false;

        const { data: listaExistenteData, error: errCheck } = await supabaseClient
            .from('lista_formulario')
            .select('id')
            .eq('valor_opcao', nomeLista)
            .eq('categoria_id', categoriaIdInt)
            .maybeSingle();

        if (errCheck) throw errCheck;

        if (listaExistenteData) {
            dropdownId = listaExistenteData.id;
            listaExistente = true;
        } else {
            // A regra de ocultamento (oculto_ate) fica só na LISTA - nunca nas opções abaixo
            const payloadLista = {
                valor_opcao: nomeLista,
                categoria_id: categoriaIdInt,
                oculto_ate: dados.ocultoAte || null,
                grid_x: dados.gridX,
                grid_y: dados.gridY,
                grid_w: dados.gridW,
                grid_h: dados.gridH,
                criado_por: idUsuario,
            };

            const { data: novaLista, error: errLista } = await supabaseClient
                .from('lista_formulario')
                .insert([payloadLista])
                .select()
                .single();

            if (errLista) throw errLista;

            dropdownId = novaLista.id;
            idListaCriadaParaRollback = novaLista.id;
        }

        const opcoesParaInserir = (dados.novoDropdown && dados.opcoesLista?.length)
            ? dados.opcoesLista.map(op => ({
                dropdown_id: dropdownId,
                nome_campo: op.nome,
                texto_output: op.textoResultado,
                data_contexto: op.ordemContexto,
                data_peso: op.ordemExibicao,
                criado_por: idUsuario,
                natureza_id: parseIdBigInt(op.naturezaId),
                aditivo_texto: op.aditivoTexto || null,
                aditivo_posicao: op.aditivoPosicao || null
            }))
            : [{
                dropdown_id: dropdownId,
                nome_campo: dados.nomeCampo,
                texto_output: dados.textoResultado,
                data_contexto: dados.ordemContexto,
                data_peso: dados.ordemExibicao,
                criado_por: idUsuario,
                natureza_id: parseIdBigInt(dados.natureza),
                aditivo_texto: dados.aditivoTexto || null,
                aditivo_posicao: dados.aditivoPosicao || null
            }];

        const { data: opcoesInseridas, error: errOpcao } = await supabaseClient
            .from('lista_opcao')
            .insert(opcoesParaInserir)
            .select();

        if (errOpcao) throw errOpcao;

        return {
            sucesso: true,
            novoCampo: opcoesInseridas[0],
            opcoesInseridas,
            idListaRelacionada: idListaCriadaParaRollback,
            listaExistente
        };
    } catch (error) {
        if (idListaCriadaParaRollback) {
            await supabaseClient.from('lista_formulario').delete().eq('id', idListaCriadaParaRollback);
        }
        alert(`Erro ao salvar Lista no banco: ${error.message || error}`);
        return { sucesso: false };
    }
}

// ==========================================
//#endregion

//#region SELECTS
// ==========================================

export async function carregarNaturezasCopom() {
    try {
        const { data, error } = await supabaseClient.from('naturezas_copom').select('id, natureza');
        if (!error && data) {
            window.listaDeNaturezas = data.map(n => ({ id: n.id, natureza: n.natureza }));
        }
    } catch (e) { console.error(e); }
}

function normalizarBusca(texto = "") {
    return String(texto)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

export async function carregarIndiceBuscaCategorias() {
    try {
        const [camposRes, listasRes, opcoesRes] = await Promise.all([
            supabaseClient.from('campos_formulario').select('categoria_id, nome_campo, texto_output'),
            supabaseClient.from('lista_formulario').select('id, categoria_id, valor_opcao'),
            supabaseClient.from('lista_opcao').select('dropdown_id, nome_campo, texto_output')
        ]);

        const termosPorCategoria = new Map();
        const addTermo = (catId, ...valores) => {
            const catIdInt = parseIdBigInt(catId);
            if (!catIdInt) return;
            const atual = termosPorCategoria.get(catIdInt) || [];
            valores.forEach(v => {
                const norm = normalizarBusca(v);
                if (norm) atual.push(norm);
            });
            termosPorCategoria.set(catIdInt, atual);
        };

        const listaParaCategoria = new Map();
        (listasRes.data || []).forEach(lista => {
            listaParaCategoria.set(lista.id, lista.categoria_id);
            addTermo(lista.categoria_id, lista.valor_opcao);
        });

        (camposRes.data || []).forEach(campo => {
            addTermo(campo.categoria_id, campo.nome_campo, campo.texto_output);
        });

        (opcoesRes.data || []).forEach(opcao => {
            const catId = listaParaCategoria.get(opcao.dropdown_id);
            addTermo(catId, opcao.nome_campo, opcao.texto_output);
        });

        window.listaDeCategorias = (window.listaDeCategorias || []).map(cat => {
            const termosExtras = termosPorCategoria.get(parseIdBigInt(cat.id)) || [];
            const termosCompletos = [
                normalizarBusca(cat.nome),
                normalizarBusca(cat.texto_output),
                ...termosExtras
            ].filter(Boolean);

            return {
                ...cat,
                _termosBusca: Array.from(new Set(termosCompletos)),
                _correspondenciasDetalhe: termosExtras
            };
        });
    } catch (err) {
        console.error("Erro ao indexar conteúdos das categorias para busca:", err);
    }
}

export async function carregarCategorias() {
    try {
        const { data, error } = await supabaseClient
            .from('categorias')
            .select('id, nome, texto_output, data_contexto, data_peso, natureza_id, criado_por, criado_em');

        if (error) throw error;

        window.listaDeCategorias = data || [];
        await carregarIndiceBuscaCategorias();
        window.renderizarSelectCategorias('nome');

    } catch (err) {
        console.error("Erro ao carregar categorias:", err.message);
    }
}

window.renderizarSelectCategorias = function(criterio = 'nome') {
    const select = document.getElementById("categoria");
    if (!select) return;

    const valorAtual = select.value;
    let categoriasOrdenadas = [...(window.listaDeCategorias || [])];

    if (criterio === 'nome') {
        categoriasOrdenadas.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
    } else if (criterio === 'id') {
        categoriasOrdenadas.sort((a, b) => Number(a.id) - Number(b.id));
    }

    select.innerHTML = '<option value="">-- Selecione uma Categoria --</option>';

    categoriasOrdenadas.forEach(cat => {
        const opt = document.createElement("option");
        opt.value = cat.id;
        opt.textContent = cat.nome;
        select.appendChild(opt);
    });

    if ([...select.options].some(o => o.value === valorAtual)) {
        select.value = valorAtual;
    } else {
        select.value = "";
    }
};

export async function carregarDadosDaCategoria(categoriaIdParam = null) {
    window.camposDaCategoria = [];
    window.listasDaCategoria = [];

    const rawCategoriaId = categoriaIdParam ?? document.getElementById("categoria")?.value;
    const categoriaId = parseIdBigInt(rawCategoriaId);

    if (!categoriaId) {
        console.warn("Categoria inválida ou não encontrada:", rawCategoriaId);
        if (typeof window.limparGrid === 'function') {
            window.limparGrid();
        }
        return;
    }

    // --- CAMPOS ---
    const { data: campos, error: campos_erro } = await supabaseClient
        .from('campos_formulario')
        .select(`
            id, categoria_id, nome_campo, tipo_campo, texto_output, 
            aditivo_texto, aditivo_posicao,
            data_contexto, data_peso, oculto_ate, criado_por,
            grid_x, grid_y, grid_w, grid_h, criado_em, natureza_id
        `)
        .eq('categoria_id', categoriaId);

    if (campos_erro) {
        console.error(campos_erro);
        return;
    }

    window.camposDaCategoria = campos || [];

    // --- LISTAS (DROPDOWNS) ---
    const { data: lista, error: lista_erro } = await supabaseClient
        .from('lista_formulario')
        .select(`
            id, valor_opcao, oculto_ate, grid_x, grid_y, 
            grid_w, grid_h, criado_por, criado_em
        `)
        .eq('categoria_id', categoriaId);

    if (lista_erro) {
        console.error(lista_erro);
        return;
    }

    if (!lista || lista.length === 0) {
        window.listasDaCategoria = [];
        if (typeof window.carregarCards === 'function') {
            window.carregarCards();
        }
        return;
    }

    const listaIds = lista.map(l => l.id);

    // --- OPÇÕES ---
    const { data: opcoes, error: opcoes_erro } = await supabaseClient
        .from('lista_opcao')
        .select(`
            id, dropdown_id, nome_campo, texto_output, 
            aditivo_texto, aditivo_posicao,
            data_contexto, data_peso, criado_por, natureza_id
        `)
        .in('dropdown_id', listaIds);

    if (opcoes_erro) {
        console.error(opcoes_erro);
        return;
    }

    window.listasDaCategoria = lista.map(itemLista => ({
        ...itemLista,
        opcoes: opcoes ? opcoes.filter(opcao => opcao.dropdown_id === itemLista.id) : []
    }));

    if (typeof window.carregarCards === 'function') {
        window.carregarCards();
    }
}
window.carregarDadosDaCategoria = carregarDadosDaCategoria;

export async function coletarDadosDoBanco(id, tabela) {
    const idInt = parseIdBigInt(id);
    if (!idInt || !tabela) {
        console.error("ID ou Tabela inválidos para coletarDadosDoBanco:", id, tabela);
        return null;
    }

    try {
        const { data, error } = await supabaseClient
            .from(tabela)
            .select('*')
            .eq('id', idInt)
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error(`Erro ao buscar dados na tabela ${tabela} (ID: ${idInt}):`, error);
        return null;
    }
}

// ==========================================
//#endregion

//#region DELETES
// ==========================================

export async function deletarCategoria(idCategoria) {
    if (!window.nivelPermissaoUsuario || window.nivelPermissaoUsuario < 2) {
        alert("Ação não autorizada.");
        return false;
    }

    const idInt = parseIdBigInt(idCategoria);
    if (!idInt) {
        alert("ID da categoria inválido.");
        return false;
    }

    try {
        console.log(`Iniciando exclusão da categoria ID ${idInt}`);

        const { error } = await supabaseClient
            .from('categorias')
            .delete()
            .eq('id', idInt);

        if (error) throw error;

        return true;
    } catch (error) {
        console.error("Erro no Supabase ao excluir categoria:", error);
        throw error;
    }
}

export async function deletarCampo(idItem, tabela, idDropdownPai = null) {
    if (!window.nivelPermissaoUsuario || window.nivelPermissaoUsuario < 2) {
        alert("Ação não autorizada.");
        return false;
    }

    const idInt = parseIdBigInt(idItem);
    const paiInt = parseIdBigInt(idDropdownPai);

    if (!idInt || !tabela) {
        alert("Parâmetros inválidos para exclusão.");
        return false;
    }

    try {
        console.log(`Iniciando exclusão do ID ${idInt} na tabela ${tabela}`);

        const { error: erroDelete } = await supabaseClient
            .from(tabela)
            .delete()
            .eq('id', idInt);

        if (erroDelete) throw erroDelete;

        if (tabela === 'lista_opcao' && paiInt) {
            console.log(`Verificando se o dropdown pai (ID ${paiInt}) ficou vazio...`);

            const { count, error: erroCount } = await supabaseClient
                .from('lista_opcao')
                .select('*', { count: 'exact', head: true })
                .eq('dropdown_id', paiInt);

            if (erroCount) throw erroCount;

            if (count === 0) {
                console.log(`Dropdown ID ${paiInt} está vazio. Excluindo lista_formulario...`);
                const { error: erroDeletePai } = await supabaseClient
                    .from('lista_formulario')
                    .delete()
                    .eq('id', paiInt);

                if (erroDeletePai) throw erroDeletePai;
            }
        }

        return true;
    } catch (error) {
        console.error("Erro no Supabase ao excluir campo:", error);
        throw error;
    }
}

// ==========================================
//#endregion

//#region UPDATES
// ==========================================

export async function atualizarCardsEmLote(tabela, arrayDeDados) {
    if (!arrayDeDados || arrayDeDados.length === 0) return true;

    const colunasPermitidas = {
        'campos_formulario': ['grid_x', 'grid_y', 'grid_w', 'grid_h', 'data_contexto', 'data_peso'],
        'lista_formulario': ['grid_x', 'grid_y', 'grid_w', 'grid_h'],
        'lista_opcao': ['data_contexto', 'data_peso']
    };

    try {
        const chavesValidas = colunasPermitidas[tabela];

        const promessasDeAtualizacao = arrayDeDados.map(item => {
            const itemId = parseIdBigInt(item?.id);
            if (!itemId) return Promise.resolve({ error: null });

            let objLimpo = {};

            if (chavesValidas) {
                Object.keys(item).forEach(key => {
                    if (chavesValidas.includes(key)) {
                        objLimpo[key] = item[key];
                    }
                });
            }

            if (Object.keys(objLimpo).length === 0) return Promise.resolve({ error: null });

            return supabaseClient
                .from(tabela)
                .update(objLimpo)
                .eq('id', itemId);
        });

        const resultados = await Promise.all(promessasDeAtualizacao);

        for (const resultado of resultados) {
            if (resultado.error) throw resultado.error;
        }

        console.log(`Dados atualizados com sucesso via UPDATE na tabela ${tabela}.`);
        return true;

    } catch (error) {
        console.error(`Erro ao atualizar lote na tabela ${tabela}:`, error);
        alert(`Erro de sincronização de layouts/dados: ${error.message}`);
        return false;
    }
}

export async function atualizarCategoriaDB(id, dados) {
    const idInt = parseIdBigInt(id);
    if (!idInt) {
        alert("ID da categoria inválido.");
        return false;
    }

    try {
        const usuarioAtualId = await getUsuarioIdLogado();

        const payloadCateg = {
            nome: dados.nomeCateg,
            texto_output: dados.textoResultado,
            editado_por: usuarioAtualId,
            natureza_id: parseIdBigInt(dados.natureza)
        };

        const { error } = await supabaseClient
            .from('categorias')
            .update(payloadCateg)
            .eq('id', idInt);

        if (error) throw error;
        return true;
    } catch (error) {
        alert(`Erro ao atualizar Categoria: ${error.message || error}`);
        return false;
    }
}

export async function atualizarCampoNormalDB(id, dados) {
    const idInt = parseIdBigInt(id);
    if (!idInt) {
        alert("ID do campo inválido.");
        return false;
    }

    try {
        const usuarioAtualId = await getUsuarioIdLogado();

        const payloadCampo = {
            nome_campo: dados.nomeCampo,
            texto_output: dados.textoResultado,
            aditivo_texto: dados.aditivoTexto || null,
            aditivo_posicao: dados.aditivoPosicao || null,
            oculto_ate: dados.ocultoAte || null,
            editado_por: usuarioAtualId,
            natureza_id: parseIdBigInt(dados.natureza)
        };

        const { error } = await supabaseClient
            .from('campos_formulario')
            .update(payloadCampo)
            .eq('id', idInt);

        if (error) throw error;
        return true;
    } catch (error) {
        alert(`Erro ao atualizar Campo: ${error.message || error}`);
        return false;
    }
}

export async function atualizarListaDB(id, dados) {
    const idInt = parseIdBigInt(id);
    if (!idInt) {
        alert("ID da lista inválido.");
        return false;
    }

    try {
        const usuarioAtualId = await getUsuarioIdLogado();

        const payloadLista = {
            valor_opcao: dados.nomeCampo,
            oculto_ate: dados.ocultoAte || null,
            editado_por: usuarioAtualId
        };

        const { error } = await supabaseClient
            .from('lista_formulario')
            .update(payloadLista)
            .eq('id', idInt);

        if (error) throw error;
        return true;
    } catch (error) {
        alert(`Erro ao atualizar Lista Root: ${error.message || error}`);
        return false;
    }
}

export async function atualizarOpcaoListaDB(id, dados) {
    const idInt = parseIdBigInt(id);
    if (!idInt) {
        alert("ID da opção inválido.");
        return false;
    }

    try {
        const usuarioAtualId = await getUsuarioIdLogado();

        const payloadOpcao = {
            nome_campo: dados.nomeCampo,
            texto_output: dados.textoResultado,
            aditivo_texto: dados.aditivoTexto || null,
            aditivo_posicao: dados.aditivoPosicao || null,
            editado_por: usuarioAtualId,
            natureza_id: parseIdBigInt(dados.natureza)
        };

        const { error } = await supabaseClient
            .from('lista_opcao')
            .update(payloadOpcao)
            .eq('id', idInt);

        if (error) throw error;
        return true;
    } catch (error) {
        alert(`Erro ao atualizar Opção da Lista: ${error.message || error}`);
        return false;
    }
}

// ==========================================
//#endregion

//#region SOLICITAÇÕES

window.updateSolicitacao = async function() {
    try {
        const { data, error } = await supabaseClient
            .from('solicitacoes')
            .select('*')
            .order('texto', { ascending: true });

        if (error) throw error;

        window.solicitacoes = data;
        console.log("Lista global atualizada:", window.solicitacoes);

        if (typeof window.renderizarSelectSolicitacao === 'function') {
            window.renderizarSelectSolicitacao();
        }
    } catch (error) {
        console.error("Erro ao carregar solicitações:", error);
    }
};

//#region SOLICITAÇÕES

window.updateSolicitacao = async function() {
    try {
        const { data, error } = await supabaseClient
            .from('solicitacoes')
            .select('*')
            .order('texto', { ascending: true });

        if (error) throw error;

        window.solicitacoes = data;
        console.log("Lista global atualizada:", window.solicitacoes);

        if (typeof window.renderizarSelectSolicitacao === 'function') {
            window.renderizarSelectSolicitacao();
        }
    } catch (error) {
        console.error("Erro ao carregar solicitações:", error);
    }
};

// FUNÇÃO PARA ADICIONAR NOVA SOLICITAÇÃO NO BANCO
window.addSolicitacao = async function(texto) {
    if (!texto) return;
    if (!window.nivelPermissaoUsuario || window.nivelPermissaoUsuario < 2) {
        console.warn("Usuario não autorizado a criar solicitações.");
        return;
    }

    try {
        // Formata para maiúsculo (padrão do seu sistema)
        const textoFormatado = texto.trim().toUpperCase();
        const { error } = await supabaseClient
            .from('solicitacoes')
            .insert([{ texto: textoFormatado }]);

        if (error) throw error;

        console.log("Solicitação adicionada com sucesso.");
        await window.updateSolicitacao(); // Atualiza a lista automaticamente
    } catch (error) {
        console.error("Erro ao adicionar solicitação:", error);
        // Mostra alerta caso o usuário não tenha permissão (Nível < 2 do RLS)
        alert("Erro ao adicionar. Você tem permissão?");
    }
};

// FUNÇÃO PARA REMOVER UMA SOLICITAÇÃO DO BANCO PELO TEXTO
window.removeSolicitacao = async function(texto) {
    if (!texto) return;
    if (!window.nivelPermissaoUsuario || window.nivelPermissaoUsuario < 2) {
        console.warn("Usuario não autorizado a excluir solicitações.");
        return;
    }

    try {
        const { error } = await supabaseClient
            .from('solicitacoes')
            .delete()
            .eq('texto', texto.trim().toUpperCase());

        if (error) throw error;

        console.log("Solicitação removida com sucesso.");
        await window.updateSolicitacao(); // Atualiza a lista automaticamente

        if (typeof window.atualizarDisplayGlobais === 'function') {
            window.atualizarDisplayGlobais();
        }
        const select = document.getElementById('solicita');
        if (!select) return;
        select.value = "";
    } catch (error) {
        console.error("Erro ao remover solicitação:", error);
        alert("Erro ao remover. Você tem permissão?");
    }
};

//#endregion