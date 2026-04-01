import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import facturasRoutes from "./routes/facturas.routes.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/facturas", facturasRoutes);

app.get("/", (req, res) => {
    res.send("API funcionando 🚀");
});

app.get("/test", (req, res) => {
    res.send("TEST OK");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});