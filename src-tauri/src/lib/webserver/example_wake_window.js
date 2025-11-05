// wake_window API 使用示例

const ws = new WebSocket('ws://localhost:8787/ws');

ws.onopen = () => {
  console.log('WebSocket 连接已建立');
  
  // 唤醒窗口
  ws.send(JSON.stringify({
    type: 'call',
    body: {
      id: Date.now().toString(),
      method: 'wake_window'
    }
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('收到消息:', message);
  
  if (message.type === 'reply') {
    if (message.body.status === 'success') {
      console.log('✅ 窗口已成功唤醒');
    } else {
      console.error('❌ 唤醒失败:', message.body.error);
    }
  }
};

ws.onerror = (error) => {
  console.error('WebSocket 错误:', error);
};

ws.onclose = () => {
  console.log('WebSocket 连接已关闭');
};
