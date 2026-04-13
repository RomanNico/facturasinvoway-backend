import { procesarExcel } from "../services/excel.service.js";
import { sincronizarFacturas } from "../services/db.service.js";
import { pool } from "../config/db.js";
import { enviarAlertaMasiva } from "../config/mailer.js";
import { obtenerInfoDestinatario } from "../config/usuarios.js";
import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";

// Subir Excel + sincronizar + enviar correos automáticos
export const uploadExcel = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No se subió archivo" });
        }

        const facturas = await procesarExcel(req.file.path);
        const resultado = await sincronizarFacturas(facturas);

        // Responder primero para evitar timeout en el frontend
        res.json({
            message: "Procesado correctamente 🚀. Enviando alertas en 2do plano...",
            total_excel: resultado.total,
            nuevas: resultado.nuevas,
            aprobadas: resultado.eliminadas,
            correos_enviados: -1,
            correos_error: 0
        });

        // 📧 Auto-envío de correos por responsable en SEGUNDO PLANO
        (async () => {
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
                    if (responsable === "Sin Responsable") continue; 

                    // 1. 🚫 Excluir área de facturación
                    if (responsable.toLowerCase().includes("facturacion") || responsable.toLowerCase().includes("facturación")) {
                        console.log(`⏭️ Omitiendo envío para área de facturación: ${responsable}`);
                        continue;
                    }

                    try {
                        // 2. 📧 Obtener mapping de correo y Cc
                        const destinatario = obtenerInfoDestinatario(responsable);

                        await enviarAlertaMasiva(responsable, facturasResp, destinatario);
                        correosEnviados++;
                        console.log(`📧 Correo enviado: ${responsable} (${facturasResp.length} facturas)`);
                        
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    } catch (emailError) {
                        correosError++;
                        console.error(`❌ Error enviando correo a ${responsable}:`, emailError.message);
                    }
                }

                console.log(`📧 Resumen 2do plano: ${correosEnviados} correos enviados, ${correosError} errores`);

            } catch (emailGlobalError) {
                console.error("❌ Error en envío masivo de correos:", emailGlobalError.message);
            }
        })();

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

// Generar Excel del Dashboard
export const descargarExcel = async (req, res) => {
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
                CASE 
                    WHEN CURRENT_DATE - fecha_entrada <= 1 THEN 'Verde'
                    WHEN CURRENT_DATE - fecha_entrada <= 2 THEN 'Amarillo'
                    ELSE 'Crítico'
                END AS estado
            FROM facturas
            ORDER BY fecha_entrada DESC;
        `);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Facturas Invo-way");

        // 1. Logo y Título
        const logoPath = path.join(process.cwd(), "src", "assets", "logo.png");
        
        if (fs.existsSync(logoPath)) {
            const logoId = workbook.addImage({
                filename: logoPath,
                extension: 'png',
            });
            worksheet.addImage(logoId, {
                tl: { col: 0.1, row: 0.1 },
                ext: { width: 120, height: 35 }
            });
        }

        worksheet.mergeCells("A1:H1");
        const titleCell = worksheet.getCell("A1");
        titleCell.value = "REPORTE OFICIAL - CONTROL FACTURACIÓN INVO-WAY";
        titleCell.font = { name: "Arial", size: 16, bold: true, color: { argb: "FF1E293B" } };
        titleCell.alignment = { horizontal: "center", vertical: "middle" };

        worksheet.mergeCells("A2:H2");
        const dateCell = worksheet.getCell("A2");
        
        // Formatear fecha y hora en zona horaria de Colombia
        const now = new Date();
        const colombiaTime = now.toLocaleString("es-CO", {
            timeZone: "America/Bogota",
            hour12: true,
            year: "numeric",
            month: "numeric",
            day: "numeric",
            hour: "numeric",
            minute: "numeric",
            second: "numeric"
        });

        dateCell.value = `Generado el: ${colombiaTime}`;
        dateCell.font = { name: "Arial", size: 10, italic: true };
        dateCell.alignment = { horizontal: "center" };

        worksheet.addRow([]); // Espacio

        // 2. Cabeceras
        const headerRow = worksheet.addRow([
            "Documento",
            "ID SAP",
            "Proveedor",
            "Responsable",
            "Fecha Alta",
            "Fecha Entrada",
            "Días Proceso",
            "Estado"
        ]);

        headerRow.eachCell((cell) => {
            cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FF1E293B" }
            };
            cell.alignment = { horizontal: "center" };
            cell.border = {
                top: { style: "thin" },
                left: { style: "thin" },
                bottom: { style: "thin" },
                right: { style: "thin" }
            };
        });

        // 3. Datos
        result.rows.forEach(f => {
            const row = worksheet.addRow([
                f.documento,
                f.identificador,
                f.proveedor,
                f.responsable,
                f.fecha_alta ? new Date(f.fecha_alta).toLocaleDateString("es-CO") : "—",
                f.fecha_entrada ? new Date(f.fecha_entrada).toLocaleDateString("es-CO") : "—",
                f.dias_proceso,
                f.estado
            ]);

            // Estilo condicional para la columna Estado (columna 8)
            const estadoCell = row.getCell(8);
            if (f.estado === "Verde") estadoCell.font = { color: { argb: "FF059669" }, bold: true };
            if (f.estado === "Amarillo") estadoCell.font = { color: { argb: "FFD97706" }, bold: true };
            if (f.estado === "Crítico") estadoCell.font = { color: { argb: "FFDC2626" }, bold: true };
        });

        // Ajustar anchos
        worksheet.columns.forEach(column => {
            column.width = 20;
        });

        // 4. Enviar archivo
        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
            "Content-Disposition",
            "attachment; filename=Reporte_InvoWay.xlsx"
        );

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error("❌ Error generando Excel:", error);
        res.status(500).json({ error: "No se pudo generar el archivo Excel" });
    }
};