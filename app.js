const wppconnect = require('@wppconnect-team/wppconnect');
const fs = require('fs');
const csv = require('csv-parser');

// Configurações
const INTERVALO_MIN = 16000; // 16 segundos
const INTERVALO_MAX = 23000; // 23 segundos
const CAMINHO_VIDEO = './namorados2025.mp4';
const MENSAGEM_TEXTO = `🎁 {primeiro_nome}, o presente que vai surpreender quem você ama está na Via Búzios!
Tem opções incríveis pra ele, pra ela, pra celebrar juntos — com bom gosto e muito carinho.

👀 Mas corre, porque os mais desejados estão saindo rápido…
📍Estamos pertinho do Supermarket. E se preferir, levamos até você!`;

const contatos = [];

fs.createReadStream('contatos.csv')
  .pipe(csv({ separator: ';' }))
  .on('data', (row) => {
    if (!row.nome || !row.numero) return;
    contatos.push({
      telefone: `${row.numero.trim()}@c.us`,
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
  // Configurações do Puppeteer para Railway/Docker
  const puppeteerConfig = {
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor'
    ]
  };

  await wppconnect.create({
    session: 'WKing',
    headless: true, // Mudei para true para produção
    puppeteerOptions: puppeteerConfig, // Adicionei as configurações do Puppeteer
  }).then(async (client) => {
    for (let i = 0; i < contatos.length; i++) {
      const contato = contatos[i];
      if (!dentroDoHorarioPermitido()) {
        console.log("⏳ Fora do horário permitido. Aguardando 5min...");
        await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
        i--; // tenta o mesmo contato novamente depois
        continue;
      }

      try {
        console.log(`📤 Enviando para ${contato.primeiro_nome}...`);
        await client.sendFile(contato.telefone, CAMINHO_VIDEO, 'namorados2025.mp4', '');
        await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 2000) + 8000));

        const mensagemPersonalizada = MENSAGEM_TEXTO.replace('{primeiro_nome}', contato.primeiro_nome);
        await client.sendText(contato.telefone, mensagemPersonalizada);

        const espera = intervaloAleatorio();
        console.log(`✅ Mensagens enviadas para ${contato.primeiro_nome}. Aguardando ${espera / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, espera));


        if (i % 200 === 0 && i !== 0) await new Promise(resolve => setTimeout(resolve, 60 * 1000));
        if (i % 500 === 0 && i !== 0) await new Promise(resolve => setTimeout(resolve, 3 * 60 * 1000));
        if (i % 1000 === 0 && i !== 0) await new Promise(resolve => setTimeout(resolve, 6 * 60 * 1000));
        if (i % 1500 === 0 && i !== 0) await new Promise(resolve => setTimeout(resolve, 10 * 60 * 1000));

      } catch (erro) {
        console.error(`❌ Erro com ${contato.primeiro_nome}:`, erro.message);
      }
    }
    console.log('🎯 Disparo finalizado!');
  }).catch((erro) => {
    console.error('❌ Erro ao inicializar WPPConnect:', erro);
  });
}

function dentroDoHorarioPermitido() {
  const agora = new Date();
  const hora = agora.getHours();
  const dia = agora.getDay();

  if (dia === 0) {
    return hora >= 13 && hora < 17; // Domingo
  } else {
    return hora >= 8 && hora < 21; // Segunda a sábado
  }
}