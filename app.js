// ====================================================================
//  Via Búzios – Disparo “Modo Fênix” com Auto-Recuperação
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
const MAX_RETRIES_MASSA = 3;
const MAX_RETRIES_RESPOSTA = 2;
const RETRY_DELAY_RESPOSTA = 25_000;
const RESTART_DELAY = 60_000; // Pausa de 1 minuto antes de tentar reiniciar a sessão

// --- DEFINIÇÕES DE TEMPLATES E RESPOSTAS ---
const TEMPLATES_INICIAIS = [ `🎁 {primeiro}, adivinha? Liberamos um lote de 50 cupons com uma surpresa especial pra você aqui na Via Búzios 😍\n\nPreparada pros nossos clientes fiéis! Responde “quero meu presente” pra garantir o seu antes que acabe! 👀`, `🎉 Hey {primeiro}! Pintou um mimo exclusivo pra quem é VIP na Via Búzios, mas corre que é limitado! 🧡\n\nQuer descobrir o que é? Manda “quero meu presente” pra reservar o seu! 😉`, `🙌 {primeiro}! Surpresa chegando… Liberamos um lote único de 50 cupons só pra quem é da casa 😍\n\nDigita “quero meu presente” pra eu liberar o seu!`, `🥳 {primeiro}, preparamos algo que é a sua cara, mas são só 50 unidades!\n\nPra saber e garantir o seu, me responde “quero meu presente” e pronto 👀`, `👋 Oi, {primeiro}! Passando pra avisar que separamos um presente pra você, mas seja rápido(a), são só para os 50 primeiros! ✨\n\nCurioso(a)? Manda um “quero meu presente” aqui!`, `✨ {primeiro}, seu dia vai ficar melhor! Temos um benefício exclusivo te esperando na Via Búzios, mas o lote é limitado.\n\nÉ só responder “quero meu presente” que eu guardo um pra você!`, `Ei, {primeiro}! 🤫 Temos um segredinho que vale um presente... mas são apenas 50 cupons!\n\nSe quiser garantir o seu, já sabe, né? “quero meu presente” 👇`, `🧡 {primeiro}, seu nome foi selecionado para algo especial que preparamos na Via Búzios! Corra, pois a oferta é limitada aos 50 primeiros.\n\nNão fica de fora! Me manda “quero meu presente” pra desbloquear.`, `Sabe quem lembrou de você hoje, {primeiro}? A gente! E com um presente limitado. 🎁\n\nPra receber, é fácil: responde “quero meu presente” antes que esgote.`, `Olá {primeiro}! Que tal uma surpresa pra alegrar sua semana? A Via Búzios preparou uma, mas são só 50 cupons! 💖\n\nBasta responder “quero meu presente” pra descobrir e garantir o seu!` ];
const TEMPLATES_RESPOSTA = [ `Ufa, na hora! Você garantiu o cupom de número {contador} de 50! 🥳\n\nVocê desbloqueou 15% OFF pra usar nas lojas Via Búzios até 15/08. Corre pra usar antes que os outros resgatem tudo!\n\nÉ só mostrar esse cupom no caixa, combinado? 🧡`, `Show, {primeiro}! Você é o cliente Nº {contador} a garantir o seu. Restam poucos! Aqui está sua surpresa: 15% DE DESCONTO 🥳\n\nVálido em qualquer loja Via Búzios até 15/08. Apresente este cupom e aproveite!`, `Conseguimos! ✨ Seu cupom é o de número {contador} e foi ativado. Se eu fosse você, já corria pra loja!\n\nUse e abuse nas lojas Via Búzios até o dia 15/08. Boas compras!`, `Missão cumprida, {primeiro}! 🎁 Você garantiu o cupom de número {contador}. Agora é correr!\n\nEle é válido até 15/08 em todas as nossas lojas. É só mostrar no caixa!` ];
const RESPOSTAS_OK = [ 'quero meu presente', 'quero o presente', 'quero a surpresa', 'quero minha surpresa', 'quero surpresa', 'meu presente', 'cade meu presente', 'kd meu presente', 'me da o presente', 'manda o presente', 'manda a surpresa' ];

// --- UTILITÁRIOS ---
const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const delay = (ms) => new Promise(r => setTimeout(r, ms));
function dentroDoHorario() { const d = new Date(); const dia = d.getDay(); const h = d.getHours(); if (dia === 0) return h >= 9 && h < 14; if (dia >= 1 && dia <= 6) return h >= 9 && h < 20; return false; }

// ======================= SISTEMA DE FILA E ESTADO GLOBAL =======================
// A fila agora é global para sobreviver aos reinícios
let messageQueue = [];
let queueIsRunning = false;
let isFirstRun = true; // Flag para popular a fila apenas na primeira execução

// ======================= PROCESSADOR DE FILA (SEM ALTERAÇÕES SIGNIFICATIVAS) =======================
async function startQueueProcessor(client) {
    if (queueIsRunning) return;
    queueIsRunning = true;
    console.log('[FILA] Iniciando o processador de fila...');

    while (messageQueue.length > 0) {
        if (!client || !client.isConnected) {
            console.error('[FILA] 🚨 Cliente desconectado! Pausando o processador.');
            queueIsRunning = false;
            return; // Sai da função se o cliente morrer
        }
        const job = messageQueue.shift();
        try {
            // ... (lógica de processamento do job idêntica à versão anterior)
            if (!dentroDoHorario() && job.isMassMessage) {
                console.log(`[FILA] ⏰ Fora do horário. Devolvendo job para o fim da fila.`);
                messageQueue.push(job);
                await delay(600_000);
                continue;
            }
            console.log(`\n[FILA] Processando job do tipo "${job.type}" para ${job.logInfo}...`);
            await client.startTyping(job.to);
            await delay(job.humanDelay);
            if (job.type === 'text') {
                await client.sendText(job.to, job.content);
            } else if (job.type === 'file') {
                await client.sendFile(job.to, job.path, job.filename, job.caption);
            }
            console.log(`[FILA] ✅ Job para ${job.logInfo} concluído com sucesso.`);
        } catch (e) {
            // A lógica de retentativa para "Chat not found" permanece a mesma
            job.retryCount = (job.retryCount || 0) + 1;
            const isChatNotFound = e.message && e.message.includes('Chat not found');
            const isFatalError = !isChatNotFound; // Considera qualquer outro erro como potencialmente fatal para o job

            if (isChatNotFound) {
                // Lógica para DISPARO EM MASSA
                if (job.isMassMessage && job.retryCount < MAX_RETRIES_MASSA) {
                    console.log(`[FILA] 🟡 Falha "Chat not found" (Tentativa ${job.retryCount}/${MAX_RETRIES_MASSA}). Devolvendo para o FIM da fila.`);
                    messageQueue.push(job);
                }
                // Lógica para RESPOSTA INTERATIVA
                else if (!job.isMassMessage && job.retryCount < MAX_RETRIES_RESPOSTA) {
                    console.log(`[FILA] 🟡 Falha "Chat not found" em resposta (Tentativa ${job.retryCount}/${MAX_RETRIES_RESPOSTA}). Tentando novamente em ${RETRY_DELAY_RESPOSTA / 1000}s...`);
                    messageQueue.unshift(job);
                    await delay(RETRY_DELAY_RESPOSTA);
                } else {
                    console.log(`[FILA] ❌ Falha definitiva para ${job.logInfo} após múltiplas tentativas. Job descartado.`);
                }
            } else {
                // Se o erro for fatal para a sessão (ex: detached frame), o catch principal vai pegar.
                // Este else descarta o JOB, mas não para o bot.
                console.error(`[FILA] ❌ Erro não recuperável para este JOB: ${e.message}. Job ${job.logInfo} descartado.`);
            }
        } finally {
            try { await client.stopTyping(job.to); } catch (e) {}
            await delay(1000);
        }
    }
    queueIsRunning = false;
    console.log('[FILA] Fila vazia. Processador em modo de espera.');
}

// ======================= FUNÇÃO PRINCIPAL E LÓGICA DE AUTO-RECUPERAÇÃO =======================
async function iniciar() {
    let client;
    try {
        console.log('🚀 Tentando iniciar uma nova sessão do wppconnect...');
        client = await wppconnect.create({
            session: SESSAO,
            tokenStore: 'file',
            autoClose: 0,
            headless: true,
            puppeteerOptions: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu',
                    '--single-process' // Adicionado para tentar reduzir o uso de memória
                ]
            },
            catchQR: (base64Qr, asciiQR) => {
                console.log(asciiQR);
                console.log('BASE64:', base64Qr);
            },
        });

        console.log('🔌 Conectado. Escutando mensagens...');

        client.onMessage(async (msg) => {
            if (!msg.from || !msg.body) return;
            const txt = msg.body.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
            if (RESPOSTAS_OK.some(pat => txt.includes(pat))) {
                console.log(`\n[CLIENTE] ${msg.from} pediu o cupom. Adicionando à FRENTE da fila...`);
                const contatoInfo = await client.getContact(msg.from);
                const primeiroNome = contatoInfo.pushname ? contatoInfo.pushname.split(' ')[0] : 'Cliente';
                const numeroCupom = rnd(35, 48);
                const respostaCupom = TEMPLATES_RESPOSTA[rnd(0, TEMPLATES_RESPOSTA.length - 1)].replace('{primeiro}', primeiroNome).replace('{contador}', numeroCupom);
                
                messageQueue.unshift({ type: 'file', to: msg.from, path: VIDEO_PATH, filename: 'cupom.mp4', caption: '🎁 Aproveite!', humanDelay: rnd(VIDEO_DELAY_MIN, VIDEO_DELAY_MAX), logInfo: `resposta de vídeo para ${primeiroNome}`, isMassMessage: false, retryCount: 0 });
                messageQueue.unshift({ type: 'text', to: msg.from, content: respostaCupom, humanDelay: rnd(RESPOSTA_DELAY_MIN, RESPOSTA_DELAY_MAX), logInfo: `resposta de texto para ${primeiroNome}`, isMassMessage: false, retryCount: 0 });
                
                startQueueProcessor(client);
            }
        });
        
        // Se a fila não estiver vazia (sobreviveu a um crash), apenas reinicia o processador
        if (messageQueue.length > 0) {
            console.log(`[SISTEMA] Reiniciando processador com ${messageQueue.length} jobs restantes na fila.`);
            startQueueProcessor(client);
        }

    } catch (err) {
        console.error('💥 Erro CRÍTICO na sessão do wppconnect:', err.message);
        if (client) {
            try {
                await client.close();
            } catch (closeErr) {
                console.error('Erro ao tentar fechar cliente após falha:', closeErr.message);
            }
        }
        console.log(`[SISTEMA] A sessão quebrou. Tentando reiniciar em ${RESTART_DELAY / 1000} segundos...`);
        await delay(RESTART_DELAY);
        // Chama a si mesma para tentar recomeçar do zero
        iniciar(); 
    }
}

// --- PONTO DE ENTRADA ---
// Lê o CSV apenas uma vez e depois inicia o loop do bot
fs.createReadStream('contatos.csv')
  .pipe(csv({ separator: ';', mapHeaders: ({ header }) => header.trim() }))
  .on('data', (row) => {
    const nomeRaw = row['nome'] || row['\uFEFFnome'] || '';
    const numeroRaw = row['numero'] || '';
    if (!nomeRaw || !numeroRaw) return;
    const nomeLimpo = nomeRaw.trim();
    const numLimpo = numeroRaw.toString().replace(/\D/g, '');
    if (numLimpo.length < 10) return;
    messageQueue.push({
        type: 'text',
        to: `55${numLimpo}@c.us`,
        content: TEMPLATES_INICIAIS[rnd(0, TEMPLATES_INICIAIS.length - 1)].replace('{primeiro}', nomeLimpo.split(' ')[0]),
        humanDelay: rnd(INTERVALO_MIN, INTERVALO_MAX),
        logInfo: `disparo para ${nomeLimpo}`,
        isMassMessage: true,
        retryCount: 0
    });
  })
  .on('end', () => {
    console.log(`✅ CSV lido. ${messageQueue.length} contatos adicionados à fila.`);
    // Inicia o bot pela primeira vez
    iniciar();
  });
