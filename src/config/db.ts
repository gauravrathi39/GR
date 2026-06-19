import mongoose from "mongoose";
import { env } from "./env";

/**
 * Connects to MongoDB. Called once at startup. Mongoose buffers queries until
 * the connection is ready, so callers don't need to await this per-request.
 */
export async function connectDatabase(uri: string = env.MONGODB_URI): Promise<void> {
  mongoose.set("strictQuery", true);

  mongoose.connection.on("connected", () => {
    // eslint-disable-next-line no-console
    console.log("✅ MongoDB connected");
  });
  mongoose.connection.on("error", (err) => {
    // eslint-disable-next-line no-console
    console.error("MongoDB connection error:", err.message);
  });

  await mongoose.connect(uri);
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
