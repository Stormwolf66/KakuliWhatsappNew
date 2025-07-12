import fetch from "node-fetch";
import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const GEMINI_IMAGE_API_KEY = process.env.GEMINI_API_KEY2;

/**
 * Handles the !kakuli command: generates an AI image and sends it
 * @param {object} client - Baileys WhatsApp client
 * @param {object} msg - WhatsApp message object
 * @param {string} prompt - image generation prompt
 */
export async function handleKakuliCommand(client, msg, prompt) {
  if (!prompt) {
    await client.sendMessage(msg.key.remoteJid, {
      text: "❌ Please provide a description after !kakuli command.",
    });
    return;
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${GEMINI_IMAGE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
          },
        }),
      }
    );

    const data = await res.json();

    const parts = data?.candidates?.[0]?.content?.parts || [];

    const imagePart = parts.find(p => p.inlineData?.data);
    if (!imagePart) {
      await client.sendMessage(msg.key.remoteJid, {
        text: "❌ No image could be generated. Try a different prompt.",
      });
      return;
    }

    const buffer = Buffer.from(imagePart.inlineData.data, "base64");
    const imagePath = path.resolve("kakuli-gemini.png");
    await fs.writeFile(imagePath, buffer);

    await client.sendMessage(msg.key.remoteJid, {
      image: { url: imagePath },
      caption: "Your loving girl Kakuli's AI-crafted image ❤️",
    });

    // Optionally delete image after sending
    await fs.unlink(imagePath);

  } catch (error) {
    console.error("Kakuli error:", error);
    await client.sendMessage(msg.key.remoteJid, {
      text: "❌ Kakuli Failed.",
    });
  }
}
