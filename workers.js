function convertTimeToStr(time) {
  return time < 10 ? '0' + time : time.toString();
}

function secToData(seconds) {
  const hours = Math.floor(seconds / 3600) % 24;
  const days = Math.floor(seconds / 86400);
  return `${convertTimeToStr(days)}天${convertTimeToStr(hours)}小时`;
}

function strOfSize(size) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let level = 0;
  while (size >= 1024 && level < units.length - 1) {
      size /= 1024;
      level++;
  }
  return `${Math.floor(size)}.${Math.floor((size % 1) * 1000)} ${units[level]}`;
}

async function getFilenameFromUrl(url) {
  if (url.includes("sub?target=")) {
      const pattern = /url=([^&]*)/;
      const match = url.match(pattern);
      if (match) {
          const encodedUrl = match[1];
          const decodedUrl = decodeURIComponent(encodedUrl);
          return await getFilenameFromUrl(decodedUrl);  // 递归调用
      }
  } else if (url.includes("api/v1/client/subscribe?token")) {
      if (!url.includes("&flag=clash")) {
          url += "&flag=clash";
      }
      try {
          const response = await fetch(url);
          const contentDisposition = response.headers.get('Content-Disposition');
          if (contentDisposition) {
              const pattern = /filename\*=UTF-8''(.+)/;
              const result = contentDisposition.match(pattern);
              if (result) {
                  let filename = decodeURIComponent(result[1]);
                  filename = filename.replace("%20", " ").replace("%2B", "+");
                  return filename;
              }
          }
      } catch (error) {
          return '';
      }
  } else {
      return '';
  }
  return '';
}

async function subInfo(inputText) {
  const headers = { 'User-Agent': 'ClashforWindows/0.18.1' };
  const urlsList = inputText.match(/https?:\/\/[^\s]+/g);

  if (!urlsList || urlsList.length === 0) {
    return '<p>未查找到有效订阅链接</p>';
  } else if (urlsList.length > 150) {
    return '<p>订阅链接过多，单次可查询数量最大为150，请合理使用</p>';
  }

  let finalOutput = `
    <table style="width: 100%; border-collapse: collapse; margin-top: 20px; text-align: left;">
      <thead>
        <tr style="background-color: #f2f2f2;">
          <th>订阅链接（点击复制）</th>
          <th>机场名</th>
          <th>已用上行</th>
          <th>已用下行</th>
          <th>剩余</th>
          <th>总共</th>
          <th>过期时间</th>
          <th>剩余时间</th>
        </tr>
      </thead>
      <tbody>
  `;

  // 收集所有查询的 Promise
  const promises = urlsList.map(async (subUrl) => {
    const filename = await getFilenameFromUrl(subUrl);
    try {
      const infoResponse = await fetch(subUrl, { headers });
      if (infoResponse.status === 200) {
        const info = infoResponse.headers.get('subscription-userinfo');
        const infoNum = info.match(/\d+/g);

        if (infoNum) {
          const currentTime = Math.floor(Date.now() / 1000);
          const airName = filename ? filename : '未知';
          let outputText = `
            <tr>
              <td>${subUrl}</td>
              <td>${airName}</td>
              <td>${strOfSize(Number(infoNum[0]))}</td>
              <td>${strOfSize(Number(infoNum[1]))}</td>
              <td>${strOfSize(Number(infoNum[2]) - Number(infoNum[1]) - Number(infoNum[0]))}</td>
              <td>${strOfSize(Number(infoNum[2]))}
          `;

          if (infoNum.length === 4) {
            const expiryDate = new Date((Number(infoNum[3]) + 28800) * 1000).toISOString().slice(0, 10);
            if (currentTime <= Number(infoNum[3])) {
              const timeLeft = Number(infoNum[3]) - currentTime;
              outputText += `
                <td>${expiryDate}</td>
                <td>${secToData(timeLeft)}</td>
              `;
            } else {
              outputText += `<td>${expiryDate}</td><td>已过期</td>`;
            }
          } else {
            outputText += `<td>没有说明</td><td>没有说明</td>`;
          }

          finalOutput += outputText + '</tr>';
        } else {
          finalOutput += `
            <tr>
              <td colspan="8">${subUrl}    无流量信息</td>
            </tr>
          `;
        }
      } else {
        finalOutput += `
          <tr>
            <td colspan="8">${subUrl}    无法访问</td>
          </tr>
        `;
      }
    } catch (error) {
      finalOutput += `
        <tr>
          <td colspan="8">${subUrl}    连接错误</td>
        </tr>
      `;
    }
  });

  await Promise.all(promises);

  finalOutput += '</tbody></table>';
  return finalOutput;
}


addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);

  if (request.method === 'POST' && url.pathname === '/api/query') {
      const requestBody = await request.json();
      const urlToCheck = requestBody.url;
      const result = await subInfo(urlToCheck);

      return new Response(result, {
          headers: { 'Content-Type': 'text/html;charset=UTF-8' }
      });
  }

  const html = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>批量流量查询</title>
      <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f9; display: flex; flex-direction: column; justify-content: flex-start; align-items: stretch; height: 100vh; width: 100%; }
          h1 { color: #333; font-size: 28px; margin: 20px 0; padding: 10px; text-align: center; }
          .form-container { width: 100%; padding: 20px; background-color: white; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1); box-sizing: border-box; margin-bottom: 20px; text-align: center; }
          
          /* 输入框 */
          textarea { 
            width: 80%; 
            min-height: 100px; 
            max-height: 200px; 
            padding: 10px; 
            margin: 10px 0; 
            border: 2px solid #ccc; 
            border-radius: 8px; 
            font-size: 16px; 
            resize: both; 
            overflow-y: auto;  /* 允许垂直方向滚动 */
            overflow-x: hidden; /* 禁止水平方向滚动 */
            box-sizing: border-box; 
          }
        
          button { 
              padding: 10px 20px; 
              background-color: #4CAF50; 
              color: white; 
              border: none; 
              border-radius: 5px; 
              cursor: pointer; 
              font-size: 16px; 
              transition: background-color 0.3s; 
              margin-top: 10px; 
          }
  
          button:hover { background-color: #45a049; }
  
          /* 表格样式 */
          table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-top: 20px; 
              text-align: left; 
              table-layout: auto; /* 让表格宽度根据内容自动调整 */
          }
          th, td { 
              padding: 10px; 
              text-align: left; 
              border: 1px solid #ddd; 
              word-wrap: break-word;
              white-space: nowrap; /* 不换行 */
              cursor: pointer; /* 添加点击效果 */
          }
  
          th { 
              background-color: #f2f2f2; 
              color: #333; 
              resize: horizontal; /* 列头支持水平调整 */
              overflow: hidden;
              min-width: 50px; /* 设置最小宽度 */
          }
  
          td {
              overflow: hidden; /* 超出部分隐藏 */
              text-overflow: ellipsis; /* 超出部分显示省略号 */
              max-width: 200px; /* 设置最大宽度限制 */
          }
  
          td[contenteditable] {
              outline: none;
          }
  
          /* 鼠标悬停时显示完整内容 */
          td:hover {
              overflow: visible;
              text-overflow: unset;
              background-color: #f9f9f9;
              cursor: pointer;
              white-space: normal; /* 显示完整内容 */
          }
  
          /* 响应式设计 */
          @media (max-width: 768px) { 
              body { padding: 10px; } 
              textarea { width: 100%; } 
              button { width: 100%; } 
          }
  
          /* 复制成功提示文本 */
          .copy-notice {
              display: none;
              position: fixed;
              bottom: 20px; /* 让提示出现在屏幕底部 */
              left: 50%;
              transform: translateX(-50%);
              padding: 10px 20px;
              background-color: #4CAF50;
              color: white;
              border-radius: 5px;
              font-size: 16px;
              transition: opacity 0.5s ease-out;
          }
  
      </style>
  </head>
  <body>
  
      <h1>批量流量查询</h1>
      <div id="buttons-container" style="display: flex; justify-content: center; gap: 10px; margin-top: 20px;">
          <a href="https://t.me/helloworld_1024" target="_blank" style="flex: 0 1 auto; padding: 8px 12px; font-size: 14px; text-decoration: none; background-color: #007BFF; color: white; border-radius: 5px; text-align: center;">你好世界 - IOS频道</a>
          <a href="https://t.me/CitizenScyu" target="_blank" style="flex: 0 1 auto; padding: 8px 12px; font-size: 14px; text-decoration: none; background-color: #007BFF; color: white; border-radius: 5px; text-align: center;">麦克阿象 - 安卓频道</a>
          <a href="https://t.me/hjfork" target="_blank" style="flex: 0 1 auto; padding: 8px 12px; font-size: 14px; text-decoration: none; background-color: #007BFF; color: white; border-radius: 5px; text-align: center;">我是垃圾 - 大人频道</a>
      </div>
      

  
      <div class="form-container">
          <form id="query-form" method="POST" style="width: 100%; display: flex; flex-direction: column; align-items: center;">
              <textarea name="url" id="url-input" placeholder="输入订阅链接"></textarea>
              <button type="submit">开始查询</button>
          </form>
      </div>
  
      <h2>查询结果：</h2>
      <div id="result-container">
          <!-- 查询结果的表格内容会在这里展示 -->
      </div>
  
      <div id="copy-notice" class="copy-notice">内容已复制！<br>看片频道 @hsck666</div>
  
      <script>
            document.getElementById('query-form').addEventListener('submit', async function(event) {
              event.preventDefault();
              event.stopImmediatePropagation();
          
              const button = event.target.querySelector('button');
              const url = document.getElementById('url-input').value;
              button.disabled = true;
              button.innerHTML = "正在查询...";
              document.getElementById('result-container').innerHTML = '<a href="https://t.me/hjfork" target="_blank" style="text-align: center; display: block;">👉<font color="#FF0000">点这里探索绝世功法，不可外传</font></a>';
          
              try {
                  const result = await fetch('/api/query', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ url })
                  });
          
                  const resultText = await result.text();
                  document.getElementById('result-container').innerHTML = resultText;
              } catch (error) {
                  document.getElementById('result-container').innerHTML = '查询失败，请稍后再试';
              } finally {
                  button.disabled = false;
                  button.innerHTML = "开始查询";
              }
          });
          
  
          async function copyToClipboard(text) {
              try {
                  await navigator.clipboard.writeText(text);
                  showCopyNotice(text); 
              } catch (err) {
                  console.error('复制失败:', err);
                  alert('复制失败，请重试');
              }
          }
  
          function showCopyNotice(text) {
              const notice = document.getElementById('copy-notice');
              notice.style.display = 'block';
              setTimeout(() => {
                  notice.style.opacity = '0'; // 使用透明度渐变
                  setTimeout(() => {
                      notice.style.display = 'none';
                      notice.style.opacity = '1'; // 恢复透明度
                  }, 500);
              }, 1500); // 显示1.5秒后渐隐
          }
  
          document.getElementById('result-container').addEventListener('click', function(event) {
              if (event.target.tagName === 'TD') {
                  const text = event.target.textContent.trim();
                  if (text) {
                      copyToClipboard(text);
                  }
              }
          });
      </script>
  
  </body>
  </html>
  
  `;
  
  return new Response(html, {
      headers: { 'Content-Type': 'text/html;charset=UTF-8' }
  });
}
