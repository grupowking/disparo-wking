const wppconnect = require('@wppconnect-team/wppconnect');
const fs = require('fs');
const csv = require('csv-parser');

const contatos = [];

fs.createReadStream('contatos.csv')
  .pipe(csv())
  .on('data', (row) => {
    contatos.push({
      nome: row.nome.trim(),
      primeiroNome: row.nome.trim().split(' ')[0],
      telefone: `${row.telefone.trim()}@c.us`
    });
  })
  .on('end', () => {
    console.log('✅ Contatos carregados. Iniciando disparo...');
    iniciarWpp();
  });

function iniciarWpp() {
  wppconnect.create({
    session: 'WKing',
    headless: true,
  }).then((client) => start(client));
}

async function start(client) {
  let enviados = 0;
  for (let contato of contatos) {
    if (!dentroDoHorarioPermitido()) {
      console.log('⏸️ Fora do horário permitido. Aguardando...');
      await esperarProximoHorario();
    }

    try {
      // Envia o vídeo
      await client.sendFile(contato.telefone, './namorados2025.mp4', 'namorados2025.mp4', '');
      const horaVideo = new Date().toLocaleString();
      fs.appendFileSync('envios.log', `${horaVideo} - 🎥 Vídeo enviado para ${contato.primeiroNome} (${contato.telefone})\n`);
      console.log(`🎥 Vídeo enviado para ${contato.primeiroNome}`);

      // Aguarda 14 a 20 segundos antes de enviar o texto
      await delay(getIntervaloAleatorio(14000, 20000));

      // Mensagem personalizada
      const mensagem = `🎁 ${contato.primeiroNome}, o presente que vai surpreender quem você ama está na Via Búzios!\nTem opções incríveis pra ele, pra ela, pra celebrar juntos — com bom gosto e muito carinho.\n\n👀 Mas corre, porque os mais desejados estão saindo rápido…\n📍Estamos pertinho do Supermarket. E se preferir, levamos até você!`;

      await client.sendText(contato.telefone, mensagem);
      const horaTexto = new Date().toLocaleString();
      fs.appendFileSync('envios.log', `${horaTexto} - 💬 Texto enviado para ${contato.primeiroNome} (${contato.telefone})\n`);
      console.log(`💬 Texto enviado para ${contato.primeiroNome}`);

      enviados++;
    } catch (error) {
      console.error(`❌ Erro com ${contato.telefone}:`, error);
    }

    // Aguarda antes de passar para o próximo cliente
    await delay(getIntervaloAleatorio(16000, 23000));
  }
  console.log(`\n📦 Total de clientes atendidos: ${enviados}`);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getIntervaloAleatorio(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function dentroDoHorarioPermitido() {
  const agora = new Date();
  const hora = agora.getHours();
  const dia = agora.getDay(); // 0 = domingo, 6 = sábado
  if (dia === 0) return hora >= 8 && hora < 14; // domingo
  return hora >= 8 && hora < 20; // segunda a sábado
}

async function esperarProximoHorario() {
  while (!dentroDoHorarioPermitido()) {
    console.log('🕒 Aguardando 10 minutos para reavaliar o horário...');
    await delay(600000); // 10 minutos
  }
}
