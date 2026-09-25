/*
============================================================
CEEJA LINHARES
firebase-cloud.js
Integração localStorage + Firebase Firestore
============================================================
*/

(function () {

    "use strict";

    /* ======================================================
       CONFIGURAÇÃO DO FIREBASE
       ====================================================== */

    const firebaseConfig = {
        apiKey: "AIzaSyAYa8tTEJ4raHcdBdDnFIZlF7y2LjTX8",
        authDomain: "ceeja-linhares-sistema.firebaseapp.com",
        projectId: "ceeja-linhares-sistema",
        storageBucket: "ceeja-linhares-sistema.firebasestorage.app",
        messagingSenderId: "791087995006",
        appId: "1:791087995006:web:14c93bc02b36c73aa8602f"
    };


    /* ======================================================
       COLEÇÕES DO SISTEMA
       ====================================================== */

    const COLLECTIONS = new Set([
        "cadastroAlunos",
        "funcionariosCadastrados",
        "registrosPresenca",
        "registrosNotas",
        "registrosConclusaoCurso"
    ]);


    const GLOBAL_OBJECTS = new Set([
        "historicoBuscaAtiva",
        "controleMatriculas"
    ]);


    const SETTINGS = new Set([
        "senhaPedagogo",
        "nomePedagogo"
    ]);


    let db = null;

    let firebasePronto = false;

    const sincronizando = new Set();

    /*
     * Guarda o setItem ORIGINAL.
     * Isso é importante para não criar um ciclo infinito
     * quando o Firebase atualizar o localStorage.
     */
    const originalSetItem =
        Storage.prototype.setItem;


    /* ======================================================
       CARREGAR SCRIPTS DO FIREBASE
       ====================================================== */

    function carregarScript(src) {

        return new Promise(function (resolve, reject) {

            const scriptExistente =
                document.querySelector(
                    'script[src="' + src + '"]'
                );

            if (scriptExistente) {

                if (window.firebase) {
                    resolve();
                    return;
                }

                scriptExistente.addEventListener(
                    "load",
                    resolve,
                    { once: true }
                );

                scriptExistente.addEventListener(
                    "error",
                    reject,
                    { once: true }
                );

                return;
            }


            const script =
                document.createElement("script");


            script.src = src;

            script.async = false;


            script.onload = function () {
                resolve();
            };


            script.onerror = function () {

                reject(
                    new Error(
                        "Não foi possível carregar o Firebase: " +
                        src
                    )
                );

            };


            document.head.appendChild(script);

        });

    }


    async function carregarFirebaseSDK() {

        /*
         * Firebase App
         */

        if (!window.firebase) {

            await carregarScript(
                "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"
            );

        }


        /*
         * Firebase Authentication
         */

        if (!window.firebase.auth) {

            await carregarScript(
                "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"
            );

        }


        /*
         * Firestore
         */

        if (!window.firebase.firestore) {

            await carregarScript(
                "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"
            );

        }


        if (
            !window.firebase ||
            !window.firebase.initializeApp
        ) {

            throw new Error(
                "O SDK do Firebase não foi carregado."
            );

        }


        if (!window.firebase.firestore) {

            throw new Error(
                "O SDK do Firestore não foi carregado."
            );

        }

    }


    /* ======================================================
       GERAR ID DOS DOCUMENTOS
       ====================================================== */

    function gerarId(
        collectionName,
        item,
        index
    ) {

        let raw;


        if (
            collectionName ===
            "cadastroAlunos"
        ) {

            raw =
                item.cpf ||
                item.matricula ||
                String(index);

        }


        else if (
            collectionName ===
            "funcionariosCadastrados"
        ) {

            raw =
                item.cpf ||
                item.usuario ||
                String(index);

        }


        else if (
            collectionName ===
            "registrosPresenca"
        ) {

            raw =
                item.id ||
                (
                    (item.cpfAluno || "aluno") +
                    "_" +
                    (item.data || "") +
                    "_" +
                    (item.hora ||
                     item.horario ||
                     "") +
                    "_" +
                    index
                );

        }


        else {

            raw =
                item.id ||
                (
                    (item.cpfAluno ||
                     item.cpf ||
                     "registro") +
                    "_" +
                    (item.timestamp ||
                     Date.now()) +
                    "_" +
                    index
                );

        }


        return String(raw)
            .replace(/[\\/#?\[\]]/g, "_")
            .slice(0, 140) ||
            String(index);

    }


    /* ======================================================
       LIMPAR DADOS INTERNOS
       ====================================================== */

    function limparDados(item) {

        const copia =
            Object.assign({}, item);

        delete copia._firestoreId;

        return copia;

    }


    /* ======================================================
       CARREGAR UMA COLEÇÃO DO FIRESTORE
       ====================================================== */

    async function carregarColecao(nome) {

        const snapshot =
            await db
                .collection(nome)
                .get();


        const dados = [];


        snapshot.forEach(
            function (docSnap) {

                dados.push(

                    Object.assign(
                        {},
                        docSnap.data(),
                        {
                            _firestoreId:
                                docSnap.id
                        }
                    )

                );

            }
        );


        return dados;

    }


    /* ======================================================
       TRAZER DADOS DA NUVEM PARA O SISTEMA
       ====================================================== */

    async function hidratarSistema() {

        /*
         * --------------------------------------------------
         * COLEÇÕES
         * --------------------------------------------------
         */

        for (
            const nome of COLLECTIONS
        ) {

            try {

                const dados =
                    await carregarColecao(
                        nome
                    );


                /*
                 * Só substitui o localStorage
                 * se houver dados na nuvem.
                 */

                if (
                    dados.length > 0
                ) {

                    originalSetItem.call(
                        localStorage,
                        nome,
                        JSON.stringify(
                            dados
                        )
                    );

                }

            }

            catch (erro) {

                console.error(
                    "Firebase: erro ao carregar " +
                    nome,
                    erro
                );

            }

        }


        /*
         * --------------------------------------------------
         * OBJETOS GLOBAIS
         * --------------------------------------------------
         */

        for (
            const nome of GLOBAL_OBJECTS
        ) {

            try {

                const snap =
                    await db
                        .collection(nome)
                        .doc("_global")
                        .get();


                if (
                    snap.exists
                ) {

                    const dados =
                        snap.data();


                    if (
                        dados &&
                        dados.value !== undefined
                    ) {

                        originalSetItem.call(
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
                    "Firebase: erro ao carregar " +
                    nome,
                    erro
                );

            }

        }


        /*
         * --------------------------------------------------
         * CONFIGURAÇÕES
         * --------------------------------------------------
         */

        for (
            const nome of SETTINGS
        ) {

            try {

                const snap =
                    await db
                        .collection("_config")
                        .doc(nome)
                        .get();


                if (
                    snap.exists
                ) {

                    const dados =
                        snap.data();


                    if (
                        dados &&
                        dados.value !== undefined
                    ) {

                        originalSetItem.call(
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
                    "Firebase: erro ao carregar configuração " +
                    nome,
                    erro
                );

            }

        }

    }


    /* ======================================================
       SALVAR COLEÇÃO NO FIRESTORE
       ====================================================== */

    async function sincronizarColecao(
        nome,
        valor
    ) {

        if (
            sincronizando.has(nome)
        ) {

            return;

        }


        sincronizando.add(nome);


        try {

            let dados;


            /*
             * Converter JSON
             */

            try {

                dados =
                    JSON.parse(valor);

            }

            catch (erro) {

                throw new Error(
                    "Os dados de " +
                    nome +
                    " não estão em JSON válido."
                );

            }


            if (
                !Array.isArray(dados)
            ) {

                throw new Error(
                    "A coleção " +
                    nome +
                    " não contém uma lista."
                );

            }


            /*
             * Salvar cada aluno/registro
             */

            for (
                let indice = 0;
                indice < dados.length;
                indice++
            ) {

                const item =
                    dados[indice] || {};


                const id =
                    String(

                        item._firestoreId ||

                        gerarId(
                            nome,
                            item,
                            indice
                        )

                    );


                await db
                    .collection(nome)
                    .doc(id)
                    .set(
                        limparDados(item),
                        {
                            merge: true
                        }
                    );


                /*
                 * Guardar o ID no objeto local
                 */

                item._firestoreId =
                    id;

            }


            /*
             * Atualizar localStorage
             * usando o setItem ORIGINAL.
             */

            originalSetItem.call(
                localStorage,
                nome,
                JSON.stringify(
                    dados
                )
            );


            console.log(
                "Firebase: " +
                nome +
                " sincronizado com sucesso."
            );

        }

        catch (erro) {

            console.error(
                "Firebase: erro ao salvar " +
                nome,
                erro
            );


            if (
                nome ===
                "cadastroAlunos"
            ) {

                const detalhe =
                    erro &&
                    erro.code
                        ? " (" +
                          erro.code +
                          ")"
                        : "";


                const mensagem =
                    "Não foi possível salvar cadastroAlunos no Firebase" +
                    detalhe +
                    ".";


                window.__erroFirebaseCadastro =
                    mensagem;


                if (
                    typeof window.mostrarErroFirebase ===
                    "function"
                ) {

                    window.mostrarErroFirebase(
                        mensagem
                    );

                }

            }


            throw erro;

        }

        finally {

            sincronizando.delete(
                nome
            );

        }

    }


    /* ======================================================
       FUNÇÃO PÚBLICA USADA PELO CADASTRO DE ALUNO
       ====================================================== */

    async function salvarColecao(
        nome,
        valor
    ) {

        if (
            !firebasePronto ||
            !db
        ) {

            throw new Error(
                "O Firebase ainda não está pronto."
            );

        }


        if (
            !COLLECTIONS.has(nome)
        ) {

            throw new Error(
                "Coleção não autorizada: " +
                nome
            );

        }


        return await sincronizarColecao(
            nome,
            valor
        );

    }


    /* ======================================================
       SALVAR OBJETO GLOBAL
       ====================================================== */

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


            await db
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


            console.log(
                "Firebase: " +
                nome +
                " salvo."
            );

        }

        catch (erro) {

            console.error(
                "Firebase: erro ao salvar " +
                nome,
                erro
            );

        }

    }


    /* ======================================================
       SALVAR CONFIGURAÇÃO
       ====================================================== */

    async function sincronizarConfiguracao(
        nome,
        valor
    ) {

        try {

            await db
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


            console.log(
                "Firebase: configuração " +
                nome +
                " salva."
            );

        }

        catch (erro) {

            console.error(
                "Firebase: erro ao salvar configuração " +
                nome,
                erro
            );

        }

    }


    /* ======================================================
       EXECUTAR O CÓDIGO ORIGINAL DA PÁGINA
       ====================================================== */

    function executarScriptPagina() {

        const holder =
            document.getElementById(
                "ceeja-app-script"
            );


        if (!holder) {

            console.warn(
                "CEEJA: script principal não encontrado."
            );

            return;

        }


        /*
         * Se já for um script normal,
         * não executar novamente.
         *
         * Isso evita erros como:
         * Identifier 'perfilLogado'
         * has already been declared.
         */

        if (
            holder.tagName === "SCRIPT" &&
            holder.type !== "text/plain"
        ) {

            console.log(
                "CEEJA: script principal já está normal."
            );

            return;

        }


        const script =
            document.createElement(
                "script"
            );


        script.type =
            "text/javascript";


        script.text =
            holder.textContent || "";


        holder.replaceWith(
            script
        );


        console.log(
            "CEEJA: código principal da página executado."
        );

    }


    /* ======================================================
       INICIALIZAÇÃO
       ====================================================== */

    async function iniciar() {

        try {

            /*
             * Carregar Firebase
             */

            await carregarFirebaseSDK();


            /*
             * Inicializar aplicação
             */

            const app =

                window.firebase.apps.length > 0

                    ? window.firebase.app()

                    : window.firebase.initializeApp(
                        firebaseConfig
                    );


            db =
                app.firestore();


            /*
             * Autenticação anônima
             */

            try {

                const auth =
                    window.firebase.auth();


                if (
                    !auth.currentUser
                ) {

                    await auth.signInAnonymously();

                }


                console.log(
                    "CEEJA: autenticação Firebase concluída."
                );

            }

            catch (erroAuth) {

                console.error(
                    "CEEJA: autenticação anônima não disponível.",
                    erroAuth
                );

            }


            /*
             * Disponibilizar API
             * para as páginas.
             */

            window.CEEJAFirebase = {

                app: app,

                db: db,

                firebaseConfig:
                    firebaseConfig,

                pronto: false,

                erro: null,

                salvarColecao:
                    salvarColecao

            };


            /*
             * Carregar dados existentes
             * antes de iniciar a página.
             */

            await hidratarSistema();


            firebasePronto =
                true;


            window.CEEJAFirebase.pronto =
                true;


            /*
             * Interceptar novos dados
             * gravados no localStorage.
             */

            Storage.prototype.setItem =

                function (
                    chave,
                    valor
                ) {

                    /*
                     * Sempre salvar normalmente
                     * no navegador.
                     */

                    originalSetItem.call(
                        this,
                        chave,
                        valor
                    );


                    /*
                     * Só sincronizar localStorage.
                     */

                    if (
                        this !== localStorage
                    ) {

                        return;

                    }


                    /*
                     * Coleções
                     */

                    if (
                        COLLECTIONS.has(chave)
                    ) {

                        sincronizarColecao(
                            chave,
                            valor
                        ).catch(
                            function (erro) {

                                console.error(
                                    "CEEJA: erro na sincronização automática.",
                                    erro
                                );

                            }
                        );

                        return;

                    }


                    /*
                     * Objetos globais
                     */

                    if (
                        GLOBAL_OBJECTS.has(chave)
                    ) {

                        sincronizarGlobal(
                            chave,
                            valor
                        );

                        return;

                    }


                    /*
                     * Configurações
                     */

                    if (
                        SETTINGS.has(chave)
                    ) {

                        sincronizarConfiguracao(
                            chave,
                            valor
                        );

                    }

                };


            /*
             * Agora executar o código
             * original da página.
             */

            executarScriptPagina();


            console.log(
                "CEEJA: Firebase conectado e sincronização ativada."
            );

        }

        catch (erro) {

            console.error(
                "CEEJA: ERRO NO FIREBASE",
                erro
            );


            /*
             * Informar erro para a página.
             */

            window.CEEJAFirebase = {

                app: null,

                db: null,

                firebaseConfig:
                    firebaseConfig,

                pronto: false,

                erro: erro,

                salvarColecao:
                    async function () {

                        throw erro;

                    }

            };


            /*
             * Mesmo se o Firebase estiver
             * indisponível, executar o código
             * original para não deixar o
             * formulário completamente parado.
             */

            executarScriptPagina();

        }

    }


    /* ======================================================
       INICIAR
       ====================================================== */

    iniciar();

})();
