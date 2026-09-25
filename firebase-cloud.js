/*
 * ============================================================
 * CEEJA LINHARES
 * FIREBASE CLOUD
 * ============================================================
 *
 * Integra:
 *
 * localStorage <-> Firebase Firestore
 *
 * Mantém o sistema atual funcionando e permite:
 *
 * - cadastrar alunos no Firebase
 * - carregar alunos do Firebase
 * - acessar de outro dispositivo
 * - sincronizar funcionários
 * - sincronizar presença
 * - sincronizar notas
 * - sincronizar conclusão de curso
 *
 * ============================================================
 */

(function () {

    "use strict";


    /* =========================================================
       CONFIGURAÇÃO DO FIREBASE
    ========================================================= */

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


    /* =========================================================
       CONTROLE
    ========================================================= */

    let firebasePronto = false;

    let firebaseErro = null;

    let sincronizando = {};


    /* =========================================================
       FUNÇÃO PARA CARREGAR OS SCRIPTS DO FIREBASE
    ========================================================= */

    function carregarScript(src) {

        return new Promise(function (resolve, reject) {

            const script =
                document.createElement("script");

            script.src = src;

            script.onload = function () {

                resolve();

            };

            script.onerror = function () {

                reject(
                    new Error(
                        "Não foi possível carregar: " + src
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
         * Firebase Firestore
         */

        if (!window.firebase.firestore) {

            await carregarScript(
                "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"
            );

        }

    }


    /* =========================================================
       GERAR ID DO DOCUMENTO
    ========================================================= */

    function gerarId(
        colecao,
        aluno,
        indice
    ) {

        let id = "";


        if (colecao === "cadastroAlunos") {

            id =
                aluno.cpf ||
                aluno.matricula ||
                String(indice);

        }

        else if (
            colecao ===
            "funcionariosCadastrados"
        ) {

            id =
                aluno.cpf ||
                aluno.usuario ||
                String(indice);

        }

        else if (
            colecao ===
            "registrosPresenca"
        ) {

            id =
                aluno.id ||
                (
                    String(
                        aluno.cpfAluno || "aluno"
                    )
                    + "_" +
                    String(
                        aluno.data || ""
                    )
                    + "_" +
                    String(
                        aluno.hora ||
                        aluno.horario ||
                        ""
                    )
                    + "_" +
                    String(indice)
                );

        }

        else {

            id =
                aluno.id ||
                (
                    String(
                        aluno.cpfAluno ||
                        aluno.cpf ||
                        "registro"
                    )
                    + "_" +
                    String(
                        aluno.timestamp ||
                        Date.now()
                    )
                    + "_" +
                    String(indice)
                );

        }


        return String(id)
            .replace(/[\\/#?\[\]]/g, "_")
            .substring(0, 140);

    }


    /* =========================================================
       LIMPAR DADOS INTERNOS
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
        db,
        nome
    ) {

        const snapshot =
            await db
                .collection(nome)
                .get();


        const dados = [];


        snapshot.forEach(function (doc) {

            dados.push({

                ...doc.data(),

                _firestoreId:
                    doc.id

            });

        });


        return dados;

    }


    /* =========================================================
       CARREGAR FIREBASE PARA LOCALSTORAGE
    ========================================================= */

    async function hidratarSistema(db) {

        const originalSetItem =
            Storage.prototype.setItem;


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
                 * quando existem dados na nuvem.
                 */

                if (dados.length > 0) {

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

    }


    /* =========================================================
       SALVAR COLEÇÃO
       
       ESTA É A FUNÇÃO USADA PELO
       cadastro_aluno(3).html
    ========================================================= */

    async function salvarColecao(
        nome,
        valor
    ) {

        if (!firebasePronto) {

            throw new Error(
                "Firebase ainda não está pronto."
            );

        }


        if (!COLLECTIONS.includes(nome)) {

            throw new Error(
                "Coleção não permitida: " +
                nome
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
                "Dados inválidos para salvar no Firebase."
            );

        }


        if (!Array.isArray(dados)) {

            throw new Error(
                "Os dados precisam ser uma lista."
            );

        }


        const db =
            window.CEEJAFirebase.db;


        /*
         * Impede gravações simultâneas
         */

        if (sincronizando[nome]) {

            return true;

        }


        sincronizando[nome] = true;


        try {

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
                            nome,
                            item,
                            i
                        )

                    );


                const dadosLimpos =
                    limparDados(item);


                await db
                    .collection(nome)
                    .doc(id)
                    .set(
                        dadosLimpos,
                        {
                            merge: true
                        }
                    );


                /*
                 * Guarda o ID
                 * do documento.
                 */

                item._firestoreId =
                    id;

            }


            /*
             * Atualiza o localStorage
             */

            localStorage.setItem(

                nome,

                JSON.stringify(
                    dados
                )

            );


            console.log(
                "Firebase: " +
                nome +
                " salvo com sucesso."
            );


            return true;

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

                window.__erroFirebaseCadastro =

                    erro &&
                    erro.message

                        ? erro.message

                        : String(erro);

            }


            throw erro;

        }

        finally {

            sincronizando[nome] =
                false;

        }

    }


    /* =========================================================
       SINCRONIZAR AUTOMATICAMENTE O LOCALSTORAGE
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
                 */

                originalSetItem.call(

                    this,

                    chave,

                    valor

                );


                /*
                 * Só trabalha com localStorage
                 */

                if (
                    this !==
                    localStorage
                ) {

                    return;

                }


                /*
                 * Se for uma coleção,
                 * envia para o Firebase.
                 */

                if (
                    COLLECTIONS.includes(
                        chave
                    )
                ) {

                    salvarColecao(
                        chave,
                        valor
                    )
                    .catch(function (erro) {

                        console.error(
                            "Erro na sincronização:",
                            erro
                        );

                    });

                }

            };

    }


    /* =========================================================
       INICIAR
    ========================================================= */

    async function iniciar() {

        /*
         * Cria o objeto global imediatamente.
         */

        window.CEEJAFirebase = {

            pronto: false,

            erro: null,

            db: null,

            app: null,

            firebaseConfig:
                firebaseConfig,

            salvarColecao:
                salvarColecao

        };


        try {

            /*
             * Carregar Firebase
             */

            await carregarFirebase();


            /*
             * Inicializar aplicativo
             */

            let app;


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


            const db =
                app.firestore();


            /*
             * Autenticação anônima
             */

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
                    "Firebase Authentication:",
                    erroAuth
                );

            }


            /*
             * Disponibiliza o Firebase
             */

            window.CEEJAFirebase.app =
                app;

            window.CEEJAFirebase.db =
                db;


            /*
             * Carregar dados existentes
             */

            await hidratarSistema(db);


            /*
             * Firebase pronto
             */

            firebasePronto =
                true;


            window.CEEJAFirebase.pronto =
                true;

            window.CEEJAFirebase.erro =
                null;


            /*
             * Ativar sincronização
             */

            ativarSincronizacao();


            console.log(
                "CEEJA: Firebase conectado."
            );


            /*
             * =================================================
             * EXECUTAR CÓDIGO DA PÁGINA
             * =================================================
             *
             * Algumas páginas usam:
             *
             * <script
             * id="ceeja-app-script"
             * type="text/plain">
             *
             * </script>
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

        catch (erro) {

            console.error(
                "CEEJA: erro ao inicializar Firebase:",
                erro
            );


            firebasePronto =
                false;


            firebaseErro =
                erro;


            window.CEEJAFirebase.pronto =
                false;


            window.CEEJAFirebase.erro =

                erro &&
                erro.message

                    ? erro.message

                    : String(erro);


            /*
             * Mesmo com erro,
             * executa a página normalmente.
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


    /* =========================================================
       INICIAR SISTEMA
    ========================================================= */

    iniciar();


})();
