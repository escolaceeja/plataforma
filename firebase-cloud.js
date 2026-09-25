/*
 * ============================================================
 * CEEJA LINHARES
 * Integração entre localStorage e Firebase Firestore
 * ============================================================
 *
 * Este arquivo:
 *
 * 1. Mantém o sistema atual funcionando com localStorage.
 * 2. Carrega os dados existentes do Firebase.
 * 3. Sincroniza alterações do localStorage com o Firebase.
 * 4. Usa autenticação anônima do Firebase.
 * 5. Não apaga automaticamente documentos existentes na nuvem.
 *
 * ============================================================
 */

(function () {

    /*
     * =========================================================
     * CONFIGURAÇÃO DO FIREBASE
     * =========================================================
     */

    const firebaseConfig = {

        apiKey: "AIzaSyAYa8tTEJ4raHcdBdDnFIZlF7y2LjTX8",

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
     * COLEÇÕES QUE FICAM NA NUVEM
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


    let firebasePronto = false;

    let sincronizando = new Set();


    /*
     * =========================================================
     * CARREGAR SCRIPTS DO FIREBASE
     * =========================================================
     */

    function carregarScript(src) {

        return new Promise(function (resolve, reject) {

            const script = document.createElement("script");

            script.src = src;

            script.onload = resolve;

            script.onerror = reject;

            document.head.appendChild(script);

        });

    }


    /*
     * =========================================================
     * GERAR ID ESTÁVEL PARA OS DOCUMENTOS
     * =========================================================
     */

    function gerarId(collectionName, item, index) {

        let raw;


        if (collectionName === "cadastroAlunos") {

            raw =
                item.cpf ||
                item.matricula ||
                String(index);

        }


        else if (collectionName === "funcionariosCadastrados") {

            raw =
                item.cpf ||
                item.usuario ||
                String(index);

        }


        else if (collectionName === "registrosPresenca") {

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
            .replace(/[\\/#?\[\]]/g, "_")
            .slice(0, 140) || String(index);

    }


    /*
     * =========================================================
     * REMOVER CAMPOS INTERNOS
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
     * CARREGAR UMA COLEÇÃO DO FIREBASE
     * =========================================================
     */

    async function carregarColecao(db, nome) {

        const {
            collection,
            getDocs
        } = window.firebase.firestore;


        const snapshot =
            await getDocs(
                collection(db, nome)
            );


        const dados = [];


        snapshot.forEach(function (docSnap) {

            dados.push({

                ...docSnap.data(),

                _firestoreId: docSnap.id

            });

        });


        return dados;

    }


    /*
     * =========================================================
     * CARREGAR DADOS DO FIREBASE PARA O SISTEMA
     * =========================================================
     */

    async function hidratarSistema(db) {

        const originalSet =
            Storage.prototype.setItem;


        /*
         * -----------------------------------------------------
         * COLEÇÕES
         * -----------------------------------------------------
         */

        for (const nome of COLLECTIONS) {

            try {

                const dados =
                    await carregarColecao(
                        db,
                        nome
                    );


                /*
                 * Só substitui o localStorage se
                 * houver dados na nuvem.
                 *
                 * Isso evita apagar uma base local
                 * caso a coleção ainda esteja vazia.
                 */

                if (dados.length > 0) {

                    originalSet.call(

                        localStorage,

                        nome,

                        JSON.stringify(dados)

                    );

                }

            }

            catch (erro) {

                console.error(

                    `Firebase: erro ao carregar ${nome}`,

                    erro

                );

            }

        }


        /*
         * -----------------------------------------------------
         * OBJETOS GLOBAIS
         * -----------------------------------------------------
         */

        for (const nome of GLOBAL_OBJECTS) {

            try {

                const {
                    collection,
                    getDocs
                } = window.firebase.firestore;


                const snapshot =
                    await getDocs(
                        collection(db, nome)
                    );


                const documento =
                    snapshot.docs.find(
                        function (d) {

                            return d.id === "_global";

                        }
                    );


                if (

                    documento &&

                    documento.data().value !== undefined

                ) {

                    originalSet.call(

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

                    `Firebase: erro ao carregar ${nome}`,

                    erro

                );

            }

        }


        /*
         * -----------------------------------------------------
         * CONFIGURAÇÕES
         * -----------------------------------------------------
         */

        for (const nome of SETTINGS) {

            try {

                const {
                    collection,
                    getDocs
                } = window.firebase.firestore;


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

                            return d.id === nome;

                        }
                    );


                if (

                    documento &&

                    documento.data().value !== undefined

                ) {

                    originalSet.call(

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

                    `Firebase: erro ao carregar configuração ${nome}`,

                    erro

                );

            }

        }

    }


    /*
     * =========================================================
     * SINCRONIZAR COLEÇÃO COM O FIREBASE
     * =========================================================
     */

    async function sincronizarColecao(

        db,

        nome,

        valor

    ) {

        /*
         * Evita duas gravações simultâneas
         * da mesma coleção.
         */

        if (sincronizando.has(nome)) {

            return;

        }


        sincronizando.add(nome);


        try {

            let dados;


            /*
             * -------------------------------------------------
             * TRANSFORMAR JSON EM OBJETO
             * -------------------------------------------------
             */

            try {

                dados =
                    JSON.parse(valor);

            }

            catch (erro) {

                console.error(

                    `Firebase: JSON inválido em ${nome}`,

                    erro

                );

                return;

            }


            if (!Array.isArray(dados)) {

                console.warn(

                    `Firebase: ${nome} não é uma lista.`

                );

                return;

            }


            const {
                doc,
                setDoc
            } = window.firebase.firestore;


            /*
             * -------------------------------------------------
             * SALVAR CADA REGISTRO
             * -------------------------------------------------
             *
             * IMPORTANTE:
             *
             * Não apagamos automaticamente os documentos
             * que já existem na nuvem.
             *
             * Isso evita que um computador com uma cópia
             * antiga apague dados cadastrados em outro.
             */

            for (

                let indice = 0;

                indice < dados.length;

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
                    limparDados(item);


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
                 * Guarda o ID do Firestore
                 * no objeto local.
                 */

                item._firestoreId = id;

            }


            /*
             * Atualiza o localStorage com os
             * IDs do Firebase.
             */

            const originalSet =
                Storage.prototype.setItem;


            originalSet.call(

                localStorage,

                nome,

                JSON.stringify(dados)

            );


            console.log(

                `Firebase: ${nome} sincronizado com sucesso.`

            );

        }


        catch (erro) {

            console.error(

                `Firebase: erro ao salvar ${nome}:`,

                erro

            );


            /*
             * Mostra o erro específico do cadastro
             * quando a coleção for cadastroAlunos.
             */

            if (nome === "cadastroAlunos") {

                const detalhe =

                    erro && erro.code

                        ? ` (${erro.code})`

                        : "";


                const mensagem =

                    `Não foi possível salvar cadastroAlunos no Firebase${detalhe}.`;


                console.error(

                    "CEEJA: detalhe do erro Firebase:",

                    erro && erro.message

                        ? erro.message

                        : erro

                );


                /*
                 * Se a página possuir a função,
                 * mostra a mensagem nela.
                 */

                if (

                    typeof window.mostrarErroFirebase ===

                    "function"

                ) {

                    window.mostrarErroFirebase(

                        mensagem

                    );

                }

                else {

                    window.__erroFirebaseCadastro =

                        mensagem;

                }

            }

        }


        finally {

            sincronizando.delete(nome);

        }

    }


    /*
     * =========================================================
     * SINCRONIZAR OBJETO GLOBAL
     * =========================================================
     */

    async function sincronizarGlobal(

        db,

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

                dados = valor;

            }


            const {
                doc,
                setDoc
            } = window.firebase.firestore;


            await setDoc(

                doc(

                    db,

                    nome,

                    "_global"

                ),

                {

                    value: dados

                },

                {

                    merge: true

                }

            );


            console.log(

                `Firebase: ${nome} salvo.`

            );

        }

        catch (erro) {

            console.error(

                `Firebase: erro ao salvar ${nome}:`,

                erro

            );

        }

    }


    /*
     * =========================================================
     * SINCRONIZAR CONFIGURAÇÃO
     * =========================================================
     */

    async function sincronizarConfiguracao(

        db,

        nome,

        valor

    ) {

        try {

            const {
                doc,
                setDoc
            } = window.firebase.firestore;


            await setDoc(

                doc(

                    db,

                    "_config",

                    nome

                ),

                {

                    value: String(valor)

                },

                {

                    merge: true

                }

            );


            console.log(

                `Firebase: configuração ${nome} salva.`

            );

        }

        catch (erro) {

            console.error(

                `Firebase: erro ao salvar configuração ${nome}:`,

                erro

            );

        }

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

            if (!window.firebase) {

                await carregarScript(

                    "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"

                );

            }


            /*
             * -------------------------------------------------
             * FIREBASE AUTHENTICATION
             * -------------------------------------------------
             */

            if (!window.firebase.auth) {

                await carregarScript(

                    "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"

                );

            }


            /*
             * -------------------------------------------------
             * FIRESTORE
             * -------------------------------------------------
             */

            if (!window.firebase.firestore) {

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
             *
             * O usuário não precisa criar uma conta.
             *
             * O Firebase cria uma identidade anônima
             * para o navegador.
             */

            try {

                if (

                    !window.firebase.auth().currentUser

                ) {

                    await window.firebase
                        .auth()
                        .signInAnonymously();

                }


                console.log(

                    "CEEJA: autenticação Firebase concluída.",

                    window.firebase
                        .auth()
                        .currentUser

                        ? window.firebase
                            .auth()
                            .currentUser
                            .uid

                        : ""

                );

            }

            catch (erroAuth) {

                console.error(

                    "CEEJA: não foi possível autenticar no Firebase. " +

                    "Verifique se o provedor 'Anônimo' está habilitado " +

                    "no Firebase Authentication.",

                    erroAuth

                );

            }


            /*
             * Disponibiliza o Firebase para
             * outras partes do sistema.
             */

            window.CEEJAFirebase = {

                app,

                db,

                firebaseConfig

            };


            /*
             * -------------------------------------------------
             * PRIMEIRO CARREGAR A NUVEM
             * -------------------------------------------------
             */

            await hidratarSistema(db);


            firebasePronto = true;


            /*
             * =================================================
             * INTERCEPTAR localStorage.setItem
             * =================================================
             */

            const originalSet =
                Storage.prototype.setItem;


            Storage.prototype.setItem =

                function (

                    chave,

                    valor

                ) {


                    /*
                     * ------------------------------------------------
                     * SALVA NORMALMENTE NO NAVEGADOR
                     * ------------------------------------------------
                     */

                    originalSet.call(

                        this,

                        chave,

                        valor

                    );


                    /*
                     * Só sincroniza o localStorage.
                     */

                    if (

                        this !== localStorage

                    ) {

                        return;

                    }


                    /*
                     * ------------------------------------------------
                     * COLEÇÕES
                     * ------------------------------------------------
                     */

                    if (

                        COLLECTIONS.has(chave)

                    ) {

                        sincronizarColecao(

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

                        GLOBAL_OBJECTS.has(chave)

                    ) {

                        sincronizarGlobal(

                            db,

                            chave,

                            valor

                        );

                        return;

                    }


                    /*
                     * ------------------------------------------------
                     * CONFIGURAÇÕES
                     * ------------------------------------------------
                     */

                    if (

                        SETTINGS.has(chave)

                    ) {

                        sincronizarConfiguracao(

                            db,

                            chave,

                            valor

                        );

                    }

                };


            /*
             * =================================================
             * EXECUTAR O CÓDIGO ORIGINAL DA PÁGINA
             * =================================================
             *
             * As páginas do CEEJA possuem o código original
             * dentro de:
             *
             * <script id="ceeja-app-script" type="text/plain">
             *
             * Só executamos esse código depois que o Firebase
             * terminou de carregar os dados.
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


            console.log(

                "CEEJA: Firebase conectado e sincronização ativada."

            );

        }


        catch (erro) {

            console.error(

                "CEEJA: erro ao inicializar Firebase:",

                erro

            );


            /*
             * -------------------------------------------------
             * MODO LOCAL
             * -------------------------------------------------
             *
             * Se o Firebase estiver indisponível,
             * o sistema continua funcionando normalmente
             * com localStorage.
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


    /*
     * =========================================================
     * INICIAR SISTEMA
     * =========================================================
     */

    iniciar();

})();
