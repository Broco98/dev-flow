import express from "express";
import { getUsers } from "./users.js";

const app = express();
app.get("/users", getUsers);

export default app;
