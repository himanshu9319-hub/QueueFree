import http from 'http';
import fs from 'fs';
import { spawn } from 'child_process';

async function main() {
  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const port = 9228;
  
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

            // Step 1: Click 1-Click Demo for Priya Sharma
            setTimeout(() => {
              ws.send(JSON.stringify({
                id: 10,
                method: "Runtime.evaluate",
                params: {
                  expression: `(() => {
                    const cards = Array.from(document.querySelectorAll('.role-card, .direct-role-card, div'));
                    const citizenCard = cards.find(c => c.innerText && c.innerText.includes('Priya Sharma (Patient Demo)'));
                    if (citizenCard) {
                      const btn = Array.from(citizenCard.querySelectorAll('button')).find(b => b.innerText && b.innerText.includes('1-Click Demo'));
                      if (btn) { btn.click(); return 'Clicked Patient 1-Click Demo'; }
                    }
                    return 'Not found';
                  })()`
                }
              }));
            }, 1000);

            // Step 2: Now find and click the "Live Board" link in the top bar
            setTimeout(() => {
              ws.send(JSON.stringify({
                id: 20,
                method: "Runtime.evaluate",
                params: {
                  expression: `(() => {
                    const links = Array.from(document.querySelectorAll('a, button'));
                    const liveBoard = links.find(el => el.innerText && el.innerText.trim().includes('Live Board'));
                    if (liveBoard) {
                      const href = liveBoard.getAttribute('href');
                      // Simulate clicking it (or window.location = href)
                      window.location.href = href;
                      return 'Navigated to: ' + href;
                    }
                    return 'Live Board link not found';
                  })()`
                }
              }));
            }, 2500);

            // Step 3: Check what is rendered after clicking Live Board
            setTimeout(() => {
              ws.send(JSON.stringify({
                id: 50,
                method: "Runtime.evaluate",
                params: {
                  expression: `document.body.innerText`
                }
              }));
            }, 4500);

            setTimeout(() => {
              ws.send(JSON.stringify({
                id: 99,
                method: "Page.captureScreenshot",
                params: { format: "png" }
              }));
            }, 5500);
          };

          ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (msg.method === "Runtime.exceptionThrown") {
              console.error("PAGE EXCEPTION:", JSON.stringify(msg.params.exceptionDetails, null, 2));
            }
            if (msg.method === "Runtime.consoleAPICalled") {
              console.log("CONSOLE LOG:", msg.params.type, msg.params.args.map(a => a.value || a.description).join(' '));
            }
            if (msg.id === 10) console.log("Step 1 (Login):", msg.result?.result?.value);
            if (msg.id === 20) console.log("Step 2 (Click Live Board):", msg.result?.result?.value);
            if (msg.id === 50) {
              console.log("Step 3 (Body text):\n", msg.result?.result?.value);
            }
            if (msg.id === 99 && msg.result?.data) {
              fs.writeFileSync("scratch/screenshot_user_action.png", Buffer.from(msg.result.data, 'base64'));
              console.log("Screenshot saved to scratch/screenshot_user_action.png");
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
