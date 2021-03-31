import chromeAws from "chrome-aws-lambda";

const CACHE_BROWSER = 60 * 60 * 12; // 12 hours
const CACHE_CDN = 60 * 60 * 24 * 3; // 3 days

export default async function handler(req, res) {
  console.log("HTTP", req.url);
  generateImage(req, res);
}

async function generateImage(req, res) {
  const width = req.query.width || 350;
  const height = req.query.height || 1200;

  try {
    const template = createTemplate({
      page: 'EPJBulvar',
      width,
      height,
    });
    const file = await createImage(
      {
        content: template,
        wait: parseInt(String(req.query.wait || 2000))
      },
      {
        defaultViewport: {
          deviceScaleFactor: 1.5,
          width,
          height,
        }
      }
    );

    res.statusCode = 200;
    res.setHeader("Content-Type", "image/png");
    res.setHeader('Cache-Control', `max-age=${CACHE_BROWSER}, s-maxage=${CACHE_CDN}, public`);
    res.end(file);
  } catch (e) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/html");
    res.end(`<h1>Server Error</h1><p>Sorry, there was a problem</p><p>${e.message}</p>`);

    console.error(e);
    console.error(e.message);
  }
}

function createTemplate(ctx) {
  return `
<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lambda</title>
</head>
<body style="margin: 0; padding: 0">
  <iframe
    src="https://www.facebook.com/plugins/page.php?href=https://facebook.com/${ctx.page}&tabs=timeline&width=${ctx.width}&height=${ctx.height}&locale=cs_CZ"
    width="${ctx.width}"
    height="${ctx.height}"
    style="border:none;overflow:hidden"
    scrolling="no"
    frameborder="0"
  ></iframe>
</body>
</html>
`;
};

export async function createImage(chromeOptions, browserOptions = {}) {
  let content = null;
  let browser = null;
  let page = null;

  try {
    browser = await createBrowser(browserOptions);
    page = await browser.newPage();
    await page.setContent(chromeOptions.content);

    if (chromeOptions.wait) {
      await page.waitForTimeout(chromeOptions.wait);
    }

    content = await page.screenshot();
  } catch (error) {
    throw error;
  } finally {
    if (page !== null) {
      await page.close();
    }
    if (browser !== null) {
      await browser.close();
    }
  }

  if (Buffer.isBuffer(content)) {
    return content;
  } else {
    return Buffer.from(content);
  }
}

async function createBrowser(args = {}) {
  const defaults = {
    defaultViewport: {
      deviceScaleFactor: 1,
      width: 1280,
      height: 640,
    },
    ignoreHTTPSErrors: true,
  };
  let options = {};

  if (isDev()) {
    options = {
      ...defaults,
      ...args,
      ...{
        args: [],
        executablePath: lookupChrome(),
        headless: true,
      }
    };
  } else {
    options = {
      ...defaults,
      ...args,
      ...{
        args: chromeAws.args,
        executablePath: await chromeAws.executablePath,
        headless: chromeAws.headless,
      }
    };
  }

  return await chromeAws.puppeteer.launch(options);
}

function lookupChrome() {
  if (process.platform === 'win32') {
    return 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
  }

  if (process.platform === 'darwin') {
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  }

  return 'google-chrome';
}

function isDev() {
  return process.env.NOW_REGION === undefined || process.env.NOW_REGION === 'dev1';
}
