import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import crypto from "crypto";
import soap from "strong-soap";
import * as dotenv from 'dotenv' ;
import nodemailer from "nodemailer";
import CryptoJS from 'crypto-js';

dotenv.config();
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);


export const getWSA = async (url, name, args) => {
  const soapWsa = soap.soap;
  return new Promise((resolve, reject) => {
    var options = {};
    soapWsa.createClient(url, options, function (err, client) {
      var method = client[name];
      method(args, function (err, result, envelope, soapHeader) {
        resolve(result);
      });
    });
  });
};

export const formatDateTime = (datetime) => {
  if (!datetime) {
    return null;
  }
  return dayjs(datetime).tz("UTC").format("YYYY-MM-DD HH:mm:ss");
};


export const formatDateTimeCustom = (datetime,format_old,format_new) => {
  if (!datetime) {
    return null;
  }
  return dayjs(datetime,`${format_old}`).format(`${format_new}`);
};

export const formatDate = (datetime) => {
  return dayjs(datetime).tz("UTC").format("YYYY-MM-DD");
};

export const formatBulan = (index) => {
  const bulan = ["Januari", "Februari", "Maret","April","Mei",
  "Juni","Juli","Agustus","September","Oktober","November","Desember"];
  
  return bulan[index-1];
};

export const sendMail = async (data) => {
  try {
    const transporter = nodemailer.createTransport({
      port: 587,
      host: data.host,
      auth: {
        user: data.sender,
        pass: data.pass,
      },
      secure: false,
    });
    let mailData = [];
    let bcc = data.bcc;
    if (bcc !== 'undefined'){
      mailData = {
        from: data.from,
        to: data.to,
        subject: data.subject,
        bcc:data.bcc,
        html: data.html,
      };
    }else{
      mailData = {
        from: data.from,
        to: data.to,
        subject: data.subject,
        html: data.html,
      };
    }
    
    await transporter.sendMail(mailData);
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const mySimpleCrypt = async (tobe) => {
  
    const secretKey = 'Djabesmen2018';
    //creating hash object 
    var hash = crypto.createHash('sha256');
    //passing the data to be hashed
    let dataKey = hash.update(secretKey, 'utf-8');
    //Creating the hash in the required format
    let basedKey= dataKey.digest('hex');
    let aesKey = basedKey.substring(0,32);
    let aesIv = basedKey.substring(0,16);

    const cipher = crypto.createCipheriv('aes-256-cbc', aesKey, aesIv);
    var encrypted = cipher.update(tobe, 'utf-8', 'base64');
    encrypted += cipher.final('base64');
    encrypted = Buffer.from(encrypted, 'utf-8').toString('base64');
     
    return encrypted;
};

export const encryptString = async (autonumber, idAtasan, domain, modul ) => {
  return btoa(autonumber + "," + idAtasan + "," + domain + "," + modul);
}

export const encrypt = (text, iv) => {
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(secretKey, 'utf8'), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return { iv: iv.toString('hex'), encryptedData: encrypted };
}

export const decrypt = (encryptedData, iv) => {
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(secretKey, 'utf8'), Buffer.from(iv, 'hex'));
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export const useEncrypt = (text) => {
  const secretKey = process.env.VITE_SC;
  const iv = process.env.VITE_IV;

  if (!secretKey || !iv) {
    throw new Error("Secret key or IV is not defined in environment variables.");
  }

  const key = CryptoJS.enc.Utf8.parse(secretKey);
  const ivWordArray = CryptoJS.enc.Utf8.parse(iv);
  const encrypted = CryptoJS.AES.encrypt(text, key, { iv: ivWordArray });

  return encodeURIComponent(encrypted);
}

export const getMonthName = (monthNumber) => {
  const monthNames = [
      "January",    
      "February",   
      "March",      
      "April",      
      "May",        
      "June",       
      "July",       
      "August",     
      "September",  
      "October", 
      "November",
      "December" 
  ];

  if (monthNumber < 1 || monthNumber > 12) {
      return "Invalid month number";
  }

  return monthNames[monthNumber - 1];
}

export const roundToTwoDecimalPlaces = (num) => {  
  if(typeof num === 'number'){
    const shiftedNum = num * 100;  
    const integerPart = Math.floor(shiftedNum);    
    const decimalPart = shiftedNum - integerPart;  
    
    const thirdDecimalPlace = Math.floor(decimalPart * 10);
    
    if (thirdDecimalPlace > 5) {  
        return (integerPart + 1) / 100;  
    } else {  
        return integerPart / 100;  
    }
  } else {
    return num;
  }  
}  

export const getRandomDarkColor=()=> {
  const getRandomValue = () => Math.floor(Math.random() * 128); // Values from 0 to 127
  const r = getRandomValue();
  const g = getRandomValue();
  const b = getRandomValue();
  
  // Convert to hexadecimal and pad with zeroes if necessary
  const toHex = (value) => value.toString(16).padStart(2, '0');
  
  const color = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  
  return color;
}

export const DMYtoYMD = (value) => {
  if (value){
    const data= value.split('-');
    return `${data[2]}-${data[1]}-${data[0]}`;
  }else {
    return null
  }
};

export const isValidDateDDMMYYY = (dateString) => {
  return dayjs(dateString, 'DD-MM-YYYY', true).isValid();
};
export const setRequest = (value) => {
  return value != null && value != '' ? value:null ;
};

export const isValidDateFormat = (dateString,dateFormat) => {
  return dayjs(dateString, dateFormat, true).isValid();
};

export const DMYHMtoYMDHM = (excelDate) => {
  if (!excelDate) return null;
  
  const date = new Date(excelDate);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export const validateIsNumber = (value) => {
  if (value == null) return false;
  if (/^-?\d+(\.\d+)?$/.test(value.toString())) {
    return true;
  }else{
    return false;
  }
}

export const roundValue = (value) => {
  const num = parseFloat(value ?? 0);
  const trimmed = Math.floor(num * 1000) / 1000; 
  const rounded = Math.round(trimmed * 100) / 100;

  return rounded.toFixed(2);
};

export const terbilang = (angka) => {
  var bilne=["","satu","dua","tiga","empat","lima","enam","tujuh","delapan","sembilan","sepuluh","sebelas"];
  if(angka < 12){
    return bilne[angka];
  }else if(angka < 20){
    return terbilang(angka-10)+" belas";
  }else if(angka < 100){
    return terbilang(Math.floor(parseInt(angka)/10))+" puluh "+terbilang(parseInt(angka)%10);
  }else if(angka < 200){
    return "seratus "+terbilang(parseInt(angka)-100);
  }else if(angka < 1000){
    return terbilang(Math.floor(parseInt(angka)/100))+" ratus "+terbilang(parseInt(angka)%100);
  }else if(angka < 2000){
    return "seribu "+terbilang(parseInt(angka)-1000);
  }else if(angka < 1000000){
    return terbilang(Math.floor(parseInt(angka)/1000))+" ribu "+terbilang(parseInt(angka)%1000);
  }else if(angka < 1000000000){
    return terbilang(Math.floor(parseInt(angka)/1000000))+" juta "+terbilang(parseInt(angka)%1000000);
  }else if(angka < 1000000000000){
    return terbilang(Math.floor(parseInt(angka)/1000000000))+" milyar "+terbilang(parseInt(angka)%1000000000);
  }else if(angka < 1000000000000000){
    return terbilang(Math.floor(parseInt(angka)/1000000000000))+" trilyun "+terbilang(parseInt(angka)%1000000000000);
  }
}

export const capitalize = (str) => str.replace(/\b\w/g, c => c.toUpperCase());

export const formatRupiah = (value) => {
  if (value) {
    return new Intl.NumberFormat("de-ID").format(parseFloat(value));
  } else {
    return 0;
  }
};

export const formatRupiah2 = (value) => {
  if (value) {
    return new Intl.NumberFormat("en-US").format(parseFloat(value).toFixed(2));
  } else {
    return 0;
  }
};
