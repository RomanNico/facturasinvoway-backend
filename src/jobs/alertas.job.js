import cron from "node-cron";
import { enviarAlerta } from "../config/mailer.js";

export const iniciarJobAlertas = (facturas) => {
    cron.schedule("0 * * * *", async () => {
        console.log("⏰ Ejecutando revisión de alertas...");

        for (const factura of facturas) {
            if (factura.estado === "rojo") {
                await enviarAlerta(factura);
            }
        }
    });
};