import { pool } from "../config/db.js";

export const sincronizarFacturas = async (facturas) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        let procesadas = 0;
        let nuevas = 0;

        // 📌 Documentos del Excel
        const documentosExcel = facturas.map(f => f.documento);

        // 📋 Obtener documentos actuales en la BD antes de la sincronización
        const actualesResult = await client.query("SELECT documento FROM facturas");
        const documentosAnteriores = actualesResult.rows.map(r => r.documento);

        // 🗑 Eliminar facturas que ya no vienen en el Excel (= aprobadas)
        let eliminadas = 0;
        let documentosEliminados = [];

        if (documentosExcel.length > 0) {
            // Primero obtener cuáles se van a eliminar
            const toDeleteResult = await client.query(
                `SELECT documento, proveedor, responsable FROM facturas 
                 WHERE documento NOT IN (${documentosExcel.map((_, i) => `$${i + 1}`).join(",")})`,
                documentosExcel
            );
            documentosEliminados = toDeleteResult.rows;

            const deleteResult = await client.query(
                `DELETE FROM facturas 
                 WHERE documento NOT IN (${documentosExcel.map((_, i) => `$${i + 1}`).join(",")})`,
                documentosExcel
            );
            eliminadas = deleteResult.rowCount;
        }

        // 🔄 Insertar / actualizar facturas
        for (const f of facturas) {
            // Verificar si es nueva
            const esNueva = !documentosAnteriores.includes(f.documento);
            if (esNueva) nuevas++;

            const fechaAltaFinal = f.fecha_alta;
            const fechaEntradaFinal = f.fecha_entrada;

            await client.query(
                `INSERT INTO facturas 
                (documento, identificador, proveedor, responsable, fecha_alta, fecha_entrada)
                VALUES ($1,$2,$3,$4,$5,$6)
                ON CONFLICT (documento) DO UPDATE SET
                    identificador = EXCLUDED.identificador,
                    proveedor = EXCLUDED.proveedor,
                    responsable = EXCLUDED.responsable`,
                [
                    f.documento,
                    f.identificador,
                    f.proveedor,
                    f.responsable,
                    fechaAltaFinal,
                    fechaEntradaFinal
                ]
            );

            procesadas++;
        }

        await client.query("COMMIT");

        console.log(`✅ Procesadas: ${procesadas} | 🆕 Nuevas: ${nuevas} | 🗑 Aprobadas/Eliminadas: ${eliminadas}`);

        return {
            total: facturas.length,
            procesadas,
            nuevas,
            eliminadas,
            documentosEliminados
        };

    } catch (error) {
        await client.query("ROLLBACK");
        console.error("❌ Error en sincronización:", error);
        throw error;
    } finally {
        client.release();
    }
};