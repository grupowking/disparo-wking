const wppconnect = require('@wppconnect-team/wppconnect');

// --- IMPORTANTE: COLOQUE AQUI UM NÚMERO QUE VOCÊ SABE QUE EXISTE ---
const NUMERO_TESTE = '5522981260708'; // Exemplo: Gabriel Cintra
// ----------------------------------------------------------------

async function testeSimples() {
  try {
    const client = await wppconnect.create({
      session: 'VBConcept',
      headless: true, // Mantenha true para usar a sessão já logada
      puppeteerOptions: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    });

    console.log('🔌 Cliente conectado. Tentando enviar mensagem de teste...');

    // Atraso para garantir a sincronização
    await new Promise(resolve => setTimeout(resolve, 20000)); 

    const response = await client.sendText(`${NUMERO_TESTE}@c.us`, 'Olá! Isto é uma mensagem de teste.');
    
    console.log('✅ Resposta da API:', response);
    console.log('✅ Mensagem de teste enviada com sucesso!');

  } catch (e) {
    console.error('💥 Falha no teste:', e.message);
  }
}

testeSimples();
