const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const { cleanText, chunkText } = require("./src/utils/textProcessor");
const app = express();
app.use(cors());

// 📁 Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "uploads")); // folder where files will be stored
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + path.extname(file.originalname);
    cb(null, uniqueName);
  },
});

const upload = multer({ storage: storage });

// 🚀 Upload route
app.post("/upload", upload.any(), async (req, res) => {
  try {
    console.log("FILES:", req.files);
    console.log("BODY:", req.body);

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const filePath = req.files[0].path;

    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);

    const cleanedText = cleanText(data.text);
    const chunks = smartChunk(cleanedText); // smaller chunks for now

   res.json({
    message: "File processed successfully",
    totalChunks: chunks.length,
    sampleChunk: chunks[0],
    lastChunk: chunks[chunks.length - 1],
   });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Processing failed" });
  }
});

// 🌐 Start server
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
