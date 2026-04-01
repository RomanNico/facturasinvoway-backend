import { procesarExcel } from "../services/excel.service.js";
import { sincronizarFacturas } from "../services/db.service.js";
import { pool } from "../config/db.js";
import { enviarAlertaMasiva } from "../config/mailer.js";

// Subir Excel + sincronizar + enviar correos automáticos
export const uploadExcel = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No se subió archivo" });
        }

        const facturas = await procesarExcel(req.file.path);
        const resultado = await sincronizarFacturas(facturas);

        // 📧 Auto-envío de correos por responsable
        let correosEnviados = 0;
        let correosError = 0;

        try {
            // Obtener facturas actualizadas con estado calculado
            const result = await pool.query(`
                SELECT 
                    documento,
                    proveedor,
                    responsable,
                    fecha_entrada,
                    CURRENT_DATE - fecha_entrada AS dias_proceso,
                    CASE 
                        WHEN CURRENT_DATE - fecha_entrada <= 1 THEN 'verde'
                        WHEN CURRENT_DATE - fecha_entrada <= 2 THEN 'amarillo'
                        ELSE 'rojo'
                    END AS estado
                FROM facturas
                ORDER BY responsable, fecha_entrada DESC
            `);

            // Agrupar por responsable
            const porResponsable = {};
            for (const f of result.rows) {
                const resp = f.responsable ? f.responsable.trim() : "Sin Responsable";
                if (!porResponsable[resp]) {
                    porResponsable[resp] = [];
                }
                porResponsable[resp].push(f);
            }

            // Enviar correo a cada responsable
            for (const [responsable, facturasResp] of Object.entries(porResponsable)) {
                if (responsable === "Sin Responsable") continue; // Saltamos vacíos
                try {
                    await enviarAlertaMasiva(responsable, facturasResp);
                    correosEnviados++;
                    console.log(`📧 Correo enviado: ${responsable} (${facturasResp.length} facturas)`);
                    // Delay de 1 segundo para evitar límite de tasa del servidor SMTP
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (emailError) {
                    correosError++;
                    console.error(`❌ Error enviando correo a ${responsable}:`, emailError.message);
                }
            }

            console.log(`📧 Resumen: ${correosEnviados} correos enviados, ${correosError} errores`);

        } catch (emailGlobalError) {
            console.error("❌ Error en envío masivo de correos:", emailGlobalError.message);
        }

        res.json({
            message: "Procesado correctamente 🚀",
            total_excel: resultado.total,
            nuevas: resultado.nuevas,
            aprobadas: resultado.eliminadas,
            correos_enviados: correosEnviados,
            correos_error: correosError
        });

    } catch (error) {
        console.error("❌ ERROR upload:", error);
        res.status(500).json({ error: "Error procesando Excel" });
    }
};

// Obtener facturas
export const getFacturas = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                documento,
                identificador,
                proveedor,
                responsable,
                fecha_alta,
                fecha_entrada,
                CURRENT_DATE - fecha_entrada AS dias_proceso,
                CURRENT_DATE - fecha_alta AS dias_alta,
                CASE 
                    WHEN CURRENT_DATE - fecha_entrada <= 1 THEN 'verde'
                    WHEN CURRENT_DATE - fecha_entrada <= 2 THEN 'amarillo'
                    ELSE 'rojo'
                END AS estado
            FROM facturas
            ORDER BY fecha_entrada DESC;
        `);

        res.json(result.rows);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error obteniendo facturas" });
    }
};

// Eliminar factura (se mantiene por si se necesita desde otro lado)
export const eliminarFactura = async (req, res) => {
    try {
        const { documento } = req.params;

        await pool.query(
            "DELETE FROM facturas WHERE documento = $1",
            [documento]
        );

        res.json({ message: "Factura aprobada ✅" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error eliminando factura" });
    }
};

// Enviar facturas por responsable (se mantiene como endpoint manual)
export const enviarFacturasResponsable = async (req, res) => {
    try {
        const { responsable } = req.body;

        const result = await pool.query(`
            SELECT 
                documento,
                proveedor,
                fecha_entrada,
                CURRENT_DATE - fecha_entrada AS dias_proceso,
                CASE 
                    WHEN CURRENT_DATE - fecha_entrada <= 1 THEN 'verde'
                    WHEN CURRENT_DATE - fecha_entrada <= 2 THEN 'amarillo'
                    ELSE 'rojo'
                END AS estado
            FROM facturas
            WHERE responsable = $1
        `, [responsable]);

        const facturas = result.rows;

        if (facturas.length === 0) {
            return res.json({ message: "No hay facturas para este responsable" });
        }

        await enviarAlertaMasiva(responsable, facturas);

        res.json({ message: "Correo enviado 🚀" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error enviando correo" });
    }
};