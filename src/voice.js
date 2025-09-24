import fetch from "node-fetch";
import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";
import ffmpeg from "fluent-ffmpeg";
import { PassThrough } from "stream";

dotenv.config();

const GEMINI_TTS_API_KEY = process.env.GEMINI_API_KEY3;
const MODEL_ID = "gemini-2.5-flash-preview-tts";
const GENERATE_CONTENT_API = "streamGenerateContent";

// Allowed voices
const allowedVoices = [
  "Achernar", "Achird", "Algenib", "Algieba", "Alnilam", "Aoede", "Autonoe",
  "Callirrhoe", "Charon", "Despina", "Enceladus", "Erinome", "Fenrir", "Gacrux",
  "Iapetus", "Kore", "Laomedeia", "Leda", "Orus", "Pulcherrima", "Puck", "Rasalgethi",
  "Sadachbia", "Sadaltager", "Schedar", "Sulafat", "Umbriel", "Vindemiatrix", "Zephyr", "Zubenelgenubi"
];

// Split long text into chunks for TTS
function splitText(text, maxLength = 300) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    chunks.push(text.slice(start, start + maxLength));
    start += maxLength;
  }
  return chunks;
}

async function generateTTS(text, voiceName, filename = "kakuli-tts.mp3") {
  const textChunks = splitText(text);
  const pcmBuffers = [];

  for (const chunk of textChunks) {
    const payload = {
      contents: [{ role: "user", text: chunk }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } }
      }
    };

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:${GENERATE_CONTENT_API}?key=${GEMINI_TTS_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }
      );

      const data = await res.json();

      // Check candidates properly
      const candidates = data?.candidates ?? [];
      for (const cand of candidates) {
        const parts = cand?.content?.[0]?.parts ?? [];
        const audioPart = parts.find(p => p?.inlineData?.data);
        if (audioPart) {
          pcmBuffers.push(Buffer.from(audioPart.inlineData.data, "base64"));
        }
      }

    } catch (err) {
      console.error("TTS generation error:", err);
    }
  }

  if (pcmBuffers.length === 0) return null;

  const finalPCM = Buffer.concat(pcmBuffers);
  const pass = new PassThrough();
  pass.end(finalPCM);

  const audioPath = path.resolve(filename);

  await new Promise((resolve, reject) => {
    ffmpeg(pass)
      .inputFormat("s16le")
      .inputOptions(['-ar 24000', '-ac 1'])
      .outputOptions(['-ar 24000'])
      .format("mp3")
      .on("end", () => resolve())
      .on("error", err => reject(err))
      .save(audioPath);
  });

  return audioPath;
}


// Handler for !voice command
export async function handleVoiceCommand(client, msg, args) {
  const input = args.join(" ");
  const [text, voiceName] = input.split(",").map(s => s.trim());

  // Validate input
  if (!text || !voiceName) {
    await client.sendMessage(msg.key.remoteJid, {
      text: "❌ Usage: !voice Your text here,VoiceName\nExample: !voice Hello,Orus"
    });
    return;
  }

  if (text.length > 500) {
    await client.sendMessage(msg.key.remoteJid, {
      text: "❌ Text exceeds 500 character limit."
    });
    return;
  }

  if (!allowedVoices.includes(voiceName)) {
    await client.sendMessage(msg.key.remoteJid, {
      text: `❌ No voice available with that name.\nAvailable voices: ${allowedVoices.join(", ")}`
    });
    return;
  }

  try {
    const audioPath = await generateTTS(text, voiceName, `voice-${Date.now()}.mp3`);
    if (!audioPath) throw new Error("No audio generated.");

    // Send audio to user
    await client.sendMessage(msg.key.remoteJid, {
      audio: { url: audioPath },
      mimetype: "audio/mpeg"
    });

    // Delete temp file
    await fs.unlink(audioPath);
  } catch (err) {
    console.error("Voice command error:", err);
    await client.sendMessage(msg.key.remoteJid, { text: "❌ Failed to generate voice." });
  }
}
