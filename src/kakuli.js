import { createApi } from "unsplash-js";
import fetch from "node-fetch";

// Create Unsplash API client
const unsplash = createApi({
  accessKey: process.env.UNSPLASH_ACCESS_KEY,
  fetch: fetch,
});

/**
 * Handles the !kakuli command: searches Unsplash and sends first image
 * @param {object} client - Baileys WhatsApp client
 * @param {object} msg - WhatsApp message object
 * @param {string} prompt - search prompt from user
 */
export async function handleKakuliCommand(client, msg, prompt) {
  if (!prompt) {
    await client.sendMessage(msg.key.remoteJid, {
      text: "❌ Please provide a search prompt after !kakuli command.",
    });
    return;
  }

  try {
    const result = await unsplash.search.getPhotos({ query: prompt, perPage: 1 });

    if (result.type !== "success" || result.response.results.length === 0) {
      await client.sendMessage(msg.key.remoteJid, {
        text: `❌ No images found for "${prompt}".`,
      });
      return;
    }

    const firstPhoto = result.response.results[0];
    const imageUrl = firstPhoto.urls.regular;

    // Send the image with custom caption
    await client.sendMessage(msg.key.remoteJid, {
      image: { url: imageUrl },
      caption: "Your loving girl Kakuli's image ❤️",
    });

    // Optional: track download to comply with Unsplash policy
    await unsplash.photos.trackDownload({
      downloadLocation: firstPhoto.links.download_location,
    });

  } catch (error) {
    console.error("Kakuli error:", error);
    await client.sendMessage(msg.key.remoteJid, {
      text: "❌ Error searching images. Please try again later.",
    });
  }
}
