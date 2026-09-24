/*
 * CEEJA LINHARES
 * Integração localStorage + Firebase Firestore
 */

(function () {

    const firebaseConfig = {
        apiKey: "AIzaSyAYa8tTEJ4raHcdpdBdDnFIZlF7y2LjTX8",
        authDomain: "ceeja-linhares-sistema.firebaseapp.com",
        projectId: "ceeja-linhares-sistema",
        storageBucket: "ceeja-linhares-sistema.firebasestorage.app",
        messagingSenderId: "791087995006",
        appId: "1:791087995006:web:14c93bc02b36c73aa8602f"
    };

    /*
     * COLEÇÕES QUE SERÃO SALVAS NO FIRESTORE
     */

    const COLLECTIONS = new Set([
        "cadastroAlunos",
        "funcionariosCadastrados",
        "registrosPresenca",
        "registrosNotas",
        "registrosConclusaoCurso"
    ]);

    /*
     * DADOS GLOBAIS
     */

    const GLOBAL_OBJECTS = new Set([
        "historicoBuscaAtiva",
        "controleMatriculas"
    ]);

    /*
     * CONFIGURAÇÕES
     */

    const SETTINGS = new Set([
        "senhaPedagogo",
        "nomePedagogo"
    ]);

    let firebaseIniciado = false;
    let sincronizando = new Set();


    /*
     * CARREGAR SCRIPT DO FIREBASE
     */

    function carregarScript(src) {

        return new Promise((resolve, reject) => {

            const script = document.createElement("script");

            script.src = src;

            script.onload = resolve;

            script.onerror = reject;

            document.head.appendChild(script);

        });

    }


    /*
     * GERAR ID DOS DOCUMENTOS
     */

    function gerarId(nome, item, indice) {

        let id;

        if (nome === "cadastroAlunos") {

            id =
                item.cpf ||
                item.matricula ||
                String(indice);

        }

        else if (nome === "funcionariosCadastrados") {

            id =
                item.cpf ||
                item.usuario ||
                String(indice);

        }

        else if (nome === "registrosPresenca") {

            id =
                item.id ||
                `${item.cpfAluno || "aluno"}_${item.data || ""}_${item.hora || item.horario || ""}_${indice}`;

        }

        else {

            id =
                item.id ||
                `${item.cpfAluno || item.cpf || "registro"}_${item.timestamp || Date.now()}_${indice}`;

        }

        return String(id)
            .replace(/[\\/#?\[\]]/g, "_")
            .slice(0, 140);

    }


    /*
     * REMOVER CAMPO INTERNO
     */

    function limparDados(item) {

        const copia = {
            ...item
        };

        delete copia._firestoreId;

        return copia;

    }


    /*
     * MOSTRAR AVISO NA TELA
     */

    function mostrarAviso(mensagem, tipo = "erro") {

        try {

            let aviso =
                document.getElementById("ceeja-firebase-aviso");

            if (!aviso) {

                aviso = document.createElement("div");

                aviso.id = "ceeja-firebase-aviso";

                aviso.style.cssText =
                    "position:fixed;" +
                    "bottom:20px;" +
                    "right:20px;" +
                    "z-index:999999;" +
                    "max-width:450px;" +
                    "padding:15px 20px;" +
                    "border-radius:8px;" +
                    "font:14px Arial,sans-serif;" +
                    "font-weight:bold;" +
                    "box-shadow:0 4px 15px rgba(0,0,0,.25);";

                document.body.appendChild(aviso);

            }

            if (tipo === "sucesso") {

                aviso.style.background = "#d4edda";
                aviso.style.color = "#155724";
                aviso.style.border = "1px solid #c3e6cb";

            }

            else {

                aviso.style.background = "#f8d7da";
                aviso.style.color = "#721c24";
                aviso.style.border = "1px solid #f5c6cb";

            }

            aviso.textContent = mensagem;

            aviso.style.display = "block";

            setTimeout(() => {

                aviso.style.display = "none";

            }, 6000);

        }

        catch (erro) {

            console.error(
                "CEEJA: não foi possível mostrar aviso.",
                erro
            );

        }

    }


    /*
     * CARREGAR UMA COLEÇÃO DO FIREBASE
     */

    async function carregarColecao(db, nome) {

        const {
            collection,
            getDocs
        } = window.firebase.firestore;

        const resultado =
            await getDocs(
                collection(db, nome)
            );

        const dados = [];

        resultado.forEach(documento => {

            dados.push({

                ...documento.data(),

                _firestoreId: documento.id

            });

        });

        return dados;

    }


    /*
     * CARREGAR DADOS DO FIREBASE PARA O LOCALSTORAGE
     */

    async function carregarDadosDaNuvem(db) {

        const originalSet =
            Storage.prototype.setItem;


        /*
         * COLEÇÕES
         */

        for (const nome of COLLECTIONS) {

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
                    `Firebase: erro ao carregar ${nome}:`,
                    erro
                );

            }

        }


        /*
         * OBJETOS GLOBAIS
         */

        for (const nome of GLOBAL_OBJECTS) {

            try {

                const {
                    collection,
                    getDocs
                } = window.firebase.firestore;

                const resultado =
                    await getDocs(
                        collection(db, nome)
                    );

                const documento =
                    resultado.docs.find(
                        doc => doc.id === "_global"
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
                    `Firebase: erro ao carregar ${nome}:`,
                    erro
                );

            }

        }


        /*
         * CONFIGURAÇÕES
         */

        for (const nome of SETTINGS) {

            try {

                const {
                    collection,
                    getDocs
                } = window.firebase.firestore;

                const resultado =
                    await getDocs(
                        collection(
                            db,
                            "_config"
                        )
                    );

                const documento =
                    resultado.docs.find(
                        doc => doc.id === nome
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
                    `Firebase: erro ao carregar configuração ${nome}:`,
                    erro
                );

            }

        }

    }


    /*
     * SALVAR COLEÇÃO NO FIRESTORE
     */

    async function sincronizarColecao(
        db,
        nome,
        valor
    ) {

        /*
         * Evita duas sincronizações
         * simultâneas da mesma coleção.
         */

        if (sincronizando.has(nome)) {

            return;

        }

        sincronizando.add(nome);

        try {

            let dados;

            try {

                dados =
                    JSON.parse(valor);

            }

            catch (erro) {

                console.error(
                    `Firebase: JSON inválido em ${nome}:`,
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
             * SALVA CADA ITEM
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
                 * no registro local.
                 */

                item._firestoreId = id;

            }


            /*
             * Atualiza o localStorage
             * com os IDs do Firestore.
             */

            const originalSet =
                Storage.prototype.setItem;

            originalSet.call(

                localStorage,

                nome,

                JSON.stringify(dados)

            );


            console.log(
                `Firebase: ${nome} salvo com sucesso.`
            );


        }

        catch (erro) {

            console.error(
                `Firebase: erro ao salvar ${nome}:`,
                erro
            );


            if (
                erro &&
                erro.code === "permission-denied"
            ) {

                mostrarAviso(
                    `O Firebase recusou a gravação de ${nome}. Verifique as regras do Firestore.`
                );

            }

            else {

                mostrarAviso(
                    `Não foi possível salvar ${nome} no Firebase.`
                );

            }

        }

        finally {

            sincronizando.delete(nome);

        }

    }


    /*
     * SALVAR OBJETO GLOBAL
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

            if (
                erro &&
                erro.code === "permission-denied"
            ) {

                mostrarAviso(
                    `O Firebase recusou a gravação de ${nome}.`
                );

            }

        }

    }


    /*
     * SALVAR CONFIGURAÇÃO
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

            if (
                erro &&
                erro.code === "permission-denied"
            ) {

                mostrarAviso(
                    `O Firebase recusou a gravação da configuração ${nome}.`
                );

            }

        }

    }


    /*
     * INICIAR FIREBASE
     */

    async function iniciar() {

        try {

            /*
             * Firebase App
             */

            if (!window.firebase) {

                await carregarScript(
                    "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"
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


            /*
             * Inicializar Firebase
             */

            const app =
                window.firebase.apps.length > 0
                    ? window.firebase.app()
                    : window.firebase.initializeApp(
                        firebaseConfig
                    );


            const db =
                app.firestore();


            window.CEEJAFirebase = {

                app,

                db,

                firebaseConfig

            };


            /*
             * Primeiro carrega os dados
             * existentes no Firebase.
             */

            await carregarDadosDaNuvem(db);


            firebaseIniciado = true;


            /*
             * INTERCEPTAR localStorage.setItem
             */

            const originalSet =
                Storage.prototype.setItem;


            Storage.prototype.setItem =
                function (
                    chave,
                    valor
                ) {


                    /*
                     * Salva normalmente
                     * no navegador.
                     */

                    originalSet.call(
                        this,
                        chave,
                        valor
                    );


                    /*
                     * Só interessa o localStorage.
                     */

                    if (
                        this !== localStorage
                    ) {

                        return;

                    }


                    /*
                     * COLEÇÕES
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
                     * OBJETOS GLOBAIS
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
                     * CONFIGURAÇÕES
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
             * EXECUTAR O CÓDIGO ORIGINAL
             * DA PÁGINA.
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


            mostrarAviso(
                "Firebase não foi conectado. Os dados podem estar sendo salvos apenas neste navegador.",
                "erro"
            );


            /*
             * Se o Firebase falhar,
             * o sistema continua funcionando
             * localmente.
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
     * INICIAR
     */

    iniciar();

})();
