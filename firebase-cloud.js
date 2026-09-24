/*
 * CEEJA LINHARES
 * Ponte entre localStorage e Firebase Firestore
 *
 * Objetivo:
 * - manter as páginas atuais funcionando com localStorage;
 * - carregar os dados do Firebase ao abrir cada página;
 * - salvar automaticamente no Firebase quando o sistema alterar
 *   localStorage;
 * - evitar apagar dados da nuvem por causa de uma cópia local antiga;
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
     * DADOS QUE DEVEM FICAR NA NUVEM
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


    let firebasePronto = false;
    let sincronizando = new Set();


    /*
     * =========================================================
     * CARREGAR FIREBASE
     * =========================================================
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
     * =========================================================
     * GERAR ID ESTÁVEL
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
     * CARREGAR DADOS DO FIREBASE
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


        snapshot.forEach(docSnap => {

            dados.push({
                ...docSnap.data(),
                _firestoreId: docSnap.id
            });

        });


        return dados;

    }


    /*
     * =========================================================
     * HIDRATAR LOCALSTORAGE
     * =========================================================
     */

    async function hidratarSistema(db) {

        const originalSet =
            Storage.prototype.setItem;


        /*
         * Coleções
         */

        for (const nome of COLLECTIONS) {

            try {

                const dados =
                    await carregarColecao(db, nome);


                /*
                 * Só substitui o localStorage se houver
                 * dados no Firebase.
                 *
                 * Isso evita apagar uma base local válida
                 * caso a coleção ainda esteja vazia.
                 */

                if (dados.length > 0) {

                    originalSet.call(
                        localStorage,
                        nome,
                        JSON.stringify(dados)
                    );

                }

            } catch (erro) {

                console.error(
                    `Firebase: erro ao carregar ${nome}`,
                    erro
                );

            }

        }


        /*
         * Objetos globais
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
                        d => d.id === "_global"
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

            } catch (erro) {

                console.error(
                    `Firebase: erro ao carregar ${nome}`,
                    erro
                );

            }

        }


        /*
         * Configurações
         */

        for (const nome of SETTINGS) {

            try {

                const {
                    collection,
                    getDocs
                } = window.firebase.firestore;


                const snapshot =
                    await getDocs(
                        collection(db, "_config")
                    );


                const documento =
                    snapshot.docs.find(
                        d => d.id === nome
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

            } catch (erro) {

                console.error(
                    `Firebase: erro ao carregar configuração ${nome}`,
                    erro
                );

            }

        }

    }


    /*
     * =========================================================
     * SALVAR COLEÇÃO
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


            try {

                dados =
                    JSON.parse(valor);

            } catch (erro) {

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
                collection,
                doc,
                setDoc
            } = window.firebase.firestore;


            /*
             * IMPORTANTE:
             *
             * Não apagamos documentos da nuvem
             * automaticamente.
             *
             * Isso evita que uma cópia local antiga
             * apague dados cadastrados por outro computador.
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
                    doc(db, nome, id),
                    dadosLimpos,
                    {
                        merge: true
                    }
                );


                /*
                 * Guarda o ID gerado no objeto local.
                 */

                item._firestoreId = id;

            }


            /*
             * Atualiza o localStorage com os IDs
             * do Firebase.
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


        } catch (erro) {

            console.error(
                `Firebase: erro ao salvar ${nome}:`,
                erro
            );


            /*
             * Mensagem somente no console.
             * Não interrompe o sistema.
             */

        } finally {

            sincronizando.delete(nome);

        }

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

        try {

            let dados;


            try {

                dados =
                    JSON.parse(valor);

            } catch (erro) {

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


        } catch (erro) {

            console.error(
                `Firebase: erro ao salvar ${nome}:`,
                erro
            );

        }

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


        } catch (erro) {

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

            if (
                !window.firebase.firestore
            ) {

                await carregarScript(
                    "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"
                );

            }


            /*
             * Inicializa aplicação
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
             * Primeiro carrega a nuvem.
             */

            await hidratarSistema(db);


            firebasePronto = true;


            /*
             * =================================================
             * INTERCEPTAR localStorage
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
                     * Salva normalmente no navegador.
                     */

                    originalSet.call(
                        this,
                        chave,
                        valor
                    );


                    /*
                     * Só sincroniza localStorage.
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
                            db,
                            chave,
                            valor
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
                            db,
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
                            db,
                            chave,
                            valor
                        );

                    }

                };


            /*
             * =================================================
             * EXECUTAR CÓDIGO ORIGINAL DA PÁGINA
             * =================================================
             */

            const holder =
                document.getElementById(
                    "ceeja-app-script"
                );


            if (holder) {

                const script =
                    document.createElement("script");


                script.textContent =
                    holder.textContent;


                holder.replaceWith(script);

            }


            console.log(
                "CEEJA: Firebase conectado e sincronização ativada."
            );


        } catch (erro) {

            console.error(
                "CEEJA: erro ao inicializar Firebase:",
                erro
            );


            /*
             * Se o Firebase estiver indisponível,
             * o sistema continua funcionando localmente.
             */

            const holder =
                document.getElementById(
                    "ceeja-app-script"
                );


            if (holder) {

                const script =
                    document.createElement("script");


                script.textContent =
                    holder.textContent;


                holder.replaceWith(script);

            }

        }

    }


    iniciar();

})();
