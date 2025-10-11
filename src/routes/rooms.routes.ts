import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import {
  postDirectRoom,
  listRooms,
  createGroupRoom,
} from "../controllers/rooms.controller";

const router = Router();

router.use(requireAuth);

router.post("/direct", postDirectRoom);
router.get("/", listRooms);
router.post("/", createGroupRoom);

export default router;
