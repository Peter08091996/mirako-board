const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const DATA_FILE = path.join(__dirname, 'data.json');

// 默认数据：与前端保持一致
const DEFAULT_DATA = {
  members: [
    { id: 'm1', name: 'Peter', abbr: 'P' },
    { id: 'm2', name: '小林', abbr: '林' },
    { id: 'm3', name: '阿伟', abbr: '伟' },
    { id: 'm4', name: 'Max',  abbr: 'M' },
    { id: 'm5', name: 'Anna', abbr: 'A' }
  ],
  tasks: [],
  filterMemberId: null,
  myMemberId: null
};

let data = { ...DEFAULT_DATA };

function loadData() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      const saved = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      data = { ...DEFAULT_DATA, ...saved };
    } catch (e) {
      console.log('读取数据文件失败，使用默认数据');
    }
  }
}

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

loadData();

app.use(express.static(__dirname));
app.use(express.json({ limit: '1mb' }));

// REST API 兜底
app.get('/api/data', (req, res) => res.json(data));

function broadcast(msg, excludeWs) {
  const payload = JSON.stringify(msg);
  wss.clients.forEach(client => {
    if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

wss.on('connection', ws => {
  // 连上即推送全量数据
  ws.send(JSON.stringify({ type: 'init', data }));

  ws.on('message', raw => {
    try {
      const msg = JSON.parse(raw);
      if (msg.type === 'update') {
        data = msg.data;
        saveData();
        broadcast({ type: 'sync', data }, ws);
      }
    } catch (e) {
      // 忽略非法消息
    }
  });
});

const PORT = process.env.PORT || 3456;
server.listen(PORT, () => {
  console.log('\n  mirako server running');
  console.log('  → http://localhost:' + PORT);
  console.log('  同一局域网内的同事可通过你的 IP 访问');
  console.log();
});
