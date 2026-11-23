const SUPABASE_URL = "https://nlcwlixlaupficvekqcd.supabase.co";
const SUPABASE_KEY = "sb_publishable_sr2AxvtVjV6jQGjj-lXCVw_hX2AJUBO";
export const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

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

    if(cat.data) cat.data.forEach(i => tudo.push({...i, tipo_base: 'Categoria'}));
    if(campos.data) campos.data.forEach(i => {
        tudo.push({...i, tipo_base: 'Campo', sub_tipo: i.tipo_campo, categoria_nome: mapaCategorias[i.categoria_id]});
    });
    if(listas.data) listas.data.forEach(i => {
        tudo.push({...i, tipo_base: 'Lista de Formulário', categoria_nome: mapaCategorias[i.categoria_id]});
    });
    if(opcoes.data) opcoes.data.forEach(i => {
        const idDaCategoria = mapaListas[i.dropdown_id];
        tudo.push({...i, tipo_base: 'Opção de Lista', categoria_nome: mapaCategorias[idDaCategoria]});
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
    
    const dados = window.entregarDadosNovaCategoria();

    if (!dados.nomeCateg){
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
            natureza_id: dados.natureza
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
        alert(`Erro ao salvar no Categoria no banco: ${error.message || error}`);
        return false;
    }
}

export async function salvarNovoComplemento() {
    if (!window.nivelPermissaoUsuario || window.nivelPermissaoUsuario < 2) {
        window.mostrarToast("Ação não autorizada."); 
        return false;
    }

    const dados = window.entregarDadosDoComplemento();

    const ehListaNova = dados.tipoCampo === "dropdown" && dados.novoDropdown;

    if (ehListaNova) {
        if (!dados.categoriaId || !dados.nomeNovoDropdown) {
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
        if (!dados.categoriaId || !dados.tipoCampo || !dados.nomeCampo) {
            window.mostrarToast("Preencha Categoria, Tipo e Nome!"); 
            return false;
        }
    }

    let registroCriado = { tipo: null, id: null, idListaRelacionada: null, idsOpcoesExtras: [] }; 

    try {
        const usuarioAtualId = await getUsuarioIdLogado();
        let resultado = { sucesso: false };

        if (dados.tipoCampo === "dropdown") {
            resultado = await salvarLista(dados, usuarioAtualId);
        } else {
            resultado = await salvarCampo(dados, usuarioAtualId);
        }

        if (resultado.sucesso && resultado.novoCampo) {
            registroCriado = { 
                tipo: dados.tipoCampo, 
                id: resultado.novoCampo.id,
                idListaRelacionada: resultado.idListaRelacionada || null,
                idsOpcoesExtras: (resultado.opcoesInseridas || []).slice(1).map(o => o.id) // NOVO
            }; 

            if (dados.tipoCampo === "dropdown") {
                window.mostrarToast(resultado.listaExistente ? "Opção(ões) registrada(s) e textos reordenados!" : "Nova Lista registrada e textos reordenados!");
            } else {
                window.mostrarToast("Novo Campo registrado e textos reordenados!");
            }

            window.limparPagina(true);
            await carregarDadosDaCategoria();
            return true;
        }

    } catch (error) {
        console.error("Erro no salvamento:", error);
        
        if (registroCriado.id) {
            console.log(`Rollback: Deletando registro incompleto...`);
            if (registroCriado.tipo === "dropdown") {
                await supabaseClient.from('lista_opcao').delete().eq('id', registroCriado.id);
                if (registroCriado.idsOpcoesExtras?.length) {
                    await supabaseClient.from('lista_opcao').delete().in('id', registroCriado.idsOpcoesExtras);
                }
                if (registroCriado.idListaRelacionada) await supabaseClient.from('lista_formulario').delete().eq('id', registroCriado.idListaRelacionada);
            } else {
                await supabaseClient.from('campos_formulario').delete().eq('id', registroCriado.id);
            }
        }
        alert(`Operação cancelada. Detalhe: ${error.message || error}`);
        return false;
    }
}

async function salvarCampo(dados, idUsuario) {
    // sem mudanças
    if (!dados) {
        alert(`Dados não recebidos para criação do Campo`);
        return { sucesso: false };
    }

    try {
        const payloadCampo = {
            categoria_id: parseInt(dados.categoriaId),
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
            natureza_id: dados.natureza
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
        alert(`Dados não recebidos para criação da Lista`);
        return { sucesso: false };
    }

    try {
        let dropdownId = null;
        let listaExistente = false;
        let idListaCriadaParaRollback = null;

        const categoriaIdInt = parseInt(dados.categoriaId);

        const { data: listaExistenteData, error: errCheck } = await supabaseClient
            .from('lista_formulario')
            .select('id')
            .eq('valor_opcao', dados.nomeDroproot)
            .eq('categoria_id', categoriaIdInt)
            .maybeSingle();

        if (errCheck) throw errCheck;

        if (listaExistenteData) {
            dropdownId = listaExistenteData.id;
            listaExistente = true;
        } else {
            // A regra de ocultamento (oculto_ate) fica só na LISTA - nunca nas opções abaixo
            const payloadLista = {
                valor_opcao: dados.nomeDroproot,
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
                natureza_id: op.naturezaId || null,
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
                natureza_id: dados.natureza,
                aditivo_texto: dados.aditivoTexto || null,
                aditivo_posicao: dados.aditivoPosicao || null
            }];

        const { data: opcoesInseridas, error: errOpcao } = await supabaseClient
            .from('lista_opcao')
            .insert(opcoesParaInserir)
            .select();

        if (errOpcao) {
            if (idListaCriadaParaRollback) {
                await supabaseClient.from('lista_formulario').delete().eq('id', idListaCriadaParaRollback);
            }
            throw errOpcao;
        }
        
        return { 
            sucesso: true, 
            novoCampo: opcoesInseridas[0],
            opcoesInseridas, // NOVO
            idListaRelacionada: idListaCriadaParaRollback,
            listaExistente: listaExistente 
        };

    } catch (error) {
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
            if (!catId) return;
            const atual = termosPorCategoria.get(catId) || [];
            valores.forEach(v => {
                const norm = normalizarBusca(v);
                if (norm) atual.push(norm);
            });
            termosPorCategoria.set(catId, atual);
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
            const termosExtras = termosPorCategoria.get(cat.id) || [];
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
    let categoriasOrdenadas = [...window.listaDeCategorias];

    if (criterio === 'nome') {
        categoriasOrdenadas.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
    } 
    else if (criterio === 'id') {
        categoriasOrdenadas.sort((a, b) => a.id - b.id);
    } 
    // else if (criterio === 'ordem') {
    //     categoriasOrdenadas.sort((a, b) => (a.data_peso || 0) - (b.data_peso || 0));
    // }

    select.innerHTML = '<option value="">-- Selecione uma Categoria --</option>';
    
    categoriasOrdenadas.forEach(cat => {
        const opt = document.createElement("option");
        opt.value = cat.id;
        opt.textContent = cat.nome;
        select.appendChild(opt);
    });

    select.value = valorAtual;
};

export async function carregarDadosDaCategoria(categoriaIdParam = null) {
    window.camposDaCategoria = [];
    window.listasDaCategoria = [];

    const categoriaId = categoriaIdParam || document.getElementById("categoria")?.value;
    
    if (!categoriaId) { 
        console.log("Categoria não encontrada!");
        if (typeof window.limparGrid === 'function'){
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

    //retornar cedo se não houver listas disponiveis nessa categoria.
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
    if (!id || !tabela) {
        console.error("ID ou Tabela não fornecidos para coletarDadosDoBanco");
        return null;
    }

    try {
        const { data, error } = await supabaseClient
            .from(tabela)
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error(`Erro ao buscar dados na tabela ${tabela} (ID: ${id}):`, error);
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

    try {
        console.log(`Iniciando exclusão da categoria ID ${idCategoria}`);

        const { error } = await supabaseClient
            .from('categorias')
            .delete()
            .eq('id', idCategoria);

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

    try {
        console.log(`Iniciando exclusão do ID ${idItem} na tabela ${tabela}`);

        // 1. Deleta o item da tabela alvo (seja campo_formulario ou lista_opcao)
        const { error: erroDelete } = await supabaseClient
            .from(tabela)
            .delete()
            .eq('id', idItem);

        if (erroDelete) throw erroDelete;

        // 2. Lógica Especial: Se for uma opção de dropdown, checar se sobraram opções.
        if (tabela === 'lista_opcao' && idDropdownPai) {
            console.log(`Verificando se o dropdown pai (ID ${idDropdownPai}) ficou vazio...`);
            
            const { count, error: erroCount } = await supabaseClient
                .from('lista_opcao')
                .select('*', { count: 'exact', head: true })
                .eq('dropdown_id', idDropdownPai);

            if (erroCount) throw erroCount;

            // Se não sobrou nenhuma opção, deleta o dropdown (lista_formulario) inteiro
            if (count === 0) {
                console.log(`Dropdown ID ${idDropdownPai} está vazio. Excluindo lista_formulario...`);
                const { error: erroDeletePai } = await supabaseClient
                    .from('lista_formulario')
                    .delete()
                    .eq('id', idDropdownPai);

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

//#region UPDATES (usado para o modo 'edição' ou 'recentes' dos usuario permitidos)
// ==========================================

export async function atualizarCardsEmLote(tabela, arrayDeDados) {
    if (!arrayDeDados || arrayDeDados.length === 0) return true;

    // Dicionário de colunas permitidas para cada tabela
    // Removido o 'id' daqui, pois não queremos atualizá-lo, apenas usá-lo como filtro
    const colunasPermitidas = {
        'campos_formulario': ['grid_x', 'grid_y', 'grid_w', 'grid_h', 'data_contexto', 'data_peso'],
        'lista_formulario': ['grid_x', 'grid_y', 'grid_w', 'grid_h'],
        'lista_opcao': ['data_contexto', 'data_peso']
    };

    try {
        const chavesValidas = colunasPermitidas[tabela];

        // Cria um array de requisições UPDATE individuais em vez de um UPSERT em massa
        const promessasDeAtualizacao = arrayDeDados.map(item => {
            let objLimpo = {};
            
            // HIGIENIZAÇÃO: Filtra apenas as colunas que vieram no item E que são permitidas
            if (chavesValidas) {
                Object.keys(item).forEach(key => {
                    if (chavesValidas.includes(key)) {
                        objLimpo[key] = item[key];
                    }
                });
            }

            // Se não houver nenhum campo permitido para atualizar, evita fazer requisição vazia
            if (Object.keys(objLimpo).length === 0) return Promise.resolve({ error: null });

            // Faz um UPDATE direcionado apenas ao ID correspondente
            return supabaseClient
                .from(tabela)
                .update(objLimpo)
                .eq('id', item.id);
        });

        // Executa todos os updates simultaneamente (muito rápido)
        const resultados = await Promise.all(promessasDeAtualizacao);

        // Verifica se alguma das requisições individuais retornou erro
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
    try {
        const usuarioAtualId = await getUsuarioIdLogado();
        
        const payloadCateg = {
            nome: dados.nomeCateg, 
            texto_output: dados.textoResultado,
            editado_por: usuarioAtualId,
            natureza_id: dados.natureza
        };

        const { error } = await supabaseClient
            .from('categorias')
            .update(payloadCateg)
            .eq('id', id);

        if (error) throw error;
        return true;
    } catch (error) {
        alert(`Erro ao atualizar Categoria: ${error.message || error}`);
        return false;
    }
}

export async function atualizarCampoNormalDB(id, dados) {
    try {
        const usuarioAtualId = await getUsuarioIdLogado();

        const payloadCampo = {
            nome_campo: dados.nomeCampo, 
            texto_output: dados.textoResultado,
            aditivo_texto: dados.aditivoTexto || null,
            aditivo_posicao: dados.aditivoPosicao || null, 
            oculto_ate: dados.ocultoAte || null,
            editado_por: usuarioAtualId,
            natureza_id: dados.natureza
        };

        const { error } = await supabaseClient
            .from('campos_formulario')
            .update(payloadCampo)
            .eq('id', id);

        if (error) throw error;
        return true;
    } catch (error) {
        alert(`Erro ao atualizar Campo: ${error.message || error}`);
        return false;
    }
}

export async function atualizarListaDB(id, dados) {
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
            .eq('id', id);

        if (error) throw error;
        return true;
    } catch (error) {
        alert(`Erro ao atualizar Lista Root: ${error.message || error}`);
        return false;
    }
}
export async function atualizarOpcaoListaDB(id, dados) {
    try {
        const usuarioAtualId = await getUsuarioIdLogado();

        const payloadOpcao = {
            nome_campo: dados.nomeCampo,
            texto_output: dados.textoResultado,
            aditivo_texto: dados.aditivoTexto || null,
            aditivo_posicao: dados.aditivoPosicao || null,
            editado_por: usuarioAtualId,
            natureza_id: dados.natureza
        };

        const { error } = await supabaseClient
            .from('lista_opcao')
            .update(payloadOpcao)
            .eq('id', id);

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

        // Salva os dados na variável global
        window.solicitacoes = data; 
        console.log("Lista global atualizada:", window.solicitacoes); // <- Isso vai te ajudar a testar!

        // Manda desenhar na tela
        window.renderizarSelectSolicitacao();

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
            
        window.atualizarDisplayGlobais(); 
        const select = document.getElementById('solicita');
        if (!select) return;
        select.value = "";

    } catch (error) {
        console.error("Erro ao remover solicitação:", error);
        alert("Erro ao remover. Você tem permissão?");
    }
};

//#endregion