import express from "express";
import loggerMiddleware from "./middleware/logger.middleware.js";
import errorMiddleware from "./middleware/error.middleware.js";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";

const app = express();

app.use(express.json());
app.use(loggerMiddleware);

app.get("/", (req, res) => {
  res.send("ClipSphere API running");
});

app.use("/auth", authRoutes);
app.use("/users", userRoutes);

// errorMiddleware must be last
app.use(errorMiddleware);

export default app;