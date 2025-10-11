import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { searchUsers } from "../controllers/users.controller";

const router = Router();

router.use(requireAuth);
router.get("/users/search", searchUsers);

export default router;
