/* FORTIS PWA — dados base (espelham a planilha). Valores por 100 g. */
window.FORTIS = window.FORTIS || {};
FORTIS.MEALS8 = ["Café da manhã","Lanche da manhã","Almoço","Lanche","Pré-treino","Pós-treino","Jantar","Ceia"];
FORTIS.ACTS = [
  ["Sedentário",1.20],["Levemente ativo",1.35],["Moderadamente ativo",1.55],
  ["Muito ativo",1.725],["Extremamente ativo",1.90]
];
FORTIS.GOALS = [
  ["Manutenção ou recomposição",0],["Superávit leve",0.075],
  ["Superávit moderado",0.125],["Superávit elevado (monitorado)",0.175]
];
FORTIS.GROUPS = ["Peito","Costas","Ombros","Bíceps","Tríceps","Pernas","Panturrilha","Abdômen","Glúteos"];
FORTIS.SHOP_CATS = ["Proteínas","Carboidratos","Vegetais e frutas","Gorduras","Organização"];
/* nome, kcal, prot, carb, gord, fibra, estado, fonte, verif(OK|WARN) */
FORTIS.FOODS = [
["Arroz branco cozido",128,2.5,28.1,0.2,1.6,"cozido","TACO/UNICAMP","OK"],
["Feijão carioca cozido",76,4.8,13.6,0.5,8.5,"cozido","TACO/UNICAMP","OK"],
["Lentilha cozida",116,9.0,20.1,0.4,7.9,"cozido","TACO/UNICAMP","OK"],
["Grão-de-bico cozido",164,9.0,27.4,2.6,7.6,"cozido","USDA","OK"],
["Peito de frango grelhado",159,32.0,0.0,3.6,0.0,"pronto","TACO/UNICAMP","OK"],
["Carne bovina magra (patinho) grelhada",219,32.0,0.0,9.5,0.0,"pronto","TACO/UNICAMP","OK"],
["Tilápia grelhada",128,26.0,0.0,2.7,0.0,"pronto","USDA","OK"],
["Atum em conserva escorrido",128,23.0,0.0,3.0,0.0,"pronto","Rótulo/USDA","WARN"],
["Ovo cozido",155,13.0,1.1,11.0,0.0,"cozido","TACO/UNICAMP","OK"],
["Leite integral",61,3.2,4.8,3.2,0.0,"pronto","TACO/UNICAMP","OK"],
["Leite desnatado",35,3.4,5.0,0.1,0.0,"pronto","TACO/UNICAMP","OK"],
["Iogurte natural",61,3.5,4.7,3.3,0.0,"pronto","TACO/Rótulo","WARN"],
["Queijo minas frescal",264,17.0,3.2,20.0,0.0,"pronto","TACO/Rótulo","WARN"],
["Whey protein (valores de exemplo — editável)",400,80.0,8.0,6.0,0.0,"pronto","Rótulo do produto","WARN"],
["Tofu",76,8.0,1.9,4.8,0.3,"pronto","USDA","OK"],
["Aveia em flocos",389,16.9,66.3,6.9,10.6,"cru","TACO/UNICAMP","OK"],
["Pão francês",300,8.0,58.0,3.1,2.3,"pronto","TACO/UNICAMP","WARN"],
["Pão integral",253,9.0,48.0,3.5,6.5,"pronto","Rótulo/TACO","WARN"],
["Macarrão cozido",131,5.0,25.0,1.1,1.8,"cozido","TACO/UNICAMP","OK"],
["Batata inglesa cozida",86,1.7,20.0,0.1,1.8,"cozido","TACO/UNICAMP","OK"],
["Batata-doce cozida",86,1.3,20.1,0.1,3.0,"cozido","TACO/USDA","OK"],
["Mandioca cozida",125,1.0,30.0,0.3,1.6,"cozido","TACO/UNICAMP","OK"],
["Tapioca pronta (sem recheio)",130,0.5,32.0,0.1,0.0,"pronto","TACO/UNICAMP","WARN"],
["Cuscuz de milho cozido",112,2.5,24.0,0.5,1.5,"cozido","TACO/UNICAMP","OK"],
["Milho verde cozido",96,3.4,21.0,1.5,2.4,"cozido","TACO/UNICAMP","OK"],
["Banana prata",98,1.3,26.0,0.1,2.0,"cru","TACO/UNICAMP","OK"],
["Maçã com casca",52,0.3,13.8,0.2,2.4,"cru","TACO/USDA","OK"],
["Mamão papaia",43,0.5,11.0,0.1,1.7,"cru","TACO/UNICAMP","OK"],
["Manga",60,0.8,15.0,0.4,1.6,"cru","TACO/UNICAMP","OK"],
["Uva",69,0.7,18.1,0.2,0.9,"cru","USDA","OK"],
["Abacate",160,2.0,8.5,14.7,6.7,"cru","TACO/USDA","OK"],
["Brócolis cozido",35,2.4,7.2,0.4,3.3,"cozido","TACO/UNICAMP","OK"],
["Cenoura crua",41,0.9,9.6,0.2,2.8,"cru","TACO/UNICAMP","OK"],
["Tomate",18,0.9,3.9,0.2,1.2,"cru","TACO/UNICAMP","OK"],
["Alface",15,1.4,2.9,0.2,1.3,"cru","TACO/UNICAMP","OK"],
["Azeite de oliva",884,0.0,0.0,100.0,0.0,"pronto","TACO/USDA","OK"],
["Pasta de amendoim",588,25.0,20.0,50.0,6.0,"pronto","Rótulo/USDA","WARN"],
["Castanha-do-pará",656,14.0,12.0,66.0,7.5,"cru","TACO/UNICAMP","OK"],
["Amendoim torrado",567,26.0,16.0,49.0,8.5,"pronto","TACO/UNICAMP","OK"],
["Nozes",654,15.0,14.0,65.0,6.7,"cru","USDA","OK"],
["Sementes de chia",486,17.0,42.0,31.0,34.4,"cru","USDA/Rótulo","OK"],
["Linhaça (semente)",534,18.0,29.0,42.0,27.3,"cru","USDA","OK"],
["Arroz integral cozido",111,2.6,23.0,0.9,1.8,"cozido","TACO/UNICAMP","OK"],
["Feijão preto cozido",77,4.9,14.0,0.5,8.4,"cozido","TACO/UNICAMP","OK"],
["Soja em grão cozida",172,18.2,8.4,9.0,6.0,"cozido","USDA","OK"],
["Sobrecoxa de frango sem pele grelhada",209,26.0,0.0,11.0,0.0,"pronto","TACO/USDA","OK"],
["Salmão grelhado",206,22.0,0.0,12.0,0.0,"pronto","USDA","OK"],
["Sardinha em conserva escorrida",208,25.0,0.0,11.5,0.0,"pronto","USDA/Rótulo","WARN"],
["Clara de ovo cozida",52,11.0,0.7,0.2,0.0,"cozido","USDA","OK"],
["Iogurte grego natural",97,9.0,3.9,5.0,0.0,"pronto","Rótulo/USDA","WARN"],
["Queijo mussarela",280,22.0,2.8,20.0,0.0,"pronto","TACO/Rótulo","WARN"],
["Queijo cottage",98,11.0,3.4,4.3,0.0,"pronto","USDA/Rótulo","WARN"],
["Granola tradicional",471,10.0,64.0,20.0,6.0,"pronto","Rótulo","WARN"],
["Inhame cozido",118,1.5,27.9,0.2,4.1,"cozido","TACO/UNICAMP","OK"],
["Abóbora cozida",26,1.0,6.5,0.1,1.5,"cozido","USDA","OK"],
["Espinafre cozido",23,3.0,3.8,0.3,2.4,"cozido","USDA","OK"],
["Laranja pera",47,0.9,11.7,0.1,2.2,"cru","TACO/UNICAMP","OK"],
["Morango",32,0.7,7.7,0.3,2.0,"cru","USDA","OK"],
["Abacaxi",50,0.5,13.1,0.1,1.4,"cru","TACO/UNICAMP","OK"],
["Melancia",30,0.6,7.6,0.2,0.4,"cru","USDA","OK"],
["Mel",304,0.3,82.0,0.0,0.2,"pronto","TACO/UNICAMP","OK"],
["Manteiga",717,0.9,0.1,81.0,0.0,"pronto","TACO/UNICAMP","OK"],
["Chocolate meio amargo 70%",598,7.8,46.0,42.6,11.0,"pronto","Rótulo/USDA","WARN"],
["Castanha de caju torrada",553,18.0,30.0,44.0,3.3,"pronto","TACO/UNICAMP","OK"],
["Semente de abóbora",559,30.0,11.0,49.0,6.0,"cru","USDA","OK"]
];
FORTIS.STRUCTS = [
 {kcal:2200, titulo:"Estrutura 1 — aprox. 2.200 kcal", rows:[
  ["Café da manhã","Aveia"],["Café da manhã","Leite ou iogurte"],["Café da manhã","Banana"],["Café da manhã","Ovos"],
  ["Almoço","Arroz"],["Almoço","Feijão"],["Almoço","Frango"],["Almoço","Vegetais"],["Almoço","Azeite"],
  ["Lanche","Pão"],["Lanche","Queijo ou iogurte"],["Lanche","Fruta"],
  ["Jantar","Batata ou arroz"],["Jantar","Carne magra"],["Jantar","Vegetais"],
  ["Ceia opcional","Iogurte, leite ou fruta"]]},
 {kcal:2800, titulo:"Estrutura 2 — aprox. 2.800 kcal", rows:[
  ["Café da manhã","Aveia"],["Café da manhã","Leite"],["Café da manhã","Banana"],["Café da manhã","Ovos"],["Café da manhã","Pasta de amendoim"],
  ["Almoço","Arroz"],["Almoço","Feijão"],["Almoço","Carne"],["Almoço","Vegetais"],["Almoço","Azeite"],
  ["Lanche pré-treino","Pão"],["Lanche pré-treino","Frango desfiado"],["Lanche pré-treino","Fruta"],
  ["Pós-treino","Leite (vitamina)"],["Pós-treino","Banana (vitamina)"],["Pós-treino","Aveia (vitamina)"],["Pós-treino","Proteína (whey/ovos)"],
  ["Jantar","Massa ou arroz"],["Jantar","Frango ou peixe"],["Jantar","Vegetais"],
  ["Ceia opcional","Iogurte"],["Ceia opcional","Castanhas"]]},
 {kcal:3400, titulo:"Estrutura 3 — aprox. 3.400 kcal", rows:[
  ["Café da manhã","Aveia"],["Café da manhã","Leite"],["Café da manhã","Ovos"],["Café da manhã","Banana"],["Café da manhã","Pasta de amendoim"],
  ["Lanche da manhã","Sanduíche (pão)"],["Lanche da manhã","Iogurte"],["Lanche da manhã","Fruta"],
  ["Almoço","Arroz"],["Almoço","Feijão"],["Almoço","Carne"],["Almoço","Legumes"],["Almoço","Azeite"],
  ["Pré-treino","Massa ou pão"],["Pré-treino","Frango"],["Pré-treino","Fruta"],
  ["Pós-treino","Leite"],["Pós-treino","Aveia"],["Pós-treino","Banana"],["Pós-treino","Proteína"],
  ["Jantar","Arroz ou batata"],["Jantar","Peixe ou carne"],["Jantar","Vegetais"],
  ["Ceia","Iogurte"],["Ceia","Cereal (aveia/granola)"],["Ceia","Castanhas"]]}
];
FORTIS.SHOPPING = [
["Proteínas","Frango (peito)"],["Proteínas","Carne magra (patinho)"],["Proteínas","Peixes (tilápia/salmão/sardinha)"],["Proteínas","Ovos"],
["Proteínas","Leite"],["Proteínas","Iogurte natural"],["Proteínas","Queijos (minas/mussarela)"],["Proteínas","Tofu"],
["Carboidratos","Feijão carioca/preto"],["Carboidratos","Lentilha"],["Carboidratos","Grão-de-bico"],["Carboidratos","Arroz branco/integral"],
["Carboidratos","Aveia em flocos"],["Carboidratos","Batata inglesa"],["Carboidratos","Batata-doce"],["Carboidratos","Mandioca"],
["Carboidratos","Macarrão"],["Carboidratos","Pães (francês/integral)"],["Carboidratos","Tapioca"],["Carboidratos","Cuscuz"],
["Vegetais e frutas","Frutas da estação"],["Vegetais e frutas","Folhas (alface/couve)"],["Vegetais e frutas","Brócolis"],["Vegetais e frutas","Cenoura"],
["Vegetais e frutas","Abobrinha"],["Vegetais e frutas","Tomate"],
["Gorduras","Azeite de oliva"],["Gorduras","Abacate"],["Gorduras","Pasta de amendoim"],["Gorduras","Castanhas e nozes"],["Gorduras","Sementes (chia/linhaça)"],
["Organização","Recipientes com tampa"],["Organização","Sacos para congelar"],["Organização","Etiquetas"],["Organização","Balança de cozinha"],["Organização","Garrafa de água"]
];
FORTIS.SUPLE = [
 {n:"Creatina monoidratada",f:"Desempenho e força",d:"3 a 5 g/dia",h:"Qualquer horário",o:"A regularidade importa mais que o horário. Pode aumentar 1 a 2 kg de peso por retenção de água no músculo (normal). Quem tem doença renal deve consultar um médico antes."},
 {n:"Whey protein",f:"Conveniência proteica",d:"Conforme o rótulo",h:"Conforme a rotina",o:"Não é obrigatório; priorize a proteína da comida. Intolerantes à lactose: prefira whey isolado."},
 {n:"Proteína vegetal em pó",f:"Atingir a meta proteica",d:"Conforme o rótulo",h:"Conforme a rotina",o:"Útil em dietas vegetarianas e veganas"},
 {n:"Cafeína",f:"Atenção e desempenho",d:"3 a 6 mg por kg de peso, cerca de 60 min antes do treino; não passar de 400 mg/dia somando café, chás, refrigerantes e pré-treinos",h:"Evitar nas 6 horas antes de dormir",o:"A resposta varia entre pessoas. Gestantes: no máximo 200 mg/dia. Evite se tiver hipertensão, arritmia, ansiedade ou insônia, ou se for menor de 18 anos, salvo orientação profissional. Cafeína pura em pó é perigosa (risco de overdose)."},
 {n:"Vitamina B12",f:"Prevenir deficiência em dietas veganas e vegetarianas (também relevante acima dos 50 anos e para quem usa metformina ou omeprazol)",d:"Referência comum para veganos: 50 a 100 µg/dia ou 2.000 µg 1 vez por semana. Confirme com um profissional",h:"Qualquer horário",o:"Fontes vegetais não fornecem B12 confiável. Faça exame de B12 periodicamente."}
];
FORTIS.BADGES5 = ["Mais massa muscular","Mais energia","Melhor recuperação","Mais disposição","Mais confiança"];
/* Textos em linguagem simples para as opções (as chaves são os valores salvos — não alterar) */
FORTIS.ACT_INFO = {
  "Sedentário":           {label:"Pouco ativo",          desc:"Trabalho sentado e quase nenhum exercício."},
  "Levemente ativo":      {label:"Levemente ativo",      desc:"Treina 1 a 2 vezes por semana ou anda bastante no dia a dia."},
  "Moderadamente ativo":  {label:"Ativo",                desc:"Treina 3 a 5 vezes por semana."},
  "Muito ativo":          {label:"Muito ativo",          desc:"Treina 6 a 7 vezes por semana ou tem trabalho físico."},
  "Extremamente ativo":   {label:"Atleta / trabalho pesado", desc:"Treina pesado 2 vezes por dia ou faz trabalho braçal intenso."}
};
FORTIS.GOAL_INFO = {
  "Manutenção ou recomposição":     {label:"Manter o peso",          desc:"Come o mesmo que gasta. Para quem quer trocar gordura por músculo sem mudar o peso.", tag:""},
  "Superávit leve":                 {label:"Ganhar massa devagar",    desc:"Come um pouco a mais (+7,5%). Ganho mais limpo, com pouca gordura.", tag:"Bom para começar"},
  "Superávit moderado":             {label:"Ganhar massa no ritmo médio", desc:"Come moderadamente a mais (+12,5%). Para quem é muito magro ou tem dificuldade de engordar.", tag:""},
  "Superávit elevado (monitorado)": {label:"Ganhar massa rápido",     desc:"Come bem mais (+17,5%). Ganho mais rápido, porém com mais gordura. Ideal com acompanhamento.", tag:""}
};
/* Medidas caseiras: [nome da medida, gramas por 1 medida]. Valores aproximados
   (tabelas de medidas caseiras usuais no Brasil). A primeira é a sugerida ao escolher o alimento.
   Líquidos usam "ml" (gramas por ml). O usuário sempre pode trocar para gramas. */
FORTIS.UNITS = {
  "Arroz branco cozido":[["colher de sopa cheia",25],["escumadeira",90]],
  "Arroz integral cozido":[["colher de sopa cheia",25],["escumadeira",90]],
  "Feijão carioca cozido":[["concha média",140],["colher de sopa",20]],
  "Feijão preto cozido":[["concha média",140],["colher de sopa",20]],
  "Lentilha cozida":[["concha média",140],["colher de sopa",22]],
  "Grão-de-bico cozido":[["colher de sopa",22],["concha média",140]],
  "Soja em grão cozida":[["colher de sopa",20]],
  "Peito de frango grelhado":[["filé médio",100]],
  "Sobrecoxa de frango sem pele grelhada":[["unidade",80]],
  "Carne bovina magra (patinho) grelhada":[["bife médio",100]],
  "Tilápia grelhada":[["filé médio",120]],
  "Salmão grelhado":[["posta média",120]],
  "Atum em conserva escorrido":[["lata (escorrido)",120],["colher de sopa",20]],
  "Sardinha em conserva escorrida":[["lata (escorrida)",84],["unidade",30]],
  "Ovo cozido":[["unidade",50]],
  "Clara de ovo cozida":[["unidade",33]],
  "Leite integral":[["copo (200 ml)",206],["xícara (240 ml)",247],["ml",1.03]],
  "Leite desnatado":[["copo (200 ml)",206],["xícara (240 ml)",247],["ml",1.03]],
  "Iogurte natural":[["pote (170 g)",170]],
  "Iogurte grego natural":[["pote (100 g)",100]],
  "Queijo minas frescal":[["fatia média",30]],
  "Queijo mussarela":[["fatia",15]],
  "Queijo cottage":[["colher de sopa",30]],
  "Whey protein (valores de exemplo — editável)":[["dosador (scoop)",30]],
  "Tofu":[["fatia",50]],
  "Aveia em flocos":[["colher de sopa",15]],
  "Granola tradicional":[["colher de sopa",10]],
  "Pão francês":[["unidade",50]],
  "Pão integral":[["fatia",25]],
  "Macarrão cozido":[["escumadeira cheia",110],["pegador",80]],
  "Batata inglesa cozida":[["unidade média",130],["colher de sopa",30]],
  "Batata-doce cozida":[["unidade média",150],["colher de sopa",30]],
  "Mandioca cozida":[["pedaço médio",70]],
  "Inhame cozido":[["pedaço médio",70]],
  "Tapioca pronta (sem recheio)":[["unidade média",60]],
  "Cuscuz de milho cozido":[["pedaço médio",100]],
  "Milho verde cozido":[["colher de sopa",20],["espiga (grãos)",100]],
  "Banana prata":[["unidade",65]],
  "Maçã com casca":[["unidade média",130]],
  "Mamão papaia":[["meia unidade",150]],
  "Manga":[["fatia média",100]],
  "Uva":[["10 uvas",50]],
  "Laranja pera":[["unidade",140]],
  "Morango":[["unidade",12]],
  "Abacaxi":[["fatia média",75]],
  "Melancia":[["fatia média",200]],
  "Abacate":[["colher de sopa",30]],
  "Brócolis cozido":[["ramo",20],["colher de sopa",15]],
  "Cenoura crua":[["unidade média",70],["colher de sopa (ralada)",12]],
  "Tomate":[["unidade média",110],["fatia",15]],
  "Alface":[["folha",10]],
  "Abóbora cozida":[["colher de sopa",30]],
  "Espinafre cozido":[["colher de sopa",25]],
  "Azeite de oliva":[["colher de sopa",13],["colher de chá",4]],
  "Manteiga":[["colher de chá",5]],
  "Mel":[["colher de sopa",21],["colher de chá",7]],
  "Pasta de amendoim":[["colher de sopa",15]],
  "Castanha-do-pará":[["unidade",4]],
  "Castanha de caju torrada":[["unidade",3],["punhado",30]],
  "Amendoim torrado":[["colher de sopa",15],["punhado",30]],
  "Nozes":[["unidade",5],["punhado",30]],
  "Sementes de chia":[["colher de sopa",12]],
  "Linhaça (semente)":[["colher de sopa",10]],
  "Semente de abóbora":[["colher de sopa",10]],
  "Chocolate meio amargo 70%":[["quadradinho",5]]
};
