-- LEGENDAS NO PADRÃO DO QUE FOI PUBLICADO (03/11/2026) — PARTE 1 de 2: PLAYMI e TÓPI
-- Instagram, Stories, Pinterest e Google. Reescritas no padrão do que saiu de verdade (Business Suite).
-- Peça publicada não é tocada; os Shorts não mudam. Pode rodar de novo.

update public.social_plan_items i
   set caption = v.legenda, updated_at = now()
  from public.social_topics t, (values
  ('plano-2026-10b:t019', 'pl-ig', 'matriz', null::date, $q$Já viu uma Totokinha que mostra a língua? 😛💗
Na Totokinha Bolinha, a língua e os bracinhos se mexem enquanto a criança passeia, e cada voltinha pela casa vira motivo de risada. Ela vem em azul e em rosa, para cada pequeno escolher a sua.
É um detalhe que transforma o passeio em brincadeira e a brincadeira em descoberta. ✨
Azul ou rosa: qual cor é a cara do pequeno aí da sua casa? Onde encontrar: link na bio.$q$),
  ('plano-2026-10b:t022', 'pl-ig', 'matriz', null::date, $q$Visual de piloto para os primeiros passeios! 🏁💙
A Totokinha Sport é uma das queridinhas da Playmi: a criança senta, impulsiona com os pés e descobre, toda orgulhosa, que consegue ir sozinha.
Neste Natal, ela é aquele presente que sai da caixa direto para a brincadeira e ganha a casa inteira como pista. 🎄✨
Onde encontrar: link na bio.$q$),
  ('plano-2026-10b:t024', 'pl-ig', 'matriz', null::date, $q$Primeiros passos, grandes descobertas! 💙✨
As Totokinhas da Playmi acompanham cada nova aventura dos pequenos: a criança explora, se movimenta e descobre o mundo enquanto passeia.
Porque é brincando que ela ganha confiança, liberdade e vontade de ir cada vez mais longe. Para muitas famílias, a Totokinha é o primeiro carrinho, e isso diz muito sobre o que ela representa. 🚗💗
Arraste para ver os modelos: qual seria o favorito aí? Onde encontrar: link na bio.$q$),
  ('plano-2026-10b:t032', 'pl-ig', 'matriz', null::date, $q$Piuí! O trem da imaginação vai partir! 🚂💙
O Trenzinho Didático da linha Play&Molto vem com 28 peças para montar, encaixar e inventar o caminho que quiser. Cada montagem pode virar um trem diferente, com uma viagem nova a cada brincadeira.
Montar com as próprias mãos é também descobrir formas, cores e possibilidades. ✨
Me diz aí: qual vagão vai na frente? Onde encontrar: link na bio.$q$),
  ('plano-2026-10b:t039', 'pl-ig', 'matriz', null::date, $q$Sobe, desce e sai para o resgate! 🚒🔥
O Eletronic Parking Bombeiro tem elevador eletrônico que leva os carrinhos até o topo da garagem, prontos para a próxima missão.
É o tipo de brinquedo que faz a criança comandar a cena, criar chamados e inventar histórias de bombeiro sem parar. Uma ótima ideia de presente para este Natal. 🎄❤️
Qual carrinho sobe primeiro? Onde encontrar: link na bio.$q$),
  ('plano-2026-10b:t032', 'pl-ig', 'adapta', null::date, $q$Hoje tem trem para montar! 🚂 Montar ou desmontar? [enquete: Montar / Desmontar]$q$),
  ('plano-2026-10b:t034', 'pl-ig', 'matriz', null::date, $q$Vai presentear um pequeno de 18 meses? 🦕💚
O Dino Sabidinho Plus é um dino didático feito para explorar com as mãos, bem na fase em que tudo vira descoberta.
Cada toque é uma nova curiosidade, e cada curiosidade é um pequeno aprendizado acontecendo durante a brincadeira. ✨
Arraste para ver a diversão em ação. Onde encontrar: link na bio.$q$),
  ('plano-2026-10b:t039', 'cd-pin', 'adapta', null::date, $q$Eletronic Parking Bombeiro Playmi: garagem com elevador
Garagem de bombeiro com elevador eletrônico que leva os carrinhos até o topo, para crianças a partir de 3 anos. Ideia de presente de Natal para os pequenos fãs de resgate.$q$),
  ('plano-2026-10b:t054', 'pl-ig', 'matriz', null::date, $q$Um presente certo para cada idade! 🎄💙
Para quem está dando os primeiros passos, a partir de 12 meses, a Totokross é a moto de equilíbrio que ajuda a ganhar confiança a cada volta. A partir dos 18 meses, a Totokinha Sport leva o pequeno para os primeiros passeios, e o Dino Sabidinho Plus convida a explorar com as mãos.
Aos 2 anos, a Bluey entra na aventura com o Patinete Bluey: 3 rodas, guidão regulável, rodas com luzes e estrutura dobrável. E, a partir dos 3 anos, a Doce Cozinha Gourmet abre espaço para os pequenos chefs criarem suas receitas de faz de conta. 🍳✨
Manda para quem ainda está escolhendo o presente! Onde encontrar: link na bio.$q$),
  ('plano-2026-10b:t049', 'pl-ig', 'matriz', null::date, $q$Sirene ligada, equipe pronta! 🚒❤️‍🔥
Na Estação de Bombeiro da Playmi, a criança comanda o resgate, organiza a equipe e inventa a missão do dia.
No faz de conta, cada chamado é uma nova história, e cada história mostra um pequeno herói ganhando coragem e imaginação. ✨
Qual seria o primeiro resgate aí na sua casa? Onde encontrar: link na bio.$q$),
  ('plano-2026-10b:t052', 'pl-ig', 'matriz', null::date, $q$Montar, encaixar, criar! 🧱✨
A Mesinha Criativa vem com 20 blocos e espaço para construir à vontade, em azul ou em rosa. É uma mesa só para os pequenos construtores, do tamanho da imaginação deles.
Torre, casinha, castelo ou algo que ninguém inventou ainda: tudo começa com um bloco em cima do outro. 💙💗
O que vai sair dessa construção? Onde encontrar: link na bio.$q$),
  ('plano-2026-10b:t049', 'cd-pin', 'adapta', null::date, $q$Estação de Bombeiro Playmi: faz de conta de resgate
Estação de bombeiro para a criança comandar o resgate e inventar missões, indicada a partir de 3 anos. Ideia de presente de Natal.$q$),
  ('plano-2026-10b:t052', 'pl-ig', 'adapta', null::date, $q$Mesinha Criativa com 20 blocos para construir 🧱 Azul ou rosa? [enquete: Azul / Rosa]$q$),
  ('plano-2026-10b:t064', 'pl-ig', 'matriz', null::date, $q$Fofura azul para abraçar! 💙✨
Smurf, Papai Smurf e Smurfette chegaram em versão pelúcia, macios e prontos para virar companhia de todas as horas.
Um presente de Natal que encanta quem cresceu com a turma da vila e quem está conhecendo os Smurfs agora. 🎄
Arraste e conta pra gente: qual deles vai para debaixo da árvore aí? Onde encontrar: link na bio.$q$),
  ('plano-2026-10b:t059', 'pl-ig', 'matriz', null::date, $q$Ele fala, ela responde, e a conversa não acaba mais! 🦄🐰🐱
O Fofush Falante chega em três versões, unicórnio, coelho e gato, para virar o melhor amigo de cada pequeno.
Conversar, rir e inventar histórias juntos: é assim que um bichinho fofo vira companhia para todas as brincadeiras. Neste Natal, ele está pronto para ganhar um lugar especial em casa. 🎄💗
Qual Fofush combina mais com a sua criança? Onde encontrar: link na bio.$q$),
  ('plano-2026-10b:t062', 'pl-ig', 'matriz', null::date, $q$Toda princesa merece um passeio real! 👑✨
A Totokinha Princesas leva o encanto das princesas Disney para os primeiros passeios, com aquele clima de conto de fadas a cada voltinha pela casa.
Para a pequena fã das princesas, é o presente de Natal que transforma o corredor em castelo e o passeio em história. 🎄💗
Onde encontrar: link na bio.$q$),
  ('plano-2026-10b:t059', 'cd-pin', 'adapta', null::date, $q$Fofush Falante Playmi: bichinho que fala
Unicórnio, coelho e gato que falam e viram o melhor amigo da criança. Ideia de presente de Natal para os pequenos.$q$),
  ('plano-2026-10b:t062', 'pl-ig', 'adapta', null::date, $q$Um passeio real com a Totokinha Princesas 👑 Qual princesa sua pequena ama? [caixinha de perguntas]$q$),
  ('plano-2026-10b:t074', 'pl-ig', 'matriz', null::date, $q$Tem criança de 3 anos ou mais na sua lista de presentes? 🎁💙
Para quem vive inventando receitas, a Doce Cozinha Gourmet transforma a brincadeira em restaurante. Para quem já está pensando no verão, o Acqua Bubble garante diversão com bolhas. Os fãs da Bluey vão adorar colecionar as miniaturas Little Figs Bluey, e quem ama um salão de beleza de faz de conta encontra no Studio Fashion Celebridades acessórios para criar novos looks. ✨
Um presente para cada jeito de brincar. Qual deles combina com quem você vai presentear? Onde encontrar: link na bio.$q$),
  ('plano-2026-10b:t054', 'cd-gmn', 'adapta', null::date, $q$Guia de Natal Playmi: um presente para cada idade. 🎄
Para o primeiro ano, brinquedos de descoberta; dos 18 meses em diante, as Totokinhas e os blocos para montar; e, para os maiores, veículos e faz de conta.
Os brinquedos Playmi são feitos pela Cardoso, em São Paulo, e você encontra nas lojas e e-commerces parceiros.$q$),
  ('plano-2026-10b:t069', 'pl-ig', 'matriz', null::date, $q$Eu quero saber! Eu quero muuuito saber! 🔭💜
As Bonecas Luna trazem a personagem de O Show da Luna com vestidos para cada aventura: abelha, joaninha e melancia.
Com a Luna por perto, cada brincadeira pode começar com uma pergunta e terminar em uma grande descoberta. Porque para os pequenos curiosos, imaginar também é investigar. 🐝🐞🍉
Qual delas a sua pequena escolheria? Onde encontrar: link na bio.$q$),
  ('plano-2026-10b:t072', 'pl-ig', 'matriz', null::date, $q$Velocidade de piloto, segurança de quem está aprendendo! 🏍️❤️
A Moto Speed XR é a moto de equilíbrio da Playmi, em vermelho e em rosa, para os pequenos ganharem confiança a cada volta.
Antes da bicicleta, vem o equilíbrio, e cada passeio é uma conquista que deixa a criança mais segura e mais orgulhosa de si. Um presente de Natal que acompanha o crescimento. 🎄✨
Onde encontrar: link na bio.$q$),
  ('plano-2026-10b:t069', 'cd-pin', 'adapta', null::date, $q$Bonecas Luna Playmi: O Show da Luna
Bonecas da Luna com vestidos de abelha, joaninha e melancia, para os pequenos curiosos a partir de 3 anos. Ideia de presente de Natal.$q$),
  ('plano-2026-10b:t072', 'pl-ig', 'adapta', null::date, $q$Moto Speed XR: equilíbrio com estilo 🏍️ Vermelha ou rosa? [enquete: Vermelha / Rosa]$q$),
  ('plano-2026-10b:t083', 'pl-ig', 'matriz', null::date, $q$O primeiro Natal a gente nunca esquece! 🎈💙
Para quem vai presentear um bebê no primeiro aninho, os Fofilhotes acompanham as primeiras descobertas, e o Carrinho de Puxar com 20 Blocos segue os primeiros passos pela casa, com torres para montar.
A Totokross ajuda a ganhar equilíbrio, e o Dino Ecológico Musical encanta com sons a cada apertadinha. 🦕🎶 Veja a idade de cada um nos cards.
Qual desses vai alegrar o primeiro ano aí? Onde encontrar: link na bio.$q$),
  ('plano-2026-10b:t078', 'pl-ig', 'matriz', null::date, $q$Bombeiro, construção ou reciclagem? 🚒🚧♻️
Os City Truck da Playmi colocam a cidade inteira na brincadeira: tem caminhão para apagar incêndio, para levantar obra e para cuidar da reciclagem.
Cada caminhão abre caminho para uma história diferente, e a criança decide qual missão vem primeiro. Presente certeiro para os pequenos apaixonados por veículos neste Natal. 🎄✨
Qual é o favorito aí? Onde encontrar: link na bio.$q$),
  ('plano-2026-10b:t081', 'pl-ig', 'matriz', null::date, $q$Um dinossauro, 30 blocos e muita imaginação! 🦖🧱
Com o Dino Jurássico, a criança monta, desmonta e inventa o próprio dino, do jeitinho que quiser.
Cada montagem é uma criatura nova e uma nova aventura pré-histórica para contar. Porque construir com as próprias mãos também é soltar a criatividade. 💚✨
E aí, o seu dino vai ser feroz ou fofinho? Onde encontrar: link na bio.$q$),
  ('plano-2026-10b:t078', 'cd-pin', 'adapta', null::date, $q$City Truck Playmi: caminhões da cidade
Caminhões de bombeiro, construção e reciclagem para crianças a partir de 3 anos brincarem de cidade. Ideia de presente de Natal.$q$),
  ('plano-2026-10b:t081', 'pl-ig', 'adapta', null::date, $q$Dino Jurássico: 30 blocos para montar o seu 🦖 Seu pequeno é fã de dinossauro? [enquete: Muito! / Sim]$q$),
  ('plano-2026-10b:t092', 'pl-ig', 'matriz', null::date, $q$Ainda sem o presente? Respira, a gente ajuda! 🎄💗
Os favoritos da Playmi estão nas lojas perto de você: a Totokinha Sport e a Totokross para os primeiros passeios, o Patinete Bluey para as aventuras com a personagem mais querida, a Totokinha Princesas para um passeio de conto de fadas e a Doce Cozinha Gourmet para os pequenos chefs.
É só escolher o que combina com a criança e garantir um Natal cheio de brincadeira. ✨
Onde encontrar: link na bio.$q$),
  ('plano-2026-10b:t087', 'pl-ig', 'matriz', null::date, $q$Ainda dá tempo de garantir um Natal cheio de estilo! 🎁💗
O Belinha Studio é o cantinho de faz de conta para brincar de cuidar, arrumar e criar o visual do jeitinho que a criança imaginar.
Porque quando a brincadeira ganha espaço, a criatividade também cresce. ✨
Qual seria o primeiro look criado aí? Onde encontrar: link na bio.$q$),
  ('plano-2026-10b:t090', 'pl-ig', 'matriz', null::date, $q$A girafa mais divertida da casa chegou! 🦒💛
A Girafa de Atividades, da linha Play&Molto, vem com 15 blocos para encaixar, empilhar e descobrir, um de cada vez.
É brincando assim que os pequenos exploram formas, cores e movimentos, e cada encaixe vira uma pequena conquista. Um presente cheio de descobertas para fechar o Natal. 🎄✨
Onde encontrar: link na bio.$q$),
  ('plano-2026-10b:t087', 'cd-pin', 'adapta', null::date, $q$Belinha Studio Playmi: faz de conta de beleza
Cantinho de faz de conta para brincar de cuidar, arrumar e criar o visual, para crianças a partir de 3 anos. Presente de Natal que ainda dá tempo.$q$),
  ('plano-2026-10b:t090', 'pl-ig', 'adapta', null::date, $q$Girafa de Atividades com 15 blocos 🦒 Encaixar ou empilhar? [enquete: Encaixar / Empilhar]$q$),
  ('plano-2026-10b:t096', 'pl-ig', 'matriz', null::date, $q$O presente que sai da caixa e já sai passeando! 🎄🚗
As Totokinhas da Playmi chegam para a semana do Natal em três jeitos de brincar: a Clássica, a Bolinha, com língua e bracinhos que se mexem, e a Sport, com visual de piloto.
Seja qual for a escolhida, o passeio pela casa vira aventura e o Natal ganha ainda mais movimento. 💙💗
Qual Totokinha estaria embaixo da árvore aí? Onde encontrar: link na bio.$q$),
  ('plano-2026-10b:t098', 'pl-ig', 'matriz', null::date, $q$Que o Natal de vocês seja cheio de brincadeira, abraço e descoberta. 🎄💙
A Playmi deseja um Feliz Natal a todas as famílias que crescem junto com a gente e que fazem de cada brinquedo uma nova história.
Obrigado por deixarem a gente fazer parte desses momentos. ✨ Conta pra gente nos comentários: como vai ser o Natal aí?$q$),
  ('plano-2026-10b:t098', 'pl-ig', 'adapta', null::date, $q$O Natal passou, e a brincadeira continua! 🎁 O que o Papai Noel trouxe aí? [caixinha de perguntas]$q$),
  ('plano-2026-10b:t100', 'pl-ig', 'matriz', null::date, $q$O presente chegou. E agora? 🎁✨
Nos primeiros dias, brincar junto faz toda a diferença: a criança descobre o brinquedo com você e cria intimidade com ele. Deixar o brinquedo ao alcance também ajuda, porque é na hora que ela quiser que a imaginação aparece.
Outra ideia é alternar, guardando alguns por uma semana e trazendo de volta depois, com cara de novidade. E o mesmo brinquedo pode render uma história nova a cada dia. 💙
Como está sendo a estreia do brinquedo novo aí na sua casa?$q$),
  ('plano-2026-10b:t104', 'pl-ig', 'matriz', null::date, $q$Férias, calor e bolhas pra todo lado! 🫧☀️
Com o Acqua Bubble, o quintal e a varanda viram o cenário perfeito para a diversão do verão.
Correr atrás das bolhas, rir junto e aproveitar o dia ao ar livre: é assim que as férias ficam ainda mais gostosas. 💙✨
Onde encontrar: link na bio.$q$),
  ('plano-2026-10b:t106', 'pl-ig', 'matriz', null::date, $q$Que 2027 venha com muitas descobertas para crescer juntos! ✨💙
A Playmi deseja um Feliz Ano Novo a todas as famílias que brincaram com a gente neste ano.
Que o próximo ano traga mais imaginação, mais abraços e muitas histórias novas para inventar. 🎉 Qual brincadeira não pode faltar no seu 2027?$q$),
  ('plano-2026-10b:t104', 'cd-pin', 'adapta', null::date, $q$Acqua Bubble Playmi: diversão de verão
Brincadeira com bolhas para o quintal e a varanda nas férias de verão, para crianças a partir de 3 anos.$q$),
  ('plano-2026-10b:t108', 'pl-ig', 'matriz', null::date, $q$Férias chegaram e a imaginação já está de malas prontas! ☀️💗
Que tal transformar a cozinha em restaurante de faz de conta com a Doce Cozinha? Ou montar um circuito de equilíbrio pela casa com a Totokross? No quintal, o Acqua Bubble enche o dia de bolhas.
Com a Estação de Resgate, os blocos viram uma cidade inteira para salvar, e as Totokinhas podem fazer um desfile pelo corredor. ✨
Qual dessas brincadeiras vai começar primeiro aí?$q$),
  ('plano-2026-10b:t112', 'pl-ig', 'matriz', null::date, $q$Aprender também é brincadeira! 📚🦕
Antes da escola, a linha Play&Learn da Playmi convida os pequenos a explorar formas, sons e cores com o Dino Sabidinho Plus e a Mesinha de Atividades Musical.
Cada descoberta feita brincando vira curiosidade para a próxima. Na Playmi, brincar também é descobrir. 💜
Onde encontrar: link na bio.$q$),
  ('plano-2026-10d:t04', 'tp-ig', 'matriz', null::date, $q$Carrega, transporta e descarrega! 🚛💛
O Tópi Invictus Graneleiro leva a carga completa de um canto ao outro da casa, e quem decide o caminho é a imaginação. Do quarto até a sala, cada viagem vira uma nova entrega para o pequeno motorista.
E aí, o que vai na caçamba hoje? Conta pra gente nos comentários! 👀
Brincar é Tópi! 🧡$q$),
  ('plano-2026-10d:t05', 'tp-ig', 'matriz', null::date, $q$Já é hora do chá? ☕🧁
Com o Tópi Chef Chá da Tarde, a mesa fica pronta para receber as bonecas, os bichinhos e até a vovó. É servir, conversar e inventar mil historinhas no faz de conta mais gostoso da tarde. 💛
Quem vem para o chá aí na sua casa?
Brincar é Tópi! 🧡$q$),
  ('plano-2026-10b:t025', 'tp-ig', 'matriz', null::date, $q$Avental, panelinha e muita imaginação: a cozinha de faz de conta está pronta! 🍳💛
Juntos, o Tópi Fogãozinho, a Tópi Chef Cozinha Preparar e Cozinhar e a Tópi Cestinha Didática viram restaurante, piquenique e até feirinha, tudo no mesmo dia. A criançada escolhe o cardápio, prepara e serve quem estiver por perto.
Arrasta para o lado e conta pra gente: qual seria o primeiro prato do seu chef? 👩‍🍳$q$),
  ('plano-2026-10d:t05', 'tp-ig', 'adapta', null::date, $q$Hora do chá na Tópi! Quem é o convidado especial? ☕ [enquete: Bonecas / Vovó]$q$),
  ('plano-2026-10d:t02', 'tp-ig', 'matriz', null::date, $q$Chegou o operador da obra! 🚜👷
O Open Tracks Trator Retroescavadeira vem com o bonequinho operador para comandar a escavação de faz de conta. Cavar, carregar e abrir caminho: cada brincadeira pode virar uma nova missão no canteiro de obras da sala. 🚧
E aí, o que essa obra vai construir hoje?
Brincar é Tópi! 🧡$q$),
  ('plano-2026-10d:t07', 'tp-ig', 'matriz', null::date, $q$Bom dia, chef! O café da manhã está servido. 🥞☕
Com o Tópi Chef Brunch, a criança arruma a mesa, prepara o cardápio e serve quem acabou de acordar. É o faz de conta deixando a manhã mais divertida para toda a família. 💛
Aqui vai a dúvida do dia: panqueca ou pão de queijo? Responde nos comentários! 👇$q$),
  ('plano-2026-10b:t045', 'tp-ig', 'matriz', null::date, $q$Amigo secreto da escola chegando e a dúvida de sempre: o que dar? 🎁
A Tópi tem uma ideia para cada perfil da turma. Para quem adora construir, os Tópi Blocos de Montar. Para os pequenos, a Tópi Tortuga. E para quem ama descobrir coisas novas, a Tópi Cestinha Didática. É só escolher e deixar a brincadeira fazer o resto. 💛
Qual desses combina com o amigo secreto daí?
Brincar é Tópi! 🧡$q$),
  ('plano-2026-10d:t07', 'tp-ig', 'adapta', null::date, $q$O café da manhã do chef está na mesa! O que vai primeiro? 🥞 [enquete: Panqueca / Pão de queijo]$q$),
  ('plano-2026-10d:t08', 'tp-ig', 'matriz', null::date, $q$Prepara que a trilha começa agora! 🚙💨
O Jeep Rally Tópi encara tapete, quintal e qualquer trilha que a criançada inventar. Sem estrada, sem mapa: só a imaginação dizendo para onde ir e uma nova aventura a cada curva. 💛
Para onde vai a próxima expedição do seu piloto?$q$),
  ('plano-2026-10d:t09', 'tp-ig', 'matriz', null::date, $q$Levanta, inclina e despeja! 🚚💛
O Invictus Basculante leva a carga e despeja exatamente onde a brincadeira mandar. É encher, transportar e começar tudo de novo, quantas vezes o pequeno motorista quiser. 🚧
E na carga de hoje, vai areia ou pedrinha? Me diz nos comentários!
Brincar é Tópi! 🧡$q$),
  ('plano-2026-10b:t055', 'tp-ig', 'matriz', null::date, $q$Natal chegando e a lista de presentes ainda em aberto? 🎄🎁
O guia da Tópi ajuda a escolher pela idade. A partir de 18 meses, o Tópi Sabidinho Plus e o Tópi Escolar são diversão que também ensina. A partir de 3 anos, o Carrinho de Boneca Passeio do Bebê leva a bonequinha para passear. E para os pequenos construtores, o Robô-Blocks garante horas de montagem. 💛
Mostra este post para quem vai presentear e conta: qual deles vai para a sua lista?
Brincar é Tópi! 🧡$q$),
  ('plano-2026-10d:t09', 'tp-ig', 'adapta', null::date, $q$Caçamba cheia, hora de despejar! O que vai na carga? 🚚 [enquete: Areia / Pedrinha]$q$),
  ('plano-2026-10d:t10', 'tp-ig', 'matriz', null::date, $q$Abre a caçamba que a obra começou! 🚧🚚
O Tópi Invictus Caçamba carrega, levanta e despeja tudo na obra de faz de conta, bem no meio da sala. Cada viagem vira uma etapa da construção, e o pequeno engenheiro decide o que vem depois. 💛
E aí, o que essa obra vai construir primeiro? 👀
Brincar é Tópi! 🧡$q$),
  ('plano-2026-10d:t11', 'tp-ig', 'matriz', null::date, $q$Avental pronto? A cozinha é toda sua! 👩‍🍳✨
Com as cozinhas Tópi Chef, a criança prepara, cozinha e serve a família inteira. Do primeiro ingrediente ao prato na mesa, cada receita inventada vira uma nova história de faz de conta. 💛
Conta pra gente: qual é a especialidade do chef aí da sua casa?
Brincar é Tópi! 🧡$q$),
  ('plano-2026-10b:t065', 'tp-ig', 'matriz', null::date, $q$Procurando presente para quem ainda não fez 3 anos? 🎁💛
A Tópi separou quatro escolhas para os pequenos: a Teltaluga, a Mesinha de Atividades, o Dino Sabidinho e o Tópi Bombeirinho. Cada um traz um jeito diferente de explorar, descobrir e se divertir nos primeiros anos.
Arrasta para conhecer e diz aqui: qual deles seria o presente perfeito? 👇$q$),
  ('plano-2026-10d:t11', 'tp-ig', 'adapta', null::date, $q$Todo chef tem um prato preferido! Qual é o da sua casa? 👩‍🍳 [caixinha]$q$),
  ('plano-2026-10d:t12', 'tp-ig', 'matriz', null::date, $q$O verão chegou na brincadeira! ☀️🏖️
O Baldico de Praia e o Dino Praia são a dupla certa para a temporada: balde, pá e muita areia para os pequenos encherem, moldarem e construírem do seu jeito. Castelo, montanha ou um bolo de areia, a imaginação decide. 💛
E aí, a diversão aí é na praia ou na piscina?
Brincar é Tópi! 🧡$q$),
  ('plano-2026-10d:t13', 'tp-ig', 'matriz', null::date, $q$Saindo quentinho do forno! 🍕🔥
Com a Tópi Chef Cozinha Forno, a criança assa a pizza, o bolo e tudo mais que inventar. É escolher a receita, colocar no forno de faz de conta e servir a família com aquele orgulho de chef. 💛
No cardápio de hoje: pizza ou bolo? Responde aqui embaixo! 👇$q$),
  ('plano-2026-10b:t075', 'tp-ig', 'matriz', null::date, $q$Noite de Natal com a família toda reunida pede brincadeira! 🎄💛
Que tal um campeonato de boliche entre os primos? Depois, todo mundo junto para ver quem monta a torre de blocos mais alta da casa. Dá para formar uma banda da família com a criançada no comando e, para fechar, uma caça ao presente com pistas espalhadas pela casa. Diversão garantida para pequenos e grandes!
Qual dessas vai acontecer aí na sua ceia?
Brincar é Tópi! 🧡$q$),
  ('plano-2026-10d:t13', 'tp-ig', 'adapta', null::date, $q$O forno do chef está quentinho! O que sai primeiro? 🍕 [enquete: Pizza / Bolo]$q$),
  ('plano-2026-10b:t055', 'cd-gmn', 'adapta', null::date, $q$Na hora de escolher o presente de Natal, a Tópi tem opção para cada fase da criança: cozinhas Tópi Chef, caminhões Invictus e jogos como Boliche e Alvo Certo. Os brinquedos Tópi são feitos pela Cardoso, em São Paulo, e você encontra nas lojas e e-commerces parceiros. Um Natal com muita brincadeira para toda a família!$q$),
  ('plano-2026-10d:t14', 'tp-ig', 'matriz', null::date, $q$Formas, letras e números: tudo vira brincadeira! 🐘🦁🦛
O Bolofante ensina as formas, o Bololéo apresenta as letras e o Bolopótamo brinca com os números. Três amigos para os pequenos explorarem, descobrirem e aprenderem brincando, um de cada vez ou todos juntos. 💛
Qual desses é a cara do seu pequeno?
Brincar é Tópi! 🧡$q$),
  ('plano-2026-10d:t15', 'tp-ig', 'matriz', null::date, $q$Hoje o cardápio vem da feira e do mar! 🥕🐟
As cozinhas Tópi Chef Legumes, Legumes e Mar e Terra e Mar deixam o faz de conta bem variado: tem prato com verdura, receita com peixinho e muita criatividade na hora de montar a mesa. 💛
E aí, qual prato a criançada inventaria primeiro? 👩‍🍳$q$),
  ('plano-2026-10b:t084', 'tp-ig', 'matriz', null::date, $q$Ainda sem presente? Calma, a Tópi resolve! 🎁🎄
Faltando poucos dias para o Natal, separamos achadinhos para cada estilo: o Carrinho de Boneca Passeio do Bebê para os passeios de faz de conta, o Tópi Sabidinho Plus para aprender brincando, o Robô-Blocks para os construtores e o Leva Papinha para cuidar da bonequinha. 💛
Qual deles vai para debaixo da árvore aí?
Brincar é Tópi! 🧡$q$),
  ('plano-2026-10d:t15', 'tp-ig', 'adapta', null::date, $q$Hoje o chef cozinha o quê? 🥕🐟 [enquete: Legumes / Peixe]$q$),
  ('plano-2026-10d:t16', 'tp-ig', 'matriz', null::date, $q$Tem fã de caminhão aí? O presente está aqui! 🚛🎁
Graneleiro, Super Cegonheiro, Caçamba e Jeep Rally: a frota da Tópi está pronta para o Natal. Carregar, transportar, despejar e cair na trilha, cada veículo abre uma nova aventura para o pequeno motorista. 💛
Qual deles vai estacionar debaixo da árvore? Me diz nos comentários!
Brincar é Tópi! 🧡$q$),
  ('plano-2026-10b:t015', 'tp-ig', 'matriz', null::date, $q$Tudo num lugar só! 🧩💛
A Mesinha de Atividades da Tópi reúne várias brincadeiras em uma única mesinha para os pequenos explorarem cada lado, descobrirem novidades e se divertirem do seu jeito. Arrasta para o lado e conhece cada cantinho dessa brincadeira.
Qual lado você acha que vai ser o favorito aí?
Brincar é Tópi! 🧡$q$),
  ('plano-2026-10b:t093', 'tp-ig', 'matriz', null::date, $q$Férias começando e a criançada cheia de energia? ☀️💛
Dá para transformar a casa em um parque de diversão. Uma fita no chão já vira pista para os carrinhos. A cozinha de faz de conta abre um restaurante cheio de pedidos. Os blocos viram prédios, pontes e cidades inteiras. E, no fim do dia, a família toda forma uma banda.
Qual dessas brincadeiras vai começar primeiro aí?
Brincar é Tópi! 🧡$q$),
  ('plano-2026-10d:t17', 'tp-ig', 'matriz', null::date, $q$A ceia de Natal da criançada está servida! 🎄🍽️
Com a linha Tópi Chef, os pequenos preparam a própria ceia de faz de conta e servem a família inteira, do prato principal à sobremesa. Uma brincadeira que deixa a noite ainda mais especial. 💛
Conta pra gente: o que não pode faltar na ceia aí da sua casa?$q$),
  ('plano-2026-10b:t099', 'tp-ig', 'matriz', null::date, $q$Feliz Natal! 🎄🧡
Que a sua casa esteja cheia de abraços, risadas e muita brincadeira hoje e sempre. Obrigado por fazer parte da nossa história e por deixar a Tópi brincar junto com a sua família este ano. ✨
E aí, qual foi o momento mais gostoso do Natal por aí? Conta pra gente!
Brincar é Tópi! 🧡$q$),
  ('plano-2026-10b:t099', 'tp-ig', 'adapta', null::date, $q$O Natal passou, e a brincadeira continua! O que o Papai Noel trouxe aí? 🎁 [caixinha]$q$),
  ('plano-2026-10b:t101', 'tp-ig', 'matriz', null::date, $q$Ganhou brinquedo novo? A diversão está só começando! 🎁💛
No primeiro dia, vale sentar no chão e brincar junto: é aí que nascem as melhores histórias. Depois, um cantinho de brincar ajuda a criança a encontrar tudo e voltar sempre. E revezar os brinquedos durante a semana faz cada um parecer novidade de novo.
Qual foi o brinquedo que mais fez sucesso aí?
Brincar é Tópi! 🧡$q$),
  ('plano-2026-10d:t18', 'tp-ig', 'matriz', null::date, $q$Férias começaram: bora pro quintal! ☀️🚜
O Trator Agro cuida da colheita e o Jeep Rally Tópi encara a trilha. Com a dupla, a brincadeira das férias ganha espaço lá fora, com terra, grama e muita imaginação para criar aventuras novas todos os dias. 💛
Qual vai ser a brincadeira favorita dessas férias?
Brincar é Tópi! 🧡$q$),
  ('plano-2026-10b:t107', 'tp-ig', 'matriz', null::date, $q$Ano novo, brincadeira nova! ✨🧡
Feliz 2027, de toda a Tópi para a sua família. Que este ano venha cheio de imaginação, descobertas e momentos gostosos de brincar juntos, do primeiro ao último dia.
Qual é o seu desejo de brincadeira para 2027? Deixa aqui nos comentários!$q$),
  ('plano-2026-10b:t107', 'tp-ig', 'adapta', null::date, $q$2027 chegou com cara de diversão! Qual vai ser a primeira brincadeira do ano? ✨ [caixinha]$q$),
  ('plano-2026-10b:t109', 'tp-ig', 'matriz', null::date, $q$Férias com menos tela e mais brincadeira? Bora! ☀️💛
Os blocos viram uma cidade inteira no tapete da sala. Na cozinha de faz de conta, abre uma feirinha cheia de fregueses. O corredor vira pista para a corrida de carrinhos e, depois, quadra de boliche. Para fechar, um piquenique com a boneca, que também merece aproveitar as férias.
Qual dessas vai entrar na rotina aí?
Brincar é Tópi! 🧡$q$)
  ) as v (k, canal, tipo, data, legenda)
 where t.id = i.topic_id and t.ext_key = v.k and i.channel_id = v.canal and i.link_kind = v.tipo
   and (v.data is null or i.pub_date = v.data)
   and not i.archived and i.stage <> 'publicado' and i.caption is distinct from v.legenda;

-- CONFERÊNCIA — com_hashtag e assinatura_antiga têm que vir 0
select i.brand, i.channel_id, count(*) as pecas,
       count(*) filter (where i.caption ~ '#\w' and i.channel_id <> 'cd-li') as com_hashtag,
       count(*) filter (where i.caption ilike '%Brincar é crescer%') as assinatura_antiga
  from public.social_plan_items i
 where not i.archived and i.stage <> 'publicado' and i.pub_date >= '2026-11-03' and i.link_kind in ('matriz', 'adapta')
   and i.brand in ('Playmi', 'Tópi') and coalesce(i.ext_id, '') not like 'shorts-2026:%'
 group by 1, 2
 order by 1, 2;
