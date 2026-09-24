# CEEJA Linhares — publicação no GitHub Pages

## Estrutura
Os arquivos HTML e o brasão foram mantidos com os mesmos nomes e a mesma estrutura visual.

O arquivo `firebase-cloud.js` funciona como uma ponte entre o código existente e o Firestore. Ele carrega os dados da nuvem antes de executar cada página e sincroniza as coleções que o sistema já utiliza.

## Publicação
1. Crie um repositório no GitHub (ex.: `ceeja-linhares-sistema`).
2. Envie todos os arquivos desta pasta para a raiz do repositório.
3. No GitHub, abra **Settings → Pages**.
4. Em **Build and deployment**, escolha **Deploy from a branch**.
5. Selecione `main` e `/ (root)` e salve.
6. Aguarde o GitHub Pages publicar o site.

## Firebase
O projeto já está configurado para:
`ceeja-linhares-sistema`

A configuração usada é a fornecida pelo proprietário do projeto. Não é necessário criar outro projeto Firebase.

## Atenção às regras do Firestore
O navegador precisa ter permissão para ler e gravar as coleções usadas pelo sistema. As regras atuais do projeto Firebase devem ser conferidas antes de colocar dados reais de alunos na internet.

O código atual usa autenticação própria por CPF/usuário e senha armazenados nos documentos. Isso mantém a estrutura existente, mas não substitui o Firebase Authentication. Para uso institucional com dados pessoais, recomenda-se posteriormente migrar as credenciais para Firebase Authentication e restringir as regras do Firestore.
