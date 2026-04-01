import xlsx from "xlsx";
import fs from "fs";

export const procesarExcel = async (filePath) => {
    const workbook = xlsx.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    const raw = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    fs.unlinkSync(filePath);

    const rows = raw.slice(3);

    return rows.map((row, index) => {

        // FECHA ALTA (columna A)
        const fechaAltaRaw = row[0];

        let fechaAlta = null;

        if (fechaAltaRaw instanceof Date) {
            fechaAlta = fechaAltaRaw;
        } else if (typeof fechaAltaRaw === "number") {
            fechaAlta = new Date((fechaAltaRaw - 25569) * 86400 * 1000);
        } else if (typeof fechaAltaRaw === "string") {
            fechaAlta = new Date(fechaAltaRaw);
        }

        // FECHA ENTRADA UO (columna L)
        const fechaEntradaRaw = row[11];

        let fechaEntrada = null;

        if (fechaEntradaRaw instanceof Date) {
            fechaEntrada = fechaEntradaRaw;
        } else if (typeof fechaEntradaRaw === "number") {
            fechaEntrada = new Date((fechaEntradaRaw - 25569) * 86400 * 1000);
        } else if (typeof fechaEntradaRaw === "string") {
            fechaEntrada = new Date(fechaEntradaRaw);
        }

        if (!fechaEntrada || isNaN(fechaEntrada)) {
            console.log(`❌ Fila ${index + 4} - Fecha inválida:`, fechaEntradaRaw);
        }

        return {
            documento: row[2],
            identificador: row[4],
            proveedor: row[5],
            responsable: row[9],
            fecha_alta: fechaAlta,
            fecha_entrada: fechaEntrada
        };

    }).filter(f => f.documento && f.proveedor);
};