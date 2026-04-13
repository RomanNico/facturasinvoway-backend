import axios from "axios";

const MAILER_URL = process.env.MAILER_URL;
const MAILER_API_KEY = process.env.MAILER_API_KEY;

// 📧 Correo de pruebas (cambiar por correos reales de responsables)
const TEST_EMAIL = "jefreynicolasromanpalacios@gmail.com";

export const enviarAlertaMasiva = async (responsable, facturas, destinatario = null) => {

    const total = facturas.length;
    const rojas = facturas.filter(f => f.estado === "rojo").length;
    const amarillas = facturas.filter(f => f.estado === "amarillo").length;
    const verdes = facturas.filter(f => f.estado === "verde").length;

    const hoy = new Date().toLocaleDateString("es-CO", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    });

    // 🔥 Construir filas de la tabla
    const filas = facturas.map(f => {
        let bgColor = "#d1fae5";
        let textColor = "#065f46";
        let estadoLabel = "EN TIEMPO";
        
        if (f.estado === "amarillo") {
            bgColor = "#fef3c7";
            textColor = "#92400e";
            estadoLabel = "PRECAUCIÓN";
        }
        if (f.estado === "rojo") {
            bgColor = "#fee2e2";
            textColor = "#991b1b";
            estadoLabel = "CRÍTICO";
        }

        const fechaEntrada = f.fecha_entrada 
            ? new Date(f.fecha_entrada).toLocaleDateString("es-CO") 
            : "—";

        return `
            <tr>
                <td style="padding: 10px 14px; border-bottom: 1px solid #e5e7eb; font-family: 'Courier New', monospace; font-size: 13px; color: #1f2937;">${f.documento}</td>
                <td style="padding: 10px 14px; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #374151;">${f.proveedor}</td>
                <td style="padding: 10px 14px; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #6b7280; text-align: center;">${fechaEntrada}</td>
                <td style="padding: 10px 14px; border-bottom: 1px solid #e5e7eb; font-size: 13px; font-weight: 700; text-align: center; color: ${f.dias_proceso > 2 ? '#dc2626' : '#1f2937'};">${f.dias_proceso}</td>
                <td style="padding: 10px 14px; border-bottom: 1px solid #e5e7eb; text-align: center;">
                    <span style="display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; background: ${bgColor}; color: ${textColor};">
                        ${estadoLabel}
                    </span>
                </td>
            </tr>
        `;
    }).join("");

    // NOTA DE PRUEBA (Para saber a quién iría el correo en producción)
    let testInfo = "";
    if (destinatario) {
        testInfo = `
        <div style="background: #eff6ff; border: 1px solid #3b82f6; color: #1e40af; padding: 16px; margin-bottom: 24px; border-radius: 8px; font-size: 13px; line-height: 1.5;">
            <div style="font-weight: 800; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
                🧪 MODO DE PRUEBA ACTIVO
            </div>
            En producción, este correo se enviaría automáticamente a: <br/>
            <span style="display: inline-block; margin-top: 6px;">
                <strong>Para (To):</strong> <code style="background: #dbeafe; padding: 2px 4px; border-radius: 4px;">${destinatario.email}</code> <br/>
                <strong>Copia (Cc):</strong> <code style="background: #dbeafe; padding: 2px 4px; border-radius: 4px;">${destinatario.cc && destinatario.cc.length > 0 ? destinatario.cc.join(", ") : "Ninguno"}</code>
            </span>
        </div>
        `;
    } else {
        testInfo = `
        <div style="background: #fff7ed; border: 1px solid #fb923c; color: #9a3412; padding: 16px; margin-bottom: 24px; border-radius: 8px; font-size: 13px; line-height: 1.5;">
            <div style="font-weight: 800; margin-bottom: 4px;">
                ⚠️ USUARIO NO MAPEADO
            </div>
            El responsable <strong>"${responsable}"</strong> no fue encontrado en el diccionario de usuarios. <br/>
            En producción, este correo <strong>NO se enviaría</strong> o requeriría intervención manual.
        </div>
        `;
    }

    const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 700px; margin: 0 auto; background: #ffffff;">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 28px 32px; border-radius: 8px 8px 0 0;">
            <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                    <td>
                        <img src="https://www.comware.com.co/wp-content/uploads/logo-blanco.png" alt="Comware" height="30" style="margin-bottom: 16px; display: block;" />
                        <h1 style="margin: 0; font-size: 20px; color: #ffffff; font-weight: 700;">
                            ⚠️ ALERTA DE FACTURACIÓN
                        </h1>
                        <p style="margin: 4px 0 0 0; font-size: 12px; color: #94a3b8; letter-spacing: 0.05em;">
                            SISTEMA DE CONTROL INVO-WAY · ${hoy.toUpperCase()}
                        </p>
                    </td>
                    <td style="text-align: right; vertical-align: bottom;">
                        <span style="display: inline-block; background: #dc2626; color: white; padding: 6px 14px; border-radius: 999px; font-size: 12px; font-weight: 700;">
                            🔴 ACCIÓN REQUERIDA
                        </span>
                    </td>
                </tr>
            </table>
        </div>

        <!-- Body -->
        <div style="padding: 24px 32px;">
            
            ${testInfo}

            <!-- Urgency Banner -->
            <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 16px 24px; margin: 0 0 24px 0;">
                <p style="margin: 0; font-size: 14px; color: #991b1b; font-weight: 600;">
                    ⏰ TIEMPO LÍMITE: Máximo <strong>48 horas</strong> para la aprobación de las facturas listadas a continuación.
                </p>
            </div>

            <p style="font-size: 14px; color: #374151; line-height: 1.6; margin: 0 0 16px 0;">
                Estimado(a) <strong>${responsable}</strong>,
            </p>

            <p style="font-size: 14px; color: #374151; line-height: 1.6; margin: 0 0 16px 0;">
                Le informamos que a la fecha usted tiene <strong style="color: #dc2626; font-size: 16px;">${total} factura${total !== 1 ? 's' : ''} de INVO-WAY</strong> pendiente${total !== 1 ? 's' : ''} de aprobación en el sistema. 
                Es <strong>imperativo</strong> que gestione la aprobación de las mismas dentro del plazo establecido de <strong>48 horas</strong>.
            </p>

            <!-- KPIs -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
                <tr>
                    <td style="padding: 4px;">
                        <div style="background: #fee2e2; border-radius: 8px; padding: 14px 16px; text-align: center;">
                            <div style="font-size: 24px; font-weight: 800; color: #dc2626;">${rojas}</div>
                            <div style="font-size: 11px; color: #991b1b; font-weight: 600; text-transform: uppercase;">Críticas</div>
                        </div>
                    </td>
                    <td style="padding: 4px;">
                        <div style="background: #fef3c7; border-radius: 8px; padding: 14px 16px; text-align: center;">
                            <div style="font-size: 24px; font-weight: 800; color: #d97706;">${amarillas}</div>
                            <div style="font-size: 11px; color: #92400e; font-weight: 600; text-transform: uppercase;">Precaución</div>
                        </div>
                    </td>
                    <td style="padding: 4px;">
                        <div style="background: #d1fae5; border-radius: 8px; padding: 14px 16px; text-align: center;">
                            <div style="font-size: 24px; font-weight: 800; color: #059669;">${verdes}</div>
                            <div style="font-size: 11px; color: #065f46; font-weight: 600; text-transform: uppercase;">En tiempo</div>
                        </div>
                    </td>
                </tr>
            </table>

            <!-- Tabla de facturas -->
            <h3 style="font-size: 14px; color: #1f2937; margin: 24px 0 12px 0; font-weight: 700;">
                📋 Detalle de facturas pendientes:
            </h3>

            <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                <thead>
                    <tr style="background: #1e293b;">
                        <th style="padding: 10px 14px; text-align: left; font-size: 11px; font-weight: 700; color: #e2e8f0; text-transform: uppercase; letter-spacing: 0.05em;">Documento</th>
                        <th style="padding: 10px 14px; text-align: left; font-size: 11px; font-weight: 700; color: #e2e8f0; text-transform: uppercase; letter-spacing: 0.05em;">Proveedor</th>
                        <th style="padding: 10px 14px; text-align: center; font-size: 11px; font-weight: 700; color: #e2e8f0; text-transform: uppercase; letter-spacing: 0.05em;">Fecha Entrada</th>
                        <th style="padding: 10px 14px; text-align: center; font-size: 11px; font-weight: 700; color: #e2e8f0; text-transform: uppercase; letter-spacing: 0.05em;">Días</th>
                        <th style="padding: 10px 14px; text-align: center; font-size: 11px; font-weight: 700; color: #e2e8f0; text-transform: uppercase; letter-spacing: 0.05em;">Estado</th>
                    </tr>
                </thead>
                <tbody>
                    ${filas}
                </tbody>
            </table>

            <!-- Warning -->
            <div style="background: #fffbeb; border: 1px solid #fbbf24; border-radius: 8px; padding: 14px 18px; margin: 24px 0 16px 0;">
                <p style="margin: 0; font-size: 13px; color: #92400e; font-weight: 600;">
                    ⚠️ IMPORTANTE: Las facturas con estado <strong style="color: #dc2626;">CRÍTICO</strong> ya han superado el plazo máximo de gestión. 
                    Se solicita su atención inmediata para evitar impactos en la operación.
                </p>
            </div>

            <!-- Lineamientos -->
            <div style="background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 8px; padding: 16px; margin: 24px 0 16px 0;">
                <h4 style="margin: 0 0 10px 0; font-size: 14px; color: #1f2937;">📌 Lineamientos y Plazos:</h4>
                <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #374151; line-height: 1.6;">
                    <li>El único correo autorizado para la radicación de facturas es <strong>radicacionfacturaelectronica@comware.com.co</strong>.</li>
                    <li>Él plazo máximo para la aprobación de facturas es de <strong>48 horas</strong>, con el fin de evitar inconvenientes con la DIAN.</li>
                </ul>
            </div>

            <!-- CTA Button -->
            <div style="text-align: center; margin: 30px 0;">
                <a href="https://pro.invoway.com/cliente?COMWARE" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 24px; border-radius: 6px;">
                    Aprobar ahora
                </a>
            </div>

            <p style="font-size: 13px; color: #374151; margin: 20px 0 0 0;">
                Atentamente,<br/>
                <strong>Sistema de Control de Facturación Invo-way</strong>
            </p>
        </div>

        <div style="background: #f8fafc; border-top: 1px solid #e5e7eb; padding: 16px 32px; border-radius: 0 0 8px 8px;">
            <p style="margin: 0; font-size: 11px; color: #9ca3af; text-align: center;">
                © ${new Date().getFullYear()} Comware · Sistema de Control de Facturación
            </p>
        </div>
    </div>
    `;

    const data = {
        Subject: `🚨 URGENTE: ${total} factura${total !== 1 ? 's' : ''} pendiente${total !== 1 ? 's' : ''} de aprobación — ${responsable}`,
        Template: {
            Type: "text/html",
            Value: html,
        },
        Recipients: [
            {
                To: TEST_EMAIL // TODO: Cambiar por destinatario.email en producción
            }
        ],
    };

    try {
        await axios.post(`${MAILER_URL}/api/mailer/delivery`, data, {
            headers: {
                "Content-Type": "application/json",
                "x-api-key": MAILER_API_KEY,
            },
        });
        console.log(`📧 Correo enviado para ${responsable} (Prueba -> ${TEST_EMAIL})`);
    } catch (error) {
        console.error(`❌ Error Mailer: ${error.message}`);
        throw error;
    }
};