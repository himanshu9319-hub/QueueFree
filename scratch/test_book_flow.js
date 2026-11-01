import http from 'http';
import fs from 'fs';
import { spawn } from 'child_process';

async function main() {
  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const port = 9222;
  
  const chrome = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    '--window-size=1280,900',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'http://127.0.0.1:5173/'
  ]);

  await new Promise(r => setTimeout(r, 2000));

  http.get(`http://127.0.0.1:${port}/json`, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', async () => {
      try {
        const tabs = JSON.parse(data);
        const targetTab = tabs.find(t => t.url.includes('5173')) || tabs[0];
        if (targetTab && targetTab.webSocketDebuggerUrl) {
          const ws = new WebSocket(targetTab.webSocketDebuggerUrl);
          
          ws.onopen = () => {
            ws.send(JSON.stringify({ id: 1, method: "Runtime.enable" }));
            ws.send(JSON.stringify({ id: 2, method: "Page.enable" }));
            
            // 1. Click "Book OPD Token" on landing page
            setTimeout(() => {
              ws.send(JSON.stringify({
                id: 10,
                method: "Runtime.evaluate",
                params: {
                  expression: `(() => {
                    const btns = Array.from(document.querySelectorAll('button'));
                    const bookBtn = btns.find(b => b.innerText && b.innerText.includes('Book OPD'));
                    if (bookBtn) { bookBtn.click(); return "Clicked Book OPD"; }
                    return "Book OPD not found";
                  })()`
                }
              }));
            }, 1200);

            // 2. Click "1-Click Demo Login" on PatientLoginPage
            setTimeout(() => {
              ws.send(JSON.stringify({
                id: 20,
                method: "Runtime.evaluate",
                params: {
                  expression: `(() => {
                    const btns = Array.from(document.querySelectorAll('button'));
                    const demoBtn = btns.find(b => b.innerText && b.innerText.includes('1-Click Demo Login'));
                    if (demoBtn) { demoBtn.click(); return "Clicked 1-Click Demo Login"; }
                    return "Demo login button not found";
                  })()`
                }
              }));
            }, 2500);

            // 3. Click "Book OPD" in sidebar
            setTimeout(() => {
              console.log("Clicking Book OPD tab in sidebar...");
              ws.send(JSON.stringify({
                id: 30,
                method: "Runtime.evaluate",
                params: {
                  expression: `(() => {
                    const btns = Array.from(document.querySelectorAll('button'));
                    const bookNav = btns.find(b => b.innerText && b.innerText.includes('Book OPD'));
                    if (bookNav) { bookNav.click(); return "Clicked Book OPD nav"; }
                    return "Book OPD nav not found";
                  })()`
                }
              }));
            }, 4500);

            // 4. Capture screenshot
            setTimeout(() => {
              ws.send(JSON.stringify({
                id: 40,
                method: "Page.captureScreenshot",
                params: { format: "png" }
              }));
              ws.send(JSON.stringify({
                id: 41,
                method: "Runtime.evaluate",
                params: { expression: "document.querySelector('.book-opd-stepper-container')?.outerHTML?.substring(0, 500) || document.getElementById('root').innerHTML.substring(0, 500)" }
              }));
            }, 6500);
          };

          ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (msg.id === 10 || msg.id === 20 || msg.id === 30) {
              console.log("Action result:", msg.result?.result?.value);
            } else if (msg.id === 40) {
              const buffer = Buffer.from(msg.result.data, 'base64');
              fs.writeFileSync('scratch/screenshot_book_stepper.png', buffer);
              console.log("Saved scratch/screenshot_book_stepper.png");
            } else if (msg.id === 41) {
              console.log("DOM snippet:", msg.result?.result?.value);
            } else if (msg.method === "Runtime.exceptionThrown") {
              console.error("\n>>> EXCEPTION THROWN AT RUNTIME:", JSON.stringify(msg.params.exceptionDetails, null, 2));
            }
          };

          await new Promise(r => setTimeout(r, 8500));
          ws.close();
        }
      } catch (err) {
        console.error("Error:", err);
      }
      chrome.kill();
      process.exit(0);
    });
  }).on('error', err => {
    console.error("Failed to connect:", err);
    chrome.kill();
    process.exit(1);
  });
}

main();
