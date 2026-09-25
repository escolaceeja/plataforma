/*
 * ============================================================
 * CEEJA LINHARES
 * FIREBASE CLOUD
 * ============================================================
 *
 * Funções:
 * - Carrega dados do Firestore para o localStorage
 * - Salva alterações do localStorage no Firestore
 * - Exclui do Firestore quando um cadastro é excluído
 * - Mantém as páginas antigas funcionando
 * - Executa o código da página somente depois da sincronização
 *
 * ============================================================
 */

(function () {

    "use strict";


    /* =========================================================
       CONFIGURAÇÃO FIREBASE
       ========================================================= */

    const firebaseConfig = {
        apiKey: "AIzaSyAYa8tTEJ4raHcdBdDnFIZlF7y2LjTX8",
        authDomain: "ceeja-linhares-sistema.firebaseapp.com",
        projectId: "ceeja-linhares-sistema",
        storageBucket: "ceeja-linhares-sistema.firebasestorage.app",
        messagingSenderId: "791087995006",
        appId: "1:791087995006:web:14c93bc02b36c73aa8602f"
    };


    /* =========================================================
       COLEÇÕES
       ========================================================= */

    const COLLECTIONS = [
        "cadastroAlunos",
        "funcionariosCadastrados",
        "registrosPresenca",
        "registrosNotas",
        "registrosConclusaoCurso"
    ];


    const GLOBAL_OBJECTS = [
        "historicoBuscaAtiva",
        "controleMatriculas"
    ];


    const SETTINGS = [
        "senhaPedagogo",
        "nomePedagogo"
    ];


    /*
     * Guarda quais documentos já existiam no Firebase
     * quando a página foi aberta.
     *
     * Isso permite identificar uma exclusão.
     */

    const idsConhecidos = {};


    let firebasePronto = false;
    let firebaseDB = null;
    let sincronizando = {};


    /* =========================================================
       CARREGAR SCRIPT DO FIREBASE
       ========================================================= */

    function carregarScript(url) {

        return new Promise(function (resolve, reject) {

            const script = document.createElement("script");

            script.src = url;

            script.onload = function () {
                resolve();
            };

            script.onerror = function () {
                reject(
                    new Error(
                        "Não foi possível carregar: " + url
                    )
                );
            };

            document.head.appendChild(script);

        });

    }


    /* =========================================================
       GARANTIR FIREBASE
       ========================================================= */

    async function carregarFirebase() {

        if (!window.firebase) {

            await carregarScript(
                "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"
            );

        }


        if (
            !window.firebase.firestore
        ) {

            await carregarScript(
                "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"
            );

        }


        /*
         * Autenticação anônima.
         */

        if (!window.firebase.auth) {

            await carregarScript(
                "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"
            );

        }

    }


    /* =========================================================
       INICIALIZAR FIREBASE
       ========================================================= */

    async function inicializarFirebase() {

        await carregarFirebase();


        let app;


        if (
            window.firebase.apps &&
            window.firebase.apps.length > 0
        ) {

            app =
                window.firebase.app();

        } else {

            app =
                window.firebase.initializeApp(
                    firebaseConfig
                );

        }


        /*
         * Login anônimo.
         */

        try {

            if (
                window.firebase.auth &&
                !window.firebase.auth().currentUser
            ) {

                await window.firebase
                    .auth()
                    .signInAnonymously();

            }

        } catch (erroAuth) {

            console.warn(
                "Firebase Auth anônimo:",
                erroAuth
            );

        }


        firebaseDB =
            app.firestore();


        window.CEEJAFirebase = {

            app: app,

            db: firebaseDB,

            firebaseConfig: firebaseConfig

        };


        return firebaseDB;

    }


    /* =========================================================
       GERAR ID DO DOCUMENTO
       ========================================================= */

    function gerarId(
        nomeColecao,
        aluno,
        indice
    ) {

        let id;


        if (
            nomeColecao === "cadastroAlunos"
        ) {

            id =
                aluno.cpf ||
                aluno.matricula ||
                String(indice);

        }


        else if (
            nomeColecao === "funcionariosCadastrados"
        ) {

            id =
                aluno.cpf ||
                aluno.usuario ||
                String(indice);

        }


        else if (
            nomeColecao === "registrosPresenca"
        ) {

            id =
                aluno.id ||
                (
                    (aluno.cpfAluno || "aluno") +
                    "_" +
                    (aluno.data || "") +
                    "_" +
                    (aluno.hora || aluno.horario || "") +
                    "_" +
                    indice
                );

        }


        else {

            id =
                aluno.id ||
                aluno.cpf ||
                aluno.cpfAluno ||
                (
                    "registro_" +
                    Date.now() +
                    "_" +
                    indice
                );

        }


        return String(id)
            .replace(/[\\/#?\[\]]/g, "_")
            .substring(0, 140);

    }


    /* =========================================================
       REMOVER CAMPOS INTERNOS
       ========================================================= */

    function limparDados(objeto) {

        const copia = {
            ...objeto
        };


        delete copia._firestoreId;


        return copia;

    }


    /* =========================================================
       CARREGAR COLEÇÃO DO FIREBASE
       ========================================================= */

    async function carregarColecao(
        nomeColecao
    ) {

        const referencia =
            firebaseDB
                .collection(nomeColecao);


        const snapshot =
            await referencia.get();


        const dados = [];


        snapshot.forEach(function (documento) {

            dados.push({

                ...documento.data(),

                _firestoreId:
                    documento.id

            });

        });


        /*
         * Guarda os IDs existentes.
         */

        idsConhecidos[nomeColecao] =
            new Set(
                dados.map(function (item) {

                    return String(
                        item._firestoreId
                    );

                })
            );


        return dados;

    }


    /* =========================================================
       CARREGAR DADOS DO FIREBASE
       ========================================================= */

    async function carregarDadosDaNuvem() {

        const originalSet =
            Storage.prototype.setItem;


        /*
         * -----------------------------------------------------
         * COLEÇÕES
         * -----------------------------------------------------
         */

        for (
            const nomeColecao of COLLECTIONS
        ) {

            try {

                const dados =
                    await carregarColecao(
                        nomeColecao
                    );


                /*
                 * Se houver dados no Firebase,
                 * eles passam a ser a fonte atual.
                 */

                if (
                    dados.length > 0
                ) {

                    originalSet.call(

                        localStorage,

                        nomeColecao,

                        JSON.stringify(
                            dados
                        )

                    );

                }

            }

            catch (erro) {

                console.error(

                    "Erro ao carregar " +
                    nomeColecao +
                    " do Firebase:",

                    erro

                );

                if (
                    !idsConhecidos[nomeColecao]
                ) {

                    idsConhecidos[nomeColecao] =
                        new Set();

                }

            }

        }


        /*
         * -----------------------------------------------------
         * OBJETOS GLOBAIS
         * -----------------------------------------------------
         */

        for (
            const nome of GLOBAL_OBJECTS
        ) {

            try {

                const snapshot =
                    await firebaseDB
                        .collection(nome)
                        .get();


                const documento =
                    snapshot.docs.find(
                        function (doc) {

                            return (
                                doc.id === "_global"
                            );

                        }
                    );


                if (
                    documento
                ) {

                    const dados =
                        documento.data();


                    if (
                        dados.value !== undefined
                    ) {

                        originalSet.call(

                            localStorage,

                            nome,

                            JSON.stringify(
                                dados.value
                            )

                        );

                    }

                }

            }

            catch (erro) {

                console.error(
                    "Erro ao carregar " +
                    nome +
                    ":",
                    erro
                );

            }

        }


        /*
         * -----------------------------------------------------
         * CONFIGURAÇÕES
         * -----------------------------------------------------
         */

        for (
            const nome of SETTINGS
        ) {

            try {

                const snapshot =
                    await firebaseDB
                        .collection("_config")
                        .get();


                const documento =
                    snapshot.docs.find(
                        function (doc) {

                            return (
                                doc.id === nome
                            );

                        }
                    );


                if (
                    documento
                ) {

                    const dados =
                        documento.data();


                    if (
                        dados.value !== undefined
                    ) {

                        originalSet.call(

                            localStorage,

                            nome,

                            String(
                                dados.value
                            )

                        );

                    }

                }

            }

            catch (erro) {

                console.error(
                    "Erro ao carregar configuração " +
                    nome +
                    ":",
                    erro
                );

            }

        }

    }


    /* =========================================================
       SINCRONIZAR COLEÇÃO
       ========================================================= */

    async function sincronizarColecao(
        nomeColecao,
        valor
    ) {

        /*
         * Evita duas sincronizações simultâneas.
         */

        if (
            sincronizando[nomeColecao]
        ) {

            return;

        }


        sincronizando[nomeColecao] =
            true;


        try {

            let dados;


            try {

                dados =
                    JSON.parse(valor);

            }

            catch (erro) {

                console.error(
                    "JSON inválido:",
                    nomeColecao,
                    erro
                );

                return;

            }


            if (
                !Array.isArray(dados)
            ) {

                console.warn(
                    nomeColecao +
                    " não é uma lista."
                );

                return;

            }


            /*
             * IDs que estavam no Firebase
             * antes da alteração.
             */

            const idsAntes =
                idsConhecidos[nomeColecao] ||
                new Set();


            /*
             * IDs que existem agora.
             */

            const idsAgora =
                new Set();


            /*
             * -------------------------------------------------
             * PRIMEIRO: SALVAR / ATUALIZAR
             * -------------------------------------------------
             */

            for (
                let i = 0;
                i < dados.length;
                i++
            ) {

                const item =
                    dados[i];


                const id =
                    String(

                        item._firestoreId ||

                        gerarId(
                            nomeColecao,
                            item,
                            i
                        )

                    );


                idsAgora.add(id);


                const dadosLimpos =
                    limparDados(item);


                await firebaseDB
                    .collection(nomeColecao)
                    .doc(id)
                    .set(
                        dadosLimpos,
                        {
                            merge: true
                        }
                    );


                /*
                 * Guarda o ID no cadastro local.
                 */

                item._firestoreId =
                    id;

            }


            /*
             * -------------------------------------------------
             * SEGUNDO: EXCLUIR
             * -------------------------------------------------
             *
             * Se existia antes, mas não existe agora,
             * foi excluído pelo usuário.
             */

            for (
                const id of idsAntes
            ) {

                if (
                    !idsAgora.has(id)
                ) {

                    try {

                        await firebaseDB
                            .collection(
                                nomeColecao
                            )
                            .doc(id)
                            .delete();


                        console.log(
                            "Firebase: documento excluído:",
                            nomeColecao,
                            id
                        );

                    }

                    catch (erroExcluir) {

                        console.error(
                            "Erro ao excluir documento:",
                            nomeColecao,
                            id,
                            erroExcluir
                        );

                    }

                }

            }


            /*
             * Atualiza os IDs conhecidos.
             */

            idsConhecidos[nomeColecao] =
                idsAgora;


            /*
             * Atualiza o localStorage com os
             * IDs do Firebase.
             */

            const originalSet =
                Storage.prototype.setItem;


            originalSet.call(

                localStorage,

                nomeColecao,

                JSON.stringify(
                    dados
                )

            );


            console.log(
                "Firebase: " +
                nomeColecao +
                " sincronizado."
            );

        }

        catch (erro) {

            console.error(

                "Firebase: erro ao sincronizar " +
                nomeColecao,

                erro

            );


            if (
                nomeColecao ===
                "cadastroAlunos"
            ) {

                console.error(
                    "Não foi possível salvar cadastroAlunos no Firebase.",
                    erro.message || erro
                );

            }

        }

        finally {

            sincronizando[nomeColecao] =
                false;

        }

    }


    /* =========================================================
       SINCRONIZAR OBJETO GLOBAL
       ========================================================= */

    async function sincronizarGlobal(
        nome,
        valor
    ) {

        try {

            let dados;


            try {

                dados =
                    JSON.parse(valor);

            }

            catch (erro) {

                dados =
                    valor;

            }


            await firebaseDB
                .collection(nome)
                .doc("_global")
                .set(

                    {
                        value: dados
                    },

                    {
                        merge: true
                    }

                );

        }

        catch (erro) {

            console.error(
                "Erro ao salvar " +
                nome +
                ":",
                erro
            );

        }

    }


    /* =========================================================
       SINCRONIZAR CONFIGURAÇÃO
       ========================================================= */

    async function sincronizarConfiguracao(
        nome,
        valor
    ) {

        try {

            await firebaseDB
                .collection("_config")
                .doc(nome)
                .set(

                    {
                        value:
                            String(valor)
                    },

                    {
                        merge: true
                    }

                );

        }

        catch (erro) {

            console.error(
                "Erro ao salvar configuração " +
                nome +
                ":",
                erro
            );

        }

    }


    /* =========================================================
       INTERCEPTAR localStorage
       ========================================================= */

    function ativarSincronizacao() {

        const originalSetItem =
            Storage.prototype.setItem;


        Storage.prototype.setItem =
            function (
                chave,
                valor
            ) {

                /*
                 * Primeiro salva normalmente
                 * no navegador.
                 */

                originalSetItem.call(

                    this,

                    chave,

                    valor

                );


                /*
                 * Só trabalhamos com localStorage.
                 */

                if (
                    this !== localStorage
                ) {

                    return;

                }


                /*
                 * Coleções.
                 */

                if (
                    COLLECTIONS.includes(
                        chave
                    )
                ) {

                    sincronizarColecao(

                        chave,

                        valor

                    );

                    return;

                }


                /*
                 * Objetos globais.
                 */

                if (
                    GLOBAL_OBJECTS.includes(
                        chave
                    )
                ) {

                    sincronizarGlobal(

                        chave,

                        valor

                    );

                    return;

                }


                /*
                 * Configurações.
                 */

                if (
                    SETTINGS.includes(
                        chave
                    )
                ) {

                    sincronizarConfiguracao(

                        chave,

                        valor

                    );

                }

            };

    }


    /* =========================================================
       EXECUTAR CÓDIGO DA PÁGINA
       ========================================================= */

    function executarPagina() {

        const holder =
            document.getElementById(
                "ceeja-app-script"
            );


        if (
            !holder
        ) {

            console.warn(
                "CEEJA: não foi encontrado o elemento ceeja-app-script."
            );

            return;

        }


        const script =
            document.createElement(
                "script"
            );


        script.textContent =
            holder.textContent;


        holder.replaceWith(
            script
        );

    }


    /* =========================================================
       INICIALIZAÇÃO
       ========================================================= */

    async function iniciar() {

        try {

            console.log(
                "CEEJA: iniciando Firebase..."
            );


            /*
             * Carrega Firebase.
             */

            await inicializarFirebase();


            /*
             * Carrega primeiro os dados
             * que estão na nuvem.
             */

            await carregarDadosDaNuvem();


            /*
             * Firebase pronto.
             */

            firebasePronto =
                true;


            /*
             * Ativa sincronização.
             */

            ativarSincronizacao();


            /*
             * Executa a página depois
             * que o Firebase terminou.
             */

            executarPagina();


            console.log(
                "CEEJA: Firebase conectado."
            );

        }

        catch (erro) {

            console.error(
                "CEEJA: erro ao iniciar Firebase:",
                erro
            );


            /*
             * Mesmo se o Firebase falhar,
             * não deixa a página travada.
             */

            executarPagina();

        }

    }


    /*
     * Inicia tudo.
     */

    iniciar();


})();
