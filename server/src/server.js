const dotenv = require("dotenv");
const app = require("./app");
const { connectDB } = require("./config/db");

dotenv.config();

const PORT = Number(process.env.PORT || 5000);

async function bootstrap() {
  try {
    await connectDB(process.env.MONGODB_URI);
    app.listen(PORT, () => {
      console.log(`TrustCircle server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

bootstrap();
