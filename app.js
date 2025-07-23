// ====================================================================
//  Via Búzios – Disparo “O Estabilizador”
// ====================================================================
const wppconnect = require('@wppconnect-team/wppconnect');
const fs         = require('fs');
const csv        = require('csv-parser');

// --- CONFIGURAÇÕES ---
const INTERVALO_MIN = 70_000;
const INTERVALO_MAX = 140_000;
const RESPOSTA_DELAY_MIN = 15_000;
const RESPOSTA_DELAY_MAX = 30_000;
const VIDEO_DELAY_MIN    = 10_000;
const VIDEO_DELAY_MAX    = 20_000;
const SESSAO       = 'VBConcept';
const VIDEO_PATH   = './cupom.mp4';

// --- CONFIGURAÇÕES DE ROBUSTEZ ---
const STABILIZATION_DELAY = 45_000; // 45 segundos para a sessão estabilizar após a conexão
const RETRY_DELAY = 25_000;         // 25 segundos de espera antes de uma retentativa
const MAX_RETRIES = 2;              // Tenta o envio original + 2 retentativas

// --- TEMPLATES E RESPOSTAS ---
const TEMPLATES_INICIAIS = [ `🎁 {primeiro}, adivinha? Liberamos um lote de 50 cupons com uma surpresa especial pra você aqui na Via Búzios 😍\n\nPreparada pros nossos clientes fiéis! Responde “quero meu presente” pra garantir o seu antes que acabe! 👀`, `🎉 Hey {primeiro}! Pintou um mimo exclusivo pra quem é VIP na Via Búzios, mas corre que é limitado! 🧡\n\nQuer descobrir o que é? Manda “quero meu presente” pra reservar o seu! 😉`, `🙌 {primeiro}! Surpresa chegando… Liberamos um lote único de 50 cupons só pra quem é da casa 😍\n\nDigita “quero meu presente” pra eu liberar o seu!`, `🥳 {primeiro}, preparamos algo que é a sua cara, mas são só 50 unidades!\n\nPra saber e garantir o seu, me responde “quero meu presente” e pronto 👀`, `👋 Oi, {primeiro}! Passando pra avisar que separamos um presente pra você, mas seja rápido(a), são só para os 50 primeiros! ✨\n\nCurioso(a)? Manda um “quero meu presente” aqui!`, `✨ {primeiro}, seu dia vai ficar melhor! Temos um benefício exclusivo te esperando na Via Búzios, mas o lote é limitado.\n\nÉ só responder “quero meu presente” que eu guardo um pra você!`, `Ei, {primeiro}! 🤫 Temos um segredinho que vale um presente... mas são apenas 50 cupons!\n\nSe quiser garantir o seu, já sabe, né? “quero meu presente” 👇`, `🧡 {primeiro}, seu nome foi selecionado para algo especial que preparamos na Via Búzios! Corra, pois a oferta é limitada aos 50 primeiros.\n\nNão fica de fora! Me manda “quero meu presente” pra desbloquear.`, `Sabe quem lembrou de você hoje, {primeiro}? A gente! E com um presente limitado. 🎁\n\nPra receber, é fácil: responde “quero meu presente” antes que esgote.`, `Olá {primeiro}! Que tal uma surpresa pra alegrar sua semana? A Via Búzios preparou uma, mas são só 50 cupons! 💖\n\nBasta responder “quero meu presente” pra descobrir e garantir o seu!` ];
const TEMPLATES_RESPOSTA = [ `Ufa, na hora! Você garantiu o cupom de número {contador} de 50! 🥳\n\nVocê desbloqueou 15% OFF pra usar nas lojas Via Búzios até 15/08. Corre pra usar antes que os outros resgatem tudo!\n\nÉ só mostrar esse cupom no caixa, combinado? 🧡`, `Show, {primeiro}! Você é o cliente Nº {contador} a garantir o seu. Restam poucos! Aqui está sua surpresa: 15% DE DESCONTO 🥳\n\nVálido em qualquer loja Via Búzios até 15/08. Apresente este cupom e aproveite!`, `Conseguimos! ✨ Seu cupom é o de número {contador} e foi ativado. Se eu fosse você, já corria pra loja!\n\nUse e abuse nas lojas Via Búzios até o dia 15/08. Boas compras!`, `Missão cumprida, {primeiro}! 🎁 Você garantiu o cupom de número {contador}. Agora é correr!\n\nEle é válido até 15/08 em todas as nossas lojas. É só mostrar no caixa!` ];
const RESPOSTAS_OK = [ 'quero meu presente', 'quero o presente', 'quero a surpresa', 'quero minha surpresa', 'quero surpresa', 'meu presente', 'cade meu presente', 'kd meu presente', 'me da o presente', 'manda o presente', 'manda a surpresa' ];

// --- UTILITÁRIOS ---
const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const delay = (ms) => new Promise(r => setTimeout(r, ms));
function dentroDoHorario() { const d = new Date(); const dia = d.getDay(); const h = d.getHours(); if (dia === 0) return h >= 9 && h < 14; if (dia >= 1 && dia <= 6) return h >= 9 && h < 20; return false; }

// --- SISTEMA DE FILA ---
const messageQueue = [];
let queueIsRunning = false;

async function startQueueProcessor(client) {
    if (queueIsRunning) return;
    queueIsRunning = true;
    console.log('[FILA] Processador iniciado.');

    while (messageQueue.length > 0) {
        const job = messageQueue.shift();
        try {
            if (!dentroDoHorario() && job.isMassMessage) {
                console.log(`[FILA] ⏰ Fora do horário. Devolvendo job para o fim da fila.`);
                messageQueue.push(job);
                await delay(600_000);
                continue;
            }

            console.log(`\n[FILA] Processando job para ${job.logInfo}...`);
            await client.startTyping(job.to);
            await delay(job.humanDelay);

            if (job.type === 'text') {
                await client.sendText(job.to, job.content);
            } else if (job.type === 'file') {
                await client.sendFile(job.to, job.path, job.filename, job.caption);
            }
            console.log(`[FILA] ✅ Job para ${job.logInfo} concluído com sucesso.`);
        } catch (e) {
            console.error(`[FILA] ❌ Falha ao processar ${job.logInfo}: ${e.message}`);
            
            job.retryCount = (job.retryCount || 0) + 1;
            const isChatNotFound = e.message && e.message.includes('Chat not found');

            if (isChatNotFound && job.retryCount <= MAX_RETRIES) {
                console.log(`[FILA] 🟡 "Chat not found" (Tentativa ${job.retryCount}/${MAX_RETRIES}). Reenfileirando na FRENTE após pausa de ${RETRY_DELAY / 1000}s.`);
                messageQueue.unshift(job); // Coloca de volta no início
                await delay(RETRY_DELAY); // Espera antes de tentar de novo
            } else {
                console.log(`[FILA] ❌ Falha definitiva para ${job.logInfo}. Job descartado.`);
            }
        } finally {
            try { await client.stopTyping(job.to); } catch {}
            await delay(1000); // Pequena pausa entre jobs
        }
    }
    queueIsRunning = false;
    console.log('[FILA] Fila vazia. Processador em modo de espera.');
}

async function iniciar() {
    let client;
    try {
        console.log('🚀 Iniciando sessão do wppconnect...');
        client = await wppconnect.create({
            session: SESSAO,
            tokenStore: 'file',
            autoClose: 0,
            headless: true,
            puppeteerOptions: {
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
            },
            catchQR: (base64Qr, asciiQR) => {
                console.log(asciiQR);
                console.log('BASE64:', base64Qr);
            },
        });

        console.log('🔌 Conectado! A sessão agora vai estabilizar por 45 segundos...');
        await delay(STABILIZATION_DELAY);
        console.log('✅ Sessão estabilizada. O bot está pronto.');

        client.onMessage(async (msg) => {
            if (!msg.from || !msg.body) return;
            const txt = msg.body.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
            if (RESPOSTAS_OK.some(pat => txt.includes(pat))) {
                console.log(`\n[CLIENTE] ${msg.from} pediu o cupom. Adicionando à FRENTE da fila...`);
                const contatoInfo = await client.getContact(msg.from);
                const primeiroNome = contatoInfo.pushname ? contatoInfo.pushname.split(' ')[0] : 'Cliente';
                const numeroCupom = rnd(35, 48);
                const respostaCupom = TEMPLATES_RESPOSTA[rnd(0, TEMPLATES_RESPOSTA.length - 1)].replace('{primeiro}', primeiroNome).replace('{contador}', numeroCupom);
                
                messageQueue.unshift({ type: 'file', to: msg.from, path: VIDEO_PATH, filename: 'cupom.mp4', caption: '🎁 Aproveite!', humanDelay: rnd(VIDEO_DELAY_MIN, VIDEO_DELAY_MAX), logInfo: `resposta de vídeo para ${primeiroNome}`, isMassMessage: false });
                messageQueue.unshift({ type: 'text', to: msg.from, content: respostaCupom, humanDelay: rnd(RESPOSTA_DELAY_MIN, RESPOSTA_DELAY_MAX), logInfo: `resposta de texto para ${primeiroNome}`, isMassMessage: false });
                
                startQueueProcessor(client);
            }
        });

        startQueueProcessor(client);

    } catch (err) {
        console.error('💥 Erro CRÍTICO na inicialização:', err.message);
        console.log('Ocorreu um erro fatal. O script será encerrado.');
    }
}

// --- PONTO DE ENTRADA ---
fs.createReadStream('contatos.csv')
  .pipe(csv({ separator: ';', mapHeaders: ({ header }) => header.trim() }))
  .on('data', (row) => {
    const nomeRaw = row['nome'] || row['\uFEFFnome'] || '';
    const numeroRaw = row['numero'] || '';
    if (!nomeRaw || !numeroRaw) return;
    const nomeLimpo = nomeRaw.trim();
    const numLimpo = numeroRaw.toString().replace(/\D/g, '');
    if (numLimpo.length < 10) return;
    const primeiroNome = nomeLimpo.split(' ')[0];
    messageQueue.push({
        type: 'text',
        to: `55${numLimpo}@c.us`,
        content: TEMPLATES_INICIAIS[rnd(0, TEMPLATES_INICIAIS.length - 1)].replace('{primeiro}', primeiroNome),
        humanDelay: rnd(INTERVALO_MIN, INTERVALO_MAX),
        logInfo: `disparo para ${nomeLimpo}`,
        isMassMessage: true,
    });
  })
  .on('end', () => {
    console.log(`✅ CSV lido. ${messageQueue.length} contatos adicionados à fila.`);
    iniciar();
  });
