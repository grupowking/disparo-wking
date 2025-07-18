const wppconnect = require('@wppconnect-team/wppconnect');
const fs = require('fs');
const csv = require('csv-parser');

// Configurações
const INTERVALO_MIN = 75000; // 75 segundos
const INTERVALO_MAX = 90000; // 90 segundos
const DDD_PADRAO = '22'; // Altere aqui se quiser outro DDD

const MENSAGEM_TEXTO = `🎁 {primeiro_nome}, tem uma surpresa especial esperando por você aqui na Via Búzios 😍

A gente preparou isso com muito carinho pra nossa clientela fiel… e claro que você não podia ficar de fora!

Quer saber o que é? Responde aqui com “quero meu presente” que eu te explico 👀`;

const contatos = [];

// Leitura do CSV
fs.createReadStream('contatos.csv')
  .pipe(csv({ separator: ';' }))
  .on('data', (row) => {
    if (!row.nome || !row.numero) return;

    let numeroLimpo = row.numero.replace(/\D/g, '');
    if (numeroLimpo.length === 8 || numeroLimpo.length === 9) {
      // Se estiver sem DDD, adiciona o DDD padrão
      numeroLimpo = DDD_PADRAO + numeroLimpo;
    }

    if (numeroLimpo.length < 10) return;

    contatos.push({
      telefone: `55${numeroLimpo}@c.us`,
      nome: row.nome.trim(),
      primeiro_nome: row.nome.trim().split(' ')[0],
    });
  })
  .on('end', () => {
    console.log('✅ Contatos carregados. Iniciando disparo...');
    iniciarDisparo();
  });

function intervaloAleatorio() {
  return Math.floor(Math.random() * (INTERVALO_MAX - INTERVALO_MIN + 1)) + INTERVALO_MIN;
}

async function iniciarDisparo() {
  const puppeteerConfig = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
    ],
  };

  await wppconnect
    .create({
      session: 'VBConcept',
      headless: false,
      useChrome: true,
      autoClose: false,
      puppeteerOptions: puppeteerConfig,
    })
    .then(async (client) => {
      // Resposta automática
      client.onMessage(async (message) => {
        if (!message.from || !message.body) return;

        const texto = message.body.toLowerCase().trim();
        const textoNormalizado = texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        if (textoNormalizado.includes("quero meu presente")) {
          await client.sendText(message.from, "🥳 Oba! Vou te mandar o cupom exclusivo agora mesmo! Aguenta aí...");
          await client.sendFile(message.from, './cupom.mp4', 'cupom.mp4', '🎁 Aproveite essa surpresa da Via Búzios com carinho!');
        }
      });

      // Disparo inicial
      for (const contato of contatos) {
        try {
          const mensagem = MENSAGEM_TEXTO.replace('{primeiro_nome}', contato.primeiro_nome);
          await client.sendText(contato.telefone, mensagem);
          console.log(`✅ Mensagem enviada para ${contato.nome}`);
        } catch (error) {
          console.error(`❌ Erro ao enviar para ${contato.nome}:`, error.message);
        }

        const delay = intervaloAleatorio();
        console.log(`⏳ Aguardando ${delay / 1000}s para o próximo...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    });
}
