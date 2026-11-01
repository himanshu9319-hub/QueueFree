import http from 'http';
import fs from 'fs';
import { spawn } from 'child_process';

async function main() {
  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const port = 9225;
  
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

            // 1. Set patient session in localStorage and navigate to /?portal=display
            setTimeout(() => {
              ws.send(JSON.stringify({
                id: 10,
                method: "Runtime.evaluate",
                params: {
                  expression: `(() => {
                    localStorage.setItem('queuefree-patient-session', JSON.stringify({
                      id: 1,
                      name: 'Priya Sharma',
                      phone: '+91 91234 56780',
                      email: 'demo.patient@queuefree.in',
                      token: 'fake-jwt-patient'
                    }));
                    window.location.href = 'http://127.0.0.1:5173/?portal=display';
                  })()`
                }
              }));
            }, 1000);

            // 2. Wait for page load and evaluate
            setTimeout(() => {
              ws.send(JSON.stringify({
                id: 50,
                method: "Runtime.evaluate",
                params: {
                  expression: `document.body.innerText`
                }
              }));
            }, 3000);

            setTimeout(() => {
              ws.send(JSON.stringify({
                id: 99,
                method: "Page.captureScreenshot",
                params: { format: "png" }
              }));
            }, 4000);
          };

          ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (msg.method === "Runtime.exceptionThrown") {
              console.error("PAGE EXCEPTION:", JSON.stringify(msg.params.exceptionDetails, null, 2));
            }
            if (msg.method === "Runtime.consoleAPICalled") {
              console.log("CONSOLE LOG:", msg.params.type, msg.params.args.map(a => a.value || a.description).join(' '));
            }
            if (msg.id === 50) {
              console.log("BODY INNER TEXT:\n", msg.result?.result?.value);
            }
            if (msg.id === 99 && msg.result?.data) {
              fs.writeFileSync("scratch/screenshot_portal_display_patient.png", Buffer.from(msg.result.data, 'base64'));
              console.log("Screenshot saved to scratch/screenshot_portal_display_patient.png");
              chrome.kill();
              process.exit(0);
            }
          };
        }
      } catch (e) {
        console.error("Error connecting CDP:", e);
        chrome.kill();
      }
    });
  });
}

main().catch(console.error);
