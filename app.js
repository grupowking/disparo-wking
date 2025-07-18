const wppconnect = require('@wppconnect-team/wppconnect');
const fs = require('fs');
const csv = require('csv-parser');

// Configurações
const INTERVALO_MIN = 75000; // 55 segundos
const INTERVALO_MAX = 90000; // 90 segundos

const MENSAGEM_TEXTO = `🎁 {primeiro_nome}, tem uma surpresa especial esperando por você aqui na Via Búzios 😍

A gente preparou isso com muito carinho pra nossa clientela fiel… e claro que você não podia ficar de fora!

Quer saber o que é? Responde aqui com “quero meu presente” que eu te explico 👀`;

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
    session: 'VBConcept',
    headless: false,
    qrTimeout: 0,
    autoClose: 0,
    puppeteerOptions: puppeteerConfig,
  }).then(async (client) => {

    // Listener para mensagens recebidas
    client.onMessage(async (message) => {
      if (!message.from || !message.body) return;

      const texto = message.body.toLowerCase().trim();
      const textoNormalizado = texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      const variacoes = [
        'quero meu presente',
        'quero o presente',
        'quero presente',
        'meu presente',
        'cadê meu presente',
        'cadê o presente',
        'cade meu presente',
        'cade o presente'
      ];

      if (variacoes.some(v => textoNormalizado.includes(v))) {
        try {
          await client.sendText(message.from, `🎉 Presente liberado!

Você acabou de desbloquear 15% OFF pra usar nas lojas Via Búzios até 31/07.

É só mostrar esse cupom no caixa, combinado? 🧡`);

          await client.sendFile(
            message.from,
            'C:\\Users\\Via\\Documents\\GitHub\\disparo-wking\\cupom.mp4',
            'cupom.mp4',
            'Cupom de 15% OFF - válido até 31/07'
          );

          console.log(`🎁 Cupom em vídeo enviado para ${message.from}`);
        } catch (erro) {
          console.error(`❌ Erro ao enviar cupom para ${message.from}:`, erro.message);
        }
      }
    });

    // Início do disparo
    for (let i = 0; i < contatos.length; i++) {
      const contato = contatos[i];
      if (!dentroDoHorarioPermitido()) {
        console.log("⏳ Fora do horário permitido. Aguardando 5min...");
        await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
        i--;
        continue;
      }

      try {
        console.log(`📤 Enviando para ${contato.primeiro_nome}...`);
        const mensagemPersonalizada = MENSAGEM_TEXTO.replace('{primeiro_nome}', contato.primeiro_nome);
        await client.sendText(contato.telefone, mensagemPersonalizada);

        const espera = intervaloAleatorio();
        console.log(`✅ Mensagem enviada para ${contato.primeiro_nome}. Aguardando ${espera / 1000}s...`);
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
    return hora >= 9 && hora < 14; // Domingo
  } else {
    return hora >= 8 && hora < 21; // Segunda a sábado
  }
}
