/*
============================================================
CEEJA LINHARES
FIREBASE CLOUD
============================================================
*/

(function () {

    "use strict";


    /* ======================================================
       CONFIGURAÇÃO
    ====================================================== */

    const firebaseConfig = {

        apiKey:
            "AIzaSyAYa8tTEJ4raHcdBdDnFIZlF7y2LjTX8",

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


    /* ======================================================
       VARIÁVEIS
    ====================================================== */

    let firebasePronto = false;

    let db = null;

    let app = null;


    const colecoes = [

        "cadastroAlunos",

        "funcionariosCadastrados",

        "registrosPresenca",

        "registrosNotas",

        "registrosConclusaoCurso"

    ];


    /* ======================================================
       OBJETO GLOBAL
       
       CRIADO IMEDIATAMENTE
    ====================================================== */

    window.CEEJAFirebase = {

        pronto: false,

        erro: null,

        db: null,

        app: null,

        firebaseConfig: firebaseConfig,

        salvarColecao: null

    };


    /* ======================================================
       GERAR ID
    ====================================================== */

    function gerarId(
        nomeColecao,
        item,
        indice
    ) {

        let id;


        if (
            nomeColecao ===
            "cadastroAlunos"
        ) {

            id =
                item.cpf ||
                item.matricula ||
                indice;

        }

        else if (
            nomeColecao ===
            "funcionariosCadastrados"
        ) {

            id =
                item.cpf ||
                item.usuario ||
                indice;

        }

        else if (
            nomeColecao ===
            "registrosPresenca"
        ) {

            id =
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
                    indice
                );

        }

        else {

            id =
                item.id ||
                (
                    (item.cpfAluno ||
                     item.cpf ||
                     "registro") +
                    "_" +
                    (item.timestamp ||
                     Date.now()) +
                    "_" +
                    indice
                );

        }


        return String(id)
            .replace(
                /[\\/#?\[\]]/g,
                "_"
            )
            .substring(0, 140);

    }


    /* ======================================================
       LIMPAR DADOS
    ====================================================== */

    function limparDados(item) {

        const copia = {
            ...item
        };

        delete copia._firestoreId;

        return copia;

    }


    /* ======================================================
       CARREGAR DADOS DO FIREBASE
    ====================================================== */

    async function carregarDadosFirebase() {

        for (
            const nomeColecao
            of colecoes
        ) {

            try {

                const snapshot =
                    await db
                        .collection(
                            nomeColecao
                        )
                        .get();


                const lista = [];


                snapshot.forEach(
                    function (doc) {

                        lista.push({

                            ...doc.data(),

                            _firestoreId:
                                doc.id

                        });

                    }
                );


                /*
                 * Só substitui o localStorage
                 * se realmente houver dados.
                 */

                if (
                    lista.length > 0
                ) {

                    localStorage.setItem(

                        nomeColecao,

                        JSON.stringify(
                            lista
                        )

                    );

                }

            }

            catch (erro) {

                console.error(

                    "Firebase: erro ao carregar " +
                    nomeColecao,

                    erro

                );

            }

        }

    }


    /* ======================================================
       SALVAR COLEÇÃO
       
       USADA DIRETAMENTE PELO
       cadastro_aluno(3).html
    ====================================================== */

    async function salvarColecao(
        nomeColecao,
        valor
    ) {

        if (!firebasePronto) {

            throw new Error(
                "Firebase ainda não está pronto."
            );

        }


        let dados;


        try {

            dados =
                typeof valor === "string"
                    ? JSON.parse(valor)
                    : valor;

        }

        catch (erro) {

            throw new Error(
                "Os dados enviados não são válidos."
            );

        }


        if (!Array.isArray(dados)) {

            throw new Error(
                "Os dados precisam ser uma lista."
            );

        }


        /*
         * Salvar cada aluno
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


            const dadosLimpos =
                limparDados(item);


            await db
                .collection(nomeColecao)
                .doc(id)
                .set(
                    dadosLimpos,
                    {
                        merge: true
                    }
                );


            /*
             * Guarda o ID
             */

            item._firestoreId =
                id;

        }


        /*
         * Salva também localmente
         */

        localStorage.setItem(

            nomeColecao,

            JSON.stringify(
                dados
            )

        );


        console.log(
            "Firebase: " +
            nomeColecao +
            " salvo com sucesso."
        );


        return true;

    }


    /*
     * Disponibiliza a função
     */

    window.CEEJAFirebase.salvarColecao =
        salvarColecao;


    /* ======================================================
       SINCRONIZAR localStorage AUTOMATICAMENTE
    ====================================================== */

    function ativarSincronizacao() {

        const originalSetItem =
            Storage.prototype.setItem;


        Storage.prototype.setItem =

            function (
                chave,
                valor
            ) {

                /*
                 * Salva normalmente
                 */

                originalSetItem.call(

                    this,

                    chave,

                    valor

                );


                /*
                 * Só sincroniza
                 * o localStorage
                 */

                if (
                    this !==
                    localStorage
                ) {

                    return;

                }


                if (
                    colecoes.includes(
                        chave
                    )
                ) {

                    salvarColecao(
                        chave,
                        valor
                    )
                    .catch(
                        function (erro) {

                            console.error(
                                "Firebase:",
                                erro
                            );

                        }
                    );

                }

            };

    }


    /* ======================================================
       INICIALIZAÇÃO
    ====================================================== */

    async function iniciarFirebase() {

        try {

            /*
             * =================================================
             * IMPORTANTE:
             * O cadastro_aluno.html não carrega o Firebase
             * diretamente.
             *
             * Portanto carregamos aqui a versão 8.10.1.
             * =================================================
             */

            if (!window.firebase) {

                await carregarScript(
                    "https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js"
                );

            }


            if (
                !window.firebase.firestore
            ) {

                await carregarScript(
                    "https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js"
                );

            }


            if (
                !window.firebase.auth
            ) {

                await carregarScript(
                    "https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js"
                );

            }


            /* =================================================
               INICIALIZAR
            ================================================= */

            if (
                window.firebase.apps &&
                window.firebase.apps.length > 0
            ) {

                app =
                    window.firebase.app();

            }

            else {

                app =
                    window.firebase.initializeApp(
                        firebaseConfig
                    );

            }


            db =
                app.firestore();


            /*
             * Disponibilizar globalmente
             */

            window.CEEJAFirebase.app =
                app;

            window.CEEJAFirebase.db =
                db;


            /* =================================================
               AUTENTICAÇÃO ANÔNIMA
            ================================================= */

            try {

                if (
                    !window.firebase
                        .auth()
                        .currentUser
                ) {

                    await window.firebase
                        .auth()
                        .signInAnonymously();

                }

            }

            catch (erroAuth) {

                console.warn(
                    "Autenticação anônima:",
                    erroAuth
                );

            }


            /* =================================================
               CARREGAR DADOS
            ================================================= */

            await carregarDadosFirebase();


            /* =================================================
               FIREBASE PRONTO
            ================================================= */

            firebasePronto =
                true;


            window.CEEJAFirebase.pronto =
                true;


            window.CEEJAFirebase.erro =
                null;


            console.log(
                "================================"
            );

            console.log(
                "CEEJA: FIREBASE CONECTADO"
            );

            console.log(
                "CEEJA: FIREBASE PRONTO = TRUE"
            );

            console.log(
                "================================"
            );


            /* =================================================
               ATIVAR SINCRONIZAÇÃO
            ================================================= */

            ativarSincronizacao();


            /* =================================================
               EXECUTAR CÓDIGO DA PÁGINA
            ================================================= */

            const holder =
                document.getElementById(
                    "ceeja-app-script"
                );


            if (holder) {

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

        }

        catch (erro) {

            console.error(
                "================================"
            );

            console.error(
                "CEEJA: ERRO NO FIREBASE"
            );

            console.error(
                erro
            );

            console.error(
                "================================"
            );


            firebasePronto =
                false;


            window.CEEJAFirebase.pronto =
                false;


            window.CEEJAFirebase.erro =

                erro &&
                erro.message

                    ? erro.message

                    : String(erro);


            /*
             * Executa a página mesmo
             * se houver erro.
             */

            const holder =
                document.getElementById(
                    "ceeja-app-script"
                );


            if (holder) {

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

        }

    }


    /* ======================================================
       INICIAR
    ====================================================== */

    iniciarFirebase();


})();
