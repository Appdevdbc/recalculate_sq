import * as ftp from "basic-ftp";
import * as dotenv from "dotenv";
import * as fs from "fs";
import { fileURLToPath } from "url";
import path from "path";
import mime from "mime-types";
import { unlink } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
export const uploadFile = async (filename) => {
  const client = new ftp.Client();
  client.ftp.verbose = true;
  try {
    await client.access({
      host: process.env.FTP_HOST,
      user: process.env.FTP_USER,
      password: process.env.FTP_PASS,
      port: process.env.FTP_PORT,
    });
    await client.uploadFrom(`./file/${filename}`, `psak73/${filename}`);
  } catch (error) {
    throw error;
  }
  client.close()
};


export const removeFile = async (filename) => {
    const client = new ftp.Client();
    client.ftp.verbose = true;
    try {
      await client.access({
        host: process.env.FTP_HOST,
        user: process.env.FTP_USER,
        password: process.env.FTP_PASS,
        port: process.env.FTP_PORT,
      });
      await client.remove(`psak73/${filename}`);
    } catch (error) {
      throw error;

    }
    client.close()
  };

  export const uploadFileWithParams = async (filename, path) => {
    const client = new ftp.Client();
    client.ftp.verbose = true;
    try {
      await client.access({
        host: process.env.FTP_HOST,
        user: process.env.FTP_USER,
        password: process.env.FTP_PASS,
        port: process.env.FTP_PORT,
      });
      await client.uploadFrom(`./file/${filename}`, `${path}/${filename}`);
    } catch (error) {
      throw error;
    }
    client.close()
  };
  
  
  export const removeFileWithParams = async (filename, path) => {
    const client = new ftp.Client();
    client.ftp.verbose = true;
    try {
      await client.access({
        host: process.env.FTP_HOST,
        user: process.env.FTP_USER,
        password: process.env.FTP_PASS,
        port: process.env.FTP_PORT,
      });
      await client.remove(`${path}/${filename}`);
    } catch (error) {
      throw error;
    }
    client.close()
  };

  export const downloadFileWithParams = async (filename, ftpPath) => {
    const client = new ftp.Client();
    client.ftp.verbose = true;

    try {
      const downloadDir = path.join(__dirname, '../file');
      if (!fs.existsSync(downloadDir)) {
        fs.mkdirSync(downloadDir, { recursive: true });
      }

      await client.access({
        host: process.env.FTP_HOST,
        user: process.env.FTP_USER,
        password: process.env.FTP_PASS,
        port: Number(process.env.FTP_PORT),
      });

      await client.downloadTo(`${downloadDir}/${filename}`, `${ftpPath}/${filename}`);
      const filePath = path.join(__dirname, `../file/${filename}`);
      const buffer = fs.readFileSync(filePath);
      const mimeType = mime.lookup(filePath);
      const originalName = path.basename(filePath); 
      unlink(`file/${filename}`, (err) => {
          if (err) return res.status(406).json({ message: 'Gagal download file, silahkan hubungi Tim IT' });
      });

      const result = {
        buffer,
        mimeType,
        originalName,
      }
      return result;
    } catch (error) {
      throw error;
    } finally {
      client.close();
    }
  };
  