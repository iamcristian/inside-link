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
    defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
  });

  const page = await browser.newPage();

  const pagesToCapture = [
    {
      url: "http://localhost:3005/admin",
      output: path.join(screenshotsDir, "admin-dashboard.png"),
      title: "Admin Dashboard (Links Management & QR)",
    },
    {
      url: "http://localhost:3005/admin/analytics",
      output: path.join(screenshotsDir, "admin-analytics.png"),
      title: "Admin Analytics (Telemetry & Trends)",
    },
  ];

  for (const item of pagesToCapture) {
    console.log(`Navigating to ${item.title}: ${item.url}`);
    try {
      await page.goto(item.url, { waitUntil: "networkidle2", timeout: 30000 });
      await new Promise((r) => setTimeout(r, 2000));
      await page.screenshot({ path: item.output, fullPage: false });
      console.log(`Saved: ${item.output}`);
    } catch (err) {
      console.error(`Error capturing ${item.title}:`, err.message);
    }
  }

  await browser.close();
  console.log("Admin screenshots captured successfully!");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
