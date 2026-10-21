
const router = require("express").Router();
const c = require("../controllers/buddyController");
const { protect } = require("../middleware/auth");

router.patch("/mine/availability", protect, c.updateAvailability);
router.get("/", c.list);
router.get("/:id", c.detail);

module.exports = router;
