const mongoose = require('mongoose');
const path = require('path');
const logger = require('../server/util/signale');
const { fetchAndGetJSON } = require('../server/util/utils');
const { buildMongoUri, describeMongoTarget } = require('../server/util/mongoUri');

// This is the main function that will run our job.
// Using a top-level async function is the best practice for managing the script's lifecycle.
async function runJob() {
  // We declare the connection variable here so it's accessible in the finally block.
  let connection;

  try {
    mongoose.set('strictQuery', true);

    const MONGO_URI = buildMongoUri({ directConnection: true });
    logger.info(`[Bree Job] Creating new isolated connection to: ${describeMongoTarget()}`);

    // --- Core Solution: Use createConnection for an isolated connection ---
    // This does not use or interfere with the global Mongoose singleton that your main app uses.
    // .asPromise() is used to make it work seamlessly with async/await.
    connection = await mongoose.createConnection(MONGO_URI, {
      autoIndex: false
    }).asPromise();

    logger.info('[Bree Job] Mongoose isolated connection successful!');

    // --- Crucial Step: Register your model on the new connection ---
    // We require the schema from your model file and build the model specifically for this connection.
    const { Planning: GlobalPlanning } = require('../server/models/planning');
    const Planning = connection.model('Planning', GlobalPlanning.schema);

    // --- Your original job logic starts here ---
    const num = await Planning.countDocuments();
    logger.info('Number of plannings: ' + num);

    if (num === 0) {
      logger.warn('No plannings found to update. Exiting job.');
      // The finally block will handle the disconnection.
      return;
    }

    const startTime = performance.now();

    // Here we fetch all the plannings
    for await (const p of Planning.find({})) {
      try {
        const allEvents = await fetchAndGetJSON(p.url);
        if (allEvents?.length) {
          p.timestamp = new Date();
          p.backup = allEvents;
          await p.save();
        }
        // Wait 600ms between requests to be polite to the remote server.
        await new Promise(resolve => setTimeout(resolve, 600));
      } catch (fetchError) {
        logger.error(`Failed to fetch or process planning for URL: ${p.url}`, fetchError);
        // Continue to the next planning even if one fails.
      }
    }

    const endTime = performance.now();
    logger.info(`Took ${(endTime - startTime) / 1000} seconds`);
    logger.success(`Finished backing up ${num} plannings`);

  } catch (error) {
    // This will catch errors from connection, querying, or any other part of the job.
    logger.error('[Bree Job] A critical error occurred:', error);
    process.exit(1); // Exit with an error code to signal failure to Bree.
  } finally {
    // --- Guaranteed Cleanup ---
    // This block will always run, whether the job succeeded or failed.
    if (connection) {
      await connection.close();
      logger.info('[Bree Job] Isolated connection closed.');
    }
    // Explicitly exit with success code. This tells Bree the job is done.
    process.exit(0);
  }
}

// Start the job execution.
runJob();
