import { Router } from "express";
import { signin, signup, refresh, logout, me } from "../controllers/auth.controller";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

router.post("/signup", signup);
router.post("/signin", signin);
router.post("/refresh", refresh);
router.post("/logout", logout);

// protected
router.get("/me", requireAuth, me);

export default router;