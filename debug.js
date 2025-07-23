const wppconnect = require('@wppconnect-team/wppconnect');

// --- FOCO DO TESTE ---
// Vamos usar o número que sabemos que existe, mas que está falhando.
const NUMERO_PROBLEMA = '5522992626120';
const ID_WHATSAPP = `${NUMERO_PROBLEMA}@c.us`;
// --------------------

async function diagnostico() {
  console.log('--- INICIANDO SCRIPT DE DIAGNÓSTICO ---');
  try {
    const client = await wppconnect.create({
      session: 'VBConcept',
      headless: true,
      puppeteerOptions: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    });

    console.log('\n[ETAPA 1/4] CONEXÃO');
    console.log('-> Cliente conectado com sucesso.');

    console.log('\n[ETAPA 2/4] SINCRONIZAÇÃO');
    console.log('-> Aguardando 30 segundos para estabilizar a sessão...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    console.log('-> Tempo de sincronização concluído.');

    console.log(`\n[ETAPA 3/4] VERIFICAÇÃO DO NÚMERO: ${ID_WHATSAPP}`);
    try {
      const status = await client.checkNumberStatus(ID_WHATSAPP);
      console.log('-> Resposta do checkNumberStatus:', status);
      if (!status.numberExists) {
        console.error('-> DIAGNÓSTICO: O WhatsApp reportou que este número NÃO EXISTE. O problema pode ser na API ou uma restrição do WhatsApp.');
        return;
      }
      console.log('-> SUCESSO: O número foi encontrado no WhatsApp.');
    } catch (e) {
      console.error('-> FALHA CRÍTICA na verificação de número:', e.message);
      console.error('-> DIAGNÓSTICO: A sessão não está pronta nem para verificar o número. O problema é de sincronização profunda.');
      return;
    }

    console.log(`\n[ETAPA 4/4] ENVIO DA MENSAGEM PARA: ${ID_WHATSAPP}`);
    try {
      const response = await client.sendText(ID_WHATSAPP, 'Olá, Juliana! Esta é uma mensagem de diagnóstico para resolver o problema de envio.');
      console.log('-> Resposta do sendText:', response);
      console.log('\n--- DIAGNÓSTICO FINAL: SUCESSO! ---');
      console.log('A função de envio principal está funcionando. O problema está na lógica de loop/fila do app.js.');
    } catch (e) {
      console.error('-> FALHA CRÍTICA no envio da mensagem:', e.message);
      console.error('\n--- DIAGNÓSTICO FINAL: FALHA ---');
      console.error('Se a verificação na Etapa 3 funcionou mas o envio falhou, o problema é um bug específico na função sendText para este tipo de sessão/número.');
    }

  } catch (e) {
    console.error('💥 Erro geral na inicialização:', e.message);
  }
}

diagnostico();
