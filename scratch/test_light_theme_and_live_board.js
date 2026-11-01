import http from 'http';
import fs from 'fs';
import { spawn } from 'child_process';

async function main() {
  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const port = 9230;
  
  const chrome = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    '--window-size=1280,950',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'http://127.0.0.1:5173/patient/login'
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

            // Step 1: Take screenshot of PatientLoginPage in Light Theme
            setTimeout(() => {
              ws.send(JSON.stringify({
                id: 10,
                method: "Page.captureScreenshot",
                params: { format: "png" }
              }));
            }, 1000);

            // Step 2: Click 1-Click Demo Login
            setTimeout(() => {
              ws.send(JSON.stringify({
                id: 20,
                method: "Runtime.evaluate",
                params: {
                  expression: `(() => {
                    const btns = Array.from(document.querySelectorAll('button'));
                    const demoBtn = btns.find(b => b.innerText && b.innerText.includes('1-Click Demo Login'));
                    if (demoBtn) { demoBtn.click(); return 'Clicked 1-Click Demo Login'; }
                    return 'Not found';
                  })()`
                }
              }));
            }, 1800);

            // Step 3: Check dashboard text and verify Live Board elements exist
            setTimeout(() => {
              ws.send(JSON.stringify({
                id: 30,
                method: "Runtime.evaluate",
                params: {
                  expression: `(() => {
                    const hasLiveBoardBanner = !!document.querySelector('.live-board-promo-banner');
                    const hasSidebarLiveBoard = Array.from(document.querySelectorAll('.patient-nav-item')).some(b => b.innerText.includes('Live TV Board'));
                    const hasTopBarLiveBoard = Array.from(document.querySelectorAll('.topbar-display-btn')).some(b => b.innerText.includes('Live Board'));
                    const sidebarBg = window.getComputedStyle(document.querySelector('.patient-sidebar')).backgroundColor;
                    const bodyBg = window.getComputedStyle(document.querySelector('.patient-app-wrapper')).backgroundColor;
                    return {
                      hasLiveBoardBanner,
                      hasSidebarLiveBoard,
                      hasTopBarLiveBoard,
                      sidebarBg,
                      bodyBg,
                      bodyTextPreview: document.body.innerText.slice(0, 400)
                    };
                  })()`
                }
              }));
            }, 3500);

            // Step 4: Take screenshot of Patient Dashboard in Light Theme
            setTimeout(() => {
              ws.send(JSON.stringify({
                id: 40,
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
            if (msg.id === 10 && msg.result?.data) {
              fs.writeFileSync("scratch/screenshot_patient_login_light.png", Buffer.from(msg.result.data, 'base64'));
              console.log("Saved scratch/screenshot_patient_login_light.png");
            }
            if (msg.id === 20) {
              console.log("Step 2 Login:", msg.result?.result?.value);
            }
            if (msg.id === 30) {
              console.log("Step 3 Dashboard Evaluation:\n", JSON.stringify(msg.result?.result?.value, null, 2));
            }
            if (msg.id === 40 && msg.result?.data) {
              fs.writeFileSync("scratch/screenshot_patient_dashboard_light.png", Buffer.from(msg.result.data, 'base64'));
              console.log("Saved scratch/screenshot_patient_dashboard_light.png");
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
