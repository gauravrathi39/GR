import { createApp } from "./app";
import { connectDatabase } from "./config/db";
import { env } from "./config/env";

async function start(): Promise<void> {
  try {
    await connectDatabase();
  } catch (err: any) {
    if (env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.warn("⚠️ Local MongoDB connection failed. Attempting to start in-memory MongoDB server...");
      try {
        const { MongoMemoryServer } = await import("mongodb-memory-server");
        const mongod = await MongoMemoryServer.create();
        const memoryUri = mongod.getUri();
        // eslint-disable-next-line no-console
        console.log(`✅ Started in-memory MongoDB server`);
        await connectDatabase(memoryUri);
      } catch (innerErr: any) {
        // eslint-disable-next-line no-console
        console.error("Failed to start in-memory MongoDB server:", innerErr);
        throw err;
      }
    } else {
      throw err;
    }
  }
  const app = createApp();
  app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`🚀 API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start server:", err);
  process.exit(1);
});

