
const router = require("express").Router();
const c = require("../controllers/bookingController");
const { protect } = require("../middleware/auth");

router.post("/", protect, c.create);
router.get("/mine", protect, c.mine);

// Các route dành cho Local.
router.get("/local", protect, c.localMine);
router.patch("/:id/local-status", protect, c.updateLocalStatus);

module.exports = router;
