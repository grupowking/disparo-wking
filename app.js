// ====================================================================
//  Via Búzios – Versão Anterior (Antes da Arquitetura de Fila)
//  Este script tem risco de instabilidade e "congelamento" sob carga,
//  mas demonstrou sucesso na retentativa de "Chat not found".
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

const RESPOSTA_DELAY_MIN = 15_000;
const RESPOSTA_DELAY_MAX = 30_000;
const VIDEO_DELAY_MIN    = 10_000;
const VIDEO_DELAY_MAX    = 20_000;

const SESSAO       = 'VBConcept';
const VIDEO_PATH   = './cupom.mp4';

// ... (Templates e Respostas OK permanecem os mesmos)
const TEMPLATES_INICIAIS = [ `🎁 {primeiro}, adivinha? Liberamos um lote de 50 cupons com uma surpresa especial pra você aqui na Via Búzios 😍\n\nPreparada pros nossos clientes fiéis! Responde “quero meu presente” pra garantir o seu antes que acabe! 👀`, `🎉 Hey {primeiro}! Pintou um mimo exclusivo pra quem é VIP na Via Búzios, mas corre que é limitado! 🧡\n\nQuer descobrir o que é? Manda “quero meu presente” pra reservar o seu! 😉`, `🙌 {primeiro}! Surpresa chegando… Liberamos um lote único de 50 cupons só pra quem é da casa 😍\n\nDigita “quero meu presente” pra eu liberar o seu!`, `🥳 {primeiro}, preparamos algo que é a sua cara, mas são só 50 unidades!\n\nPra saber e garantir o seu, me responde “quero meu presente” e pronto 👀`, `👋 Oi, {primeiro}! Passando pra avisar que separamos um presente pra você, mas seja rápido(a), são só para os 50 primeiros! ✨\n\nCurioso(a)? Manda um “quero meu presente” aqui!`, `✨ {primeiro}, seu dia vai ficar melhor! Temos um benefício exclusivo te esperando na Via Búzios, mas o lote é limitado.\n\nÉ só responder “quero meu presente” que eu guardo um pra você!`, `Ei, {primeiro}! 🤫 Temos um segredinho que vale um presente... mas são apenas 50 cupons!\n\nSe quiser garantir o seu, já sabe, né? “quero meu presente” 👇`, `🧡 {primeiro}, seu nome foi selecionado para algo especial que preparamos na Via Búzios! Corra, pois a oferta é limitada aos 50 primeiros.\n\nNão fica de fora! Me manda “quero meu presente” pra desbloquear.`, `Sabe quem lembrou de você hoje, {primeiro}? A gente! E com um presente limitado. 🎁\n\nPra receber, é fácil: responde “quero meu presente” antes que esgote.`, `Olá {primeiro}! Que tal uma surpresa pra alegrar sua semana? A Via Búzios preparou uma, mas são só 50 cupons! 💖\n\nBasta responder “quero meu presente” pra descobrir e garantir o seu!` ];
const TEMPLATES_RESPOSTA = [ `Ufa, na hora! Você garantiu o cupom de número {contador} de 50! 🥳\n\nVocê desbloqueou 15% OFF pra usar nas lojas Via Búzios até 15/08. Corre pra usar antes que os outros resgatem tudo!\n\nÉ só mostrar esse cupom no caixa, combinado? �`, `Show, {primeiro}! Você é o cliente Nº {contador} a garantir o seu. Restam poucos! Aqui está sua surpresa: 15% DE DESCONTO 🥳\n\nVálido em qualquer loja Via Búzios até 15/08. Apresente este cupom e aproveite!`, `Conseguimos! ✨ Seu cupom é o de número {contador} e foi ativado. Se eu fosse você, já corria pra loja!\n\nUse e abuse nas lojas Via Búzios até o dia 15/08. Boas compras!`, `Missão cumprida, {primeiro}! 🎁 Você garantiu o cupom de número {contador}. Agora é correr!\n\nEle é válido até 15/08 em todas as nossas lojas. É só mostrar no caixa!` ];
const RESPOSTAS_OK = [ 'quero meu presente', 'quero o presente', 'quero a surpresa', 'quero minha surpresa', 'quero surpresa', 'meu presente', 'cade meu presente', 'kd meu presente', 'me da o presente', 'manda o presente', 'manda a surpresa' ];

// --------------------------------------------------------------------
// UTILITÁRIOS E LEITURA DO CSV (Sem alterações)
// --------------------------------------------------------------------
const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const delay = (ms) => new Promise(r => setTimeout(r, ms));
const intervalo = () => rnd(INTERVALO_MIN, INTERVALO_MAX);
const typingTime = () => rnd(TYPING_MIN, TYPING_MAX);
function dentroDoHorario() { const d = new Date(); const dia = d.getDay(); const h = d.getHours(); if (dia === 0) return h >= 9 && h < 14; if (dia >= 1 && dia <= 6) return h >= 9 && h < 20; return false; }
const contatos = [];
fs.createReadStream('contatos.csv').pipe(csv({ separator: ';', mapHeaders: ({ header }) => header.trim() })).on('data', (row) => { const nomeRaw = row['nome'] || ''; const numeroRaw = row['numero'] || ''; if (!nomeRaw || !numeroRaw) return; const nomeLimpo = nomeRaw.trim(); const numLimpo = numeroRaw.toString().replace(/\D/g, ''); if (numLimpo.length < 10) return; contatos.push({ telefone : `55${numLimpo}@c.us`, nomeCompleto : nomeLimpo, primeiroNome : nomeLimpo.split(' ')[0], }); }).on('end', () => { console.log(`✅ CSV lido. ${contatos.length} contatos válidos.`); iniciar(); });


// ======================= LÓGICA ANTIGA (PRÉ-FILA) =======================
async function enviarMensagemComRetentativa(client, contato, pos, total) {
    const logPrefix = `(${pos}/${total}) para ${contato.nomeCompleto}`;
    try {
        await client.startTyping(contato.telefone);
        const txt = TEMPLATES_INICIAIS[rnd(0, TEMPLATES_INICIAIS.length - 1)].replace('{primeiro}', contato.primeiroNome);
        await delay(typingTime());
        await client.sendText(contato.telefone, txt);
        console.log(`✅ ${logPrefix}: Mensagem enviada.`);
    } catch (err) {
        if (err.message && err.message.includes('Chat not found')) {
            console.log(`🟡 ${logPrefix}: Falha inicial (Chat not found). Pausando 20s para retentativa...`);
            await delay(20000);
            try {
                console.log(`  -> Retentativa ${logPrefix}...`);
                const txt = TEMPLATES_INICIAIS[rnd(0, TEMPLATES_INICIAIS.length - 1)].replace('{primeiro}', contato.primeiroNome);
                await client.sendText(contato.telefone, txt);
                console.log(`✅ ${logPrefix}: SUCESSO na retentativa!`);
            } catch (retryErr) {
                console.error(`❌ ${logPrefix}: Falha definitiva após retentativa: ${retryErr.message}`);
            }
        } else {
            console.error(`❌ ${logPrefix}: Falha não relacionada a 'Chat not found': ${err.message}`);
        }
    } finally {
        try { await client.stopTyping(contato.telefone); } catch (e) {}
    }
}

async function executarSequenciaDeResposta(client, msg) {
    console.log(`\n▶️ Cliente ${msg.from} pediu o cupom. Iniciando sequência de resposta ISOLADA...`);
    try {
        const contatoInfo = await client.getContact(msg.from);
        const primeiroNome = contatoInfo.pushname ? contatoInfo.pushname.split(' ')[0] : 'Cliente';
        const numeroCupom = rnd(35, 48);
        const respostaCupom = TEMPLATES_RESPOSTA[rnd(0, TEMPLATES_RESPOSTA.length - 1)].replace('{primeiro}', primeiroNome).replace('{contador}', numeroCupom);

        try {
            await client.startTyping(msg.from);
            await delay(rnd(RESPOSTA_DELAY_MIN, RESPOSTA_DELAY_MAX));
            await client.sendText(msg.from, respostaCupom);
        } finally {
            await client.stopTyping(msg.from);
        }

        try {
            await client.startTyping(msg.from);
            await delay(rnd(VIDEO_DELAY_MIN, VIDEO_DELAY_MAX));
            await client.sendFile(msg.from, VIDEO_PATH, 'cupom.mp4', '🎁 Aproveite essa surpresa da Via Búzios com carinho!');
        } finally {
            await client.stopTyping(msg.from);
        }
        console.log(`✅ Sequência de cupom concluída para ${primeiroNome}.`);
    } catch (e) {
        console.error(`⚠️ Falha crítica na sequência de cupom para ${msg.from}: ${e.message}`);
        try { await client.stopTyping(msg.from); } catch (e) {}
    }
}

async function iniciar() {
  let client;
  try {
    client = await wppconnect.create({
      session: SESSAO,
      tokenStore: 'file',
      autoClose: 0,
      headless: true,
      puppeteerOptions: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-accelerated-2d-canvas', '--no-first-run', '--no-zygote', '--disable-gpu'], },
      catchQR: (base64Qr, asciiQR) => {
        console.log('\n\n--- INSTRUÇÕES DE LOGIN ---\n');
        console.log('Opção 1 (TENTATIVA): Escaneie o código ASCII abaixo.\n');
        console.log(asciiQR);
        console.log('\n---');
        console.log('Opção 2 (GARANTIDO): Se o código acima falhar, copie o texto BASE64 abaixo no seu navegador para gerar a imagem do QR Code.\n');
        console.log('BASE64:', base64Qr);
        console.log('\n---------------------------\n');
      },
    });

    console.log('🔌 Conectado. Escutando mensagens...');

    client.onMessage((msg) => {
      if (!msg.from || !msg.body) return;
      const txt = msg.body.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      if (RESPOSTAS_OK.some(pat => txt.includes(pat))) {
        executarSequenciaDeResposta(client, msg);
      }
    });

    console.log('⏳ Aguardando 30 segundos para a sincronização inicial da sessão...');
    await delay(30000);
    console.log('✅ Sessão estabilizada. Iniciando disparos.');

    const fila = [...contatos];
    let pos = 0;
    const totalContatos = fila.length;

    for (const c of fila) {
        pos++;
        if (!dentroDoHorario()) {
            console.log(`⏰ (${pos}/${totalContatos}) Fora do horário permitido. Pausando 15 min…`);
            await delay(900_000);
            continue;
        }

        await enviarMensagemComRetentativa(client, c, pos, totalContatos);
        
        const tempoDeEspera = intervalo();
        console.log(`⏳ Aguardando ${tempoDeEspera / 1000}s para o próximo...`);
        await delay(tempoDeEspera);
    }
    console.log('🏁 Disparo finalizado.');
  } catch (err) {
    console.error('💥 Erro crítico na inicialização do wppconnect:', err.message);
  }
}