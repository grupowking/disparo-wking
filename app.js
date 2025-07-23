// ====================================================================
//  Via Búzios – Disparo “Edição Final com Contagem de Urgência”
// ====================================================================
const wppconnect = require('@wppconnect-team/wppconnect');
const fs          = require('fs');
const csv         = require('csv-parser');

// --------------------------------------------------------------------
// CONFIGURAÇÕES
// --------------------------------------------------------------------
const INTERVALO_MIN = 70_000;   // 70 s
const INTERVALO_MAX = 140_000;  // 140 s
const TYPING_MIN    = 3_000;    // 3 s
const TYPING_MAX    = 6_000;    // 6 s

const SESSAO        = 'VBConcept';
const VIDEO_PATH    = './cupom.mp4';

const TEMPLATES_INICIAIS = [
  `🎁 {primeiro}, adivinha? Liberamos um lote de 50 cupons com uma surpresa especial pra você aqui na Via Búzios 😍\n\nPreparada pros nossos clientes fiéis! Responde “quero meu presente” pra garantir o seu antes que acabe! 👀`,
  `🎉 Hey {primeiro}! Pintou um mimo exclusivo pra quem é VIP na Via Búzios, mas corre que é limitado! 🧡\n\nQuer descobrir o que é? Manda “quero meu presente” pra reservar o seu! 😉`,
  `🙌 {primeiro}! Surpresa chegando… Liberamos um lote único de 50 cupons só pra quem é da casa 😍\n\nDigita “quero meu presente” pra eu liberar o seu!`,
  `🥳 {primeiro}, preparamos algo que é a sua cara, mas são só 50 unidades!\n\nPra saber e garantir o seu, me responde “quero meu presente” e pronto 👀`,
  `👋 Oi, {primeiro}! Passando pra avisar que separamos um presente pra você, mas seja rápido(a), são só para os 50 primeiros! ✨\n\nCurioso(a)? Manda um “quero meu presente” aqui!`,
  `✨ {primeiro}, seu dia vai ficar melhor! Temos um benefício exclusivo te esperando na Via Búzios, mas o lote é limitado.\n\nÉ só responder “quero meu presente” que eu guardo um pra você!`,
  `Ei, {primeiro}! 🤫 Temos um segredinho que vale um presente... mas são apenas 50 cupons!\n\nSe quiser garantir o seu, já sabe, né? “quero meu presente” 👇`,
  `🧡 {primeiro}, seu nome foi selecionado para algo especial que preparamos na Via Búzios! Corra, pois a oferta é limitada aos 50 primeiros.\n\nNão fica de fora! Me manda “quero meu presente” pra desbloquear.`,
  `Sabe quem lembrou de você hoje, {primeiro}? A gente! E com um presente limitado. 🎁\n\nPra receber, é fácil: responde “quero meu presente” antes que esgote.`,
  `Olá {primeiro}! Que tal uma surpresa pra alegrar sua semana? A Via Búzios preparou uma, mas são só 50 cupons! 💖\n\nBasta responder “quero meu presente” pra descobrir e garantir o seu!`
];

// *** ATUALIZADO: 4 VARIAÇÕES COM CONTAGEM ALEATÓRIA ***
const TEMPLATES_RESPOSTA = [
    `Ufa, na hora! Você garantiu o cupom de número {contador} de 50! 🥳\n\nVocê desbloqueou 15% OFF pra usar nas lojas Via Búzios até 15/08. Corre pra usar antes que os outros resgatem tudo!\n\nÉ só mostrar esse cupom no caixa, combinado? 🧡`,
    `Show, {primeiro}! Você é o cliente Nº {contador} a garantir o seu. Restam poucos! Aqui está sua surpresa: 15% DE DESCONTO 🥳\n\nVálido em qualquer loja Via Búzios até 15/08. Apresente este cupom e aproveite!`,
    `Conseguimos! ✨ Seu cupom é o de número {contador} e foi ativado. Se eu fosse você, já corria pra loja!\n\nUse e abuse nas lojas Via Búzios até o dia 15/08. Boas compras!`,
    `Missão cumprida, {primeiro}! 🎁 Você garantiu o cupom de número {contador}. Agora é correr!\n\nEle é válido até 15/08 em todas as nossas lojas. É só mostrar no caixa!`
];

const RESPOSTAS_OK = [
  'quero meu presente', 'quero o presente', 'quero a surpresa',
  'quero minha surpresa', 'quero surpresa', 'meu presente',
  'cade meu presente', 'kd meu presente', 'me da o presente',
  'manda o presente', 'manda a surpresa'
];

// --------------------------------------------------------------------
// UTILITÁRIOS
// --------------------------------------------------------------------
const rnd        = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const delay      = (ms)       => new Promise(r => setTimeout(r, ms));
const intervalo  = ()         => rnd(INTERVALO_MIN, INTERVALO_MAX);
const typingTime = ()         => rnd(TYPING_MIN, TYPING_MAX);

function dentroDoHorario() {
  const d   = new Date();
  const dia = d.getDay();              // 0 = dom
  const h   = d.getHours();
  if (dia === 0)             return h >= 9 && h < 14;  // Domingo: 9h às 13:59h
  if (dia >= 1 && dia <= 6)  return h >= 9 && h < 20;  // Seg-Sáb: 9h às 19:59h
  return false;
}

// --------------------------------------------------------------------
// LEITURA DO CSV
// --------------------------------------------------------------------
const contatos = [];
fs.createReadStream('contatos.csv')
  .pipe(csv({ separator: ';' }))
  .on('data', (row) => {
    if (!row.nome || !row.numero) return;
    const num = row.numero.replace(/\D/g, '');
    if (num.length < 10) return;
    contatos.push({
      telefone     : `55${num}@c.us`,
      nomeCompleto : row.nome.trim(),
      primeiroNome : row.nome.trim().split(' ')[0],
    });
  })
  .on('end', () => {
    console.log(`✅ CSV lido. ${contatos.length} contatos válidos.`);
    iniciar();
  });

// --------------------------------------------------------------------
// FUNÇÃO PRINCIPAL
// --------------------------------------------------------------------
async function iniciar() {
  try {
    const client = await wppconnect.create({
      session: SESSAO,
      tokenStore: 'file',
      autoClose: 0,
      headless: true,
      puppeteerOptions: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-accelerated-2d-canvas', '--no-first-run', '--no-zygote', '--disable-gpu'],
      },
    });

    console.log('🔌 Conectado. Escutando mensagens…');

    // ---------- AUTO-RESPOSTA CUPOM ----------
    client.onMessage(async (msg) => {
      if (!msg.from || !msg.body) return;
      const txt = msg.body.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      const contatoInfo = await client.getContact(msg.from);
      const primeiroNome = contatoInfo.pushname ? contatoInfo.pushname.split(' ')[0] : '';

      if (RESPOSTAS_OK.some(pat => txt.includes(pat))) {
        try {
          // *** NOVO: Gera um número aleatório para o gatilho de urgência ***
          const numeroCupom = rnd(35, 48); 
          
          // Seleciona uma resposta aleatória e personaliza com o nome e o número do cupom
          const respostaCupom = TEMPLATES_RESPOSTA[rnd(0, TEMPLATES_RESPOSTA.length - 1)]
                                  .replace('{primeiro}', primeiroNome)
                                  .replace('{contador}', numeroCupom);

          await client.startTyping(msg.from);
          await delay(typingTime());
          await client.sendText(msg.from, respostaCupom);
          await client.sendFile(from, VIDEO_PATH, 'cupom.mp4', '🎁 Aproveite essa surpresa da Via Búzios com carinho!');
          console.log(`🎬 Cupom Nº ${numeroCupom} enviado para ${contatoInfo.pushname} (${msg.from})`);
        } catch (e) {
          console.error(`⚠️ Falha ao enviar cupom → ${msg.from}: ${e.message}`);
        }
      }
    });

    // ---------- DISPARO EM LOTE ----------
    const fila = [...contatos];
    let pos    = 0;
    while (fila.length) {
      if (!dentroDoHorario()) {
        console.log('⏰ Fora do horário permitido. Pausando 15 min…');
        await delay(900_000);
        continue;
      }
      const c   = fila.shift();
      pos      += 1;
      const txt = TEMPLATES_INICIAIS[rnd(0, TEMPLATES_INICIAIS.length - 1)].replace('{primeiro}', c.primeiroNome);

      try {
        await client.startTyping(c.telefone);
        await delay(typingTime());
        await client.sendText(c.telefone, txt);
        console.log(`✅ (${pos}/${contatos.length}) ${c.nomeCompleto}`);
      } catch (err) {
        console.error(`❌ (${pos}) Falha p/ ${c.nomeCompleto}: ${err.message}`);
        if (/not defined|sync|connect/i.test(err.message)) {
          fila.push(c);
          console.log('↩️  Re-enfileirado para tentar depois.');
        }
      }
      await delay(intervalo());

      if (pos > 0 && pos % 500 === 0) {
        console.log(`☕️ Pausa longa! ${pos} mensagens enviadas. Descansando por 2 horas.`);
        await delay(7_200_000);
      } else if (pos > 0 && pos % 50 === 0) {
        console.log(`💧 Pausa curta! ${pos} mensagens enviadas. Descansando por 30 minutos.`);
        await delay(1_800_000);
      }
    }
    console.log('🏁 Disparo finalizado.');
  } catch (err) {
    console.error('💥 Erro crítico na inicialização:', err.message);
  }
}
