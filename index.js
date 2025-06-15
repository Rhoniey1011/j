import fs from "fs";
import axios from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";

const NETWORK_CHANNEL_IDS = {
  "Sui": "1037811694564560966"
};

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateXSuperProperties(version, build, locale) {
  const properties = {
    os: "Windows",
    browser: "Chrome",
    device: "",
    system_locale: locale,
    browser_user_agent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36`,
    browser_version: version,
    os_version: "10",
    referrer: "",
    referring_domain: "",
    referrer_current: "",
    referring_domain_current: "",
    release_channel: "stable",
    client_build_number: build,
    client_event_source: null
  };

  return Buffer.from(JSON.stringify(properties)).toString("base64");
}

function getHeaders(token) {
  const chromeVersions = ["114.0.0.0", "115.0.0.0", "116.0.0.0", "123.0.0.0"];
  const buildNumbers = [272073, 273362, 271899, 274010];
  const locales = ["en-US", "en-GB", "id-ID"];

  const version = getRandomItem(chromeVersions);
  const build = getRandomItem(buildNumbers);
  const locale = getRandomItem(locales);

  return {
    "Authorization": token,
    "Content-Type": "application/json",
    "User-Agent": `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/${version} Safari/537.36`,
    "X-Super-Properties": generateXSuperProperties(version, build, locale),
    "X-Discord-Locale": locale,
    "Origin": "https://discord.com",
    "Referer": "https://discord.com/channels/@me"
  };
}


function getAxiosWithProxy(proxyString, token) {
  if (!proxyString) return axios.create({ headers: getHeaders(token) });

  let proxyUrlString = proxyString.trim();
  if (!/^https?:\/\//i.test(proxyUrlString)) {
    proxyUrlString = "http://" + proxyUrlString;
  }

  const proxyUrl = new URL(proxyUrlString);
  const auth = proxyUrl.username && proxyUrl.password ? `${proxyUrl.username}:${proxyUrl.password}@` : "";
  const proxyForAgent = `http://${auth}${proxyUrl.hostname}:${proxyUrl.port}`;

  const httpsAgent = new HttpsProxyAgent(proxyForAgent);

  return axios.create({
    httpsAgent,
    headers: getHeaders(token), // <-- panggil fungsi getHeaders di sini
  });
}

async function sendFaucetMessage(discordToken, walletAddress, channelId, axiosInstance) {
  try {
    const message = `!faucet ${walletAddress}`;

    await axiosInstance.post(
      `https://discord.com/api/v9/channels/${channelId}/messages`,
      { content: message }
    );

    console.log(`✅ Sent faucet message for wallet ${walletAddress}`);
  } catch (error) {
    console.error(`❌ Error for ${walletAddress}:`, error.response?.data || error.message);
  }
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  if (!fs.existsSync("./accounts.json")) {
    console.error("❌ accounts.json not found.");
    return;
  }

  if (!fs.existsSync("./proxy.txt")) {
    console.error("❌ proxy.txt not found.");
    return;
  }

  const accounts = JSON.parse(fs.readFileSync("./accounts.json", "utf-8"));
  const proxies = fs.readFileSync("./proxy.txt", "utf-8").split("\n").map(p => p.trim()).filter(Boolean);
  const channelId = NETWORK_CHANNEL_IDS["Sui"];

  while (true) {
    console.log("\n🚀 Starting faucet claim for all accounts...\n");

    for (let i = 0; i < accounts.length; i++) {
      const { discord_token, wallet_address } = accounts[i];
      const proxy = proxies[i % proxies.length];
	  
	  console.log(`🔗 Using proxy: ${proxy}`);
	  
      if (!discord_token || !wallet_address) {
        console.warn("⚠️ Incomplete data, skipping...\n");
        continue;
      }

      const axiosInstance = getAxiosWithProxy(proxy, discord_token);

      console.log(`💰 Wallet ${wallet_address}`);
      await sendFaucetMessage(discord_token, wallet_address, channelId, axiosInstance);

      if (i < accounts.length - 1) {
        const delay = Math.floor(Math.random() * (20000 - 13000 + 1)) + 13000;
        console.log(`⏳ Waiting ${Math.floor(delay / 1000)}s before next wallet...`);
        await wait(delay);
      }
    }

    console.log("\n⏰ All accounts are processed, waiting 6 hours before the next loop...");
    await wait(6 * 60 * 60 * 1000);
  }
}

main();
