/*
 * ============================================================
 * CEEJA LINHARES - FIREBASE CLOUD
 * Integração entre localStorage e Firebase Firestore
 * ============================================================
 *
 * Este arquivo:
 *
 * 1. Conecta ao Firebase.
 * 2. Faz autenticação anônima.
 * 3. Carrega os dados existentes do Firestore.
 * 4. Mantém o sistema atual funcionando com localStorage.
 * 5. Sincroniza alterações com o Firestore.
 * 6. Mostra o erro real do Firebase quando houver falha.
 *
 * ============================================================
 */

(function () {

    "use strict";


    /*
     * =========================================================
     * CONFIGURAÇÃO DO FIREBASE
     * =========================================================
     */

    const firebaseConfig = {

        apiKey:
            "AIzaSyAYa8tTEJ4raHcdpdBdDnFIZlF7y2LjTX8",

        authDomain:
            "ceeja-linhares-sistema.firebaseapp.com",

        projectId:
            "ceeja-linhares-sistema",

        storageBucket:
            "ceeja-linhares-sistema.firebasestorage.app",

        messagingSenderId:
            "791087995006",

        appId:
            "1:791087995006:web:14c93bc02b36c73aa8602f"

    };


    /*
     * =========================================================
     * COLEÇÕES DO SISTEMA
     * =========================================================
     */

    const COLLECTIONS = new Set([

        "cadastroAlunos",

        "funcionariosCadastrados",

        "registrosPresenca",

        "registrosNotas",

        "registrosConclusaoCurso"

    ]);


    /*
     * =========================================================
     * OBJETOS GLOBAIS
     * =========================================================
     */

    const GLOBAL_OBJECTS = new Set([

        "historicoBuscaAtiva",

        "controleMatriculas"

    ]);


    /*
     * =========================================================
     * CONFIGURAÇÕES
     * =========================================================
     */

    const SETTINGS = new Set([

        "senhaPedagogo",

        "nomePedagogo"

    ]);


    /*
     * =========================================================
     * CONTROLE DAS FILAS
     * =========================================================
     */

    const filas = new Map();


    /*
     * Método ORIGINAL do localStorage.
     *
     * Isso é importante para evitar loop de sincronização.
     */

    const nativeSetItem =
        Storage.prototype.setItem;


    let firebasePronto = false;


    /*
     * =========================================================
     * CARREGAR SCRIPT DO FIREBASE
     * =========================================================
     */

    function carregarScript(src) {

        return new Promise(function (resolve, reject) {

            const script =
                document.createElement("script");

            script.src = src;

            script.onload = resolve;

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


    /*
     * =========================================================
     * EXECUTAR O CÓDIGO ORIGINAL DA PÁGINA
     * =========================================================
     */

    function executarPaginaOriginal() {

        const holder =
            document.getElementById(
                "ceeja-app-script"
            );

        if (!holder) {
            return;
        }

        const script =
            document.createElement("script");

        script.textContent =
            holder.textContent;

        holder.replaceWith(script);

    }


    /*
     * =========================================================
     * MOSTRAR ERRO
     * =========================================================
     */

    function mostrarErro(mensagem) {

        console.error(
            "CEEJA Firebase:",
            mensagem
        );

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


    /*
     * =========================================================
     * GERAR ID DOS DOCUMENTOS
     * =========================================================
     */

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
                `${item.cpfAluno || "aluno"}_${item.data || ""}_${item.hora || item.horario || ""}_${index}`;

        }


        else {

            raw =
                item.id ||
                `${item.cpfAluno || item.cpf || "registro"}_${item.timestamp || Date.now()}_${index}`;

        }


        return String(raw)

            .replace(
                /[\\/#?\[\]]/g,
                "_"
            )

            .slice(
                0,
                140
            )

            || String(index);

    }


    /*
     * =========================================================
     * LIMPAR DADOS INTERNOS
     * =========================================================
     */

    function limparDados(item) {

        const copia = {
            ...item
        };

        delete copia._firestoreId;

        return copia;

    }


    /*
     * =========================================================
     * CARREGAR UMA COLEÇÃO DO FIRESTORE
     * =========================================================
     */

    async function carregarColecao(
        db,
        nome
    ) {

        const {
            collection,
            getDocs
        } =
            window.firebase.firestore;


        const snapshot =
            await getDocs(
                collection(
                    db,
                    nome
                )
            );


        const dados = [];


        snapshot.forEach(
            function (docSnap) {

                dados.push({

                    ...docSnap.data(),

                    _firestoreId:
                        docSnap.id

                });

            }
        );


        return dados;

    }


    /*
     * =========================================================
     * CARREGAR DADOS DA NUVEM
     * =========================================================
     */

    async function hidratarSistema(db) {


        /*
         * -----------------------------------------------------
         * COLEÇÕES
         * -----------------------------------------------------
         */

        for (
            const nome
            of COLLECTIONS
        ) {

            try {

                const dados =
                    await carregarColecao(
                        db,
                        nome
                    );


                /*
                 * Só substitui o localStorage
                 * se houver dados na nuvem.
                 */

                if (
                    dados.length > 0
                ) {

                    nativeSetItem.call(

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

                    `Firebase: erro ao carregar ${nome}:`,

                    erro

                );

            }

        }


        /*
         * -----------------------------------------------------
         * OBJETOS GLOBAIS
         * -----------------------------------------------------
         */

        for (
            const nome
            of GLOBAL_OBJECTS
        ) {

            try {

                const {
                    collection,
                    getDocs
                } =
                    window.firebase.firestore;


                const snapshot =
                    await getDocs(

                        collection(
                            db,
                            nome
                        )

                    );


                const documento =
                    snapshot.docs.find(
                        function (d) {

                            return (
                                d.id ===
                                "_global"
                            );

                        }
                    );


                if (

                    documento &&

                    documento.data().value
                    !== undefined

                ) {

                    nativeSetItem.call(

                        localStorage,

                        nome,

                        JSON.stringify(

                            documento.data().value

                        )

                    );

                }

            }

            catch (erro) {

                console.error(

                    `Firebase: erro ao carregar ${nome}:`,

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
            const nome
            of SETTINGS
        ) {

            try {

                const {
                    collection,
                    getDocs
                } =
                    window.firebase.firestore;


                const snapshot =
                    await getDocs(

                        collection(
                            db,
                            "_config"
                        )

                    );


                const documento =
                    snapshot.docs.find(
                        function (d) {

                            return (
                                d.id ===
                                nome
                            );

                        }
                    );


                if (

                    documento &&

                    documento.data().value
                    !== undefined

                ) {

                    nativeSetItem.call(

                        localStorage,

                        nome,

                        String(

                            documento.data().value

                        )

                    );

                }

            }

            catch (erro) {

                console.error(

                    `Firebase: erro ao carregar configuração ${nome}:`,

                    erro

                );

            }

        }

    }


    /*
     * =========================================================
     * SALVAR COLEÇÃO NO FIRESTORE
     * =========================================================
     */

    async function sincronizarColecao(

        db,

        nome,

        valor

    ) {

        let dados;


        /*
         * -----------------------------------------------------
         * TRANSFORMAR JSON
         * -----------------------------------------------------
         */

        try {

            dados =
                JSON.parse(
                    valor
                );

        }

        catch (erro) {

            throw new Error(
                `JSON inválido em ${nome}.`
            );

        }


        /*
         * -----------------------------------------------------
         * VERIFICAR LISTA
         * -----------------------------------------------------
         */

        if (
            !Array.isArray(dados)
        ) {

            throw new Error(

                `O conteúdo de ${nome} não é uma lista.`

            );

        }


        const {
            doc,
            setDoc
        } =
            window.firebase.firestore;


        /*
         * -----------------------------------------------------
         * SALVAR CADA REGISTRO
         * -----------------------------------------------------
         */

        for (

            let indice = 0;

            indice <
            dados.length;

            indice++

        ) {

            const item =
                dados[indice];


            const id =
                String(

                    item._firestoreId ||

                    gerarId(

                        nome,

                        item,

                        indice

                    )

                );


            const dadosLimpos =
                limparDados(
                    item
                );


            await setDoc(

                doc(

                    db,

                    nome,

                    id

                ),

                dadosLimpos,

                {

                    merge: true

                }

            );


            /*
             * Guardar ID do Firestore
             */

            item._firestoreId =
                id;

        }


        /*
         * Atualizar localStorage
         * usando o método ORIGINAL.
         */

        nativeSetItem.call(

            localStorage,

            nome,

            JSON.stringify(
                dados
            )

        );


        console.log(

            `Firebase: ${nome} sincronizado com sucesso.`

        );

    }


    /*
     * =========================================================
     * AGENDAR SINCRONIZAÇÃO
     * =========================================================
     */

    function agendarColecao(

        db,

        nome,

        valor

    ) {

        const anterior =
            filas.get(nome) ||
            Promise.resolve();


        const atual =
            anterior.then(
                function () {

                    return sincronizarColecao(

                        db,

                        nome,

                        valor

                    );

                }
            );


        filas.set(
            nome,
            atual
        );


        atual.catch(
            function (erro) {

                const codigo =
                    erro &&
                    erro.code

                        ? ` (${erro.code})`

                        : "";


                const detalhe =
                    erro &&
                    erro.message

                        ? erro.message

                        : String(
                            erro
                        );


                mostrarErro(

                    `Não foi possível salvar ${nome} no Firebase${codigo}. ${detalhe}`

                );

            }
        );


        atual.finally(
            function () {

                if (
                    filas.get(nome)
                    === atual
                ) {

                    filas.delete(
                        nome
                    );

                }

            }
        );


        return atual;

    }


    /*
     * =========================================================
     * AGUARDAR SINCRONIZAÇÃO
     * =========================================================
     */

    function aguardarSincronizacao(
        nome
    ) {

        return (

            filas.get(nome) ||

            Promise.resolve()

        );

    }


    /*
     * =========================================================
     * SALVAR OBJETO GLOBAL
     * =========================================================
     */

    async function sincronizarGlobal(

        db,

        nome,

        valor

    ) {

        let dados;


        try {

            dados =
                JSON.parse(
                    valor
                );

        }

        catch (erro) {

            dados =
                valor;

        }


        const {
            doc,
            setDoc
        } =
            window.firebase.firestore;


        await setDoc(

            doc(

                db,

                nome,

                "_global"

            ),

            {

                value:
                    dados

            },

            {

                merge:
                    true

            }

        );


        console.log(

            `Firebase: ${nome} salvo.`

        );

    }


    /*
     * =========================================================
     * SALVAR CONFIGURAÇÃO
     * =========================================================
     */

    async function sincronizarConfiguracao(

        db,

        nome,

        valor

    ) {

        const {
            doc,
            setDoc
        } =
            window.firebase.firestore;


        await setDoc(

            doc(

                db,

                "_config",

                nome

            ),

            {

                value:
                    String(valor)

            },

            {

                merge:
                    true

            }

        );


        console.log(

            `Firebase: configuração ${nome} salva.`

        );

    }


    /*
     * =========================================================
     * INICIALIZAÇÃO
     * =========================================================
     */

    async function iniciar() {

        try {


            /*
             * -------------------------------------------------
             * FIREBASE APP
             * -------------------------------------------------
             */

            if (
                !window.firebase
            ) {

                await carregarScript(

                    "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"

                );

            }


            /*
             * -------------------------------------------------
             * FIREBASE AUTHENTICATION
             * -------------------------------------------------
             */

            if (
                !window.firebase.auth
            ) {

                await carregarScript(

                    "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"

                );

            }


            /*
             * -------------------------------------------------
             * FIRESTORE
             * -------------------------------------------------
             */

            if (
                !window.firebase.firestore
            ) {

                await carregarScript(

                    "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"

                );

            }


            /*
             * -------------------------------------------------
             * INICIALIZAR APLICATIVO
             * -------------------------------------------------
             */

            const app =

                window.firebase.apps.length > 0

                    ? window.firebase.app()

                    : window.firebase.initializeApp(

                        firebaseConfig

                    );


            const db =
                app.firestore();


            /*
             * -------------------------------------------------
             * AUTENTICAÇÃO ANÔNIMA
             * -------------------------------------------------
             */

            if (
                !window.firebase.auth().currentUser
            ) {

                await window.firebase

                    .auth()

                    .signInAnonymously();

            }


            /*
             * -------------------------------------------------
             * CONFIRMAR AUTENTICAÇÃO
             * -------------------------------------------------
             */

            if (
                !window.firebase.auth().currentUser
            ) {

                throw new Error(

                    "A autenticação anônima não retornou um usuário."

                );

            }


            console.log(

                "CEEJA: autenticação Firebase concluída. UID:",

                window.firebase

                    .auth()

                    .currentUser

                    .uid

            );


            /*
             * -------------------------------------------------
             * DISPONIBILIZAR FIREBASE
             * -------------------------------------------------
             */

            window.CEEJAFirebase = {

                app:
                    app,

                db:
                    db,

                firebaseConfig:
                    firebaseConfig,

                pronto:
                    true,

                aguardarSincronizacao:
                    aguardarSincronizacao,

                salvarColecao:
                    function (
                        nome,
                        valor
                    ) {

                        return agendarColecao(

                            db,

                            nome,

                            valor

                        );

                    }

            };


            /*
             * -------------------------------------------------
             * CARREGAR DADOS DA NUVEM
             * -------------------------------------------------
             */

            await hidratarSistema(
                db
            );


            firebasePronto =
                true;


            /*
             * =================================================
             * INTERCEPTAR localStorage.setItem
             * =================================================
             */

            Storage.prototype.setItem =

                function (

                    chave,

                    valor

                ) {


                    /*
                     * Salvar normalmente no navegador
                     */

                    nativeSetItem.call(

                        this,

                        chave,

                        valor

                    );


                    /*
                     * Só sincronizar localStorage
                     */

                    if (
                        this !== localStorage
                    ) {

                        return;

                    }


                    if (
                        !firebasePronto
                    ) {

                        return;

                    }


                    /*
                     * ------------------------------------------------
                     * COLEÇÕES
                     * ------------------------------------------------
                     */

                    if (
                        COLLECTIONS.has(
                            chave
                        )
                    ) {

                        agendarColecao(

                            db,

                            chave,

                            valor

                        );


                        return;

                    }


                    /*
                     * ------------------------------------------------
                     * OBJETOS GLOBAIS
                     * ------------------------------------------------
                     */

                    if (
                        GLOBAL_OBJECTS.has(
                            chave
                        )
                    ) {

                        const filaId =
                            "__global__" +
                            chave;


                        const anterior =
                            filas.get(
                                filaId
                            ) ||
                            Promise.resolve();


                        const atual =
                            anterior.then(
                                function () {

                                    return sincronizarGlobal(

                                        db,

                                        chave,

                                        valor

                                    );

                                }
                            );


                        filas.set(
                            filaId,
                            atual
                        );


                        atual.catch(
                            function (erro) {

                                console.error(

                                    `Firebase: erro ao salvar ${chave}:`,

                                    erro

                                );

                            }
                        );


                        return;

                    }


                    /*
                     * ------------------------------------------------
                     * CONFIGURAÇÕES
                     * ------------------------------------------------
                     */

                    if (
                        SETTINGS.has(
                            chave
                        )
                    ) {

                        const filaId =
                            "__config__" +
                            chave;


                        const anterior =
                            filas.get(
                                filaId
                            ) ||
                            Promise.resolve();


                        const atual =
                            anterior.then(
                                function () {

                                    return sincronizarConfiguracao(

                                        db,

                                        chave,

                                        valor

                                    );

                                }
                            );


                        filas.set(
                            filaId,
                            atual
                        );


                        atual.catch(
                            function (erro) {

                                console.error(

                                    `Firebase: erro ao salvar configuração ${chave}:`,

                                    erro

                                );

                            }
                        );

                    }

                };


            /*
             * =================================================
             * FIREBASE CONECTADO
             * =================================================
             */

            console.log(

                "CEEJA: Firebase conectado e sincronização ativada."

            );


            /*
             * Executar código original da página
             */

            executarPaginaOriginal();

        }


        catch (erro) {

            firebasePronto =
                false;


            const codigo =
                erro &&
                erro.code

                    ? ` (${erro.code})`

                    : "";


            const detalhe =
                erro &&
                erro.message

                    ? erro.message

                    : String(
                        erro
                    );


            console.error(

                "CEEJA: erro ao inicializar Firebase:",

                erro

            );


            window.CEEJAFirebase = {

                pronto:
                    false,

                erro:
                    detalhe,

                aguardarSincronizacao:
                    function () {

                        return Promise.reject(
                            erro
                        );

                    }

            };


            /*
             * Mostrar o erro verdadeiro
             */

            mostrarErro(

                `Firebase não foi conectado${codigo}. ${detalhe}`

            );


            /*
             * Mesmo sem Firebase,
             * permite o sistema funcionar localmente.
             */

            executarPaginaOriginal();

        }

    }


    /*
     * =========================================================
     * INICIAR SISTEMA
     * =========================================================
     */

    iniciar();

})();
