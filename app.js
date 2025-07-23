// ====================================================================
//  Via Búzios – Disparo “Versão Definitiva e Completa”
//  Arquitetura: Fila de Prioridade + Login Base64 para Servidor
// ====================================================================
const wppconnect = require('@wppconnect-team/wppconnect');
const fs         = require('fs');
const csv        = require('csv-parser');

// --------------------------------------------------------------------
// CONFIGURAÇÕES
// --------------------------------------------------------------------
const INTERVALO_MIN = 70_000;
const INTERVALO_MAX = 140_000;
const TYPING_MIN    = 3_000;
const TYPING_MAX    = 6_000;

const RESPOSTA_DELAY_MIN = 15_000; // Reduzido para uma resposta mais rápida
const RESPOSTA_DELAY_MAX = 30_000;
const VIDEO_DELAY_MIN    = 10_000;
const VIDEO_DELAY_MAX    = 20_000;

const SESSAO       = 'VBConcept';
const VIDEO_PATH   = './cupom.mp4';

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
const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const delay = (ms) => new Promise(r => setTimeout(r, ms));
function dentroDoHorario() { const d = new Date(); const dia = d.getDay(); const h = d.getHours(); if (dia === 0) return h >= 9 && h < 14; if (dia >= 1 && dia <= 6) return h >= 9 && h < 20; return false; }

// --------------------------------------------------------------------
// LEITURA DO CSV
// --------------------------------------------------------------------
const contatos = [];
fs.createReadStream('contatos.csv').pipe(csv({ separator: ';', mapHeaders: ({ header }) => header.trim() })).on('data', (row) => { const nomeRaw = row['nome'] || ''; const numeroRaw = row['numero'] || ''; if (!nomeRaw || !numeroRaw) return; const nomeLimpo = nomeRaw.trim(); const numLimpo = numeroRaw.toString().replace(/\D/g, ''); if (numLimpo.length < 10) return; contatos.push({ telefone : `55${numLimpo}@c.us`, nomeCompleto : nomeLimpo, primeiroNome : nomeLimpo.split(' ')[0], }); }).on('end', () => { console.log(`✅ CSV lido. ${contatos.length} contatos válidos.`); iniciar(); });

// ======================= SISTEMA DE FILA DE MENSAGENS =======================
const messageQueue = [];
let isSending = false;

async function processQueue(client) {
    if (isSending || messageQueue.length === 0) {
        return;
    }
    isSending = true;
    const job = messageQueue.shift();

    try {
        if (!dentroDoHorario() && job.isMassMessage) {
            console.log(`[FILA] ⏰ Fora do horário para disparo em massa. Adicionando job de volta ao fim da fila.`);
            messageQueue.push(job); // Devolve ao fim da fila
            await delay(600_000); // Espera 10 minutos antes de checar de novo
            isSending = false;
            process.nextTick(() => processQueue(client));
            return;
        }

        console.log(`\n[FILA] Processando job do tipo "${job.type}" para ${job.logInfo}...`);
        
        const initialDelay = job.humanDelay;
        console.log(`[FILA] Aguardando ${initialDelay / 1000}s (simulação humana)...`);
        await client.startTyping(job.to);
        await delay(initialDelay);

        if (job.type === 'text') {
            await client.sendText(job.to, job.content);
        } else if (job.type === 'file') {
            await client.sendFile(job.to, job.path, job.filename, job.caption);
        }
        
        console.log(`[FILA] ✅ Job para ${job.logInfo} concluído com sucesso.`);
    } catch (e) {
        console.error(`[FILA] ❌ Job para ${job.logInfo} falhou: ${e.message}`);
        if (e.message && e.message.includes('Chat not found') && (job.retryCount || 0) < 1) {
            console.log(`[FILA] 🟡 Reagendando job para ${job.logInfo} após falha "Chat not found".`);
            job.retryCount = 1;
            messageQueue.unshift(job); // Retentativa com prioridade máxima
        }
    } finally {
        try { await client.stopTyping(job.to); } catch (e) {}
        isSending = false;
        process.nextTick(() => processQueue(client));
    }
}
// ====================================================================

async function iniciar() {
  let client;
  try {
    client = await wppconnect.create({
      session: SESSAO,
      tokenStore: 'file',
      autoClose: 0,
      headless: true,
      puppeteerOptions: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-accelerated-2d-canvas', '--no-first-run', '--no-zygote', '--disable-gpu'],
      },
      catchQR: (base64Qr, asciiQR) => {
        console.log('\n\n--------------------------------------------------------------------------------');
        console.log('ATENÇÃO: É NECESSÁRIO ESCANEAR O QR CODE PARA INICIAR A SESSÃO');
        console.log('--------------------------------------------------------------------------------\n');
        console.log('Opção 1 (TENTATIVA): Tente escanear o código ASCII abaixo. Diminua o zoom do navegador se necessário.');
        console.log(asciiQR);
        console.log('\n--------------------------------------------------------------------------------');
        console.log('Opção 2 (GARANTIDO): Se o código acima não funcionar, siga os passos:');
        console.log('1. Copie TODO o texto que começa com "data:image/png;base64," na linha abaixo.');
        console.log('2. Cole o texto copiado na barra de endereço do seu navegador e aperte Enter.');
        console.log('3. Uma imagem perfeita do QR Code irá aparecer. Escaneie-a com seu celular.');
        console.log('\nQR CODE EM BASE64 (copie tudo, incluindo o início "data:image/png;base64,"): \n');
        console.log(base64Qr);
        console.log('\n--------------------------------------------------------------------------------');
      },
    });

    console.log('🔌 Conectado. Escutando mensagens e pronto para processar a fila.');

    client.onMessage(async (msg) => {
      if (!msg.from || !msg.body) return;
      const txt = msg.body.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      
      if (RESPOSTAS_OK.some(pat => txt.includes(pat))) {
        console.log(`\n[CLIENTE] ${msg.from} pediu o cupom. Adicionando à FRENTE da fila...`);
        const contatoInfo = await client.getContact(msg.from);
        const primeiroNome = contatoInfo.pushname ? contatoInfo.pushname.split(' ')[0] : 'Cliente';
        const numeroCupom = rnd(35, 48);
        const respostaCupom = TEMPLATES_RESPOSTA[rnd(0, TEMPLATES_RESPOSTA.length - 1)]
                                  .replace('{primeiro}', primeiroNome)
                                  .replace('{contador}', numeroCupom);
        
        messageQueue.unshift({
            type: 'file',
            to: msg.from,
            path: VIDEO_PATH,
            filename: 'cupom.mp4',
            caption: '🎁 Aproveite essa surpresa da Via Búzios com carinho!',
            humanDelay: rnd(VIDEO_DELAY_MIN, VIDEO_DELAY_MAX),
            logInfo: `resposta de vídeo para ${primeiroNome}`,
            isMassMessage: false // Marcar como não sendo de massa
        });

        messageQueue.unshift({
            type: 'text',
            to: msg.from,
            content: respostaCupom,
            humanDelay: rnd(RESPOSTA_DELAY_MIN, RESPOSTA_DELAY_MAX),
            logInfo: `resposta de texto para ${primeiroNome}`,
            isMassMessage: false // Marcar como não sendo de massa
        });

        processQueue(client);
      }
    });

    console.log('⏳ Sessão estabilizada. Populando a fila com disparos em massa...');
    
    for (const c of contatos) {
        const txt = TEMPLATES_INICIAIS[rnd(0, TEMPLATES_INICIAIS.length - 1)].replace('{primeiro}', c.primeiroNome);
        messageQueue.push({
            type: 'text',
            to: c.telefone,
            content: txt,
            humanDelay: rnd(INTERVALO_MIN, INTERVALO_MAX),
            logInfo: `disparo para ${c.nomeCompleto}`,
            isMassMessage: true // Marcar como sendo de massa
        });
    }
    console.log(`✅ ${contatos.length} contatos adicionados ao FIM da fila de disparo.`);
    
    processQueue(client);

  } catch (err) {
    console.error('💥 Erro crítico na inicialização do wppconnect:', err.message);
  }
}
