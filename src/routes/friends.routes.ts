import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import {
  requestFriend,
  listFriends,
  acceptFriend,
  declineFriend,
} from "../controllers/friends.controller";

const router = Router();
router.use(requireAuth);

router.post("/friends/request", requestFriend);
router.post("/friends/accept", acceptFriend);
router.get("/friends", listFriends);
router.post("/friends/decline", declineFriend);

export default router;
