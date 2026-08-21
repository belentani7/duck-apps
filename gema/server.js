#!/usr/bin/env node

/**
 * 🦆 DUCK - Servidor de Desenvolvimento
 * Servidor HTTP simples para testar a aplicação localmente
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// Configuração
const PORT = 3000;
const HOST = 'localhost';

// Tipos MIME
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

// Criar servidor
const server = http.createServer((req, res) => {
  // Log de requisições
  console.log(`${req.method} ${req.url}`);

  // Evitar path traversal
  let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);

  // Obter extensão do arquivo
  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = mimeTypes[extname] || 'application/octet-stream';

  // Ler e enviar arquivo
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        // Arquivo não encontrado
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <!DOCTYPE html>
          <html lang="pt-BR">
          <head>
            <meta charset="UTF-8">
            <title>404 - Não Encontrado</title>
            <style>
              body {
                font-family: monospace;
                background: #060907;
                color: #00e881;
                padding: 20px;
              }
              h1 { font-size: 2em; }
            </style>
          </head>
          <body>
            <h1>🦆 404 - Arquivo não encontrado</h1>
            <p>Procurando: ${req.url}</p>
            <p><a href="/">Voltar ao início</a></p>
          </body>
          </html>
        `, 'utf-8');
      } else {
        // Outro erro
        res.writeHead(500);
        res.end(`Erro no servidor: ${error}`, 'utf-8');
      }
    } else {
      // Sucesso
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

// Iniciar servidor
server.listen(PORT, HOST, () => {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`🦆 DUCK - Servidor de Desenvolvimento`);
  console.log(`${'='.repeat(50)}`);
  console.log(`\n✅ Servidor iniciado com sucesso!\n`);
  console.log(`🌐 Acesse em: http://${HOST}:${PORT}`);
  console.log(`📁 Diretório: ${__dirname}`);
  console.log(`\n💡 Dicas:`);
  console.log(`   - Pressione Ctrl+C para parar o servidor`);
  console.log(`   - F12 para abrir DevTools`);
  console.log(`   - Console tem acesso a window.duck API`);
  console.log(`\n${'='.repeat(50)}\n`);
});

// Tratamento de erros
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Porta ${PORT} já está em uso!`);
    console.error(`   Tente outra porta: node server.js --port 3001`);
  } else {
    console.error('❌ Erro do servidor:', error);
  }
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Servidor sendo encerrado...');
  server.close(() => {
    console.log('✅ Servidor encerrado');
    process.exit(0);
  });
});
