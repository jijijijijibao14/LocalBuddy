const router = require("express").Router();
const { protect } = require("../middleware/auth");
const controller = require("../controllers/notificationController");

router.use(protect);
router.get("/", controller.listMine);
router.patch("/read-all", controller.markAllRead);
router.patch("/:id/read", controller.markRead);

module.exports = router;
