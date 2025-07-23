// ====================================================================
//  Via Búzios – Disparo “Final com Retentativa Persistente”
// ====================================================================
const wppconnect = require('@wppconnect-team/wppconnect');
const fs         = require('fs');
const csv        = require('csv-parser');

// --------------------------------------------------------------------
// CONFIGURAÇÕES
// --------------------------------------------------------------------
const INTERVALO_MIN = 70_000;
const INTERVALO_MAX = 140_000;
const RESPOSTA_DELAY_MIN = 15_000;
const RESPOSTA_DELAY_MAX = 30_000;
const VIDEO_DELAY_MIN    = 10_000;
const VIDEO_DELAY_MAX    = 20_000;

const SESSAO       = 'VBConcept';
const VIDEO_PATH   = './cupom.mp4';

const TEMPLATES_INICIAIS = [/* ... */];
const TEMPLATES_RESPOSTA = [/* ... */];
const RESPOSTAS_OK = [/* ... */];

// --------------------------------------------------------------------
// UTILITÁRIOS E LEITURA DO CSV
// --------------------------------------------------------------------
const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const delay = (ms) => new Promise(r => setTimeout(r, ms));
function dentroDoHorario() {
  const d = new Date(); const dia = d.getDay(); const h = d.getHours();
  if (dia === 0) return h >= 9 && h < 14;
  if (dia >= 1 && dia <= 6) return h >= 9 && h < 20;
  return false;
}
const contatos = [];
fs.createReadStream('contatos.csv')
  .pipe(csv({ separator: ';', mapHeaders: ({ header }) => header.trim() }))
  .on('data', (row) => {
    const nomeRaw = row['nome'] || ''; const numeroRaw = row['numero'] || '';
    if (!nomeRaw || !numeroRaw) return;
    const nomeLimpo = nomeRaw.trim();
    const numLimpo = numeroRaw.toString().replace(/\D/g, '');
    if (numLimpo.length < 10) return;
    contatos.push({
      telefone     : `55${numLimpo}@c.us`,
      nomeCompleto : nomeLimpo,
      primeiroNome : nomeLimpo.split(' ')[0],
    });
  })
  .on('end', () => {
    console.log(`✅ CSV lido. ${contatos.length} contatos válidos.`);
    iniciar();
  });

// ======================= SISTEMA DE FILA COM RETENTATIVA PERSISTENTE =======================
const messageQueue = [];
let queueIsRunning = false;

async function startQueueProcessor(client) {
  if (queueIsRunning) return;
  queueIsRunning = true;
  console.log('[FILA] Iniciando o processador de fila...');

  while (messageQueue.length > 0) {
    const job = messageQueue.shift();
    try {
      if (!dentroDoHorario() && job.isMassMessage) {
        console.log(`[FILA] ⏰ Fora do horário. Reenfileirando...`);
        messageQueue.push(job);
        await delay(600_000);
        continue;
      }
      if (job.retryCount > 0) {
        console.log(`
[FILA] Segunda tentativa para ${job.logInfo}. Verificando número...`);
        await client.checkNumberStatus(job.to);
        await delay(5000);
      }
      console.log(`
[FILA] Processando job: ${job.logInfo}`);
      await client.startTyping(job.to);
      await delay(job.humanDelay);

      if (job.type === 'text') {
        await client.sendText(job.to, job.content);
      } else if (job.type === 'file') {
        await client.sendFile(job.to, job.path, job.filename, job.caption);
      }
      console.log(`[FILA] ✅ Enviado com sucesso: ${job.logInfo}`);
    } catch (e) {
      console.error(`[FILA] ❌ Falha: ${e.message}`);
      if (e.message.includes('Chat not found') && !job.retryCount) {
        console.log(`[FILA] 🟡 Chat não encontrado. Reenfileirando ${job.logInfo}`);
        job.retryCount = 1;
        messageQueue.push(job);
      } else {
        console.log(`[FILA] ❌ Job descartado: ${job.logInfo}`);
      }
    } finally {
      try { await client.stopTyping(job.to); } catch {}
      await delay(1000);
    }
  }
  queueIsRunning = false;
  console.log('[FILA] Fila concluída.');
}

// --------------------------------------------------------------------
// INÍCIO DO SISTEMA
// --------------------------------------------------------------------
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
        args: [
          '--no-sandbox', '--disable-setuid-sandbox',
          '--disable-dev-shm-usage', '--disable-accelerated-2d-canvas',
          '--no-first-run', '--no-zygote', '--disable-gpu'
        ]
      },
      catchQR: (base64Qr, asciiQR) => {
        console.log('
QR Code para login (ASCII):
', asciiQR);
        console.log('Ou use o base64:
', base64Qr);
      },
    });

    console.log('🔌 Conectado. Escutando mensagens...');

    client.onMessage(async (msg) => {
      if (!msg.from || !msg.body) return;
      const txt = msg.body.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
      if (RESPOSTAS_OK.some(pat => txt.includes(pat))) {
        console.log(`
[CLIENTE] ${msg.from} pediu o cupom.`);
        const contatoInfo = await client.getContact(msg.from);
        const primeiroNome = contatoInfo.pushname ? contatoInfo.pushname.split(' ')[0] : 'Cliente';
        const numeroCupom = rnd(35, 48);
        const respostaCupom = TEMPLATES_RESPOSTA[rnd(0, TEMPLATES_RESPOSTA.length - 1)]
          .replace('{primeiro}', primeiroNome).replace('{contador}', numeroCupom);
        messageQueue.unshift({ type: 'file', to: msg.from, path: VIDEO_PATH, filename: 'cupom.mp4', caption: '🎁 Aproveite essa surpresa da Via Búzios com carinho!', humanDelay: rnd(VIDEO_DELAY_MIN, VIDEO_DELAY_MAX), logInfo: `resposta vídeo ${primeiroNome}`, isMassMessage: false });
        messageQueue.unshift({ type: 'text', to: msg.from, content: respostaCupom, humanDelay: rnd(RESPOSTA_DELAY_MIN, RESPOSTA_DELAY_MAX), logInfo: `resposta texto ${primeiroNome}`, isMassMessage: false });
        startQueueProcessor(client);
      }
    });

    console.log('⏳ Sessão estabilizada. Iniciando fila de disparo...');
    for (const c of contatos) {
      const txt = TEMPLATES_INICIAIS[rnd(0, TEMPLATES_INICIAIS.length - 1)].replace('{primeiro}', c.primeiroNome);
      messageQueue.push({ type: 'text', to: c.telefone, content: txt, humanDelay: rnd(INTERVALO_MIN, INTERVALO_MAX), logInfo: `disparo ${c.nomeCompleto}`, isMassMessage: true });
    }
    console.log(`✅ ${contatos.length} contatos adicionados à fila.`);
    startQueueProcessor(client);
  } catch (err) {
    console.error('💥 Erro crítico na inicialização:', err.message);
  }
}
