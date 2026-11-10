const mongoose = require("mongoose");
const UploadedFile = require("../models/UploadedFile");

exports.getMedia = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.sendStatus(404);
    const file = await UploadedFile.findById(req.params.id).select("contentType data");
    if (!file) return res.sendStatus(404);
    res.set("X-Content-Type-Options", "nosniff");
    res.type(file.contentType).send(file.data);
  } catch (error) {
    next(error);
  }
};
