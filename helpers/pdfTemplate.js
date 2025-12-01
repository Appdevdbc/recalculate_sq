import pdf from "pdf-creator-node";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import ejs from "ejs";

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const pdfPUMPerjalananDinas = async (data) => {
  try {
    // Timestamp untuk nama file
    const now = new Date();
    const timestamp = [
      now.getHours(),
      now.getMinutes(),
      now.getSeconds(),
      now.getDate(),
      now.getMonth() + 1,
      now.getFullYear(),
    ]
      .map((val) => String(val).padStart(2, "0"))
      .join("");

    const fileName = `pum_perjalanan_dinas_karyawan_${timestamp}.pdf`;
    const outputPath = path.join(__dirname, '../file', fileName);

    const logoPath = path.join(__dirname, "../template/logo-dbc.png");
    const logoBuffer = fs.readFileSync(logoPath);
    const logoBase64 = `data:image/png;base64,${logoBuffer.toString("base64")}`;

    const ejsTemplate = fs.readFileSync(path.join(__dirname, '../template/PUM_perjalananDinas.ejs'), 'utf8');

    // Render EJS jadi HTML murni
    const html = ejs.render(ejsTemplate, {
      ...data,
      logo: logoBase64,
    });

    // Konfigurasi PDF
    const options = {
      format: "A4",
      orientation: "landscape",
    };

    // Konfigurasi dokumen PDF
    const document = {
      html,
      data: {
        ...data,
        logo: logoBase64,
      },
      path: outputPath, // Simpan PDF ke file outputPath
      additionalJsContext: {
        inject: async (date) => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, "0");
          return `${year} - ${month}`;
        },
        date: () => {
          const monthNames = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December",
          ];
          return `${now.getDate()} ${monthNames[now.getMonth()]} ${now.getFullYear()}`;
        },
      },
      type: "buffer", // Return the PDF as buffer instead of saving it
    };

    // Generate dan simpan PDF
    const buffer = await pdf.create(document, options);

    // Mengembalikan buffer PDF
    return { data: buffer, path: outputPath.replace("file/", "") };
  } catch (error) {
    console.error("PDF generation error:", error);
    throw error;
  }
};

export const pdfPUMNonPerjalananDinasAP = async (data) => {
  try {
    // Timestamp untuk nama file
    const now = new Date();
    const timestamp = [
      now.getHours(),
      now.getMinutes(),
      now.getSeconds(),
      now.getDate(),
      now.getMonth() + 1,
      now.getFullYear(),
    ]
      .map((val) => String(val).padStart(2, "0"))
      .join("");

    const fileName = `pum_non_perjalanan_dinas_${timestamp}.pdf`;
    const outputPath = path.join(__dirname, '../file', fileName);

    const logoPath = path.join(__dirname, "../template/logo-dbc.png");
    const logoBuffer = fs.readFileSync(logoPath);
    const logoBase64 = `data:image/png;base64,${logoBuffer.toString("base64")}`;
    // Pastikan template HTML ada
    const html = fs.readFileSync(path.join(__dirname, '../template/PUM_nonPerjalananDinasiAP.html'), 'utf8');

    // Konfigurasi PDF
    const options = {
      format: "A4",
      orientation: "landscape",
    };

    // Konfigurasi dokumen PDF
    const document = {
      html,
      data: {
        ...data,
        logo: logoBase64,
      },
      path: outputPath, // Simpan PDF ke file outputPath
      additionalJsContext: {
        inject: async (date) => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, "0");
          return `${year} - ${month}`;
        },
        date: () => {
          const monthNames = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December",
          ];
          return `${now.getDate()} ${monthNames[now.getMonth()]} ${now.getFullYear()}`;
        },
      },
      type: "buffer", // Return the PDF as buffer instead of saving it
    };

    // Generate dan simpan PDF
    const buffer = await pdf.create(document, options);

    // Mengembalikan buffer PDF
    return { data: buffer, path: outputPath.replace("file/", "") };
  } catch (error) {
    console.error("PDF generation error:", error);
    throw error;
  }
};

export default {
  pdfPUMPerjalananDinas, pdfPUMNonPerjalananDinasAP
};