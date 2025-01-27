const express = require("express");
const config = require("./src/config");
const jwt = require("jsonwebtoken");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs").promises;
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = 1234;

// Enable CORS middleware
app.use(cors());

// Fungsi untuk membaca token langsung dari file
async function readTokenFromFile() {
  const tokenPath = path.join(__dirname, "src", ".moneylovercli"); // Sesuaikan path
  try {
    const data = await fs.readFile(tokenPath, "utf8");
    const { jwtToken } = JSON.parse(data);
    return jwtToken;
  } catch (error) {
    console.error("Gagal membaca token dari file:", error);
    return null;
  }
}

// Fungsi untuk memeriksa apakah token sudah expired
function isTokenExpired(token) {
  try {
    // Decode token tanpa verifikasi signature
    const decoded = jwt.decode(token);

    if (!decoded || !decoded.exp) {
      return true; // Token tidak valid atau tidak memiliki field exp
    }

    // Bandingkan waktu kedaluwarsa dengan waktu saat ini
    const currentTime = Math.floor(Date.now() / 1000); // Waktu saat ini dalam detik
    return decoded.exp < currentTime; // Token expired jika exp < currentTime
  } catch (error) {
    console.error("Error decoding token:", error);
    return true; // Anggap token expired jika terjadi error
  }
}

// Fungsi untuk menjalankan perintah login
function runLoginCommand() {
  return new Promise((resolve, reject) => {
    // Ambil nilai dari environment variables
    const email = process.env.EMAIL;
    const password = process.env.PASSWORD;

    // Jalankan perintah CLI untuk login dengan variabel environment
    exec(
      `node ./src/index.js login ${email} ${password}`,
      (error, stdout, stderr) => {
        if (error) {
          console.error("Error running login command:", error);
          reject(error);
        } else {
          console.log("Login command output:", stdout);
          resolve(stdout);
        }
      }
    );
  });
}

// Fungsi untuk menjalankan perintah logout
function runLogoutCommand() {
  return new Promise((resolve, reject) => {
    // Jalankan perintah CLI untuk login
    exec("node ./src/index.js logout", (error, stdout, stderr) => {
      if (error) {
        console.error("Error running login command:", error);
        reject(error);
      } else {
        console.log("Login command output:", stdout);
        resolve(stdout);
      }
    });
  });
}

app.get("/token", async (req, res) => {
  try {
    let token = await readTokenFromFile(); // Baca dari file, bukan config.get

    if (!token) {
      console.log("Token tidak ditemukan. Menjalankan login...");
      await runLoginCommand();
      token = await readTokenFromFile(); // Baca ulang dari file
    }

    if (!token) {
      return res.status(404).json({
        success: false,
        message: "Token masih tidak ditemukan setelah login.",
      });
    }

    if (isTokenExpired(token)) {
      console.log("Token expired. Memperbarui...");
      await runLogoutCommand();
      await runLoginCommand();
      token = await readTokenFromFile(); // Baca ulang dari file
    }

    res.json({ success: true, token });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.listen(PORT, () => {
  console.log(`API berjalan di http://localhost:${PORT}`);
});
