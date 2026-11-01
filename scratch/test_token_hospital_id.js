import http from 'http';
import fs from 'fs';
import { spawn } from 'child_process';

async function main() {
  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const port = 9229;
  
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

            // Step 1: Set queuefree-token with hospital = 10 (integer, exactly what API returns)
            setTimeout(() => {
              ws.send(JSON.stringify({
                id: 10,
                method: "Runtime.evaluate",
                params: {
                  expression: `(() => {
                    localStorage.setItem('queuefree-token', JSON.stringify({
                      id: 42,
                      token_number: 'CARDIO-003',
                      hospital: 10,
                      hospital_name: 'DEMO General Hospital',
                      doctor: 20,
                      doctor_name: 'Dr. Meera Kapoor'
                    }));
                    window.location.reload();
                    return 'Saved token with hospital: 10 and reloaded';
                  })()`
                }
              }));
            }, 1000);

            // Step 2: Check page text and ensure NO ErrorBoundary error
            setTimeout(() => {
              ws.send(JSON.stringify({
                id: 50,
                method: "Runtime.evaluate",
                params: {
                  expression: `document.body.innerText`
                }
              }));
            }, 3500);

            setTimeout(() => {
              ws.send(JSON.stringify({
                id: 99,
                method: "Page.captureScreenshot",
                params: { format: "png" }
              }));
            }, 4500);
          };

          ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (msg.method === "Runtime.exceptionThrown") {
              console.error("PAGE EXCEPTION:", JSON.stringify(msg.params.exceptionDetails, null, 2));
            }
            if (msg.method === "Runtime.consoleAPICalled") {
              console.log("CONSOLE LOG:", msg.params.type, msg.params.args.map(a => a.value || a.description).join(' '));
            }
            if (msg.id === 10) console.log("Step 1:", msg.result?.result?.value);
            if (msg.id === 50) {
              const text = msg.result?.result?.value || '';
              console.log("Step 2 (Body text preview):\n", text.slice(0, 300));
              if (text.includes('Something went wrong') || text.includes('TypeError')) {
                console.error("FAILED! Error boundary was triggered!");
              } else {
                console.log("SUCCESS! No error boundary triggered.");
              }
            }
            if (msg.id === 99 && msg.result?.data) {
              fs.writeFileSync("scratch/screenshot_fix_verification.png", Buffer.from(msg.result.data, 'base64'));
              console.log("Screenshot saved to scratch/screenshot_fix_verification.png");
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
