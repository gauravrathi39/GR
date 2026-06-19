import type { Request, Response } from "express";
import * as trips from "../services/trip.service";
import { asyncHandler } from "../utils/asyncHandler";

export const list = asyncHandler(async (req: Request, res: Response) => {
  const data = await trips.listTrips(req.userId as string);
  res.json({ trips: data });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const trip = await trips.createTrip(req.userId as string, req.body);
  res.status(201).json({ trip });
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const trip = await trips.getTrip(req.userId as string, req.params.id);
  res.json({ trip });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await trips.deleteTrip(req.userId as string, req.params.id);
  res.status(204).send();
});

export const addActivity = asyncHandler(async (req: Request, res: Response) => {
  const trip = await trips.addActivity(req.userId as string, req.params.id, req.body);
  res.status(201).json({ trip });
});

export const removeActivity = asyncHandler(async (req: Request, res: Response) => {
  const trip = await trips.removeActivity(
    req.userId as string,
    req.params.id,
    Number(req.params.day),
    req.params.activityId
  );
  res.json({ trip });
});

export const regenerateDay = asyncHandler(async (req: Request, res: Response) => {
  const trip = await trips.regenerateDay(
    req.userId as string,
    req.params.id,
    req.body.day,
    req.body.instruction
  );
  res.json({ trip });
});

export const chat = asyncHandler(async (req: Request, res: Response) => {
  const { trip, assistantMessage } = await trips.chatEditTrip(
    req.userId as string,
    req.params.id,
    req.body.message
  );
  res.json({ trip, assistantMessage });
});
