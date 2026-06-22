#!/usr/bin/env node
/**
 * Usage: node generate-image.mjs "prompt text" output-filename.png [width] [height]
 * Requires: GEMINI_API_KEY environment variable
 */

import fs from "fs";
import path from "path";
import https from "https";

const [, , prompt, outputFile = "generated.png", width = "1024", height = "1024"] = process.argv;

if (!prompt) {
  console.error("Usage: node generate-image.mjs \"prompt\" output.png [width] [height]");
  process.exit(1);
}

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("Error: GEMINI_API_KEY environment variable not set");
  process.exit(1);
}

async function generateImage() {
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
  });

  const options = {
    hostname: "generativelanguage.googleapis.com",
    path: `/v1beta/models/gemini-3.1-flash-image:generateContent?key=${apiKey}`,
    method: "POST",
    headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          const parts = json?.candidates?.[0]?.content?.parts ?? [];
          const imagePart = parts.find((p) => p.inlineData?.mimeType?.startsWith("image/"));
          if (!imagePart) {
            console.error("No image in response:", JSON.stringify(json, null, 2));
            process.exit(1);
          }
          const buffer = Buffer.from(imagePart.inlineData.data, "base64");
          const outPath = path.resolve(outputFile);
          fs.writeFileSync(outPath, buffer);
          console.log(`Image saved: ${outPath}`);
          resolve(outPath);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

generateImage().catch((e) => { console.error(e); process.exit(1); });
