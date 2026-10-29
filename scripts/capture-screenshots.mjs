import puppeteer from "puppeteer-core";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const screenshotsDir = path.resolve(__dirname, "../docs/screenshots");

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

async function run() {
  console.log("Launching Chrome at:", chromePath);
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    defaultViewport: { width: 1280, height: 800, deviceScaleFactor: 2 },
  });

  const page = await browser.newPage();

  const pagesToCapture = [
    {
      url: "https://www.cristianarando.dev/links/",
      output: path.join(screenshotsDir, "public-directory.png"),
      title: "Public Links Directory",
    },
    {
      url: "https://www.cristianarando.dev/proyecto-guia-turistica/",
      output: path.join(screenshotsDir, "hub-preview.png"),
      title: "Project Micro-Landing (HUB)",
    },
    {
      url: "https://www.cristianarando.dev/login/",
      output: path.join(screenshotsDir, "admin-login.png"),
      title: "Admin Login Console",
    },
    {
      url: "https://www.cristianarando.dev/presupuesto-confidencial/",
      output: path.join(screenshotsDir, "pin-protection.png"),
      title: "PIN Protection Interstitial",
    },
    {
      url: "https://www.cristianarando.dev/enlace-expirado/",
      output: path.join(screenshotsDir, "expired-link.png"),
      title: "Expired Link Notice (HTTP 410)",
    },
  ];

  for (const item of pagesToCapture) {
    console.log(`Navigating to ${item.title}: ${item.url}`);
    try {
      await page.goto(item.url, { waitUntil: "networkidle2", timeout: 30000 });
      await new Promise((r) => setTimeout(r, 1000));
      await page.screenshot({ path: item.output, fullPage: false });
      console.log(`Saved: ${item.output}`);
    } catch (err) {
      console.error(`Error capturing ${item.title}:`, err.message);
    }
  }

  await browser.close();
  console.log("Screenshots captured successfully!");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
