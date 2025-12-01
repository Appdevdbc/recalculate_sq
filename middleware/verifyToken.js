import dotenv from "dotenv";  
dotenv.config();  
import jwt from "jsonwebtoken";  
import { dbHris, db } from "../config/db.js";  
  
export const cekToken = async (req, res, next) => {  
  try {  
    const check = await db("dbPortalFA.dbo.throw_mstr")  
      .where("throw_method", req.method)  
      .where("throw_path", req.path)  
      .count({ row: "throw_method" });  
  
    if (check[0].row > 0) {  
      return next();  
    } else {  
      let token;  

      if (req.headers['accept'] === 'text/event-stream') {   
        token = req.query.token;
      } else {  
        token = req.headers.authorization.split(' ')[1];  
      }  
  
      if (token) {  
        const decoded = jwt.verify(token, process.env.TOKEN);  
        const response = await dbHris("ptl_hris")  
          .where("Emp_Id", decoded.user)  
          .where("user_active", "Active")  
          .count({ row: "Emp_Id" });  
  
        if (response[0].row > 0) {  
          return next();  
        } else {  
          return res.status(401).json({ message: "Token sudah tidak sesuai atau expired", decoded });  
        }  
      } else {  
        return res.status(401).json({ message: "Invalid Token" });  
      }  
    }  
  } catch (error) {  
    console.error("Error in cekToken middleware:", error); // Log the error  
    return res.status(402).json({ message: "Token sudah tidak sesuai atau expired" });  
  }  
};  
 
