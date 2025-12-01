import {dbHris} from "../config/db.js";
import nodemailer from "nodemailer";
import * as dotenv from "dotenv";
dotenv.config();

export const sendMail = async (data) => {
	try {
		let mailSender = await dbHris("ptl_apps")
						.join("ptl_mail_sender", "ptl_mail_sender.id", "ptl_apps.apps_sender")
						.select("ms_name","ms_pass","ms_host","ms_name_alias")
						.where("apps_slug", process.env.APP_FLAG)
						.first();		
		if (!mailSender) {
			throw {
				message: "Data mail sender tidak tersedia",
			};
		}
		
		const transporter = nodemailer.createTransport({
			port: 587,
			host: mailSender.ms_host,
			auth: {
				user: mailSender.ms_name,
				pass: mailSender.ms_pass,
			},
			secure: false,
		});	
		
		let mailData;
        if (process.env.ENVIRONMENT == 'LOCAL'){
			mailData = {
				//from: data.from,
				from: `${process.env.APP_ALIAS} "LOCAL" <${mailSender.ms_name_alias}>`,
				to: data.to,
				cc: data.cc ? data.cc : "",
				// bcc: ["shendy.dewandaru@dbc.co.id", "riki@dbc.co.id"],
				bcc: ["shendy.dewandaru@dbc.co.id"],
				subject: data.subject,
				html: data.html,
			};
		}
		else if (process.env.ENVIRONMENT == 'DEV'){
			mailData = {
				//from: data.from,
				from: `${process.env.APP_ALIAS} "DEV" <${mailSender.ms_name_alias}>`,
				to: data.to,
				cc: data.cc ? data.cc : "",
				// bcc: ["shendy.dewandaru@dbc.co.id", "riki@dbc.co.id"],
				bcc: ["shendy.dewandaru@dbc.co.id"],
				subject: data.subject,
				html: data.html,
			};
		}
		else if (process.env.ENVIRONMENT == 'TEST'){
			mailData = {
				//from: data.from,
				from: `${process.env.APP_ALIAS} "TEST" <${mailSender.ms_name_alias}>`,
				to: data.to,
				cc: data.cc ? data.cc : "",
				// bcc: ["shendy.dewandaru@dbc.co.id", "riki@dbc.co.id"],
				bcc: ["shendy.dewandaru@dbc.co.id"],
				subject: data.subject,
				html: data.html,
			};
		}
		else {
			mailData = {
				//from: data.from,
				from: `${process.env.APP_ALIAS} <${mailSender.ms_name_alias}>`,
				to: data.to,
				cc: data.cc ? data.cc : "",
				// bcc: ["shendy.dewandaru@dbc.co.id", "riki@dbc.co.id"],
				bcc: ["shendy.dewandaru@dbc.co.id"],
				subject: data.subject,
				html: data.html,
			};
		}

		await transporter.sendMail(mailData);
	} catch (error) {
		throw error;
	}
};

export const sendMailNew = async (data) => {
	try {
		console.log(data.html)
		let mailSender = await dbHris("ptl_apps")
						.join("ptl_mail_sender", "ptl_mail_sender.id", "ptl_apps.apps_sender")
						.select("ms_name","ms_pass","ms_host","ms_name_alias")
						.where("apps_slug", process.env.APP_FLAG)
						.first();		
		if (!mailSender) {
			throw {
				message: "Data mail sender tidak tersedia",
			};
		}
		
		const transporter = nodemailer.createTransport({
			port: 587,
			host: mailSender.ms_host,
			auth: {
				user: mailSender.ms_name,
				pass: mailSender.ms_pass,
			},
			secure: false,
		});	
		
		let mailData;
		mailData = {
			//from: data.from,
			from: ['LOCAL', 'DEV', 'TEST'].includes(process.env.ENVIRONMENT) ? `${process.env.ENVIRONMENT} <${mailSender.ms_name_alias}>`
			: `<${mailSender.ms_name_alias}>`,
			to: data.to,
			cc: data.cc ? data.cc : "",
			// bcc: ["shendy.dewandaru@dbc.co.id"],
			bcc: ["faris@dbc.co.id", "nyimas.karina@dbc.co.id", "irfanfirdaus545@gmail.com"],
			subject: data.subject,
			html: data.html,
		};

		const info = await transporter.sendMail(mailData);

		console.log("Email terkirim");
		console.log("Message ID:", info.messageId);
		console.log("Server response:", info.response);

		return { success: true, messageId: info.messageId, response: info.response };
	} catch (error) {
		console.error(" Gagal mengirim email:", error.message || error);
		throw error;
	}
};