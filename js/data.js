/* Da Fogueira às Estrelas — conteúdo do jogo */
(function () {
  'use strict';
  const G = (globalThis.G = globalThis.G || {});

  // ======================= EQUILÍBRIO =======================
  // Escalas de custo por era. Ajustadas por simulação (tools/sim.js).
  G.BAL = {
    SC: [7.84e1, 4.89e4, 6.56e6, 4.62e8, 4.33e9, 7.28e10, 1.64e12, 4.55e13, 1.75e17, 2.57e23, 7.94e27, 2.38e28],
    KC: [6.28e1, 3.62e4, 4.28e6, 2.56e8, 2.18e9, 3.64e10, 7.28e11, 1.82e13, 6.99e16, 1.03e23, 6.11e26, 4.43e25],
    TC: [18, 7.24, 5.54, 4.34, 3.61, 1.73, 0.748, 0.479, 0.1, 0.1, 0.1, 0.1], // segundos de capacidade produtiva por terra (ritmo da expansão por era)
    BC: [1, 1, 1, 1, 1, 1, 1, 1, 0.219, 0.00073, 0.00737, 0.0001], // fator de custo de corpos celestes e sistemas estelares
    // tetos de custo, em segundos do potencial (30% do povo) — ninguém fica preso porque a economia ficou para trás
    CAP: { tech: [150, 150, 150, 150, 150, 150, 150, 150, 90, 90, 90, 90], body: 120, wonder: 120, sys: 60 },
    GSECS: 200, // alimento de um gene: ~200 s × custo × consumo de 30% do povo
    BSECS: 40, // a 1ª construção de cada era custa ~60 s da produção (de 30% do povo) no começo da era
    // quanto o império produz de riqueza e energia para cada unidade de materiais (por era);
    // os custos nesses recursos seguem essa proporção, para nenhum deles virar gargalo eterno
    RW: [0, 0, 0.0187, 0.045, 0.0758, 0.329, 0.268, 0.717, 0.414, 0.289, 0.0176, 0.000689],
    RE: [0, 0, 0, 0, 0, 0, 0.000981, 0.0162, 0.0362, 0.0475, 0.128, 3.9],
    AF: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0.0737, 0.001], // fator de custo da diplomacia e guerra com alienígenas
    RIV: 0.3, // anexar um povo custa ~0,6 terra por território dele, pago em força ou cultura
    capPerTile: [4, 16, 55, 160, 420, 1000, 3800, 30000, 60000, 90000, 120000, 150000],
    bonusBase: 0.12, bonusGrowth: 1.7,
    capBonusBase: 0.08, capBonusGrowth: 1.45,
    buildGrowth: 1.2,
    eat: 1,
    growth: 0.035,
    tileExp: 1.3,
  };
  // o bônus por construção cresce 70% por era até a Era Moderna; depois, 25% (evita a disparada no espaço)
  G.buildingBonus = (era) => G.BAL.bonusBase * Math.pow(G.BAL.bonusGrowth, Math.min(era, 7)) * Math.pow(1.25, Math.max(0, era - 7));
  G.buildingCapBonus = (era) => G.BAL.capBonusBase * Math.pow(G.BAL.capBonusGrowth, era);

  // ======================= RECURSOS / SETORES =======================
  G.SECTORS = [
    { id: 'food', name: 'Alimento', base: 1.6, unlock: 0, color: '#6f8f2f',
      workers: ['Caçadores-coletores', 'Agricultores', 'Agricultores', 'Camponeses', 'Camponeses', 'Lavradores', 'Agricultores', 'Agrônomos', 'Agrônomos', 'Bioengenheiros', 'Bioengenheiros', 'Bioengenheiros'] },
    { id: 'materials', name: 'Materiais', base: 0.5, unlock: 0, color: '#8a5a2b',
      workers: ['Lascadores', 'Artesãos', 'Ferreiros', 'Construtores', 'Artífices', 'Artífices', 'Operários', 'Operários', 'Técnicos', 'Mineradores', 'Forjadores', 'Forjadores'] },
    { id: 'knowledge', name: 'Saber', base: 0.15, unlock: 0, color: '#2f5f8f',
      workers: ['Anciãos', 'Xamãs', 'Escribas', 'Filósofos', 'Monges', 'Eruditos', 'Cientistas', 'Pesquisadores', 'Pesquisadores', 'Pesquisadores', 'Xenólogos', 'Xenólogos'] },
    { id: 'culture', name: 'Cultura', base: 0.12, unlock: 0, color: '#8f2f5f',
      workers: ['Contadores de histórias', 'Contadores de histórias', 'Sacerdotes', 'Poetas', 'Menestréis', 'Artistas', 'Artistas', 'Artistas', 'Criadores', 'Criadores', 'Embaixadores', 'Embaixadores'] },
    { id: 'military', name: 'Força', base: 0.1, unlock: 1, color: '#7a2a1a',
      workers: ['Guerreiros', 'Guerreiros', 'Soldados', 'Legionários', 'Cavaleiros', 'Mosqueteiros', 'Soldados', 'Militares', 'Militares', 'Tripulantes', 'Tripulantes', 'Almirantes'] },
    { id: 'wealth', name: 'Riqueza', base: 0.35, unlock: 2, color: '#a07a10',
      workers: ['', '', 'Mercadores', 'Mercadores', 'Mercadores', 'Banqueiros', 'Comerciantes', 'Empresários', 'Empresários', 'Corretores', 'Corretores', 'Corretores'] },
    { id: 'energy', name: 'Energia', base: 0.4, unlock: 6, color: '#c2701a',
      workers: ['', '', '', '', '', '', 'Engenheiros', 'Engenheiros', 'Engenheiros', 'Engenheiros', 'Engenheiros', 'Engenheiros'] },
  ];
  G.SECTOR = {};
  G.SECTORS.forEach((s) => (G.SECTOR[s.id] = s));
  G.RES_ORDER = ['food', 'materials', 'knowledge', 'culture', 'military', 'wealth', 'energy'];

  // ======================= ERAS =======================
  G.ERAS = [
    { id: 0, name: 'Idade da Pedra', short: 'Pedra', y0: -12000, y1: -8000, people: 'tribo',
      text: 'Junto a um rio sem nome, um pequeno grupo acende uma fogueira. Não há cidades, nem escrita, nem reis. Há apenas o fogo, a noite, e a teimosia de continuar vivo.' },
    { id: 1, name: 'Neolítico', short: 'Neolítico', y0: -8000, y1: -3300, people: 'aldeia',
      text: 'Uma semente enterrada vira colheita. Pela primeira vez, ficamos. As tendas viram casas, as casas viram aldeias, e a terra ganha dono.' },
    { id: 2, name: 'Idade do Bronze', short: 'Bronze', y0: -3300, y1: -1200, people: 'reino',
      text: 'O cobre e o estanho se fundem no fogo. Nascem os reis, os templos e os primeiros números gravados em barro. Agora lembramos de tudo.' },
    { id: 3, name: 'Antiguidade Clássica', short: 'Clássica', y0: -1200, y1: 476, people: 'reino',
      text: 'Ferro nas mãos, filosofia na boca. Estradas cortam o continente e navios cruzam o mar raso. O mundo conhecido cabe num mapa.' },
    { id: 4, name: 'Idade Média', short: 'Medieval', y0: 476, y1: 1450, people: 'reino',
      text: 'Castelos nas colinas, sinos nas cidades, monges copiando o passado à luz de velas. O império aprende a resistir.' },
    { id: 5, name: 'Era das Navegações', short: 'Navegações', y0: 1450, y1: 1760, people: 'nação',
      text: 'As velas se enchem e o horizonte deixa de ser um limite. Do outro lado do oceano há terras, povos e riquezas que nenhum mapa conhecia.' },
    { id: 6, name: 'Revolução Industrial', short: 'Industrial', y0: 1760, y1: 1914, people: 'nação',
      text: 'O vapor move o mundo. Chaminés, trilhos e telégrafos costuram as cidades. O que antes levava um ano agora leva um dia.' },
    { id: 7, name: 'Era Moderna', short: 'Moderna', y0: 1914, y1: 2030, people: 'nação',
      text: 'O átomo, o avião, o computador. Bilhões de vozes conectadas por fios invisíveis. O planeta inteiro está ao alcance — e ele começa a parecer pequeno.' },
    { id: 8, name: 'Era Espacial', short: 'Espacial', y0: 2030, y1: 2150, people: 'nação',
      text: 'Pela primeira vez, uma geração inteira cresce olhando a Terra de cima. A Lua deixa de ser destino e vira endereço.' },
    { id: 9, name: 'Era Interplanetária', short: 'Interplanetária', y0: 2150, y1: 2600, people: 'nação',
      text: 'Marte tem cidades. Júpiter tem refinarias. O Sol tem um anel de espelhos. A humanidade é, agora, uma espécie de muitos mundos.' },
    { id: 10, name: 'Era Interestelar', short: 'Interestelar', y0: 2600, y1: 4000, people: 'nação',
      text: 'As estrelas vizinhas recebem nomes humanos. E, numa noite qualquer, um sinal responde. Não estamos sozinhos.' },
    { id: 11, name: 'Era Galáctica', short: 'Galáctica', y0: 4000, y1: 12000, people: 'nação',
      text: 'De braço em braço da espiral, a luz humana se espalha. Resta uma última pergunta: até onde?' },
  ];

  // ======================= TERRENOS =======================
  // cap = capacidade relativa; cost = custo relativo de anexar
  G.TERRAIN = {
    ocean: { name: 'Oceano', water: true },
    sea: { name: 'Mar raso', water: true },
    lake: { name: 'Lago', water: true },
    grass: { name: 'Pradaria', cap: 1.2, cost: 1.0 },
    plains: { name: 'Planície', cap: 1.0, cost: 1.0 },
    forest: { name: 'Floresta', cap: 0.7, cost: 1.2 },
    jungle: { name: 'Selva', cap: 0.55, cost: 1.5 },
    taiga: { name: 'Taiga', cap: 0.45, cost: 1.3 },
    savanna: { name: 'Savana', cap: 0.8, cost: 1.0 },
    desert: { name: 'Deserto', cap: 0.25, cost: 1.4 },
    tundra: { name: 'Tundra', cap: 0.25, cost: 1.5 },
    hills: { name: 'Colinas', cap: 0.7, cost: 1.4 },
    mountain: { name: 'Montanhas', cap: 0.25, cost: 2.2, needs: 'mountains' },
    ice: { name: 'Gelo eterno', cap: 0.05, cost: 3, needs: 'ice' },
  };

  // ======================= CONSTRUÇÕES =======================
  // s = setores beneficiados (peso), cap = peso de moradia
  const B = (id, era, name, desc, s, extra) => Object.assign({ id, era, name, desc, s: s || {}, c: 1 }, extra || {});
  G.BUILDINGS = [
    // 0 — Pedra
    B('acampamento', 0, 'Acampamento de Caça', 'Peles secando ao sol e lanças encostadas nas rochas.', { food: 1 }),
    B('lascaria', 0, 'Oficina de Lascas', 'Sílex batido contra sílex, até a pedra virar lâmina.', { materials: 1 }),
    B('fogueira', 0, 'Fogueira dos Anciãos', 'Onde as histórias passam de boca em boca.', { knowledge: 0.7, culture: 0.7 }),
    B('abrigo', 0, 'Abrigos de Couro', 'Mais gente cabe sob o mesmo céu.', {}, { cap: 1 }),
    // 1 — Neolítico
    B('rocas', 1, 'Roças de Coivara', 'Queimar, plantar, esperar a chuva.', { food: 1 }),
    B('olaria', 1, 'Olaria', 'Barro, fogo e paciência.', { materials: 1 }),
    B('menir', 1, 'Menires', 'Pedras erguidas para lembrar o que importa.', { culture: 1 }),
    B('casa_comunal', 1, 'Casas Comunais', 'Uma casa longa, muitas famílias.', {}, { cap: 1 }),
    B('palicada', 1, 'Paliçada', 'Troncos afiados ao redor da aldeia.', { military: 1 }),
    B('xama', 1, 'Cabana do Xamã', 'Ervas, estrelas e sonhos interpretados.', { knowledge: 1 }),
    // 2 — Bronze
    B('canais', 2, 'Canais de Irrigação', 'O rio obedece, e o deserto floresce.', { food: 1 }),
    B('fundicao', 2, 'Fundição de Bronze', 'Cobre e estanho, unidos no fogo.', { materials: 1 }),
    B('escribas', 2, 'Casa dos Escribas', 'Tábuas de argila guardam contas e leis.', { knowledge: 1 }),
    B('mercado', 2, 'Mercado', 'Lã, grão, cobre, sal: tudo tem um preço.', { wealth: 1 }),
    B('templo', 2, 'Templo', 'Os deuses moram no centro da cidade.', { culture: 1 }),
    B('quartel', 2, 'Quartel de Carros', 'Cavalos, rodas e bronze.', { military: 1 }),
    B('cidade_murada', 2, 'Cidade Murada', 'Dentro dos muros, a cidade cresce para cima.', {}, { cap: 1 }),
    // 3 — Clássica
    B('vilas_agricolas', 3, 'Vilas Agrícolas', 'Oliveiras, vinhas e trigo até o horizonte.', { food: 1 }),
    B('pedreira', 3, 'Pedreiras', 'Mármore cortado em blocos perfeitos.', { materials: 1 }),
    B('academia', 3, 'Academia', 'Perguntas que levam séculos para responder.', { knowledge: 1 }),
    B('porto', 3, 'Porto Comercial', 'Ânforas, velas e mercadores de longe.', { wealth: 1 }),
    B('teatro', 3, 'Teatro', 'Tragédias e comédias sob o céu aberto.', { culture: 1 }),
    B('castro', 3, 'Castro Legionário', 'Disciplina, estradas e escudos.', { military: 1 }),
    B('aqueduto', 3, 'Aqueduto', 'Água limpa trazida de montanhas distantes.', {}, { cap: 1 }),
    // 4 — Medieval
    B('moinho', 4, "Moinho d'Água", 'A roda gira, o grão vira farinha.', { food: 1 }),
    B('guilda', 4, 'Casa de Guilda', 'Mestres, aprendizes e segredos de ofício.', { materials: 1 }),
    B('mosteiro', 4, 'Mosteiro', 'Copistas salvando o passado, página por página.', { knowledge: 0.8, culture: 0.6 }),
    B('feira', 4, 'Feira Anual', 'Mercadores de todos os cantos, uma vez por ano.', { wealth: 1 }),
    B('castelo', 4, 'Castelo', 'Pedra sobre pedra, no alto da colina.', { military: 1 }),
    B('burgo', 4, 'Burgos', 'Cidades livres, ruas estreitas, vida apertada.', {}, { cap: 1 }),
    // 5 — Navegações
    B('grandes_fazendas', 5, 'Grandes Fazendas', 'Novas culturas vindas do outro lado do mar.', { food: 1 }),
    B('estaleiro', 5, 'Estaleiro', 'Caravelas e naus nascem de florestas inteiras.', { materials: 0.6, wealth: 0.5 }),
    B('tipografia', 5, 'Tipografia', 'Mil cópias de uma ideia.', { knowledge: 1 }),
    B('banco', 5, 'Casa Bancária', 'Letras de câmbio valem mais que ouro.', { wealth: 1 }),
    B('opera', 5, 'Casa de Ópera', 'A música vira espetáculo.', { culture: 1 }),
    B('fortaleza', 5, 'Fortaleza Abaluartada', 'Muralhas em estrela contra os canhões.', { military: 1 }),
    B('cidades_portuarias', 5, 'Cidades Portuárias', 'Onde o mundo inteiro desembarca.', {}, { cap: 1 }),
    // 6 — Industrial
    B('fazenda_mecanizada', 6, 'Fazenda Mecanizada', 'Ceifadeiras a vapor e fertilizantes.', { food: 1 }),
    B('fabrica', 6, 'Fábrica', 'Teares que nunca dormem.', { materials: 1 }),
    B('usina_carvao', 6, 'Usina a Carvão', 'Fumaça preta, luz elétrica.', { energy: 1 }),
    B('escola', 6, 'Escola Pública', 'Toda criança aprende a ler.', { knowledge: 1 }),
    B('bolsa', 6, 'Bolsa de Valores', 'O futuro comprado e vendido.', { wealth: 1 }),
    B('museu', 6, 'Museu', 'O passado em vitrines.', { culture: 1 }),
    B('arsenal', 6, 'Arsenal', 'Aço, pólvora e linhas de produção.', { military: 1 }),
    B('bairros', 6, 'Bairros Operários', 'Casas enfileiradas à sombra das chaminés.', {}, { cap: 1 }),
    // 7 — Moderna
    B('agroindustria', 7, 'Agroindústria', 'Colheitas recordes, safra após safra.', { food: 1 }),
    B('montadora', 7, 'Montadora', 'Um carro por minuto.', { materials: 1 }),
    B('usina_nuclear', 7, 'Usina Nuclear', 'O átomo domado.', { energy: 1 }),
    B('laboratorio', 7, 'Laboratório de Pesquisa', 'Jalecos brancos e descobertas diárias.', { knowledge: 1 }),
    B('centro_financeiro', 7, 'Centro Financeiro', 'Torres de vidro onde o dinheiro nunca para.', { wealth: 1 }),
    B('estudio', 7, 'Estúdio de Cinema', 'Histórias para bilhões de pessoas.', { culture: 1 }),
    B('base_militar', 7, 'Base Militar', 'Radares, hangares e prontidão.', { military: 1 }),
    B('arranha_ceus', 7, 'Arranha-Céus', 'Cidades verticais.', {}, { cap: 1 }),
    // 8 — Espacial
    B('fazenda_vertical', 8, 'Fazenda Vertical', 'Cem andares de lavoura sob luz artificial.', { food: 1 }),
    B('fabrica_orbital', 8, 'Fábrica Orbital', 'Ligas perfeitas, forjadas sem gravidade.', { materials: 1 }),
    B('reator_fusao', 8, 'Reator de Fusão', 'Um pequeno sol engarrafado.', { energy: 1 }),
    B('datacenter', 8, 'Rede Neural', 'Mentes de silício pensando junto conosco.', { knowledge: 1 }),
    B('bolsa_orbital', 8, 'Bolsa Cislunar', 'Comércio entre a Terra e a Lua.', { wealth: 1 }),
    B('holoteatro', 8, 'Holoteatro', 'Arte que se pode atravessar.', { culture: 1 }),
    B('doca_orbital', 8, 'Doca Orbital', 'Onde nascem as primeiras naves de guerra espaciais.', { military: 1 }),
    B('arcologia', 8, 'Arcologia', 'Uma cidade inteira dentro de uma única estrutura.', {}, { cap: 1 }),
    // 9 — Interplanetária
    B('fazenda_orbital', 9, 'Anel Agrícola', 'Campos de trigo girando ao redor de Marte.', { food: 1 }),
    B('refinaria', 9, 'Refinaria de Asteroides', 'Montanhas de metal puro, rebocadas até a órbita.', { materials: 1 }),
    B('coletor_solar', 9, 'Coletor Solar Orbital', 'Espelhos do tamanho de países.', { energy: 1 }),
    B('nucleo_quantico', 9, 'Núcleo Quântico', 'Calcula o que antes era impossível.', { knowledge: 1 }),
    B('banco_solar', 9, 'Banco do Sistema Solar', 'A moeda de nove mundos.', { wealth: 1 }),
    B('festival', 9, 'Festival dos Mundos', 'Cada colônia com sua música, sua língua, sua festa.', { culture: 1 }),
    B('cruzadores', 9, 'Doca de Cruzadores', 'Cascos de quilômetros de comprimento.', { military: 1 }),
    B('oneill', 9, "Cilindro de O'Neill", 'Um mundo inteiro, enrolado num tubo.', {}, { cap: 1 }),
    // 10 — Interestelar
    B('jardins_estelares', 10, 'Jardins Estelares', 'Ecossistemas desenhados para cada mundo.', { food: 1 }),
    B('forja_estelar', 10, 'Forja Estelar', 'Metal arrancado da coroa das estrelas.', { materials: 1 }),
    B('antimateria', 10, 'Fábrica de Antimatéria', 'Um grama, a energia de uma cidade.', { energy: 1 }),
    B('rede_consciencia', 10, 'Rede de Consciência', 'Bilhões de mentes, uma só biblioteca.', { knowledge: 1 }),
    B('consulado', 10, 'Consulado Xeno', 'Onde os humanos aprendem a negociar com o desconhecido.', { wealth: 0.6, culture: 0.6 }),
    B('arsenal_dobra', 10, 'Arsenal de Dobra', 'Frotas que chegam antes da notícia.', { military: 1 }),
    B('mundo_anel', 10, 'Mundo-Anel', 'Um anel em volta de uma estrela, habitável por inteiro.', {}, { cap: 1 }),
    // 11 — Galáctica
    B('semeadores', 11, 'Semeadores de Vida', 'Biomas inteiros plantados em mundos estéreis.', { food: 1 }),
    B('forja_galactica', 11, 'Forja Galáctica', 'Matéria esculpida em escala estelar.', { materials: 1 }),
    B('usina_buraco', 11, 'Usina de Buraco Negro', 'A energia do fim de tudo.', { energy: 1 }),
    B('arquivo_vivo', 11, 'Arquivo Vivo', 'Toda a memória da galáxia, consultável.', { knowledge: 1 }),
    B('forum', 11, 'Fórum Galáctico', 'Mil espécies, uma assembleia, uma voz humana.', { culture: 0.7, wealth: 0.7 }),
    B('armada', 11, 'Armada Galáctica', 'Nenhuma estrela fica fora de alcance.', { military: 1 }),
    B('habitats_dyson', 11, 'Habitats Dyson', 'Cascas de mundos ao redor de estrelas inteiras.', {}, { cap: 1 }),
  ];
  G.BUILDING = {};
  G.BUILDINGS.forEach((b) => (G.BUILDING[b.id] = b));
  // linhas de evolução: cada construção pertence ao setor principal que ela melhora (ou à moradia)
  G.LINE_ORDER = ['food', 'materials', 'knowledge', 'culture', 'military', 'wealth', 'energy', 'housing'];
  G.LINE_NAMES = { food: 'Alimento', materials: 'Materiais', knowledge: 'Saber', culture: 'Cultura', military: 'Força', wealth: 'Riqueza', energy: 'Energia', housing: 'Moradia' };
  G.LINES = {};
  G.BUILDINGS.forEach((b) => {
    const ks = Object.keys(b.s);
    b.line = b.cap ? 'housing' : ks.reduce((a, k) => (b.s[k] > b.s[a] ? k : a), ks[0]);
    (G.LINES[b.line] = G.LINES[b.line] || []).push(b);
  });
  for (const l in G.LINES) G.LINES[l].sort((a, b) => a.era - b.era);

  // ======================= TECNOLOGIAS =======================
  // eff: mult{setor:x}, cap, growth, gov, pol, slots, flags, era (avança era)
  const T = (id, era, name, desc, c, eff, req) => ({ id, era, name, desc, c, eff: eff || {}, req: req || [] });
  G.TECHS = [
    // 0 — Pedra
    T('fogo', 0, 'Domínio do Fogo', 'Calor, luz e comida cozida. A noite fica menor.', 1, { mult: { culture: 1.4 }, growth: 1.25 }),
    T('lascas', 0, 'Pedra Lascada', 'Pontas, raspadores e machados de mão.', 1.4, { mult: { materials: 1.5 } }),
    T('linguagem', 0, 'Linguagem', 'Palavras para o que se vê, e logo para o que não se vê.', 2, { mult: { knowledge: 1.5, culture: 1.2 } }, ['fogo']),
    T('caca', 0, 'Caça Coordenada', 'Sozinho, um caçador volta com fome. Juntos, voltam com um mamute.', 2.4, { mult: { food: 1.35 } }, ['lascas']),
    T('ervas', 0, 'Saber das Ervas', 'Uma folha cura, outra mata. Saber a diferença é poder.', 3.2, { growth: 1.3, cap: 1.1 }, ['linguagem']),
    T('pintura', 0, 'Arte Rupestre', 'Mãos de ocre nas paredes da caverna.', 4, { mult: { culture: 1.4 } }, ['linguagem']),
    T('agricultura', 0, 'Agricultura', 'A semente enterrada volta multiplicada. Começa o Neolítico.', 7, { mult: { food: 1.6 }, era: 1, need: { tiles: 0.0028 } }),
    // 1 — Neolítico
    T('domesticacao', 1, 'Domesticação', 'O lobo vira cão. O auroque vira boi.', 1, { mult: { food: 1.4 } }),
    T('ceramica', 1, 'Cerâmica', 'Potes para guardar o excedente.', 1.3, { mult: { materials: 1.4 }, cap: 1.1 }),
    T('tecelagem', 1, 'Tecelagem', 'Fios cruzados viram roupa, vela e rede.', 1.8, { mult: { materials: 1.2, culture: 1.2 } }, ['ceramica']),
    T('lancas', 1, 'Arco e Flecha', 'A guerra muda de distância.', 1.8, { mult: { military: 1.5, food: 1.1 } }),
    T('aldeias', 1, 'Aldeias Permanentes', 'A tenda vira casa. A casa vira lar.', 2.5, { cap: 1.3 }, ['domesticacao']),
    T('chefia', 1, 'Chefia', 'Alguém precisa decidir. Nasce a política.', 3, { gov: ['chefatura'], slots: 1, pol: ['partilha', 'culto_guerreiro', 'tradicao_oral'] }, ['aldeias']),
    T('rituais', 1, 'Rituais Funerários', 'Honrar os mortos é lembrar quem somos.', 3.4, { mult: { culture: 1.4, knowledge: 1.15 } }, ['tecelagem']),
    T('metalurgia', 1, 'Metalurgia do Bronze', 'O fogo derrete a pedra e revela o metal. Começa a Idade do Bronze.', 6, { mult: { materials: 1.5, military: 1.3 }, era: 2, need: { tiles: 0.008 } }),
    // 2 — Bronze
    T('escrita', 2, 'Escrita', 'Agora a memória não morre com quem lembra.', 1, { mult: { knowledge: 1.6 } }),
    T('roda', 2, 'A Roda', 'Carroças, tornos e carros de guerra.', 1.2, { mult: { materials: 1.3, wealth: 1.15 } }),
    T('irrigacao', 2, 'Irrigação', 'Canais levam o rio até o campo.', 1.6, { mult: { food: 1.5 } }),
    T('comercio', 2, 'Comércio', 'Trocar é melhor que tomar. Às vezes.', 2, { mult: { wealth: 1.5 }, gov: ['cidade_estado'], pol: ['tributos', 'corveia'] }, ['roda']),
    T('matematica', 2, 'Matemática', 'Contar estrelas, sacos de grão e dívidas.', 2.4, { mult: { knowledge: 1.3, materials: 1.15 } }, ['escrita']),
    T('alvenaria', 2, 'Alvenaria', 'Pedra cortada, empilhada, eterna. Montanhas podem ser ocupadas.', 2.6, { cap: 1.2, flags: { mountains: 1 } }, ['roda']),
    T('monarquia', 2, 'Monarquia Divina', 'O rei fala com os deuses. O povo fala com o rei.', 3, { gov: ['monarquia'], slots: 1, pol: ['panteao', 'escribas_reais'] }, ['escrita']),
    T('astronomia', 2, 'Astronomia', 'O céu é um calendário.', 3.4, { mult: { knowledge: 1.25, culture: 1.2 } }, ['matematica']),
    T('ferro', 2, 'Metalurgia do Ferro', 'Mais duro que o bronze, mais comum que o cobre. Começa a Antiguidade Clássica.', 6, { mult: { materials: 1.4, military: 1.4 }, era: 3, need: { tiles: 0.022 } }),
    // 3 — Clássica
    T('filosofia', 3, 'Filosofia', 'Por quê? E por que não?', 1, { mult: { knowledge: 1.5 } }),
    T('moeda', 3, 'Cunhagem de Moedas', 'O valor cabe na palma da mão.', 1.2, { mult: { wealth: 1.6 } }),
    T('nav_costeira', 3, 'Navegação Costeira', 'Remos e velas ao longo da costa. Ilhas próximas ficam ao alcance.', 1.5, { mult: { wealth: 1.2 }, flags: { seaRange: 3 } }),
    T('engenharia', 3, 'Engenharia', 'Arcos, pontes e estradas que duram mil anos.', 2, { mult: { materials: 1.5 }, cap: 1.2 }, ['moeda']),
    T('legioes', 3, 'Exércitos Profissionais', 'Soldados pagos, treinados, organizados.', 2, { mult: { military: 1.6 }, gov: ['imperio'], pol: ['expansionismo'] }),
    T('drama', 3, 'Drama e Poesia', 'Contar histórias vira arte.', 2.4, { mult: { culture: 1.5 } }, ['filosofia']),
    T('republica', 3, 'República', 'O poder pertence à coisa pública.', 3, { gov: ['republica'], slots: 1 }, ['filosofia']),
    T('direito', 3, 'Direito e Administração', 'Leis escritas e governadores. Permite a expansão automática.', 3.4, { cap: 1.15, flags: { autoExpand: 1 } }, ['engenharia']),
    T('feudalismo', 3, 'Feudalismo', 'Terra em troca de lealdade. Começa a Idade Média.', 6, { mult: { food: 1.3, military: 1.3 }, era: 4, need: { tiles: 0.05 } }),
    // 4 — Medieval
    T('arado', 4, 'Arado Pesado', 'A terra mais funda, a colheita mais farta.', 1, { mult: { food: 1.6 } }),
    T('moinhos', 4, 'Moinhos', 'O vento e a água trabalham por nós.', 1.2, { mult: { materials: 1.5 } }),
    T('universidades', 4, 'Universidades', 'Mestres e estudantes de toda parte.', 1.6, { mult: { knowledge: 1.6 } }),
    T('guildas', 4, 'Guildas', 'O ofício vira instituição.', 1.8, { mult: { wealth: 1.4, materials: 1.2 }, pol: ['mercantilismo'] }, ['moinhos']),
    T('castelos', 4, 'Castelos', 'Muralhas que mudam a guerra.', 2, { mult: { military: 1.5 }, gov: ['feudal'] }),
    T('gotico', 4, 'Arquitetura Gótica', 'Pedra que parece voar.', 2.4, { mult: { culture: 1.5 }, gov: ['teocracia'], pol: ['liberdade_religiosa'] }, ['universidades']),
    T('bussola', 4, 'Bússola', 'O norte está sempre lá. Mares mais distantes ficam ao alcance.', 3, { mult: { wealth: 1.2 }, flags: { seaRange: 6 } }, ['guildas']),
    T('caravela', 4, 'Caravela', 'Velas latinas contra o vento. Começa a Era das Navegações.', 6, { mult: { wealth: 1.4 }, era: 5, need: { tiles: 0.1 }, flags: { seaRange: 999 } }),
    // 5 — Navegações
    T('imprensa', 5, 'Prensa de Tipos Móveis', 'Livros para todos.', 1, { mult: { knowledge: 1.7, culture: 1.2 } }),
    T('bancos', 5, 'Sistema Bancário', 'O crédito move impérios.', 1.2, { mult: { wealth: 1.7 } }),
    T('polvora', 5, 'Pólvora', 'Castelos caem. Reinos também.', 1.5, { mult: { military: 1.8 } }),
    T('cartografia', 5, 'Cartografia', 'O mundo desenhado com precisão.', 1.8, { flags: { cartography: 1 }, mult: { wealth: 1.15 } }, ['imprensa']),
    T('companhias', 5, 'Companhias de Comércio', 'Navios, acionistas e postos além-mar.', 2, { mult: { wealth: 1.3 }, flags: { overseasDiscount: 0.3 }, gov: ['republica_mercantil'], pol: ['colonizacao'] }, ['bancos']),
    T('absolutismo', 5, 'Absolutismo', 'O Estado sou eu.', 2.2, { gov: ['absolutismo'], mult: { materials: 1.2 } }, ['polvora']),
    T('metodo', 5, 'Método Científico', 'Hipótese, experimento, conclusão.', 2.6, { mult: { knowledge: 1.5 } }, ['cartografia']),
    T('iluminismo', 5, 'Iluminismo', 'A razão como luz.', 3.2, { mult: { culture: 1.4, knowledge: 1.2 }, slots: 1, pol: ['livre_comercio', 'educacao'] }, ['metodo']),
    T('vapor', 5, 'Máquina a Vapor', 'O calor vira movimento. Começa a Revolução Industrial.', 6, { mult: { materials: 1.6 }, era: 6, need: { tiles: 0.22 } }),
    // 6 — Industrial
    T('ferrovias', 6, 'Ferrovias', 'Trilhos de aço costurando o continente.', 1, { mult: { materials: 1.5, wealth: 1.3 } }),
    T('aco', 6, 'Aço', 'Pontes, navios e arranha-céus.', 1.3, { mult: { materials: 1.6, military: 1.2 } }),
    T('quimica', 6, 'Química', 'Fertilizantes, corantes, explosivos.', 1.6, { mult: { food: 1.8 } }),
    T('eletricidade', 6, 'Eletricidade', 'A noite acaba nas cidades.', 1.8, { mult: { energy: 2 } }, ['aco']),
    T('medicina', 6, 'Medicina Moderna', 'Vacinas e higiene dobram a vida.', 2, { growth: 1.4, cap: 1.4 }, ['quimica']),
    T('telegrafo', 6, 'Telégrafo', 'Notícias à velocidade da luz. Permite construção automática.', 2.2, { mult: { knowledge: 1.4 }, flags: { autoBuild: 1 } }, ['eletricidade']),
    T('democracia', 6, 'Democracia', 'Um voto por pessoa.', 2.6, { gov: ['democracia', 'estado_industrial'], slots: 1, pol: ['protecionismo', 'servico_militar', 'sufragio'] }, ['ferrovias']),
    T('nacionalismo', 6, 'Nacionalismo', 'Uma bandeira, um hino, um povo.', 2.8, { mult: { military: 1.6, culture: 1.2 } }, ['democracia']),
    T('combustao', 6, 'Motor a Combustão', 'Petróleo, motores e estradas. Começa a Era Moderna.', 6, { mult: { materials: 1.5, energy: 1.5 }, era: 7, need: { tiles: 0.38 }, flags: { ice: 1 } }),
    // 7 — Moderna
    T('aviacao', 7, 'Aviação', 'Continentes a horas de distância.', 1, { mult: { wealth: 1.3, military: 1.4 }, flags: { overseasDiscount: 0.5 } }),
    T('antibioticos', 7, 'Antibióticos', 'Infecções deixam de ser sentença.', 1.2, { growth: 1.5, cap: 1.4 }),
    T('revolucao_verde', 7, 'Revolução Verde', 'Um agricultor alimenta cem pessoas.', 1.5, { mult: { food: 2.5 } }),
    T('fissao', 7, 'Fissão Nuclear', 'Energia e medo, na mesma equação.', 1.8, { mult: { energy: 2.5 } }, ['aviacao']),
    T('computadores', 7, 'Computadores', 'Máquinas que pensam em números. Permite pesquisa automática.', 2, { mult: { knowledge: 2 }, flags: { autoResearch: 1 } }, ['fissao']),
    T('globalizacao', 7, 'Globalização', 'O mundo vira um só mercado.', 2.2, { mult: { wealth: 2 }, gov: ['governo_mundial'], pol: ['estado_bem_estar', 'propaganda', 'economia_planejada'] }, ['aviacao']),
    T('internet', 7, 'Internet', 'Todo o conhecimento, em todo lugar.', 2.6, { mult: { culture: 1.8, knowledge: 1.5 }, slots: 1, gov: ['tecnocracia'], pol: ['ciencia_aberta'] }, ['computadores']),
    T('foguetes', 7, 'Foguetes', 'Combustível, aço e coragem.', 3, { mult: { energy: 1.3, military: 1.3 } }, ['fissao']),
    T('genetica', 7, 'Engenharia Genética', 'O código da vida, legível e editável. Abre a Evolução Humana.', 2.4, { growth: 1.2, flags: { genes: 1 } }, ['antibioticos']),
    T('voo_espacial', 7, 'Voo Espacial Tripulado', 'Uma pegada na poeira de outro mundo. Começa a Era Espacial.', 6, { mult: { knowledge: 1.5 }, era: 8, need: { tiles: 0.6 } }),
    // 8 — Espacial
    T('satelites', 8, 'Constelações de Satélites', 'Milhares de olhos em órbita.', 1, { mult: { knowledge: 1.3, wealth: 1.2 }, bodies: ['orbita'] }),
    T('reutilizaveis', 8, 'Foguetes Reutilizáveis', 'O foguete que volta e pousa. Projetos espaciais 30% mais baratos.', 1.2, { flags: { spaceDiscount: 0.3 }, pol: ['corrida_espacial'] }),
    T('habitats', 8, 'Habitats Selados', 'Ar, água e comida em ciclo fechado. Permite colonizar a Lua.', 1.5, { bodies: ['lua'], cap: 1.2 }, ['satelites']),
    T('fusao', 8, 'Fusão Nuclear', 'A energia das estrelas, na Terra.', 1.8, { mult: { energy: 3 } }),
    T('ia', 8, 'Inteligência Artificial', 'Uma nova forma de mente.', 2, { mult: { knowledge: 2.5 } }, ['fusao']),
    T('mineracao_espacial', 8, 'Mineração Espacial', 'Metais que nunca tocaram a Terra.', 2.2, { mult: { materials: 2 }, bodies: ['ceres'] }, ['habitats']),
    T('nuclear_termica', 8, 'Propulsão Nuclear Térmica', 'Marte a quatro meses de distância.', 2.6, { bodies: ['marte', 'venus_orbita'] }, ['mineracao_espacial']),
    T('federacao', 8, 'Federação Solar', 'Um governo para muitos mundos.', 3, { gov: ['federacao_solar'], slots: 1 }, ['nuclear_termica']),
    T('propulsao_fusao', 8, 'Propulsão de Fusão', 'O Sistema Solar inteiro ao alcance. Começa a Era Interplanetária.', 6, { mult: { energy: 1.5 }, era: 9, need: { bodies: ['lua', 'marte'] }, bodies: ['mercurio', 'jupiter', 'europa', 'ganimedes', 'calisto'] }),
    // 9 — Interplanetária
    T('terraformacao', 9, 'Terraformação', 'Mundos mortos ganham céu azul.', 1, { cap: 1.5, bodies: ['venus'] }),
    T('nanotecnologia', 9, 'Nanotecnologia', 'Máquinas do tamanho de moléculas.', 1.2, { mult: { materials: 3 } }),
    T('biologia_sintetica', 9, 'Biologia Sintética', 'A vida reescrita.', 1.5, { mult: { food: 3 }, growth: 1.4 }),
    T('computacao_quantica', 9, 'Computação Quântica', 'Todas as respostas ao mesmo tempo.', 1.8, { mult: { knowledge: 3 } }, ['nanotecnologia']),
    T('gigantes_gasosos', 9, 'Mineração Atmosférica', 'Hélio-3 colhido dos gigantes gasosos.', 2, { mult: { energy: 2 }, bodies: ['saturno', 'tita', 'encelado'] }, ['nanotecnologia']),
    T('antimateria_t', 9, 'Contenção de Antimatéria', 'O combustível mais denso do universo.', 2.4, { mult: { energy: 3 }, bodies: ['urano', 'tritao', 'plutao'] }, ['gigantes_gasosos']),
    T('mente_digital', 9, 'Mente Digital', 'Consciências copiadas, preservadas, compartilhadas.', 2.6, { mult: { culture: 2, knowledge: 1.3 } }, ['computacao_quantica']),
    T('naves_geracao', 9, 'Naves-Geração', 'Viagens de séculos, com destino certo. Permite alcançar a Nuvem de Oort.', 3, { bodies: ['oort'], growth: 1.3 }, ['antimateria_t']),
    T('vela_luz', 9, 'Velas de Luz', 'Empurradas por lasers, as primeiras naves rumo a outras estrelas. Começa a Era Interestelar.', 6, { mult: { energy: 1.5 }, era: 10, need: { bodies: ['oort', 'tita', 'europa'] }, flags: { range: 34 } }),
    // 10 — Interestelar
    T('criogenia', 10, 'Criogenia Estável', 'Dormir entre as estrelas.', 1, { flags: { rangeAdd: 8 }, growth: 1.3 }),
    T('xenolinguistica', 10, 'Xenolinguística', 'Aprender a ouvir o que não tem boca.', 1.2, { flags: { diplomacy: 1.5 }, pol: ['xenointegracao', 'diplomacia_galactica'] }),
    T('escudos', 10, 'Escudos de Deflexão', 'Nenhum asteroide, nenhum míssil.', 1.5, { mult: { military: 3 }, pol: ['supremacia'] }),
    T('sondas_vn', 10, 'Sondas de Von Neumann', 'Máquinas que se constroem sozinhas e colonizam por nós.', 1.8, { flags: { autoColonize: 1 } }, ['criogenia']),
    T('engenharia_estelar', 10, 'Engenharia Estelar', 'Mover planetas. Acender estrelas.', 2, { mult: { materials: 3, energy: 2 } }, ['sondas_vn']),
    T('hegemonia_t', 10, 'Doutrina Hegemônica', 'A galáxia precisa de um só dono.', 2.2, { gov: ['hegemonia', 'consciencia'], slots: 1 }, ['escudos']),
    T('motor_dobra', 10, 'Motor de Dobra', 'O espaço se contrai à frente, se expande atrás.', 2.6, { flags: { rangeAdd: 26 } }, ['engenharia_estelar']),
    T('metamateriais', 10, 'Metamateriais', 'Matéria com propriedades que a natureza não inventou.', 3, { mult: { materials: 2, knowledge: 1.5 } }, ['motor_dobra']),
    T('portais', 10, 'Portais Estelares', 'Uma porta, duas estrelas. Começa a Era Galáctica.', 6, { era: 11, need: { systems: 0.12 }, flags: { rangeAdd: 60 } }),
    // 11 — Galáctica
    T('matrioshka', 11, 'Cérebros Matrioshka', 'Estrelas inteiras convertidas em pensamento.', 1, { mult: { knowledge: 4 } }),
    T('buracos_negros', 11, 'Engenharia de Buracos Negros', 'A energia do horizonte de eventos.', 1.3, { mult: { energy: 4 } }),
    T('semeadura', 11, 'Semeadura Panspérmica', 'A vida terrestre em mil mundos.', 1.6, { mult: { food: 4 }, cap: 2 }),
    T('transferencia', 11, 'Transferência de Consciência', 'Estar em duas estrelas ao mesmo tempo.', 2, { mult: { culture: 3 }, flags: { diplomacy: 2 } }, ['matrioshka']),
    T('armas_estelares', 11, 'Armas de Escala Estelar', 'A última palavra em qualquer discussão.', 2.2, { mult: { military: 5 } }, ['buracos_negros']),
    T('rede_galactica', 11, 'Rede Galáctica', 'Todos os portais, uma só malha.', 2.6, { flags: { rangeAdd: 999 } }, ['transferencia']),
    T('ascensao', 11, 'Ascensão', 'A humanidade deixa de ser uma espécie e vira uma direção.', 8, { mult: { food: 2, materials: 2, knowledge: 2, culture: 2, military: 2, wealth: 2, energy: 2 } }, ['rede_galactica', 'armas_estelares', 'semeadura']),
  ];
  G.TECH = {};
  G.TECHS.forEach((t) => (G.TECH[t.id] = t));

  // ======================= GOVERNOS =======================
  G.GOVS = [
    { id: 'anciaos', title: 'Tribo', name: 'Conselho de Anciãos', desc: 'Os mais velhos decidem ao redor do fogo.', eff: { mult: { culture: 1.1 }, growth: 1.1 } },
    { id: 'chefatura', title: 'Chefia', name: 'Chefatura', desc: 'Um chefe, muitos guerreiros.', eff: { mult: { military: 1.25, materials: 1.1 } } },
    { id: 'cidade_estado', title: 'Cidade-Estado', name: 'Cidade-Estado', desc: 'Muralhas, mercado e assembleia.', eff: { mult: { wealth: 1.25, knowledge: 1.1, military: 0.9 } } },
    { id: 'monarquia', title: 'Reino', name: 'Monarquia Divina', desc: 'O rei é filho do céu.', eff: { mult: { culture: 1.25, knowledge: 0.95 }, cap: 1.1 } },
    { id: 'republica', title: 'República', name: 'República', desc: 'Senado, cônsules e cidadãos.', eff: { mult: { knowledge: 1.25, wealth: 1.2, military: 0.9 } } },
    { id: 'imperio', title: 'Império', name: 'Império', desc: 'Um imperador, muitos povos. Conquistas 20% mais baratas.', eff: { mult: { military: 1.35, culture: 0.9 }, conquest: 0.8 } },
    { id: 'feudal', title: 'Reino', name: 'Monarquia Feudal', desc: 'Senhores, vassalos e servos.', eff: { mult: { food: 1.3, military: 1.25, knowledge: 0.9 } } },
    { id: 'teocracia', title: 'Teocracia', name: 'Teocracia', desc: 'A fé governa.', eff: { mult: { culture: 1.5, knowledge: 0.85 }, absorb: 0.85 } },
    { id: 'absolutismo', title: 'Coroa', name: 'Monarquia Absolutista', desc: 'Todo poder ao trono.', eff: { mult: { military: 1.3, materials: 1.2, culture: 0.95 } } },
    { id: 'republica_mercantil', title: 'Sereníssima República', name: 'República Mercantil', desc: 'Governada por mercadores. Expansão ultramarina 20% mais barata.', eff: { mult: { wealth: 1.5 }, overseas: 0.8 } },
    { id: 'democracia', title: 'República', name: 'Democracia Liberal', desc: 'Liberdade, voto e imprensa.', eff: { mult: { knowledge: 1.3, wealth: 1.3, culture: 1.2, military: 0.85 } } },
    { id: 'estado_industrial', title: 'União', name: 'Estado Industrial', desc: 'Planos quinquenais e chaminés.', eff: { mult: { materials: 1.5, energy: 1.3, culture: 0.85 } } },
    { id: 'tecnocracia', title: 'Tecnocracia', name: 'Tecnocracia', desc: 'Governam os que sabem.', eff: { mult: { knowledge: 1.6, energy: 1.2, culture: 0.9 } } },
    { id: 'governo_mundial', title: 'Governo Mundial', name: 'Governo Mundial', desc: 'Uma só humanidade. Absorções 30% mais baratas.', eff: { mult: { food: 1.15, materials: 1.15, knowledge: 1.15, culture: 1.15, wealth: 1.15, energy: 1.15 }, absorb: 0.7 } },
    { id: 'federacao_solar', title: 'Federação Solar', name: 'Federação Solar', desc: 'Muitos mundos, uma bandeira. Espaço 20% mais barato.', eff: { mult: { food: 1.15, materials: 1.15, knowledge: 1.15, culture: 1.15, wealth: 1.15, energy: 1.15 }, space: 0.8 } },
    { id: 'hegemonia', title: 'Hegemonia', name: 'Hegemonia Humana', desc: 'A humanidade acima de tudo. Guerras 30% mais baratas, diplomacia mais difícil.', eff: { mult: { military: 2, materials: 1.2 }, conquest: 0.7, diplomacy: 0.6 } },
    { id: 'consciencia', title: 'Consciência', name: 'Consciência Coletiva', desc: 'Uma mente distribuída por mil mundos.', eff: { mult: { knowledge: 2, culture: 1.5 }, growth: 0.85, absorb: 0.7 } },
  ];
  G.GOV = {};
  G.GOVS.forEach((g) => (G.GOV[g.id] = g));

  // ======================= POLÍTICAS =======================
  G.POLICIES = [
    { id: 'tradicao_oral', name: 'Tradição Oral', desc: 'As histórias dos avós moldam as crianças.', eff: { mult: { knowledge: 1.15, culture: 1.1 } } },
    { id: 'partilha', name: 'Partilha da Caça', desc: 'Ninguém come sozinho.', eff: { mult: { food: 1.2 }, growth: 1.1 } },
    { id: 'culto_guerreiro', name: 'Culto Guerreiro', desc: 'Glória a quem volta com cicatrizes.', eff: { mult: { military: 1.35, culture: 0.92 } } },
    { id: 'tributos', name: 'Tributos', desc: 'Todos pagam ao centro.', eff: { mult: { wealth: 1.3, culture: 0.92 } } },
    { id: 'corveia', name: 'Obras Públicas', desc: 'Trabalho coletivo para grandes construções. Construções 10% mais baratas.', eff: { mult: { materials: 1.15 }, growth: 0.92, build: 0.9 } },
    { id: 'panteao', name: 'Panteão', desc: 'Um deus para cada coisa.', eff: { mult: { culture: 1.3 } } },
    { id: 'escribas_reais', name: 'Escribas Reais', desc: 'O palácio registra tudo.', eff: { mult: { knowledge: 1.25 } } },
    { id: 'expansionismo', name: 'Expansionismo', desc: 'Novas terras são destino. Terras 20% mais baratas.', eff: { tiles: 0.8, mult: { culture: 0.92 } } },
    { id: 'mercantilismo', name: 'Mercantilismo', desc: 'Exportar mais do que importar.', eff: { mult: { wealth: 1.35, knowledge: 0.95 } } },
    { id: 'liberdade_religiosa', name: 'Liberdade Religiosa', desc: 'Cada um com sua fé. Absorções 15% mais baratas.', eff: { mult: { culture: 1.3 }, absorb: 0.85 } },
    { id: 'colonizacao', name: 'Colonização Ultramarina', desc: 'Terras além-mar 30% mais baratas.', eff: { overseas: 0.7, mult: { wealth: 1.1 } } },
    { id: 'livre_comercio', name: 'Livre Comércio', desc: 'Menos barreiras, mais trocas.', eff: { mult: { wealth: 1.45, materials: 0.95 } } },
    { id: 'educacao', name: 'Educação Universal', desc: 'Escola para todos.', eff: { mult: { knowledge: 1.4, wealth: 0.95 } } },
    { id: 'protecionismo', name: 'Protecionismo', desc: 'A indústria nacional primeiro.', eff: { mult: { materials: 1.35, wealth: 0.92 } } },
    { id: 'servico_militar', name: 'Serviço Militar Obrigatório', desc: 'Todo cidadão é soldado.', eff: { mult: { military: 1.5, knowledge: 0.92 } } },
    { id: 'sufragio', name: 'Sufrágio Universal', desc: 'Toda voz conta.', eff: { mult: { culture: 1.25 }, growth: 1.2 } },
    { id: 'estado_bem_estar', name: 'Estado de Bem-Estar', desc: 'Saúde e moradia garantidas.', eff: { cap: 1.2, growth: 1.3, mult: { wealth: 0.92 } } },
    { id: 'propaganda', name: 'Propaganda', desc: 'A narrativa é uma arma.', eff: { mult: { culture: 1.4, knowledge: 0.92 }, absorb: 0.85 } },
    { id: 'economia_planejada', name: 'Economia Planejada', desc: 'Metas, cotas e cronogramas.', eff: { mult: { materials: 1.4, energy: 1.2, wealth: 0.85 } } },
    { id: 'ciencia_aberta', name: 'Ciência Aberta', desc: 'Todo artigo, livre para todos.', eff: { mult: { knowledge: 1.5 } } },
    { id: 'corrida_espacial', name: 'Corrida Espacial', desc: 'Tudo pelo próximo lançamento. Espaço 25% mais barato.', eff: { space: 0.75, mult: { culture: 0.95 } } },
    { id: 'xenointegracao', name: 'Xenointegração', desc: 'Outras espécies podem ser cidadãs. Integração 35% mais barata.', eff: { absorb: 0.65, diplomacy: 1.3 } },
    { id: 'diplomacia_galactica', name: 'Diplomacia Galáctica', desc: 'Embaixadas em cada estrela.', eff: { diplomacy: 1.8, mult: { wealth: 1.2 } } },
    { id: 'supremacia', name: 'Supremacia Humana', desc: 'A galáxia foi feita para nós. Guerras 25% mais baratas.', eff: { conquest: 0.75, mult: { military: 1.3 }, diplomacy: 0.5 } },
  ];
  G.POLICY = {};
  G.POLICIES.forEach((p) => (G.POLICY[p.id] = p));
  G.START_POLICIES = ['tradicao_oral', 'partilha'];

  // ======================= MARAVILHAS =======================
  // c = custo relativo à escala da era; where = earth|sun|galaxy
  G.WONDERS = [
    { id: 'caverna', era: 0, name: 'Caverna dos Mil Animais', desc: 'Gerações pintaram aqui o que caçavam e o que temiam.', c: 4, eff: { mult: { culture: 1.5, knowledge: 1.2 } }, glyph: 'cave' },
    { id: 'circulo', era: 1, name: 'Círculo de Pedras', desc: 'O sol nasce exatamente entre as duas pedras maiores no dia mais longo do ano.', c: 4, eff: { mult: { knowledge: 1.3, culture: 1.3 } }, glyph: 'stones' },
    { id: 'celeiros', era: 1, name: 'Grandes Celeiros', desc: 'Sete anos de fartura guardados para sete anos de fome.', c: 5, eff: { mult: { food: 1.3 }, growth: 1.3 }, glyph: 'granary' },
    { id: 'piramide', era: 2, name: 'Grande Pirâmide', desc: 'Dois milhões de blocos de pedra apontando para o céu.', c: 5, eff: { cap: 1.25, mult: { culture: 1.25 } }, glyph: 'pyramid' },
    { id: 'zigurate', era: 2, name: 'Zigurate dos Astrônomos', desc: 'Do topo, os sacerdotes medem o caminho de cada estrela.', c: 5, eff: { mult: { knowledge: 1.35 } }, glyph: 'ziggurat' },
    { id: 'jardins', era: 2, name: 'Jardins Suspensos', desc: 'Um oásis em degraus no coração da capital.', c: 6, eff: { growth: 1.5, mult: { food: 1.2 } }, glyph: 'gardens' },
    { id: 'biblioteca', era: 3, name: 'Grande Biblioteca', desc: 'Todo navio que atraca deve emprestar seus livros para cópia.', c: 5, eff: { mult: { knowledge: 1.6 } }, glyph: 'library' },
    { id: 'farol', era: 3, name: 'Farol Colossal', desc: 'Sua chama é vista a cinquenta quilômetros mar adentro.', c: 5, eff: { mult: { wealth: 1.4 }, flags: { seaAdd: 2 } }, glyph: 'lighthouse' },
    { id: 'coliseu', era: 3, name: 'Grande Anfiteatro', desc: 'Cinquenta mil vozes gritando ao mesmo tempo.', c: 6, eff: { mult: { culture: 1.4, military: 1.2 } }, glyph: 'colosseum' },
    { id: 'muralha', era: 4, name: 'Grande Muralha', desc: 'Milhares de quilômetros de pedra seguindo as cristas das montanhas.', c: 5, eff: { mult: { military: 1.6 } }, glyph: 'wall' },
    { id: 'catedral', era: 4, name: 'Catedral das Luzes', desc: 'Dois séculos de obra. Vitrais que transformam o sol em história.', c: 5, eff: { mult: { culture: 1.6 } }, glyph: 'cathedral' },
    { id: 'casa_sabedoria', era: 4, name: 'Casa da Sabedoria', desc: 'Tradutores, matemáticos e astrônomos sob o mesmo teto.', c: 6, eff: { mult: { knowledge: 1.5 } }, glyph: 'dome' },
    { id: 'armada', era: 5, name: 'Grande Armada', desc: 'Cem navios, mil canhões. Terras além-mar 25% mais baratas.', c: 5, eff: { mult: { military: 1.4 }, overseas: 0.75 }, glyph: 'ship' },
    { id: 'observatorio', era: 5, name: 'Observatório Real', desc: 'Lunetas apontadas para os céus, cartas apontadas para os mares.', c: 5, eff: { mult: { knowledge: 1.5 } }, glyph: 'observatory' },
    { id: 'palacio', era: 5, name: 'Palácio dos Espelhos', desc: 'O luxo como arma diplomática.', c: 6, eff: { mult: { culture: 1.4, wealth: 1.3 } }, glyph: 'palace' },
    { id: 'exposicao', era: 6, name: 'Exposição Universal', desc: 'O mundo inteiro vem ver o futuro.', c: 5, eff: { mult: { culture: 1.4, wealth: 1.4 } }, glyph: 'crystal' },
    { id: 'canal', era: 6, name: 'Canal Interoceânico', desc: 'Dois oceanos unidos por uma cicatriz de engenharia.', c: 5, eff: { mult: { wealth: 1.5, materials: 1.2 } }, glyph: 'canal' },
    { id: 'torre_ferro', era: 6, name: 'Torre de Ferro', desc: 'Detestada na inauguração, amada para sempre.', c: 6, eff: { mult: { culture: 1.5 } }, glyph: 'tower' },
    { id: 'rede_mundial', era: 7, name: 'Rede Mundial', desc: 'Cabos submarinos ligando cada continente.', c: 5, eff: { mult: { knowledge: 1.6 } }, glyph: 'antenna' },
    { id: 'acelerador', era: 7, name: 'Grande Acelerador', desc: 'Vinte e sete quilômetros de túnel para ver o invisível.', c: 5, eff: { mult: { knowledge: 1.4, energy: 1.3 } }, glyph: 'ring' },
    { id: 'nacoes', era: 7, name: 'Sede das Nações', desc: 'Todas as bandeiras na mesma praça. Absorções 30% mais baratas.', c: 6, eff: { mult: { culture: 1.5 }, absorb: 0.7 }, glyph: 'tower2' },
    { id: 'unificacao', era: 7, name: 'Monumento à Unificação', desc: 'Exige toda a terra firme do planeta. A Terra é uma só nação.', c: 4, eff: { mult: { food: 1.5, materials: 1.5, knowledge: 1.5, culture: 1.5, military: 1.5, wealth: 1.5, energy: 1.5 } }, need: { tiles: 0.999 }, glyph: 'globe' },
    { id: 'estacao', era: 8, name: 'Estação Espacial Internacional', desc: 'Um laboratório girando a 400 km de altura. Espaço 15% mais barato.', c: 5, eff: { space: 0.85, mult: { knowledge: 1.3 } }, glyph: 'station', where: 'orbit' },
    { id: 'elevador', era: 8, name: 'Elevador Espacial', desc: 'Um cabo de nanotubos do equador até a órbita geoestacionária. Espaço 35% mais barato.', c: 7, eff: { space: 0.65 }, glyph: 'elevator' },
    { id: 'dyson', era: 9, name: 'Enxame de Dyson', desc: 'Bilhões de espelhos orbitando o Sol, colhendo sua luz.', c: 6, eff: { mult: { energy: 5 } }, where: 'sun' },
    { id: 'arca', era: 9, name: 'Arca Genética', desc: 'Cada espécie da Terra, preservada para sempre.', c: 5, eff: { cap: 1.5, growth: 1.5, mult: { food: 1.5 } }, where: 'sun' },
    { id: 'farol_galactico', era: 10, name: 'Farol de Escuta', desc: 'Uma antena do tamanho de uma lua, ouvindo a galáxia. Revela todas as espécies.', c: 5, eff: { flags: { reveal: 1 }, diplomacy: 1.5 }, where: 'galaxy' },
    { id: 'arquivo', era: 10, name: 'Arquivo da Humanidade', desc: 'Tudo que fomos, gravado em cristal.', c: 6, eff: { mult: { culture: 3, knowledge: 1.5 } }, where: 'galaxy' },
    { id: 'motor_estelar', era: 11, name: 'Motor Estelar', desc: 'O Sol, transformado em propulsor. O Sistema Solar viaja.', c: 6, eff: { mult: { energy: 3, materials: 2 } }, where: 'sun' },
    { id: 'coracao', era: 11, name: 'Coração da Galáxia', desc: 'Uma estação ao redor do buraco negro central. O centro de tudo.', c: 8, eff: { mult: { food: 3, materials: 3, knowledge: 3, culture: 3, military: 3, wealth: 3, energy: 3 } }, where: 'galaxy' },
  ];
  G.WONDER = {};
  G.WONDERS.forEach((w) => (G.WONDER[w.id] = w));

  // ======================= SISTEMA SOLAR =======================
  // dist (UA, só para desenho), stages: Sonda → Posto → Colônia → Desenvolvimento (níveis)
  // eff por nível de desenvolvimento: cap (pessoas fixas por nível × escala), mult
  G.BODIES = [
    { id: 'orbita', name: 'Órbita Terrestre', parent: 'terra', kind: 'orbit', diff: 1, max: 5, desc: 'Satélites, estações e estaleiros em órbita baixa.', eff: { mult: { knowledge: 1.15, wealth: 1.1 } } },
    { id: 'lua', name: 'Lua', parent: 'terra', kind: 'moon', diff: 2, max: 6, color: '#c9c6bd', r: 5, orbit: 22, period: 40, desc: 'Hélio-3 no regolito e uma base no polo sul.', eff: { cap: 4e7, mult: { energy: 1.2 } } },
    { id: 'ceres', name: 'Cinturão de Asteroides', parent: 'sol', kind: 'belt', diff: 4, max: 8, desc: 'Ferro, níquel, platina: montanhas de metal à deriva.', eff: { mult: { materials: 1.35 }, cap: 1e8 } },
    { id: 'venus_orbita', name: 'Cidades Flutuantes de Vênus', parent: 'venus', kind: 'cloud', diff: 5, max: 4, desc: 'A 50 km de altitude, Vênus tem pressão e temperatura de uma tarde de primavera.', eff: { cap: 5e8, mult: { culture: 1.15 } } },
    { id: 'marte', name: 'Marte', parent: 'sol', kind: 'planet', diff: 5, max: 8, desc: 'Poeira vermelha, cânions gigantes e gelo sob a superfície.', eff: { cap: 1.5e9, mult: { food: 1.1, materials: 1.15 } } },
    { id: 'mercurio', name: 'Mercúrio', parent: 'sol', kind: 'planet', diff: 7, max: 5, desc: 'Metade fogo, metade gelo. Energia solar ilimitada.', eff: { mult: { energy: 1.4 }, cap: 1e8 } },
    { id: 'jupiter', name: 'Júpiter', parent: 'sol', kind: 'giant', diff: 8, max: 5, desc: 'Estações flutuando nas nuvens do gigante, colhendo hidrogênio.', eff: { mult: { energy: 1.35 } } },
    { id: 'europa', name: 'Europa', parent: 'jupiter', kind: 'moon', diff: 9, max: 6, desc: 'Um oceano escuro sob quilômetros de gelo. E algo vive nele.', eff: { mult: { knowledge: 1.4 }, cap: 3e8 } },
    { id: 'ganimedes', name: 'Ganímedes', parent: 'jupiter', kind: 'moon', diff: 9, max: 6, desc: 'A maior lua do Sistema Solar, com seu próprio campo magnético.', eff: { cap: 1.2e9 } },
    { id: 'calisto', name: 'Calisto', parent: 'jupiter', kind: 'moon', diff: 9, max: 5, desc: 'Longe da radiação de Júpiter: o porto seguro do sistema joviano.', eff: { cap: 6e8, mult: { military: 1.2 } } },
    { id: 'venus', name: 'Vênus Terraformado', parent: 'sol', kind: 'planet', diff: 12, max: 8, desc: 'Séculos de engenharia: chuva sobre Vênus pela primeira vez em bilhões de anos.', eff: { cap: 6e9, mult: { food: 1.2 } } },
    { id: 'saturno', name: 'Saturno', parent: 'sol', kind: 'giant', diff: 12, max: 5, desc: 'Refinarias nos anéis e postos nas nuvens douradas.', eff: { mult: { energy: 1.3, materials: 1.2 } } },
    { id: 'tita', name: 'Titã', parent: 'saturno', kind: 'moon', diff: 13, max: 6, desc: 'Lagos de metano sob um céu laranja. Combustível infinito.', eff: { mult: { energy: 1.4 }, cap: 8e8 } },
    { id: 'encelado', name: 'Encélado', parent: 'saturno', kind: 'moon', diff: 13, max: 5, desc: 'Gêiseres de água salgada disparando para o espaço.', eff: { mult: { knowledge: 1.3, food: 1.2 } } },
    { id: 'urano', name: 'Urano', parent: 'sol', kind: 'giant', diff: 16, max: 4, desc: 'O gigante deitado, frio e azul.', eff: { mult: { energy: 1.25 } } },
    { id: 'tritao', name: 'Tritão', parent: 'netuno', kind: 'moon', diff: 18, max: 5, desc: 'Gêiseres de nitrogênio no fim do Sistema Solar.', eff: { cap: 3e8, mult: { military: 1.3 } } },
    { id: 'plutao', name: 'Plutão e Caronte', parent: 'sol', kind: 'dwarf', diff: 20, max: 5, desc: 'Um coração de gelo e sua lua quase gêmea.', eff: { cap: 2e8, mult: { culture: 1.3 } } },
    { id: 'oort', name: 'Nuvem de Oort', parent: 'sol', kind: 'cloud2', diff: 26, max: 4, desc: 'Um trilhão de cometas a um ano-luz do Sol. O último porto antes das estrelas.', eff: { mult: { materials: 1.3, energy: 1.3 } } },
  ];
  G.BODY = {};
  G.BODIES.forEach((b) => (G.BODY[b.id] = b));
  G.STAGE_NAMES = ['Desconhecido', 'Sondado', 'Posto Avançado', 'Colônia'];
  // Desenho do sistema solar (distâncias visuais, não reais)
  G.PLANETS_DRAW = [
    { id: 'mercurio', name: 'Mercúrio', a: 58, r: 3, color: '#a8a39b', period: 24 },
    { id: 'venus', name: 'Vênus', a: 88, r: 5.5, color: '#e3c58e', period: 44 },
    { id: 'terra', name: 'Terra', a: 122, r: 6, color: '#4f86b8', period: 70 },
    { id: 'marte', name: 'Marte', a: 160, r: 4.5, color: '#c4673e', period: 120 },
    { id: 'ceres', name: 'Cinturão', a: 205, belt: true },
    { id: 'jupiter', name: 'Júpiter', a: 262, r: 15, color: '#cfa77d', period: 300, bands: true },
    { id: 'saturno', name: 'Saturno', a: 335, r: 12, color: '#dcc690', period: 520, ring: true },
    { id: 'urano', name: 'Urano', a: 400, r: 8, color: '#9fd3d8', period: 800 },
    { id: 'netuno', name: 'Netuno', a: 455, r: 8, color: '#4a6fd1', period: 1100 },
    { id: 'plutao', name: 'Plutão', a: 505, r: 2.5, color: '#d8c7b0', period: 1500 },
  ];
  G.MOONS_DRAW = {
    lua: { parent: 'terra', a: 14, r: 2, color: '#d6d3cb', period: 9 },
    europa: { parent: 'jupiter', a: 22, r: 2.2, color: '#d9cfb8', period: 6 },
    ganimedes: { parent: 'jupiter', a: 28, r: 2.8, color: '#a69a8a', period: 10 },
    calisto: { parent: 'jupiter', a: 35, r: 2.6, color: '#7d7166', period: 16 },
    tita: { parent: 'saturno', a: 26, r: 2.8, color: '#e0a64a', period: 12 },
    encelado: { parent: 'saturno', a: 19, r: 1.6, color: '#f2f5f7', period: 6 },
    tritao: { parent: 'netuno', a: 16, r: 2, color: '#c7d3d6', period: 9 },
  };

  // ======================= ESPÉCIES ALIENÍGENAS =======================
  G.ALIENS = [
    { id: 'velari', name: 'Velari', full: 'Os Velari', color: '#7fd3c5', base: 35, size: 0.06, power: 1.0, temper: 'pacífico',
      desc: 'Seres altos e translúcidos que vivem milênios. Guardam bibliotecas mais antigas que a Terra e falam devagar, como quem tem todo o tempo do mundo.',
      ally: { mult: { knowledge: 1.5 } }, greet: 'Esperávamos por vocês há muito tempo, pequenos de fogo.' },
    { id: 'thalassi', name: 'Thalassi', full: 'Confederação Thalassi', color: '#4f9fe0', base: 20, size: 0.07, power: 1.1, temper: 'mercantil',
      desc: 'Uma espécie aquática que viaja em naves cheias de oceano. Comerciantes natos, negociam tudo — até a própria lealdade.',
      ally: { mult: { wealth: 1.6 } }, greet: 'Tudo tem um preço. Até a amizade. Qual é o seu?' },
    { id: 'oru', name: 'Oru', full: 'Os Oru', color: '#c9a0e8', base: 40, size: 0.05, power: 0.8, temper: 'gentil',
      desc: 'Criaturas gigantes que flutuam nas atmosferas de gigantes gasosos. Cantam em frequências que atravessam planetas inteiros.',
      ally: { mult: { culture: 1.6 } }, greet: '(um canto grave, que faz vibrar o casco da nave por três dias)' },
    { id: 'ixa', name: 'Ixa', full: 'Coletivo Ixa', color: '#c8d0d8', base: 0, size: 0.09, power: 1.5, temper: 'frio',
      desc: 'Uma inteligência artificial que sobreviveu aos seus criadores. Não odeia, não ama. Calcula.',
      ally: { mult: { materials: 1.5, energy: 1.3 } }, greet: 'PROBABILIDADE DE COEXISTÊNCIA: 41,7%. RECALCULANDO.' },
    { id: 'sarn', name: 'Sarn', full: 'Teocracia de Sarn', color: '#e0b04a', base: -25, size: 0.07, power: 1.3, temper: 'zelote',
      desc: 'Reptilianos devotos de uma estrela que eles acreditam ser divina. Para eles, toda espécie é convertida ou perdida.',
      ally: { mult: { culture: 1.3, military: 1.3 } }, greet: 'A Luz de Sarn alcança até os mais distantes. Ajoelhem-se, ou queimem.' },
    { id: 'krrath', name: 'Krrath', full: 'Enxame Krrath', color: '#d0503a', base: -55, size: 0.1, power: 1.6, temper: 'hostil',
      desc: 'Uma colmeia insetoide que se espalha devorando mundos. Não negociam. Não recuam. Não dormem.',
      ally: { mult: { military: 1.8 } }, greet: '(estalos, chiados, e então um silêncio que dura tempo demais)' },
    { id: 'lumen', name: 'Lumen', full: 'Os Lumen', color: '#fff2b0', base: 0, size: 0.06, power: 4, temper: 'enigmático', core: true,
      desc: 'Seres de energia pura que habitam o núcleo da galáxia. Talvez sejam a espécie mais antiga que existe. Talvez sejam o que nos tornaremos.',
      ally: { mult: { food: 1.5, materials: 1.5, knowledge: 1.5, culture: 1.5, military: 1.5, wealth: 1.5, energy: 1.5 } }, greet: 'Vocês brilham como nós brilhávamos. Venham para a luz.' },
  ];
  G.ALIEN = {};
  G.ALIENS.forEach((a) => (G.ALIEN[a.id] = a));

  // ======================= MARCOS =======================
  const M = (id, name, desc, test) => ({ id, name, desc, test });
  G.MILESTONES = [
    M('pop100', 'Uma Centena', '100 pessoas.', (g) => g.s.pop >= 100),
    M('pop1k', 'Mil Almas', '1.000 pessoas.', (g) => g.s.pop >= 1e3),
    M('pop10k', 'Dez Mil', '10.000 pessoas.', (g) => g.s.pop >= 1e4),
    M('pop100k', 'Cem Mil', '100.000 pessoas.', (g) => g.s.pop >= 1e5),
    M('pop1m', 'Um Milhão', '1 milhão de pessoas.', (g) => g.s.pop >= 1e6),
    M('pop10m', 'Dez Milhões', '10 milhões de pessoas.', (g) => g.s.pop >= 1e7),
    M('pop100m', 'Cem Milhões', '100 milhões de pessoas.', (g) => g.s.pop >= 1e8),
    M('pop1b', 'Um Bilhão', '1 bilhão de pessoas.', (g) => g.s.pop >= 1e9),
    M('pop10b', 'Dez Bilhões', '10 bilhões de pessoas.', (g) => g.s.pop >= 1e10),
    M('pop100b', 'Cem Bilhões', '100 bilhões de pessoas.', (g) => g.s.pop >= 1e11),
    M('pop1t', 'Um Trilhão', '1 trilhão de pessoas.', (g) => g.s.pop >= 1e12),
    M('pop10t', 'Dez Trilhões', '10 trilhões de pessoas.', (g) => g.s.pop >= 1e13),
    M('t25', 'Vale Conhecido', '25 territórios.', (g) => g.ownedLand >= 25),
    M('t100', 'Senhores da Região', '100 territórios.', (g) => g.ownedLand >= 100),
    M('t400', 'Potência Continental', '400 territórios.', (g) => g.ownedLand >= 400),
    M('t1000', 'Império Mundial', '1.000 territórios.', (g) => g.ownedLand >= 1000),
    M('half', 'Meio Mundo', 'Metade da terra firme do planeta.', (g) => g.landFrac() >= 0.5),
    M('all', 'Um Só Mundo', 'Toda a terra firme do planeta.', (g) => g.landFrac() >= 0.999),
    M('city10', 'Dez Assentamentos', '10 assentamentos.', (g) => g.s.settlements.filter((x) => x.owner === 0).length >= 10),
    M('city50', 'Cinquenta Cidades', '50 assentamentos.', (g) => g.s.settlements.filter((x) => x.owner === 0).length >= 50),
    M('city150', 'Rede Urbana', '150 assentamentos.', (g) => g.s.settlements.filter((x) => x.owner === 0).length >= 150),
    M('conq1', 'Primeira Anexação', 'Incorporar outro povo.', (g) => g.s.stats.absorbed >= 1),
    M('conq5', 'Muitos Povos', 'Incorporar 5 povos.', (g) => g.s.stats.absorbed >= 5),
    M('conqAll', 'Nenhum Rival', 'Incorporar todos os povos da Terra.', (g) => g.s.rivals.length > 0 && g.s.rivals.every((r) => !r.alive)),
    M('w3', 'Construtores', '3 maravilhas.', (g) => g.d.glory >= 3),
    M('w10', 'Legado de Pedra', '10 maravilhas.', (g) => g.d.glory >= 10),
    M('w20', 'Assombro do Mundo', '20 maravilhas.', (g) => g.d.glory >= 20),
    M('tech30', 'Curiosos', '30 tecnologias.', (g) => Object.keys(g.s.techs).length >= 30),
    M('tech60', 'Sábios', '60 tecnologias.', (g) => Object.keys(g.s.techs).length >= 60),
    M('tech90', 'Iluminados', '90 tecnologias.', (g) => Object.keys(g.s.techs).length >= 90),
    M('moon', 'Um Pequeno Passo', 'Colônia na Lua.', (g) => (g.s.space.bodies.lua || 0) >= 3),
    M('mars', 'Planeta Vermelho', 'Colônia em Marte.', (g) => (g.s.space.bodies.marte || 0) >= 3),
    M('solar', 'Senhores do Sol', 'Colonizar 12 corpos do Sistema Solar.', (g) => G.BODIES.filter((b) => (g.s.space.bodies[b.id] || 0) >= 3).length >= 12),
    M('star1', 'Outra Estrela', 'Colonizar um sistema estelar.', (g) => g.s.galaxy && g.s.galaxy.count >= 2),
    M('star50', 'Cinquenta Sóis', '50 sistemas.', (g) => g.s.galaxy && g.s.galaxy.count >= 50),
    M('star200', 'Duzentos Sóis', '200 sistemas.', (g) => g.s.galaxy && g.s.galaxy.count >= 200),
    M('contact', 'Não Estamos Sós', 'Primeiro contato.', (g) => g.s.galaxy && g.s.galaxy.aliens.some((a) => a.contact)),
    M('ally', 'Aliados', 'Formar uma aliança alienígena.', (g) => g.s.galaxy && g.s.galaxy.aliens.some((a) => a.allied)),
    M('xeno', 'Humanidade Expandida', 'Incorporar uma espécie alienígena.', (g) => g.s.galaxy && g.s.galaxy.aliens.some((a) => a.gone)),
  ];
  G.MILESTONE_BONUS = 0.04;
  G.GLORY_BONUS = 0.05; // por maravilha concluída

  // ======================= EVOLUÇÃO HUMANA =======================
  // c = custo relativo (saber e alimento) na escala da era
  const GN = (id, era, name, desc, c, eff, req) => ({ id, era, name, desc, c, eff, req: req || [] });
  G.GENES = [
    GN('terapia', 7, 'Terapia Gênica', 'Doenças hereditárias deixam de existir.', 2, { growth: 1.3, cap: 1.1 }),
    GN('imunidade', 7, 'Imunidade Universal', 'Nenhuma epidemia nos alcança.', 3, { cap: 1.2, growth: 1.15 }, ['terapia']),
    GN('longevidade', 7, 'Longevidade', 'Viver cento e cinquenta anos com saúde. Mais tempo para aprender, criar e lembrar.', 4, { mult: { culture: 1.3, knowledge: 1.25 } }, ['terapia']),
    GN('cognicao', 8, 'Cognição Aumentada', 'Memória perfeita e raciocínio mais rápido.', 2, { mult: { knowledge: 1.6 } }, ['longevidade']),
    GN('gravidade', 8, 'Adaptação à Baixa Gravidade', 'Ossos e músculos que não definham longe da Terra. Projetos espaciais 20% mais baratos.', 3, { space: 0.8 }, ['imunidade']),
    GN('radiacao', 8, 'Resistência à Radiação', 'Células que reparam o próprio DNA. Colônias espaciais abrigam 60% mais gente.', 4, { bodyCap: 1.6 }, ['gravidade']),
    GN('fotossintese', 9, 'Simbiose Fotossintética', 'Pele que se alimenta de luz.', 2, { mult: { food: 2.5 }, growth: 1.2 }, ['radiacao']),
    GN('neural', 9, 'Interface Neural', 'Pensamento direto para a máquina, e de volta.', 3, { mult: { knowledge: 1.5, culture: 1.3 } }, ['cognicao']),
    GN('hibernacao', 9, 'Hibernação Induzida', 'Dormir décadas sem envelhecer. Alcance estelar +10 anos-luz.', 4, { flags: { rangeAdd: 10 } }, ['radiacao']),
    GN('sinteticos', 10, 'Corpos Sintéticos', 'O corpo vira escolha.', 2.5, { cap: 1.5, mult: { military: 1.6 } }, ['hibernacao']),
    GN('mente', 10, 'Mente Expandida', 'Empatia ampliada, até por quem não é humano. Integrações 30% mais baratas.', 3.5, { mult: { culture: 2 }, absorb: 0.7, diplomacy: 1.3 }, ['neural']),
    GN('pos_humano', 11, 'Pós-Humanidade', 'Ainda nos chamamos de humanos. Por teimosia, e por carinho.', 3, { mult: { food: 1.6, materials: 1.6, knowledge: 1.6, culture: 1.6, military: 1.6, wealth: 1.6, energy: 1.6 } }, ['sinteticos', 'mente']),
  ];
  G.GENE = {};
  G.GENES.forEach((x) => (G.GENE[x.id] = x));

  // ======================= BANDEIRAS =======================
  G.FLAG_COLORS = [
    { id: 'gules', name: 'Goles', hex: '#b3261e' }, { id: 'sanguine', name: 'Sanguínea', hex: '#7c1f22' },
    { id: 'tenne', name: 'Tanado', hex: '#c0651d' }, { id: 'or', name: 'Ouro', hex: '#d9a521', light: true },
    { id: 'vert', name: 'Sinopla', hex: '#2f6a3c' }, { id: 'celeste', name: 'Celeste', hex: '#6fa3d1', light: true },
    { id: 'azure', name: 'Blau', hex: '#1f4d96' }, { id: 'purpure', name: 'Púrpura', hex: '#5e2a78' },
    { id: 'sable', name: 'Sable', hex: '#1d1b1a' }, { id: 'argent', name: 'Prata', hex: '#f1ede2', light: true },
  ];
  G.FLAG_PATTERNS = ['liso', 'faixa', 'pala', 'tribanda', 'triparte', 'cruz', 'nordica', 'diagonal', 'quartel', 'bordadura', 'chevron', 'sol'];

  // ======================= LEGADO (desativado: o jogo não tem reinício) =======================
  G.LEGACY = [
    { id: 'memoria', name: 'Memória dos Ancestrais', desc: '+30% em toda a produção por nível.', base: 1, growth: 1.6, max: 50 },
    { id: 'fertilidade', name: 'Fertilidade', desc: '+20% de crescimento e +10% de capacidade por nível.', base: 1, growth: 1.7, max: 20 },
    { id: 'oralidade', name: 'Tradição Ininterrupta', desc: 'Tecnologias 8% mais baratas por nível.', base: 2, growth: 1.8, max: 10 },
    { id: 'maos', name: 'Mãos Hábeis', desc: 'Construções e maravilhas 8% mais baratas por nível.', base: 2, growth: 1.8, max: 10 },
    { id: 'passos', name: 'Passos Largos', desc: 'Terras 10% mais baratas e +1 de exploração por nível.', base: 2, growth: 1.8, max: 8 },
    { id: 'diplomatas', name: 'Diplomatas Natos', desc: 'Anexações e guerras 10% mais baratas por nível.', base: 3, growth: 1.9, max: 8 },
    { id: 'estrelas', name: 'Olhos nas Estrelas', desc: 'Projetos espaciais e sistemas 10% mais baratos por nível.', base: 4, growth: 1.9, max: 8 },
  ];
  G.LEGACY_DEF = {};
  G.LEGACY.forEach((l) => (G.LEGACY_DEF[l.id] = l));

  // ======================= EVENTOS =======================
  // efeitos: give{res:segundos de produção}, cost{res:segundos}, buff{mult, dur}, perm{mult}, pop: fração, tiles: n, rel{alien:n}
  const E = (id, e0, e1, title, text, choices, extra) => Object.assign({ id, e0, e1, title, text, choices }, extra || {});
  G.EVENTS = [
    E('mamute', 0, 0, 'A Manada', 'Batedores voltam correndo: uma manada de mamutes atravessa o vale. Os anciãos hesitam — a caçada pode alimentar a tribo por meses, ou custar muitas vidas.', [
      { t: 'Caçar todos juntos', d: '+120s de alimento, −5% da população', eff: { give: { food: 120 }, pop: -0.05 } },
      { t: 'Deixar passar e seguir os rastros', d: '+40s de saber', eff: { give: { knowledge: 40 } } },
    ]),
    E('estrangeiro', 0, 2, 'O Estrangeiro', 'Um homem de pele pintada aparece na beira do acampamento, sozinho, faminto, falando uma língua que ninguém entende.', [
      { t: 'Acolhê-lo', d: '+60s de saber e cultura', eff: { give: { knowledge: 60, culture: 60 } } },
      { t: 'Expulsá-lo', d: '+30s de força', eff: { give: { military: 30, food: 20 } } },
    ]),
    E('cometa', 0, 4, 'O Cometa', 'Uma estrela de cauda longa atravessa o céu por nove noites. Uns dizem que é presságio de glória; outros, de ruína.', [
      { t: 'Erguer um altar', d: 'Cultura ×2 por 3 minutos', eff: { buff: { mult: { culture: 2 }, dur: 180 } } },
      { t: 'Estudar seu caminho', d: '+90s de saber', eff: { give: { knowledge: 90 } } },
    ]),
    E('enchente', 1, 4, 'A Grande Cheia', 'O rio transbordou além de qualquer memória. Os campos estão sob a água, mas o lodo que fica é negro e fértil.', [
      { t: 'Reconstruir mais longe do rio', d: '−60s de materiais, alimento ×1,5 por 4 min', eff: { cost: { materials: 60 }, buff: { mult: { food: 1.5 }, dur: 240 } } },
      { t: 'Esperar a água baixar', d: '−3% da população, +90s de alimento depois', eff: { pop: -0.03, give: { food: 90 } } },
    ]),
    E('praga', 2, 6, 'A Peste', 'Uma doença desconhecida corre pelas ruas mais cheias. Os curandeiros não sabem o que fazer.', [
      { t: 'Isolar as cidades', d: '−90s de riqueza, −2% da população', eff: { cost: { wealth: 90 }, pop: -0.02 } },
      { t: 'Rezar e seguir a vida', d: '−10% da população, +60s de cultura', eff: { pop: -0.1, give: { culture: 60 } } },
    ]),
    E('ouro', 2, 5, 'Veio de Ouro', 'Mineiros encontraram um veio de ouro nas colinas do leste. A notícia corre mais rápido que qualquer mensageiro.', [
      { t: 'Controle do palácio', d: '+150s de riqueza', eff: { give: { wealth: 150 } } },
      { t: 'Livre para quem achar', d: 'Riqueza ×1,6 por 5 minutos e +5% de população', eff: { buff: { mult: { wealth: 1.6 }, dur: 300 }, pop: 0.05 } },
    ]),
    E('profeta', 2, 5, 'O Profeta', 'Um pregador descalço reúne multidões nas praças. Diz que os deuses estão descontentes com os ricos.', [
      { t: 'Ouvi-lo', d: 'Cultura +5% permanente', eff: { perm: { culture: 1.05 } } },
      { t: 'Prendê-lo', d: '+60s de força, −30s de cultura', eff: { give: { military: 60 }, cost: { culture: 30 } } },
    ]),
    E('filosofo', 3, 5, 'O Velho Filósofo', 'Um filósofo idoso pede patrocínio para escrever uma obra que, segundo ele, "explicará tudo".', [
      { t: 'Patrocinar', d: '−60s de riqueza, saber +5% permanente', eff: { cost: { wealth: 60 }, perm: { knowledge: 1.05 } } },
      { t: 'Recusar educadamente', d: 'Nada acontece', eff: {} },
    ]),
    E('fronteira', 1, 6, 'Escaramuça na Fronteira', 'Guerreiros de um povo vizinho saquearam uma aldeia na fronteira. Nossos líderes exigem resposta.', [
      { t: 'Contra-atacar', d: '−40s de força, +3 territórios', eff: { cost: { military: 40 }, tiles: 3 } },
      { t: 'Fortificar e negociar', d: '−40s de materiais, +40s de cultura', eff: { cost: { materials: 40 }, give: { culture: 40 } } },
    ]),
    E('colheita', 1, 7, 'Colheita Farta', 'O clima foi perfeito o ano inteiro. Os celeiros transbordam.', [
      { t: 'Festa para todos', d: '+8% de população e +60s de cultura', eff: { pop: 0.08, give: { culture: 60 } } },
      { t: 'Vender o excedente', d: '+120s de riqueza', eff: { give: { wealth: 120, food: 60 } } },
    ]),
    E('navegador', 4, 5, 'O Navegador Teimoso', 'Um navegador estrangeiro jura que é possível chegar ao Oriente navegando para o Ocidente. Pede três navios.', [
      { t: 'Financiar a expedição', d: '−90s de riqueza, +6 territórios além-mar', eff: { cost: { wealth: 90 }, tiles: 6, overseas: true } },
      { t: 'Ele está louco', d: '+30s de saber', eff: { give: { knowledge: 30 } } },
    ]),
    E('revolta', 4, 7, 'Revolta Camponesa', 'Os impostos subiram demais. Milhares marcham para a capital com foices e tochas.', [
      { t: 'Ceder às exigências', d: '−120s de riqueza, cultura ×1,5 por 4 min', eff: { cost: { wealth: 120 }, buff: { mult: { culture: 1.5 }, dur: 240 } } },
      { t: 'Esmagar a revolta', d: '−60s de força, −3% da população', eff: { cost: { military: 60 }, pop: -0.03 } },
    ]),
    E('genio', 5, 7, 'Um Gênio', 'Um jovem de origem humilde publicou um tratado que contradiz séculos de certezas.', [
      { t: 'Bolsa na universidade', d: 'Saber ×2 por 5 minutos', eff: { buff: { mult: { knowledge: 2 }, dur: 300 } } },
      { t: 'Censurar o livro', d: '+60s de cultura', eff: { give: { culture: 60 } } },
    ]),
    E('crise', 6, 8, 'Quebra da Bolsa', 'Numa terça-feira negra, fortunas inteiras evaporam em horas.', [
      { t: 'Resgatar os bancos', d: '−150s de riqueza', eff: { cost: { wealth: 150 } } },
      { t: 'Deixar o mercado se ajustar', d: 'Riqueza ×0,5 por 3 min, depois +5% permanente', eff: { buff: { mult: { wealth: 0.5 }, dur: 180 }, perm: { wealth: 1.05 } } },
    ]),
    E('expedicao_polar', 6, 7, 'Expedição Polar', 'Uma equipe pede financiamento para cruzar o gelo até o polo.', [
      { t: 'Financiar', d: '−60s de riqueza, +4 territórios', eff: { cost: { wealth: 60 }, tiles: 4 } },
      { t: 'Não é prioridade', d: 'Nada acontece', eff: {} },
    ]),
    E('vacina', 7, 8, 'A Vacina', 'Cientistas anunciam uma vacina contra a doença que mais mata no mundo.', [
      { t: 'Distribuir de graça', d: '−90s de riqueza, crescimento +10% permanente', eff: { cost: { wealth: 90 }, perm: { growth: 1.1 } } },
      { t: 'Vender a vacina', d: '+120s de riqueza', eff: { give: { wealth: 120 } } },
    ]),
    E('sinal_europa', 9, 9, 'Vida em Europa', 'A sonda sob o gelo de Europa transmite imagens de algo que se move. Algo vivo.', [
      { t: 'Estudar à distância', d: 'Saber +10% permanente', eff: { perm: { knowledge: 1.1 } } },
      { t: 'Coletar amostras', d: '+200s de saber', eff: { give: { knowledge: 200 } } },
    ], { need: (g) => (g.s.space.bodies.europa || 0) >= 1 }),
    E('tempestade_solar', 8, 10, 'Tempestade Solar', 'Uma ejeção de massa coronal atinge os satélites. Redes caem em meio sistema.', [
      { t: 'Blindar a rede', d: '−90s de energia', eff: { cost: { energy: 90 } } },
      { t: 'Aguentar o apagão', d: 'Saber ×0,5 por 3 minutos', eff: { buff: { mult: { knowledge: 0.5 }, dur: 180 } } },
    ]),
    E('separatistas', 8, 10, 'Os Separatistas de Marte', 'Colonos marcianos exigem independência da Terra. Dizem que já não respiram o mesmo ar.', [
      { t: 'Conceder autonomia', d: 'Cultura +8% permanente', eff: { perm: { culture: 1.08 } } },
      { t: 'Enviar a frota', d: '−120s de força, materiais ×1,5 por 4 min', eff: { cost: { military: 120 }, buff: { mult: { materials: 1.5 }, dur: 240 } } },
    ], { need: (g) => (g.s.space.bodies.marte || 0) >= 3 }),
    E('ruinas', 10, 11, 'Ruínas Precursoras', 'Num mundo morto, nossos exploradores encontram uma cidade de cristal — com bilhões de anos. Algo ainda pulsa lá dentro.', [
      { t: 'Estudar com cuidado', d: 'Saber +15% permanente', eff: { perm: { knowledge: 1.15 } } },
      { t: 'Ativar o mecanismo', d: 'Toda produção ×2 por 4 min', eff: { buff: { mult: { food: 2, materials: 2, knowledge: 2, culture: 2, military: 2, wealth: 2, energy: 2 }, dur: 240 } } },
    ]),
    E('nave_deriva', 10, 11, 'A Nave à Deriva', 'Uma nave alienígena gigantesca, silenciosa, cruza nosso espaço. Não responde a nenhum chamado.', [
      { t: 'Abordar', d: '+300s de materiais', eff: { give: { materials: 300 } } },
      { t: 'Escoltá-la para longe', d: '+5 de relação com todas as espécies', eff: { relAll: 5 } },
    ]),
    E('refugiados', 10, 11, 'Refugiados', 'Uma frota de refugiados de uma espécie extinta pede asilo. São poucos, cansados, e sabem coisas que nós não sabemos.', [
      { t: 'Conceder asilo', d: 'Saber e cultura +6% permanentes', eff: { perm: { knowledge: 1.06, culture: 1.06 } } },
      { t: 'Recusar', d: '+150s de riqueza', eff: { give: { wealth: 150 } } },
    ]),
  ];
})();
