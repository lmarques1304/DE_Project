# Instant Democracy

**Instant Democracy** é uma plataforma web desenvolvida no âmbito de um projeto académico da Universidade de Coimbra, com o objetivo de incentivar a participação dos estudantes na comunidade universitária.

A plataforma permite que estudantes, núcleos e a Universidade de Coimbra apresentem propostas e iniciativas, promovendo a discussão, a votação e a participação ativa na vida académica.

## Objetivo do projeto

Criar um espaço digital onde a comunidade académica possa partilhar ideias, votar em propostas e descobrir iniciativas apoiadas pelos estudantes.

O projeto pretende facilitar a comunicação entre estudantes e organizações académicas, incentivando a colaboração e a criação de atividades que aproximem a comunidade universitária.

## Funcionalidades

- Registo e autenticação de estudantes, com verificação de email.
- Diferentes tipos de contas: estudante, administrador, Universidade de Coimbra e núcleos.
- Criação de propostas com título, descrição, categoria e prazo de votação.
- Possibilidade de submissão anónima de propostas por estudantes.
- Moderação das propostas dos estudantes antes da publicação.
- Publicação direta de propostas por contas institucionais.
- Votação com opções *Yes* e *No*, limitada a um voto por estudante e por proposta.
- Apresentação dos resultados e dos prazos de votação.
- Página de propostas aprovadas pela comunidade.
- Dashboards específicos para estudantes, organizações e administradores.

## Como funciona

Os estudantes podem criar propostas que são analisadas pelos administradores antes de serem publicadas. As contas da Universidade de Coimbra e dos núcleos podem publicar diretamente.

Depois de publicada, cada proposta fica disponível para votação até à data definida.

Uma proposta é considerada **aprovada pela comunidade** quando o prazo de votação termina e o número de votos *Yes* é superior ao número de votos *No*.

A autorização de publicação por um administrador não representa a aprovação da proposta pela comunidade.

## Tecnologias utilizadas

- **Frontend:** HTML, CSS e JavaScript
- **Backend:** Node.js e Express.js
- **Base de dados:** SQLite, através de better-sqlite3
- **Autenticação:** express-session e bcryptjs
- **Verificação de email:** Nodemailer

## Instalação e execução

É necessário ter o Node.js e o npm instalados.

1. Clonar o repositório.
2. Abrir a pasta do projeto no terminal.
3. Instalar as dependências:

   `npm install`

4. Configurar localmente as variáveis de ambiente necessárias para as sessões e o envio de emails, utilizando um ficheiro `.env`.
5. Iniciar o servidor:

   `npm run dev`

6. Abrir no navegador:

   `http://localhost:3000`

A base de dados SQLite e as respetivas tabelas são criadas automaticamente quando o servidor é iniciado.

## Segurança e dados

O ficheiro `.env`, a base de dados local e a pasta `node_modules` não devem ser incluídos no repositório.

Cada colaborador deve utilizar as suas próprias configurações locais.

## Estado do projeto

O projeto encontra-se em desenvolvimento e está sujeito a alterações.