/**
 * VOD Uploader Service
 * Simplified version with no authentication requirements
 */

const fs = require("fs");
const path = require("path");

// Configuration - use a relative path for local development, container path for Docker
const isDocker = fs.existsSync("/.dockerenv");
const VOD_STORAGE_PATH =
  process.env.VOD_STORAGE_PATH ||
  (isDocker ? "/app/vod" : path.join(__dirname, "../../vod"));

/**
 * Simple VOD uploader service
 */
class VodUploader {
  /**
   * Initialize the VOD uploader service
   */
  constructor() {
    console.log(
      `VOD Uploader Service initialized with storage path: ${VOD_STORAGE_PATH}`
    );
    this.ensureStorageDirectory();
  }

  /**
   * Ensure the VOD storage directory exists
   */
  ensureStorageDirectory() {
    try {
      console.log(
        `Checking if VOD storage directory exists: ${VOD_STORAGE_PATH}`
      );
      console.log({ exists: fs.existsSync(VOD_STORAGE_PATH) });

      if (!fs.existsSync(VOD_STORAGE_PATH)) {
        console.log(`Creating VOD storage directory: ${VOD_STORAGE_PATH}`);
        fs.mkdirSync(VOD_STORAGE_PATH, { recursive: true });
        console.log(`Created VOD storage directory: ${VOD_STORAGE_PATH}`);
      } else {
        console.log(
          `VOD storage directory already exists: ${VOD_STORAGE_PATH}`
        );
      }
    } catch (error) {
      console.error(`Error creating VOD storage directory: ${error.message}`);
      console.error(error.stack);
    }
  }

  /**
   * Process a VOD file for a stream
   * @param {string} streamId - The ID of the stream
   * @param {string} filePath - The path to the VOD file
   */
  async processVod(streamId, filePath) {
    try {
      console.log(`Processing VOD for stream ${streamId}: ${filePath}`);

      // Create a directory for the stream
      const streamDir = path.join(VOD_STORAGE_PATH, streamId);
      console.log(`Creating stream directory: ${streamDir}`);

      if (!fs.existsSync(streamDir)) {
        fs.mkdirSync(streamDir, { recursive: true });
      }

      // In a real implementation, you would:
      // 1. Copy/move the VOD file to the stream directory
      // 2. Generate thumbnails
      // 3. Create HLS segments if needed
      // 4. Update metadata

      console.log(`VOD processing completed for stream ${streamId}`);
      return true;
    } catch (error) {
      console.error(`Error processing VOD: ${error.message}`);
      console.error(error.stack);
      return false;
    }
  }

  /**
   * Delete a VOD for a stream
   * @param {string} streamId - The ID of the stream
   */
  async deleteVod(streamId) {
    try {
      const streamDir = path.join(VOD_STORAGE_PATH, streamId);

      if (fs.existsSync(streamDir)) {
        fs.rmSync(streamDir, { recursive: true, force: true });
        console.log(`Deleted VOD for stream ${streamId}`);
      } else {
        console.log(`No VOD found for stream ${streamId}`);
      }

      return true;
    } catch (error) {
      console.error(`Error deleting VOD: ${error.message}`);
      console.error(error.stack);
      return false;
    }
  }
}

console.log({ xx: require.main });
// Create the module as a standalone script
if (require.main === module) {
  console.log("Running VOD Uploader as a standalone script");
  // If run directly (node vodUploader.js), do some initialization
  const uploader = new VodUploader();

  // Keep the process alive
  setInterval(() => {
    console.log("VOD Uploader is running...");
  }, 60000);
} else {
  // Export a singleton instance when required as a module
  module.exports = new VodUploader();
}
