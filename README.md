# Da Fogueira às Estrelas

Um jogo incremental sobre a humanidade. Começa com uma tribo de doze pessoas ao redor de uma fogueira, às margens de um rio sem nome, e termina quando não resta uma estrela da galáxia fora do alcance humano.

O mapa é o centro do jogo e muda com as eras:

- **Idade da Pedra → Idade Média:** um mapa de pergaminho desenhado a tinta, com montanhas e florestas em traço, linhas de eco no mar e *Terra Incógnita* onde ninguém foi.
- **Navegações → Revolução Industrial:** um atlas aquarelado, com rotas marítimas, navios e ferrovias.
- **Era Moderna:** a Terra vista à noite, com a luz das cidades e as rotas aéreas.
- **Era Espacial em diante:** o globo em órbita, o Sistema Solar com as colônias, e por fim a galáxia inteira.

## O que há no jogo

- **12 eras**, da Idade da Pedra à Era Galáctica.
- **Árvore do Conhecimento** com mais de 100 tecnologias em três ramos (Produção; Saber e Sociedade; Expansão e Poder). Cada era termina num marco que abre a seguinte.
- **Povo e trabalho:** a população cresce com o território e a moradia; você define a prioridade de cada ofício.
- **Território:** anexe terras uma a uma (ou clicando no mapa), deixe a cultura expandir as fronteiras sozinha, integre povos vizinhos pela cultura ou conquiste-os pela força, inteiros ou só pela fronteira.
- **Governos e políticas:** 17 formas de governo — o título do seu império acompanha o governo (Tribo, Reino, Império, República, Federação Solar…) — e 24 políticas com prós e contras.
- **30 maravilhas em três etapas:** cada etapa rende parte do bônus; cada maravilha concluída soma Glória ao império.
- **Evolução Humana:** a partir da engenharia genética, melhorias para a própria espécie — da longevidade à pós-humanidade.
- **Sistema Solar:** 18 destinos para sondar, ocupar, colonizar e desenvolver.
- **Galáxia:** 540 sistemas, as estrelas reais mais próximas do Sol, e **7 espécies alienígenas** com temperamentos diferentes — diplomacia, alianças, integração ou guerra.
- **Bandeira e nome:** crie a bandeira do seu povo (12 campos, 10 cores heráldicas, 15 emblemas) e escolha a tradição sonora dos nomes das suas cidades.
- Eventos com escolhas, crônica do império, marcos, progresso offline (até 24 horas) e salvamento automático.

## Como jogar

Abra `index.html` no navegador — não precisa instalar nada. O progresso fica salvo no próprio navegador; use **Império → Exportar** para guardar uma cópia.

## Publicar no GitHub Pages

1. Crie um repositório no GitHub e envie estes arquivos (a pasta inteira, com `index.html` na raiz).
2. No repositório, vá em **Settings → Pages**.
3. Em **Build and deployment**, escolha **Deploy from a branch**, branch `main`, pasta `/ (root)`, e salve.
4. Em um ou dois minutos o jogo estará em `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`.

## Para quem quiser mexer no jogo

- `js/data.js` — todo o conteúdo: eras, tecnologias, construções, governos, políticas, maravilhas, corpos celestes, espécies, eventos e a tabela de equilíbrio.
- `js/game.js` — as regras (economia, território, diplomacia, salvamento). Não depende do navegador.
- `js/world.js` e `js/galaxy.js` — geração do planeta e da galáxia.
- `js/mapview.js` e `js/spaceview.js` — o desenho do mapa, do globo, do Sistema Solar e da galáxia.
- `js/ui.js` e `js/main.js` — interface e laço principal.
- `tools/` — ferramentas de equilíbrio: `node tools/run.js <semente>` simula uma partida inteira com um jogador-robô; `node tools/calibrate.js` recalibra os custos de cada era; `node tools/serve.js` sobe um servidor local. Abrir o jogo com `?dev` na URL carrega um ajudante de testes (`G.dev.ate(era)`).
