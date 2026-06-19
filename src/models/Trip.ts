import { Schema, model, Types, type Document, type Model } from "mongoose";

export type BudgetType = "Low" | "Medium" | "High";
export type HotelTier = "Budget" | "Mid-range" | "Luxury";
export type ChatRole = "user" | "assistant";

export interface IActivity {
  id: string;
  title: string;
  description: string;
  time?: string; // e.g. "Morning", "14:00"
  estimatedCost?: number; // in the trip currency
}

export interface IDayPlan {
  day: number;
  summary: string;
  activities: IActivity[];
}

export interface IBudget {
  flights: number;
  accommodation: number;
  food: number;
  activities: number;
  total: number;
  currency: string;
}

export interface IHotel {
  name: string;
  tier: HotelTier;
  pricePerNight: number;
  rating: number;
  description: string;
}

export interface IChatMessage {
  role: ChatRole;
  content: string;
  createdAt: Date;
}

export interface ITrip extends Document {
  userId: Types.ObjectId;
  destination: string;
  days: number;
  budgetType: BudgetType;
  interests: string[];
  itinerary: IDayPlan[];
  budget: IBudget;
  hotels: IHotel[];
  chatHistory: IChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const activitySchema = new Schema<IActivity>(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    time: { type: String },
    estimatedCost: { type: Number },
  },
  { _id: false }
);

const dayPlanSchema = new Schema<IDayPlan>(
  {
    day: { type: Number, required: true },
    summary: { type: String, default: "" },
    activities: { type: [activitySchema], default: [] },
  },
  { _id: false }
);

const budgetSchema = new Schema<IBudget>(
  {
    flights: { type: Number, default: 0 },
    accommodation: { type: Number, default: 0 },
    food: { type: Number, default: 0 },
    activities: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    currency: { type: String, default: "USD" },
  },
  { _id: false }
);

const hotelSchema = new Schema<IHotel>(
  {
    name: { type: String, required: true },
    tier: {
      type: String,
      enum: ["Budget", "Mid-range", "Luxury"],
      required: true,
    },
    pricePerNight: { type: Number, default: 0 },
    rating: { type: Number, default: 0 },
    description: { type: String, default: "" },
  },
  { _id: false }
);

const chatMessageSchema = new Schema<IChatMessage>(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const tripSchema = new Schema<ITrip>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true, // every query is scoped by owner; index makes that cheap
    },
    destination: { type: String, required: true, trim: true },
    days: { type: Number, required: true, min: 1, max: 30 },
    budgetType: {
      type: String,
      enum: ["Low", "Medium", "High"],
      required: true,
    },
    interests: { type: [String], default: [] },
    itinerary: { type: [dayPlanSchema], default: [] },
    budget: { type: budgetSchema, default: () => ({}) },
    hotels: { type: [hotelSchema], default: [] },
    chatHistory: { type: [chatMessageSchema], default: [] },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete (ret as Record<string, unknown>).__v;
        return ret;
      },
    },
  }
);

export const Trip: Model<ITrip> = model<ITrip>("Trip", tripSchema);
