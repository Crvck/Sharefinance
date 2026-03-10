const QRCode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// Puppeteer configuration
const puppeteerConfig = {
    headless: true,
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
    ]
};

function cleanChromiumLocks(baseDir) {
    const lockNames = new Set(['SingletonLock', 'SingletonCookie', 'SingletonSocket']);
    if (!fs.existsSync(baseDir)) {
        return;
    }

    const walk = (dir) => {
        let entries = [];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(fullPath);
                continue;
            }
            if (lockNames.has(entry.name)) {
                try {
                    fs.rmSync(fullPath, { force: true });
                } catch (error) {
                    console.warn(`No se pudo limpiar lock ${fullPath}:`, error.message);
                }
            }
        }
    };

    walk(baseDir);
}

cleanChromiumLocks('/data/nanobot/whatsapp-session');

if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    puppeteerConfig.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
}

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: '/data/nanobot/whatsapp-session'
    }),
    puppeteer: puppeteerConfig
});

client.on('qr', async (qr) => {
    console.log('\n Nuevo QR de WhatsApp generado');

    const qrFilePng = '/data/nanobot/whatsapp-qr.png';
    const qrFileSvg = '/data/nanobot/whatsapp-qr.svg';

    try {
        // High-resolution PNG avoids terminal wrapping/cropping issues.
        await QRCode.toFile(qrFilePng, qr, {
            type: 'png',
            width: 1400,
            margin: 4,
            errorCorrectionLevel: 'H'
        });

        // SVG copy as crisp fallback.
        await QRCode.toFile(qrFileSvg, qr, {
            type: 'svg',
            margin: 2,
            errorCorrectionLevel: 'H'
        });

        console.log(` PNG: ${qrFilePng}`);
        console.log(` SVG: ${qrFileSvg}`);
    } catch (error) {
        console.error('No se pudo guardar archivos QR:', error.message);
    }

    console.log('\n Escanea el archivo PNG o SVG (no el texto de consola)\n');
    console.log('   Pasos:');
    console.log('   1. Abre WhatsApp en tu teléfono');
    console.log('   2. Ve a Configuración > Dispositivos vinculados');
    console.log('   3. Toca "Vincular un dispositivo"');
    console.log('   4. Escanea el QR desde el archivo PNG/SVG\n');
});

client.on('authenticated', () => {
    console.log(' WhatsApp autenticado correctamente');
});

client.on('auth_failure', (msg) => {
    console.error(' Error de autenticación:', msg);
});

client.on('ready', () => {
    console.log(' WhatsApp bridge listo y conectado');
    console.log(' Esperando mensajes...\n');

    const statusPayload = JSON.stringify({ type: 'status', status: 'connected' });
    connections.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(statusPayload);
        }
    });
});

client.on('disconnected', (reason) => {
    console.log(' WhatsApp desconectado:', reason);

    const statusPayload = JSON.stringify({ type: 'status', status: 'disconnected' });
    connections.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(statusPayload);
        }
    });

    process.exit(1);
});

const wss = new WebSocket.Server({ port: 3001 });
const connections = new Set();
const FINANCE_BOT_BALANCE_URL = process.env.FINANCE_BOT_BALANCE_URL || 'http://finance-service:8000/api/bot/balance/';
const FINANCE_BOT_TRANSACTION_URL = process.env.FINANCE_BOT_TRANSACTION_URL || 'http://finance-service:8000/api/bot/transaction/';
const BALANCE_KEYWORDS = /(saldo|balance|ahorros|gastos)/i;

function sanitizeText(input) {
    if (typeof input !== 'string') {
        return '';
    }
    // Remove lone surrogate code points that can crash downstream UTF-8 writes.
    return input.replace(/[\uD800-\uDFFF]/g, '');
}

function extractPhoneCandidates(sender) {
    const raw = (sender || '').split('@')[0].replace(/\D/g, '');
    if (!raw) {
        return [];
    }
    const candidates = [`+${raw}`];
    // WhatsApp in MX may include 521..., while records usually use +52...
    if (raw.startsWith('521') && raw.length > 3) {
        candidates.push(`+52${raw.slice(3)}`);
    }
    return [...new Set(candidates)];
}

async function fetchBalanceBySender(sender) {
    const phones = extractPhoneCandidates(sender);
    for (const phone of phones) {
        try {
            const url = `${FINANCE_BOT_BALANCE_URL}?phone_number=${encodeURIComponent(phone)}`;
            const response = await fetch(url);
            const payload = await response.json();
            if (response.ok && payload.ok) {
                return payload;
            }
        } catch (error) {
            console.error(` Error consultando balance para ${phone}:`, error.message);
        }
    }
    return null;
}

function buildBalanceMessage(data) {
    const shared = data.shared || {};
    const personal = data.personal || {};
    const savings = data.savings || {};
    const summary = data.summary || {};

    const lines = [
        '📊 Resumen de cuenta',
        '',
        '👥 Compartido',
        `- Gastos mes: $${Number(shared.month_spent || 0).toFixed(2)}`,
        `- Gastos total: $${Number(shared.total_spent || 0).toFixed(2)}`,
        `- Ahorros mes: $${Number(savings.shared_month || 0).toFixed(2)}`,
        `- Ahorros total: $${Number(savings.shared_total || 0).toFixed(2)}`,
        '',
        '👤 Personal',
        `- Gastos mes: $${Number(personal.month_spent || 0).toFixed(2)}`,
        `- Gastos total: $${Number(personal.total_spent || 0).toFixed(2)}`,
        `- Ahorros mes: $${Number(savings.personal_month || 0).toFixed(2)}`,
        `- Ahorros total: $${Number(savings.personal_total || 0).toFixed(2)}`,
        '',
        '🔗 Unido (Compartido + Personal)',
        `- Gastos mes: $${Number(summary.month_spent_combined || 0).toFixed(2)}`,
        `- Gastos total: $${Number(summary.total_spent_combined || 0).toFixed(2)}`,
        `- Ahorros mes: $${Number(savings.combined_month || 0).toFixed(2)}`,
        `- Ahorros total: $${Number(savings.combined_total || 0).toFixed(2)}`,
    ];

    return lines.join('\n');
}

function parseQuickExpense(text) {
    const clean = (text || '').trim();
    if (!clean) {
        return null;
    }

    // Format: "taxi 200" or "comida 300.50"
    const conceptFirst = clean.match(/^([A-Za-zÁÉÍÓÚáéíóúÑñ\s]{2,80})\s+(\d+(?:[.,]\d{1,2})?)$/);
    if (conceptFirst) {
        return {
            concept: conceptFirst[1].trim(),
            amount: Number(conceptFirst[2].replace(',', '.')),
        };
    }

    // Format: "200 taxi"
    const amountFirst = clean.match(/^(\d+(?:[.,]\d{1,2})?)\s+([A-Za-zÁÉÍÓÚáéíóúÑñ\s]{2,80})$/);
    if (amountFirst) {
        return {
            concept: amountFirst[2].trim(),
            amount: Number(amountFirst[1].replace(',', '.')),
        };
    }

    return null;
}

async function registerExpenseBySender(sender, concept, amount) {
    const phones = extractPhoneCandidates(sender);
    for (const phone of phones) {
        try {
            const response = await fetch(FINANCE_BOT_TRANSACTION_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone_number: phone,
                    amount,
                    description: concept,
                    type: 'gasto',
                }),
            });
            const payload = await response.json();
            if (response.ok && payload.ok) {
                return payload;
            }
        } catch (error) {
            console.error(` Error registrando gasto para ${phone}:`, error.message);
        }
    }
    return null;
}

wss.on('connection', (ws) => {
    console.log(' Nanobot conectado al bridge');
    connections.add(ws);

    ws.on('close', () => {
        connections.delete(ws);
        console.log(' Nanobot desconectado del bridge');
    });

    ws.on('message', async (data) => {
        try {
            const msg = JSON.parse(data);
            if (msg.type === 'send') {
                const text = typeof msg.text === 'string' ? msg.text : '';
                console.log(` Enviando respuesta a ${msg.to}: ${text.substring(0, 50)}...`);
                
                // Accept any non-empty chat id; WhatsApp can use c.us, g.us, lid, etc.
                if (!msg.to || typeof msg.to !== 'string') {
                    console.error(` ID de chat inválido: ${msg.to}`);
                    return;
                }
                
                const chatId = msg.to;
                await client.sendMessage(chatId, text);
                console.log(' Mensaje enviado correctamente');
            }
        } catch (error) {
            console.error(' Error procesando mensaje:', error.message);
        }
    });
});

client.on('message', async (msg) => {
    try {
        const from = msg.from || '';
        const body = sanitizeText(msg.body);

        // Skip unsupported sources (e.g. newsletters/system channels) to avoid bridge crashes.
        if (!from.endsWith('@c.us') && !from.endsWith('@g.us')) {
            console.log(` Ignorando mensaje no compatible desde: ${from}`);
            return;
        }

        // Ignore groups to keep finance bot focused on direct user chats.
        if (from.endsWith('@g.us')) {
            console.log(` Ignorando mensaje de grupo: ${from}`);
            return;
        }

        console.log(`\n📩 Mensaje recibido de: ${from}`);
        console.log(`   Texto: ${body.substring(0, 100)}`);

        // Ignore empty/placeholder messages that can break downstream prompts.
        if (!body.trim() || body.trim() === '*ⓘ Foto*') {
            console.log(' Ignorando mensaje vacío o de placeholder');
            return;
        }

        const incomingText = body.trim().toLowerCase();
        if (incomingText === 'test') {
            const testHelp = [
                'Hola, ahora me converti en un bot.',
                '',
                'Comandos/mensajes para pruebas:',
                '- Gasté $150 en comida',
                '- Pagué 250 de gasolina',
                '- Taxi 80',
                '- ¿Cual es mi balance?',
                '- Cuanto he gastado',
                '- Hola'
            ].join('\n');

            await client.sendMessage(from, testHelp);
            console.log(' Respuesta de prueba enviada para comando test');
            return;
        }

        const quickExpense = parseQuickExpense(body);
        if (quickExpense && quickExpense.amount > 0) {
            const result = await registerExpenseBySender(from, quickExpense.concept, quickExpense.amount);
            if (result) {
                await client.sendMessage(
                    from,
                    `Gasto registrado: ${quickExpense.concept} por $${quickExpense.amount.toFixed(2)}`
                );
                console.log(' Registro rapido de gasto exitoso');
            } else {
                await client.sendMessage(
                    from,
                    'No pude registrar ese gasto. Verifica que tu numero este registrado e intenta de nuevo.'
                );
                console.log(' Fallo registro rapido de gasto');
            }
            return;
        }

        if (BALANCE_KEYWORDS.test(incomingText)) {
            const balanceData = await fetchBalanceBySender(from);
            if (!balanceData) {
                await client.sendMessage(
                    from,
                    'No pude consultar tu saldo ahora. Verifica que tu numero este registrado y vuelve a intentar.'
                );
                console.log(' No se encontro balance para el remitente');
                return;
            }
            const balanceMsg = buildBalanceMessage(balanceData);
            await client.sendMessage(from, balanceMsg);
            console.log(' Respuesta de saldo/ahorros/gastos enviada');
            return;
        }
        
        const contact = await msg.getContact();
        const chat = await msg.getChat();

        const sender = msg.from;
        const payload = {
            type: 'message',
            sender,
            pn: sender,
            content: sanitizeText(body),
            id: msg.id && msg.id._serialized ? msg.id._serialized : '',
            timestamp: msg.timestamp,
            isGroup: chat.isGroup,
            from: msg.from,
            author: msg.author || msg.from,
            body: msg.body,
            contactName: contact.pushname || contact.name || msg.from
        };

        console.log(`   Enviando a ${connections.size} conexión(es) del nanobot`);
        connections.forEach((ws) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(payload));
            }
        });
    } catch (error) {
        console.error('❌ Error manejando mensaje:', error.message);
    }
});

console.log(' Iniciando WhatsApp Bridge...');
console.log(' WebSocket server en puerto 3001');
console.log(' Esperando codigo QR...\n');

client.initialize();

process.on('SIGINT', async () => {
    console.log('\n Cerrando WhatsApp Bridge...');
    await client.destroy();
    process.exit(0);
});
