import { Router } from "express";
import * as trip from "../controllers/trip.controller";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  activityParamSchema,
  addActivitySchema,
  chatSchema,
  createTripSchema,
  regenerateDaySchema,
  tripIdParamSchema,
} from "../validation/schemas";

const router = Router();

// Every trip route requires authentication; controllers scope by req.userId.
router.use(requireAuth);

router.get("/", trip.list);
router.post("/", validate({ body: createTripSchema }), trip.create);
router.get("/:id", validate({ params: tripIdParamSchema }), trip.getOne);
router.delete("/:id", validate({ params: tripIdParamSchema }), trip.remove);

router.post(
  "/:id/activities",
  validate({ params: tripIdParamSchema, body: addActivitySchema }),
  trip.addActivity
);
router.delete(
  "/:id/days/:day/activities/:activityId",
  validate({ params: activityParamSchema }),
  trip.removeActivity
);
router.post(
  "/:id/regenerate-day",
  validate({ params: tripIdParamSchema, body: regenerateDaySchema }),
  trip.regenerateDay
);
router.post(
  "/:id/chat",
  validate({ params: tripIdParamSchema, body: chatSchema }),
  trip.chat
);

export default router;
