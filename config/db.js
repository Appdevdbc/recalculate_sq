import knex from "knex";
import { attachPaginate } from "knex-paginate";
import * as dotenv from 'dotenv' 
dotenv.config()
attachPaginate();

export const dbRecalculate = knex({
  client: "mssql",
  connection: {
    host: process.env.DB1_HOST,
    port: Number(process.env.DB1_PORT),
    user: process.env.DB1_USERNAME,
    password: process.env.DB1_PASSWORD,
    timezone: "Asia/Jakarta",
    options: {
      instanceName: process.env.DB1_INSTANCE,
      database: process.env.DB1_DATABASE,
      debug: {
        packet: false,
        payload: false,
        token: false,
        data: false,
      },
    },
  },
});

export const dbDBCNet = knex({
  client: "mssql",
  connection: {
    host: process.env.DB2_HOST,
    port: Number(process.env.DB2_PORT),
    user: process.env.DB2_USERNAME,
    password: process.env.DB2_PASSWORD,
    timezone: "Asia/Jakarta",
    options: {
      instanceName: process.env.DB2_INSTANCE,
      database: process.env.DB2_DATABASE,
      debug: {
        packet: false,
        payload: false,
        token: false,
        data: false,
      },
    },
  },
});