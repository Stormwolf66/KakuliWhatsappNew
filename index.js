import { createApi } from "unsplash-js";
import fetch from "node-fetch"; 
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const unsplash = createApi({
  accessKey: process.env.UNSPLASH_ACCESS_KEY,
  fetch: fetch,
});

// Function to download image from URL and save locally
async function downloadImage(url, filepath) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);

  const buffer = await response.buffer();
  fs.writeFileSync(filepath, buffer);
  console.log(`Image saved to ${filepath}`);
}

async function searchAndTrackDownload(query) {
  try {
    const result = await unsplash.search.getPhotos({ query, perPage: 1 });

    if (result.type === "success" && result.response.results.length > 0) {
      const firstPhoto = result.response.results[0];

      const imageUrl = firstPhoto.urls.regular;
      console.log("Image URL:", imageUrl);

      // Download the image locally
      await downloadImage(imageUrl, "./downloaded-image.jpg");

      // Track the download event (important for Unsplash API compliance)
      await unsplash.photos.trackDownload({
        downloadLocation: firstPhoto.links.download_location,
      });

      console.log("Download tracked successfully.");
    } else {
      console.log("No photos found for query:", query);
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

// Run the function with your search query
searchAndTrackDownload("dogs");
